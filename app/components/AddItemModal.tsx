"use client";

import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import toast from "react-hot-toast";

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSuccess }) => {
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
        type: "unique", // 'unique' or 'bulk'
        quantity: 1,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            const newItem = {
                ...formData,
                price: Number(formData.price),
                quantity: Number(formData.quantity),
                status: 'available',
                borrowedCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            // If unique, quantity is always 1
            if (formData.type === 'unique') {
                newItem.quantity = 1;
            }

            await addDoc(collection(db, "products"), newItem);

            // Log Activity
            const { logActivity } = await import("@/utils/logger");
            await logActivity({
                action: 'create',
                productName: formData.name,
                userName: "Admin", // TODO: Pass actual user
                details: `Added new item: ${formData.name} (${formData.type})`,
                imageUrl: formData.imageUrl
            });

            toast.success("เพิ่มอุปกรณ์เรียบร้อยแล้ว");
            onSuccess();
            onClose();

            // Reset form
            setFormData({
                name: "",
                brand: "",
                location: "",
                category: "",
                serialNumber: "",
                description: "",
                price: 0,
                warrantyInfo: "",
                imageUrl: "",
                type: "unique",
                quantity: 1,
            });

        } catch (err: any) {
            console.error("Error adding product:", err);
            setError(err.message || "เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์");
            toast.error("เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

            <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-soft-lg overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-text">เพิ่มอุปกรณ์ใหม่</h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text">✕</button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <form id="add-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Type Selection */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">ประเภทอุปกรณ์</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${formData.type === 'unique' ? 'bg-primary-start/10 border-primary-start text-primary-start' : 'bg-card border-border hover:bg-border/50'}`}>
                                    <input type="radio" name="type" value="unique" checked={formData.type === 'unique'} onChange={handleInputChange} className="hidden" />
                                    <span className="text-2xl">📱</span>
                                    <span className="font-bold">รายชิ้น (Unique)</span>
                                    <span className="text-xs text-center opacity-70">มีหมายเลขเครื่อง, ติดตามรายชิ้น</span>
                                </label>
                                <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${formData.type === 'bulk' ? 'bg-primary-start/10 border-primary-start text-primary-start' : 'bg-card border-border hover:bg-border/50'}`}>
                                    <input type="radio" name="type" value="bulk" checked={formData.type === 'bulk'} onChange={handleInputChange} className="hidden" />
                                    <span className="text-2xl">📦</span>
                                    <span className="font-bold">จำนวนมาก (Bulk)</span>
                                    <span className="text-xs text-center opacity-70">นับจำนวน, ไม่มีหมายเลขเครื่อง</span>
                                </label>
                            </div>
                        </div>

                        {/* Basic Info Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">ข้อมูลพื้นฐาน</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">ชื่อสินค้า <span className="text-red-500">*</span></label>
                                    <input name="name" value={formData.name} onChange={handleInputChange} className="input-field" required />
                                </div>
                                <div>
                                    <label className="label">ยี่ห้อ / แบรนด์ <span className="text-red-500">*</span></label>
                                    <input name="brand" value={formData.brand} onChange={handleInputChange} className="input-field" required />
                                </div>
                                <div>
                                    <label className="label">สถานที่จัดเก็บ <span className="text-red-500">*</span></label>
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

                        {/* Specific Fields based on Type */}
                        {formData.type === 'bulk' && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">จำนวนสินค้า</h3>
                                <div>
                                    <label className="label">จำนวนเริ่มต้น <span className="text-red-500">*</span></label>
                                    <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} className="input-field" min="1" required />
                                </div>
                            </div>
                        )}

                        {formData.type === 'unique' && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">ข้อมูลจำเพาะ</h3>
                                <div>
                                    <label className="label">หมายเลขเครื่อง (Serial Number)</label>
                                    <input name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="input-field" />
                                </div>
                            </div>
                        )}

                    </form>
                </div>

                <div className="p-6 border-t border-border flex justify-end gap-3 bg-card">
                    <button onClick={onClose} className="btn-secondary">ยกเลิก</button>
                    <button form="add-form" type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50">
                        {loading ? "กำลังบันทึก..." : "เพิ่มอุปกรณ์"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddItemModal;
