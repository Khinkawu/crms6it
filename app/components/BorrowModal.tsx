"use client";

import React, { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { db, storage } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Product } from "../../types";
import { useAuth } from "../../context/AuthContext";

interface BorrowModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onSuccess: () => void;
}

const BorrowModal: React.FC<BorrowModalProps> = ({ isOpen, onClose, product, onSuccess }) => {
    const { user } = useAuth();
    const sigPad = useRef<SignatureCanvas>(null);

    const [formData, setFormData] = useState({
        room: "",
        phone: "",
        returnDate: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && sigPad.current) {
            sigPad.current.clear();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClear = () => {
        sigPad.current?.clear();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.room || !formData.phone || !formData.returnDate) {
            setError("Please fill in all fields.");
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

            // Convert DataURL to Blob
            const res = await fetch(signatureDataUrl);
            const blob = await res.blob();

            // Upload to Storage
            const filename = `signatures/borrow_${Date.now()}_${user?.uid}.png`;
            const storageRef = ref(storage, filename);
            await uploadBytes(storageRef, blob);
            const signatureUrl = await getDownloadURL(storageRef);

            // 2. Create Transaction
            await addDoc(collection(db, "transactions"), {
                type: "borrow",
                productId: product.id,
                productName: product.name,
                borrowerEmail: user?.email,
                borrowerName: user?.displayName || "Unknown",
                userRoom: formData.room,
                userPhone: formData.phone,
                borrowDate: serverTimestamp(),
                updatedAt: serverTimestamp(),
                returnDate: new Date(formData.returnDate),
                status: "active",
                signatureUrl: signatureUrl,
            });

            // 3. Update Product Status
            if (product.id) {
                const productRef = doc(db, "products", product.id);
                await updateDoc(productRef, {
                    status: "borrowed",
                });
            }

            // 4. Log Activity
            const { logActivity } = await import("../../utils/logger");
            await logActivity({
                action: 'borrow',
                productName: product.name,
                userName: user?.displayName || user?.email || "Unknown",
                imageUrl: product.imageUrl
            });

            onSuccess();
            onClose();

        } catch (err: any) {
            console.error("Error processing borrow:", err);
            setError("Failed to process request. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content - Liquid Glass Theme */}
            <div className="relative w-full max-w-md bg-[#0f172a]/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
                <div className="p-6">
                    <h2 className="text-2xl font-bold text-white mb-1">Borrow Item</h2>
                    <p className="text-white/60 text-sm mb-6">{product.name}</p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Borrower Info */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Borrower</label>
                            <div className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/80">
                                {user?.displayName || user?.email}
                            </div>
                        </div>

                        {/* Inputs Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Room / Dept</label>
                                <input
                                    type="text"
                                    name="room"
                                    value={formData.room}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                                    placeholder="e.g. 101"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Phone</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                                    placeholder="08x-xxx-xxxx"
                                />
                            </div>
                        </div>

                        {/* Return Date */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Expected Return</label>
                            <input
                                type="date"
                                name="returnDate"
                                value={formData.returnDate}
                                onChange={handleInputChange}
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500/50 transition-colors [color-scheme:dark]"
                            />
                        </div>

                        {/* Signature Pad */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Signature</label>
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                            <div className="w-full h-40 bg-white rounded-xl overflow-hidden cursor-crosshair touch-none border-2 border-transparent focus-within:border-cyan-500/50 transition-colors">
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
                                className="flex-1 py-3 rounded-xl bg-white/5 text-white font-medium hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Processing..." : "Confirm Borrow"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BorrowModal;