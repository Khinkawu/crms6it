"use client";

import React, { useState, useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Product } from "../../types";
import ConfirmationModal from "./ConfirmationModal";
import toast from "react-hot-toast";
import { incrementStats, decrementStats, updateStatsOnStatusChange } from "../../utils/aggregation";

interface EditProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onSuccess: () => void;
}

const EditProductModal: React.FC<EditProductModalProps> = ({ isOpen, onClose, product, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: "",
        brand: "",
        location: "",
        category: "",
        serialNumber: "",
        description: "",
        price: 0,
        warrantyInfo: "",
        imageUrl: "",
    });

    // Stock Management
    const [stockMode, setStockMode] = useState<'set' | 'add'>('add');
    const [stockInput, setStockInput] = useState<number>(0);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Confirmation Modal State
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    useEffect(() => {
        if (isOpen && product) {
            setFormData({
                name: product.name || "",
                brand: product.brand || "",
                location: product.location || "",
                category: product.category || "",
                serialNumber: product.serialNumber || "",
                description: product.description || "",
                price: product.price || 0,
                warrantyInfo: product.warrantyInfo || "",
                imageUrl: product.imageUrl || "",
            });
            setStockInput(0);
        }
    }, [isOpen, product]);

    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const productRef = doc(db, "products", product.id!);

            const updates: any = {
                ...formData,
                price: Number(formData.price),
                updatedAt: serverTimestamp(),
            };

            // Handle Stock Update for Bulk Items
            if (product.type === 'bulk') {
                const currentQty = product.quantity || 0;
                let newQty = currentQty;

                if (stockInput !== 0) {
                    if (stockMode === 'set') {
                        newQty = Number(stockInput);
                    } else {
                        newQty = currentQty + Number(stockInput);
                    }

                    if (newQty < 0) {
                        throw new Error("จำนวนสินค้าคงเหลือไม่สามารถติดลบได้");
                    }

                    updates.quantity = newQty;

                    // Update status if stock becomes available/unavailable
                    const borrowed = product.borrowedCount || 0;
                    if (newQty - borrowed > 0) {
                        updates.status = 'available';
                    } else {
                        updates.status = 'requisitioned'; // Or unavailable
                    }
                }
            }

            // Detect Status Change for Stats
            if (product.type !== 'bulk') {
                // Unique Item
                // Check if status is being updated
                if (updates.status && updates.status !== product.status) {
                    await updateStatsOnStatusChange(product.status!, updates.status);
                }
            } else {
                // Bulk Item
                // Check if availability status changes based on quantity update
                // Old availability
                const oldAvailable = (product.quantity || 0) - (product.borrowedCount || 0) > 0;
                // New availability
                const newQty = updates.quantity !== undefined ? updates.quantity : (product.quantity || 0);
                const newBorrowed = updates.borrowedCount !== undefined ? updates.borrowedCount : (product.borrowedCount || 0);
                const newAvailable = newQty - newBorrowed > 0;

                if (oldAvailable !== newAvailable) {
                    if (newAvailable) {
                        await incrementStats('available');
                    } else {
                        await decrementStats('available');
                    }
                }
            }

            await updateDoc(productRef, updates);

            // Log Activity
            const { logActivity } = await import("@/utils/logger");
            await logActivity({
                action: 'update',
                productName: formData.name,
                userName: "Admin", // TODO: Pass actual user
                details: `Updated details. ${product.type === 'bulk' && stockInput !== 0 ? `Stock updated by ${stockInput}` : ''}`,
                imageUrl: formData.imageUrl
            });

            toast.success("อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว");
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error updating product:", err);
            setError(err.message || "เกิดข้อผิดพลาดในการอัปเดตสินค้า");
            toast.error("เกิดข้อผิดพลาดในการอัปเดตสินค้า");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            const { deleteDoc, doc } = await import("firebase/firestore");
            await deleteDoc(doc(db, "products", product.id!));

            // Log Activity
            const { logActivity } = await import("@/utils/logger");
            await logActivity({
                action: 'delete', // Changed from 'update' to 'delete'
                productName: product.name,
                userName: "Admin",
                details: `Deleted product: ${product.name}`,
                imageUrl: product.imageUrl
            });

            // Update Stats
            await decrementStats('total');
            if (product.type === 'bulk') {
                // For bulk, if we delete the whole product, we lose all its quantity from "available" (assuming it was available)
                // But wait, "available" count in Dashboard for bulk is: (quantity - borrowedCount) > 0 ? +1 : 0
                // So if it was contributing +1 to available, we decrement it.
                const isAvailable = (product.quantity || 0) - (product.borrowedCount || 0) > 0;
                if (isAvailable) await decrementStats('available');

                // If it was contributing to borrowed? (borrowedCount > 0)
                if ((product.borrowedCount || 0) > 0) await decrementStats('borrowed');
            } else {
                // Unique
                if (product.status) await decrementStats(product.status);
            }

            toast.success("ลบสินค้าเรียบร้อยแล้ว");
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error deleting product:", err);
            toast.error("เกิดข้อผิดพลาดในการลบสินค้า");
            setLoading(false);
        }
    };

    return (
        <>
            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDelete}
                title="ลบสินค้า"
                message="คุณแน่ใจหรือไม่ที่จะลบสินค้านี้? การกระทำนี้ไม่สามารถย้อนกลับได้"
                confirmText="ลบสินค้า"
                isDangerous={true}
            />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

                <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-soft-lg overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b border-border flex justify-between items-center">
                        <h2 className="text-xl font-bold text-text">แก้ไขข้อมูลสินค้า</h2>
                        <button onClick={onClose} className="text-text-secondary hover:text-text">✕</button>
                    </div>

                    <div className="p-6 overflow-y-auto">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <form id="edit-form" onSubmit={handleSubmit} className="space-y-6">

                            {/* Basic Info Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">ข้อมูลพื้นฐาน</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">ชื่อสินค้า</label>
                                        <input name="name" value={formData.name} onChange={handleInputChange} className="input-field" required />
                                    </div>
                                    <div>
                                        <label className="label">ยี่ห้อ / แบรนด์</label>
                                        <input name="brand" value={formData.brand} onChange={handleInputChange} className="input-field" required />
                                    </div>
                                    <div>
                                        <label className="label">สถานที่จัดเก็บ</label>
                                        <input name="location" value={formData.location} onChange={handleInputChange} className="input-field" required />
                                    </div>
                                    <div>
                                        <label className="label">หมวดหมู่</label>
                                        <input name="category" value={formData.category} onChange={handleInputChange} className="input-field" />
                                    </div>
                                </div>
                            </div>

                            {/* Details Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">รายละเอียดเพิ่มเติม</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">ราคา</label>
                                        <input type="number" name="price" value={formData.price} onChange={handleInputChange} className="input-field" />
                                    </div>
                                    <div>
                                        <label className="label">ข้อมูลการรับประกัน</label>
                                        <input name="warrantyInfo" value={formData.warrantyInfo} onChange={handleInputChange} className="input-field" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="label">ลิงก์รูปภาพ (URL)</label>
                                        <input name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} className="input-field" placeholder="https://..." />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="label">รายละเอียด</label>
                                        <textarea name="description" value={formData.description} onChange={handleInputChange} className="input-field h-24 resize-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Stock Management (Bulk Only) */}
                            {product.type === 'bulk' && (
                                <div className="p-4 bg-input-bg rounded-xl border border-border space-y-4">
                                    <h3 className="text-sm font-bold text-primary-start uppercase tracking-wider flex items-center gap-2">
                                        📦 จัดการสต็อกสินค้า
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-text">
                                        <span>ทั้งหมด: <strong className="text-lg">{product.quantity || 0}</strong></span>
                                        <span>ถูกยืม: <strong>{product.borrowedCount || 0}</strong></span>
                                        <span>คงเหลือ: <strong>{(product.quantity || 0) - (product.borrowedCount || 0)}</strong></span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                        <div>
                                            <label className="label">โหมดการอัปเดต</label>
                                            <div className="flex bg-card rounded-lg border border-border p-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setStockMode('add')}
                                                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${stockMode === 'add' ? 'bg-primary-start text-white shadow-sm' : 'text-text-secondary hover:text-text'}`}
                                                >
                                                    เพิ่ม / ลด
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setStockMode('set')}
                                                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${stockMode === 'set' ? 'bg-primary-start text-white shadow-sm' : 'text-text-secondary hover:text-text'}`}
                                                >
                                                    ตั้งค่าจำนวนใหม่
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="label">
                                                {stockMode === 'add' ? 'จำนวนที่ต้องการเพิ่ม (ใส่ลบเพื่อลด)' : 'จำนวนทั้งหมดใหม่'}
                                            </label>
                                            <input
                                                type="number"
                                                value={stockInput}
                                                onChange={(e) => setStockInput(parseInt(e.target.value) || 0)}
                                                className="input-field font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Unique Item Specifics */}
                            {product.type !== 'bulk' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="label">หมายเลขเครื่อง (Serial Number)</label>
                                            <input name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="input-field" />
                                        </div>
                                    </div>
                                </div>
                            )}

                        </form>
                    </div>

                    <div className="p-6 border-t border-border flex justify-between items-center bg-card">
                        <button
                            type="button"
                            onClick={() => setIsDeleteConfirmOpen(true)}
                            className="px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-medium transition-colors"
                            disabled={loading}
                        >
                            ลบสินค้า
                        </button>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="btn-secondary">ยกเลิก</button>
                            <button form="edit-form" type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50">
                                {loading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default EditProductModal;
