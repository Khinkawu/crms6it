"use client";

import React, { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { db, storage } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Product } from "../../types";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { logActivity } from "../../utils/logger";
import { incrementStats, decrementStats, updateStatsOnStatusChange } from "../../utils/aggregation";

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
        borrowerName: "",
        room: "",
        phone: "",
        returnDate: "",
        reason: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            if (sigPad.current) sigPad.current.clear();
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClear = () => {
        sigPad.current?.clear();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.borrowerName || !formData.room || !formData.phone || !formData.returnDate || !formData.reason) {
            setError("กรุณากรอกข้อมูลให้ครบถ้วน");
            return;
        }

        if (sigPad.current?.isEmpty()) {
            setError("กรุณาลงลายมือชื่อ");
            return;
        }

        // Availability Check
        const isBulk = product.type === 'bulk';
        const availableStock = isBulk ? (product.quantity || 0) - (product.borrowedCount || 0) : (product.status === 'available' ? 1 : 0);

        if (availableStock <= 0) {
            setError("สินค้าไม่พร้อมให้ใช้งาน");
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
                borrowerName: formData.borrowerName, // Use manual name
                recordedBy: user?.displayName || "Unknown", // Track who recorded it
                userRoom: formData.room,
                userPhone: formData.phone,
                reason: formData.reason,
                borrowDate: serverTimestamp(),
                updatedAt: serverTimestamp(),
                returnDate: new Date(formData.returnDate),
                status: "active",
                signatureUrl: signatureUrl,
            });

            // 3. Update Product Status
            if (product.id) {
                const productRef = doc(db, "products", product.id);
                if (isBulk) {
                    await updateDoc(productRef, {
                        borrowedCount: increment(1)
                    });

                    // Update Stats for Bulk
                    const oldBorrowed = product.borrowedCount || 0;
                    const totalQty = product.quantity || 0;

                    // If first item borrowed, increment 'borrowed' stat (counting SKUs with borrowed items)
                    if (oldBorrowed === 0) {
                        await incrementStats('borrowed');
                    }

                    // If it becomes unavailable (stock runs out)
                    const oldAvailable = totalQty - oldBorrowed > 0;
                    const newAvailable = totalQty - (oldBorrowed + 1) > 0;

                    if (oldAvailable && !newAvailable) {
                        await decrementStats('available');
                    }

                } else {
                    await updateDoc(productRef, {
                        status: "ไม่ว่าง", // borrowed
                    });

                    // Update Stats for Unique
                    await updateStatsOnStatusChange('available', 'borrowed');
                }
            }

            // 4. Log Activity with Signature
            await logActivity({
                action: 'borrow',
                productName: product.name,
                userName: formData.borrowerName, // Use borrower name for log
                details: `Borrowed by ${formData.borrowerName}. Reason: ${formData.reason} (Recorded by ${user?.displayName})`,
                imageUrl: product.imageUrl,
                signatureUrl: signatureUrl
            });

            toast.success("บันทึกข้อมูลเรียบร้อยแล้ว");
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error borrowing product:", error);
            setError("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
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

            {/* Modal Content - Clean SaaS Theme */}
            <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-soft-lg overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col overscroll-contain">
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <h2 className="text-2xl font-bold text-text mb-1">ยืมวัสดุ อุปกรณ์</h2>
                    <p className="text-text-secondary text-sm mb-6">{product.name}</p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Borrower Info */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">บัญชีผู้บันทึก</label>
                            <div className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-text text-sm opacity-70">
                                {user?.displayName || user?.email}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">ชื่อผู้ยืม</label>
                            <input
                                type="text"
                                name="borrowerName"
                                value={formData.borrowerName}
                                onChange={handleInputChange}
                                required
                                className="input-field"
                                placeholder="ระบุชื่อผู้ยืม"
                            />
                        </div>

                        {/* Inputs Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">ห้อง / แผนก</label>
                                <input
                                    type="text"
                                    name="room"
                                    value={formData.room}
                                    onChange={handleInputChange}
                                    required
                                    className="input-field"
                                    placeholder="เช่น 126 , ห้องลีลาวดี"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">เบอร์โทรศัพท์</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    required
                                    className="input-field"
                                    placeholder="08x-xxx-xxxx"
                                />
                            </div>
                        </div>

                        {/* Return Date */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">วันที่คาดว่าจะคืน</label>
                            <input
                                type="date"
                                name="returnDate"
                                value={formData.returnDate}
                                onChange={handleInputChange}
                                min={new Date().toISOString().split('T')[0]}
                                required
                                className="input-field dark:[color-scheme:dark]"
                            />
                        </div>

                        {/* Reason Field */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">เหตุผลในการยืม</label>
                            <textarea
                                name="reason"
                                value={formData.reason}
                                onChange={handleInputChange}
                                required
                                className="input-field resize-none h-20"
                                placeholder="ระบุเหตุผลในการยืม"
                            />
                        </div>

                        {/* Signature Pad */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">ลายเซ็นต์</label>
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="text-xs text-primary-start hover:text-primary-end transition-colors"
                                >
                                    ล้างลายเซ็นต์
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
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50"
                            >
                                {loading ? "กำลังบันทึก..." : "ยืนยันการยืม"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BorrowModal;
