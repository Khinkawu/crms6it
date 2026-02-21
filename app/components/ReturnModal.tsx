"use client";

import React, { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { db, storage } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDocs, query, where, onSnapshot, deleteField } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Product } from "../../types";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { incrementStats, decrementStats, updateStatsOnStatusChange } from "../../utils/aggregation";
import { logActivity } from "../../utils/logger";

interface ReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onSuccess: () => void;
}

function formatBorrowDate(timestamp: any): string {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

const ReturnModal: React.FC<ReturnModalProps> = ({ isOpen, onClose, product, onSuccess }) => {
    const { user } = useAuth();
    const sigPad = useRef<SignatureCanvas>(null);

    const [formData, setFormData] = useState({
        returnerName: "",
        notes: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Bulk item: active borrows list & selection
    const [activeBorrows, setActiveBorrows] = useState<any[]>([]);
    const [selectedBorrowId, setSelectedBorrowId] = useState<string>("");

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            if (sigPad.current) sigPad.current.clear();
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Fetch active borrows for bulk items
    useEffect(() => {
        if (!isOpen || product.type !== 'bulk') return;

        const q = query(
            collection(db, "transactions"),
            where("type", "==", "borrow"),
            where("productId", "==", product.id),
            where("status", "==", "active")
        );
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort by borrowDate ascending (oldest first)
            list.sort((a: any, b: any) => {
                const aDate = a.borrowDate?.toDate?.() ?? new Date(0);
                const bDate = b.borrowDate?.toDate?.() ?? new Date(0);
                return aDate.getTime() - bDate.getTime();
            });
            setActiveBorrows(list);
            // Auto-select if only one borrower
            if (list.length === 1) setSelectedBorrowId(list[0].id);
        });
        return () => unsub();
    }, [isOpen, product]);

    // Auto-fill returner name when a borrow is selected
    useEffect(() => {
        if (selectedBorrowId && product.type === 'bulk') {
            const selected = activeBorrows.find((b: any) => b.id === selectedBorrowId);
            if (selected && !formData.returnerName) {
                setFormData(prev => ({ ...prev, returnerName: (selected as any).borrowerName || '' }));
            }
        }
    }, [selectedBorrowId]);

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

        if (!formData.returnerName) {
            setError("กรุณาระบุชื่อผู้คืน");
            return;
        }

        if (product.type === 'bulk' && !selectedBorrowId) {
            setError("กรุณาเลือกรายการที่จะคืน");
            return;
        }

        if (sigPad.current?.isEmpty()) {
            setError("กรุณาลงลายมือชื่อ");
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
            const filename = `signatures/return_${Date.now()}_${user?.uid}.png`;
            const storageRef = ref(storage, filename);
            await uploadBytes(storageRef, blob);
            const signatureUrl = await getDownloadURL(storageRef);

            // 2. Update Product Status
            if (product.id) {
                const productRef = doc(db, "products", product.id);
                const isBulk = product.type === 'bulk';

                if (isBulk) {
                    // Bulk Item Logic
                    await updateDoc(productRef, {
                        borrowedCount: increment(-1),
                        updatedAt: serverTimestamp()
                    });

                    // Update Stats for Bulk
                    const currentBorrowed = product.borrowedCount || 0;
                    const totalQty = product.quantity || 0;

                    // If borrowed count goes to 0, decrement 'borrowed' stat
                    if (currentBorrowed === 1) {
                        await decrementStats('borrowed');
                    }

                    // If it becomes available (was out of stock)
                    const wasAvailable = totalQty - currentBorrowed > 0;
                    const willBeAvailable = totalQty - (currentBorrowed - 1) > 0;

                    if (!wasAvailable && willBeAvailable) {
                        await incrementStats('available');
                    }
                } else {
                    // Unique Item Logic
                    await updateDoc(productRef, {
                        status: 'available',
                        updatedAt: serverTimestamp()
                    });

                    // Update Stats
                    // We assume it returns from 'borrowed' (or 'ไม่ว่าง') to 'available'
                    await updateStatsOnStatusChange('borrowed', 'available');
                }
            }

            // 3. Update the specific borrow transaction by ID
            const isBulkReturn = product.type === 'bulk';
            const targetTxId = isBulkReturn ? selectedBorrowId : product.activeBorrowId;

            if (targetTxId) {
                // Direct update by transaction ID — no query needed
                await updateDoc(doc(db, "transactions", targetTxId), {
                    status: "completed",
                    returnedAt: serverTimestamp(),
                    returnerName: formData.returnerName,
                    returnReceiverName: user?.displayName,
                    returnNotes: formData.notes,
                    returnSignatureUrl: signatureUrl
                });
            } else {
                // Fallback: find by query (for legacy data without activeBorrowId)
                const borrowQuery = query(
                    collection(db, "transactions"),
                    where("type", "==", "borrow"),
                    where("productId", "==", product.id),
                    where("status", "==", "active")
                );
                const borrowSnapshot = await getDocs(borrowQuery);
                // For unique items: update the first (should be only one)
                // For bulk items: update the oldest one
                const sortedDocs = borrowSnapshot.docs.sort((a, b) => {
                    const aDate = a.data().borrowDate?.toDate?.() ?? new Date(0);
                    const bDate = b.data().borrowDate?.toDate?.() ?? new Date(0);
                    return aDate.getTime() - bDate.getTime();
                });
                if (sortedDocs.length > 0) {
                    await updateDoc(doc(db, "transactions", sortedDocs[0].id), {
                        status: "completed",
                        returnedAt: serverTimestamp(),
                        returnerName: formData.returnerName,
                        returnReceiverName: user?.displayName,
                        returnNotes: formData.notes,
                        returnSignatureUrl: signatureUrl
                    });
                }
            }

            // Clear activeBorrowId for unique items
            if (!isBulkReturn && product.id) {
                await updateDoc(doc(db, "products", product.id!), {
                    activeBorrowId: deleteField()
                });
            }

            // 4. Create Return Record (for audit log - separate record)
            await addDoc(collection(db, "transactions"), {
                type: "return",
                productId: product.id,
                productName: product.name,
                returnerName: formData.returnerName,
                receiverEmail: user?.email,
                receiverName: user?.displayName, // Admin receiving it
                notes: formData.notes,
                timestamp: serverTimestamp(),
                signatureUrl: signatureUrl,
                status: "completed"
            });

            // Log Activity
            await logActivity({
                action: 'return',
                productName: product.name,
                userName: formData.returnerName,
                details: `คืน: ${formData.notes}`,
                zone: product.location || 'unknown',
                status: 'completed',
                signatureUrl: signatureUrl
            });

            toast.success("คืนวัสดุเรียบร้อยแล้ว");
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error returning product:", error);
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
                    <h2 className="text-2xl font-bold text-text mb-1">คืนวัสดุ อุปกรณ์</h2>
                    <p className="text-text-secondary text-sm mb-6">{product.name}</p>

                    {/* Bulk item: borrower selector */}
                    {product.type === 'bulk' && activeBorrows.length > 0 && (
                        <div className="mb-4 space-y-1">
                            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">เลือกรายการที่จะคืน</label>
                            <select
                                value={selectedBorrowId}
                                onChange={(e) => setSelectedBorrowId(e.target.value)}
                                className="input-field"
                                required
                            >
                                <option value="">-- เลือกผู้ยืม --</option>
                                {activeBorrows.map((b: any) => (
                                    <option key={b.id} value={b.id}>
                                        {b.borrowerName} — ยืมเมื่อ {formatBorrowDate(b.borrowDate)} (ห้อง {b.userRoom})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {product.type === 'bulk' && activeBorrows.length === 0 && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-600 text-sm">
                            ไม่พบรายการยืมที่ค้างอยู่
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Receiver Info (Admin) */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">ผู้รับคืน (Admin)</label>
                            <div className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-text text-sm opacity-70">
                                {user?.displayName || user?.email}
                            </div>
                        </div>

                        {/* Returner Info */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">ชื่อผู้คืน</label>
                            <input
                                type="text"
                                name="returnerName"
                                value={formData.returnerName}
                                onChange={handleInputChange}
                                required
                                className="input-field"
                                placeholder="ระบุชื่อผู้ที่นำของมาคืน"
                            />
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">หมายเหตุ / สภาพของ</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleInputChange}
                                className="input-field resize-none h-20"
                                placeholder="เช่น สภาพปกติ, มีรอยขีดข่วน..."
                            />
                        </div>

                        {/* Signature Pad */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">ลายเซ็นผู้คืน</label>
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
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50"
                            >
                                {loading ? "กำลังบันทึก..." : "ยืนยันการคืน"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ReturnModal;
