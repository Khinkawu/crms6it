"use client";

import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Product } from "@/types";
import ConfirmationModal from "./ConfirmationModal";
import toast from "react-hot-toast";
import { incrementStats, decrementStats, updateStatsOnStatusChange } from "@/utils/aggregation";
import { Box, Hash, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface EditProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onSuccess: () => void;
}

const EditProductModal: React.FC<EditProductModalProps> = ({ isOpen, onClose, product, onSuccess }) => {
    const { getDisplayName, role } = useAuth();
    const isAdminOrTech = role === 'admin' || role === 'technician';

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
        stockId: "",
    });

    // Image Upload State
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Categories (Same as Add Product)
    const categories = [
        { id: 'IT', label: 'คอมพิวเตอร์ (IT)', prefix: 'COM' },
        { id: 'AV', label: 'โสตทัศนูปกรณ์ (AV)', prefix: 'AV' },
        { id: 'NET', label: 'เครือข่าย (Network)', prefix: 'NET' },
        { id: 'OFF', label: 'อุปกรณ์สำนักงาน (Office)', prefix: 'OFF' },
        { id: 'TOOL', label: 'เครื่องมือช่าง (Tools)', prefix: 'TOOL' },
        { id: 'ACC', label: 'อุปกรณ์เสริม (Accessories)', prefix: 'ACC' },
        { id: 'GEN', label: 'อื่นๆ (General)', prefix: 'GEN' },
    ];

    // Stock Management
    const [stockMode, setStockMode] = useState<'set' | 'add'>('add');
    const [stockInput, setStockInput] = useState<number>(0);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Confirmation Modal State
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

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
                stockId: product.stockId || "",
            });
            setStockInput(0);
            setImagePreview(product.imageUrl || null);
            setImageFile(null);
        }
    }, [isOpen, product]);

    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // --- Image Handling ---
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const resizeImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                const maxWidth = 800;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error("Canvas to Blob failed"));
                        }
                    },
                    "image/webp",
                    0.7
                );
            };
            img.onerror = (err) => reject(err);
        });
    };
    // ----------------------

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

            // Handle Image Upload
            if (imageFile) {
                // 1. Resize
                const resizedImageBlob = await resizeImage(imageFile);

                // 2. Upload New Image
                const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name.replace(/\.[^/.]+$/, "")}.webp`);
                const snapshot = await uploadBytes(storageRef, resizedImageBlob);
                const downloadURL = await getDownloadURL(snapshot.ref);

                updates.imageUrl = downloadURL;

                // 3. Delete Old Image (if exists and is a firebase storage url)
                if (product.imageUrl && product.imageUrl.includes("firebasestorage")) {
                    try {
                        const oldImageRef = ref(storage, product.imageUrl);
                        await deleteObject(oldImageRef);
                    } catch (err) {
                        console.warn("Failed to delete old image:", err);
                        // Convert to non-fatal error
                    }
                }
            }

            // Handle Stock Update
            const currentQty = product.type === 'bulk' ? (product.quantity || 0) : (product.status === 'requisitioned' ? 0 : 1);
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

                // Auto-convert to bulk if it was unique and now has quantity changes
                if (product.type === 'unique') {
                    updates.type = 'bulk';
                }

                // Update status if stock becomes available/unavailable
                const borrowed = product.borrowedCount || 0;
                if (newQty - borrowed > 0) {
                    updates.status = 'available';
                } else {
                    updates.status = 'requisitioned'; // Or unavailable
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
                userName: getDisplayName(),
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
            await deleteDoc(doc(db, "products", product.id!));

            // Log Activity
            const { logActivity } = await import("@/utils/logger");
            await logActivity({
                action: 'delete',
                productName: product.name,
                userName: getDisplayName(),
                details: `Deleted product: ${product.name}`,
                imageUrl: product.imageUrl
            });

            // Update Stats
            await decrementStats('total');
            if (product.type === 'bulk') {
                const isAvailable = (product.quantity || 0) - (product.borrowedCount || 0) > 0;
                if (isAvailable) await decrementStats('available');

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

                <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-soft-lg overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col overscroll-contain overflow-y-auto md:overflow-hidden">
                    <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
                        <h2 className="text-xl font-bold text-text">แก้ไขข้อมูลสินค้า</h2>
                        <button onClick={onClose} aria-label="ปิด" className="text-text-secondary hover:text-text">✕</button>
                    </div>

                    <div className="p-6 md:overflow-y-auto">
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
                                </div>
                            </div>

                            {/* Image Upload Section */}
                            <div className="space-y-2">
                                <label className="label">รูปภาพสินค้า</label>
                                <div
                                    className={`relative w-full h-48 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden group
                                    ${imagePreview ? 'border-primary/50 bg-primary/5' : 'border-gray-300 dark:border-white/20 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {imagePreview ? (
                                        <div className="relative w-full h-full">
                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium">
                                                คลิกเพื่อเปลี่ยนรูป
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center p-4">
                                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                                <Upload className="w-6 h-6 text-gray-400 dark:text-white/70" />
                                            </div>
                                            <p className="text-gray-600 dark:text-white/60 font-medium">คลิกหรือลากรูปภาพมาวางที่นี่</p>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageSelect}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            {/* Category & Stock ID */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                                <div>
                                    <label className="label flex items-center gap-2">
                                        <Box className="w-4 h-4 text-blue-500" /> หมวดหมู่
                                    </label>
                                    <select
                                        name="category"
                                        value={categories.find(c => c.label === formData.category)?.id || ""}
                                        onChange={(e) => {
                                            const selectedLabel = categories.find(c => c.id === e.target.value)?.label || e.target.value;
                                            setFormData(prev => ({ ...prev, category: selectedLabel }));
                                        }}
                                        className="input-field appearance-none font-prompt"
                                    >
                                        <option value="">-- เลือกหมวดหมู่ --</option>
                                        {categories.map(cat => (
                                            <option
                                                key={cat.id}
                                                value={cat.id}
                                            >
                                                {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label flex items-center gap-2">
                                        <Hash className="w-4 h-4 text-emerald-500" /> Stock ID (แก้ไขได้)
                                    </label>
                                    <input
                                        name="stockId"
                                        value={formData.stockId}
                                        onChange={handleInputChange}
                                        className="input-field font-mono font-bold text-emerald-600"
                                        placeholder="เช่น COM-001"
                                    />
                                </div>
                            </div>

                            {/* Stock Management Section - Available for all since we can replenish anything */}
                            {isAdminOrTech && (
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800/50 space-y-4">
                                    <h3 className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-2">
                                        📦 จัดการสต็อกสินค้า {product.type === 'unique' && <span className="text-purple-500 normal-case">(จะถูกเปลี่ยนเป็นแบบวัสดุสิ้นเปลืองเมื่อเพิ่มสต็อก)</span>}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-text">
                                        <span>ทั้งหมด: <strong className="text-lg">{product.type === 'bulk' ? (product.quantity || 0) : (product.status === 'requisitioned' ? 0 : 1)}</strong></span>
                                        <span>ถูกยืม: <strong>{product.borrowedCount || 0}</strong></span>
                                        <span>คงเหลือ: <strong>{(product.type === 'bulk' ? (product.quantity || 0) : (product.status === 'requisitioned' ? 0 : 1)) - (product.borrowedCount || 0)}</strong></span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                        <div>
                                            <label className="label">โหมดการอัปเดต</label>
                                            <div className="flex bg-card rounded-lg border border-border p-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setStockMode('add')}
                                                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${stockMode === 'add' ? 'bg-purple-600 text-white shadow-sm' : 'text-text-secondary hover:text-text'}`}
                                                >
                                                    เพิ่ม / ลด
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setStockMode('set')}
                                                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${stockMode === 'set' ? 'bg-purple-600 text-white shadow-sm' : 'text-text-secondary hover:text-text'}`}
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
                                                className="input-field border-purple-200 focus:border-purple-500 font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

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
                                        <label className="label">รายละเอียด</label>
                                        <textarea name="description" value={formData.description} onChange={handleInputChange} className="input-field h-24 resize-none" />
                                    </div>
                                </div>
                            </div>



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
                            <button form="edit-form" type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50">
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
