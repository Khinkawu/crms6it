"use client";

import React, { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { db, storage } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Product } from "../../types";
import { useAuth } from "../../context/AuthContext";

interface RequisitionModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onSuccess: () => void;
}

const RequisitionModal: React.FC<RequisitionModalProps> = ({ isOpen, onClose, product, onSuccess }) => {
    const { user } = useAuth();
    const sigPad = useRef<SignatureCanvas>(null);

    const [quantity, setQuantity] = useState(1);
    const [formData, setFormData] = useState({
        room: "",
        position: "ครู", // Default
        reason: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isBulk = product.type === 'bulk';
    const availableStock = isBulk ? (product.quantity || 0) - (product.borrowedCount || 0) : 1;

    useEffect(() => {
        if (isOpen && sigPad.current) {
            sigPad.current.clear();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClear = () => {
        sigPad.current?.clear();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!formData.room) {
            setError("Please provide a room/location.");
            return;
        }

        if (!formData.reason) {
            setError("Please provide a reason for requisition.");
            return;
        }

        if (isBulk && (quantity <= 0 || quantity > availableStock)) {
            setError(`Invalid quantity. Max available: ${availableStock}`);
            return;
        }

        if (sigPad.current?.isEmpty()) {
            setError("Please provide a signature.");
            return;
        }

        setLoading(true);

        try {
            // 1. Upload Signature
            const signatureDataUrl = sigPad.current?.toDataURL("image/png");
            if (!signatureDataUrl) throw new Error("Failed to capture signature");

            const res = await fetch(signatureDataUrl);
            const blob = await res.blob();

            const filename = `signatures/req_${Date.now()}_${user?.uid}.png`;
            const storageRef = ref(storage, filename);
            await uploadBytes(storageRef, blob);
            const signatureUrl = await getDownloadURL(storageRef);

            // 2. Update Product Stock/Status
            const productRef = doc(db, "products", product.id!);

            if (isBulk) {
                await updateDoc(productRef, {
                    quantity: increment(-quantity),
                    status: (product.quantity || 0) - quantity <= 0 ? 'requisitioned' : 'available'
                });
            } else {
                await updateDoc(productRef, {
                    status: 'requisitioned'
                });
            }

            // 3. Create Transaction
            await addDoc(collection(db, "transactions"), {
                type: "requisition",
                productId: product.id,
                productName: product.name,
                requesterEmail: user?.email,
                requesterName: user?.displayName || "Unknown",
                position: formData.position,
                room: formData.room,
                reason: formData.reason,
                quantity: isBulk ? quantity : 1,
                signatureUrl: signatureUrl,
                timestamp: serverTimestamp(),
                status: "completed"
            });

            // 4. Log Activity
            const { logActivity } = await import("../../utils/logger");
            await logActivity({
                action: 'requisition',
                productName: product.name,
                userName: user?.displayName || user?.email || "Unknown",
                details: `${isBulk ? `Qty: ${quantity}` : ''} Reason: ${formData.reason}`,
                imageUrl: product.imageUrl
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error requisitioning item:", err);
            setError(err.message || "Failed to process requisition.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

            {/* Modal Content - Clean SaaS Theme */}
            <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-soft-lg overflow-hidden animate-fade-in-up">
                <div className="p-6">
                    <h2 className="text-2xl font-bold text-text mb-1">Requisition Item</h2>
                    <p className="text-text-secondary text-sm mb-6">{product.name}</p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Requester Info (Read Only) */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Requester</label>
                            <div className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-text">
                                {user?.displayName || user?.email}
                            </div>
                        </div>

                        {/* Position & Room Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Position</label>
                                <select
                                    name="position"
                                    value={formData.position}
                                    onChange={handleInputChange}
                                    className="input-field"
                                >
                                    <option value="ผู้บริหาร">ผู้บริหาร</option>
                                    <option value="ครู">ครู</option>
                                    <option value="ครู LS">ครู LS</option>
                                    <option value="บุคลากร">บุคลากร</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Room / Location</label>
                                <input
                                    type="text"
                                    name="room"
                                    value={formData.room}
                                    onChange={handleInputChange}
                                    required
                                    className="input-field"
                                    placeholder="e.g. 101"
                                />
                            </div>
                        </div>

                        {/* Reason Field */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Reason for Requisition</label>
                            <textarea
                                name="reason"
                                value={formData.reason}
                                onChange={handleInputChange}
                                required
                                className="input-field resize-none h-20"
                                placeholder="e.g. For classroom project..."
                            />
                        </div>

                        {/* Quantity (Bulk Only) */}
                        {isBulk && (
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                                    Quantity (Max: {availableStock})
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max={availableStock}
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                                    className="input-field"
                                />
                            </div>
                        )}

                        {/* Signature Pad */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Signature</label>
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="text-xs text-primary-start hover:text-primary-end transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                            <div className="w-full h-40 bg-white rounded-xl overflow-hidden cursor-crosshair touch-none border-2 border-border focus-within:border-primary-start transition-colors">
                                <SignatureCanvas
                                    ref={sigPad}
                                    penColor="black"
                                    canvasProps={{
                                        className: "w-full h-full"
                                    }}
                                    backgroundColor="white"
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {loading ? "Processing..." : "Confirm Requisition"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RequisitionModal;
