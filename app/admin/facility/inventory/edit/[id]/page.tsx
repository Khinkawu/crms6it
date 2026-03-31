"use client";

import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { Box, Hash, Upload, ArrowLeft, Edit, Info, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { incrementStats, decrementStats, updateStatsOnStatusChange } from "@/utils/aggregation";
import ConfirmationModal from "@/components/ConfirmationModal";

export default function EditFacilityInventoryPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const { getDisplayName, role, user, loading: authLoading } = useAuth();

    // Access control
    const hasAccess = role === 'admin' || role === 'facility_technician';

    const [formData, setFormData] = useState({
        name: "",
        brand: "",
        model: "",
        location: "",
        category: "",
        serialNumber: "",
        description: "",
        price: 0,
        stockId: "",
    });

    const [initialProduct, setInitialProduct] = useState<any>(null);

    // Stock Management
    const [stockMode, setStockMode] = useState<'add' | 'set'>('add');
    const [stockInput, setStockInput] = useState<number>(0);

    // Image Upload State
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Delete Modal
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Facility Categories
    const categories = [
        { id: 'ELEC', label: 'ระบบไฟฟ้า (Electrical)', prefix: 'ELEC' },
        { id: 'PLUMB', label: 'ระบบประปา (Plumbing)', prefix: 'PLUMB' },
        { id: 'HVAC', label: 'ระบบปรับอากาศ (HVAC)', prefix: 'HVAC' },
        { id: 'CIVIL', label: 'งานโครงสร้าง/โยธา (Civil)', prefix: 'CIV' },
        { id: 'FURN', label: 'เฟอร์นิเจอร์ (Furniture)', prefix: 'FURN' },
        { id: 'CLEAN', label: 'อุปกรณ์ทำความสะอาด (Cleaning)', prefix: 'CLN' },
        { id: 'TOOL', label: 'เครื่องมือช่าง (Tools)', prefix: 'TOOL' },
        { id: 'MISC', label: 'อื่นๆ (Miscellaneous)', prefix: 'MISC' },
    ];

    useEffect(() => {
        if (!authLoading && (!user || !hasAccess)) {
            router.push('/manage/dashboard');
        }
    }, [user, hasAccess, authLoading, router]);

    // Fetch initial data
    useEffect(() => {
        const fetchProduct = async () => {
            if (!id) return;
            try {
                const docRef = doc(db, "facility_inventory", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setInitialProduct({ id: docSnap.id, ...data });
                    setFormData({
                        name: data.name || "",
                        brand: data.brand || "",
                        model: data.model || "",
                        location: data.location || "",
                        category: data.category || "",
                        serialNumber: data.serialNumber || "",
                        description: data.description || "",
                        price: data.price || 0,
                        stockId: data.stockId || "",
                    });
                    setImagePreview(data.imageUrl || null);
                } else {
                    toast.error("ไม่พบข้อมูลอุปกรณ์นี้");
                    router.push('/manage/inventory?tab=facility');
                }
            } catch (err) {
                console.error("Error fetching product:", err);
                toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
            } finally {
                setInitialLoading(false);
            }
        };

        if (id) {
            fetchProduct();
        }
    }, [id, router]);

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

        if (!formData.name || !formData.category) {
            setError("กรุณากรอกชื่อและหมวดหมู่ของวัสดุ/อุปกรณ์");
            return;
        }

        setLoading(true);

        try {
            const productRef = doc(db, "facility_inventory", id);

            const updates: any = {
                ...formData,
                price: Number(formData.price),
                updatedAt: serverTimestamp(),
            };

            // Handle Image Upload
            if (imageFile) {
                const resizedImageBlob = await resizeImage(imageFile);
                const storageRef = ref(storage, `facility_inventory/${Date.now()}_${imageFile.name.replace(/\.[^/.]+$/, "")}.webp`);
                const snapshot = await uploadBytes(storageRef, resizedImageBlob);
                const downloadURL = await getDownloadURL(snapshot.ref);

                updates.imageUrl = downloadURL;

                // Delete Old Image (if it exists and is from firebase)
                if (initialProduct?.imageUrl && initialProduct.imageUrl.includes("firebasestorage")) {
                    try {
                        const oldImageRef = ref(storage, initialProduct.imageUrl);
                        await deleteObject(oldImageRef);
                    } catch (err) {
                        console.warn("Failed to delete old image:", err);
                    }
                }
            }

            // Handle Stock Update
            if (stockInput !== 0) {
                const currentQty = initialProduct.quantity || 0;
                let newQty = currentQty;

                if (stockMode === 'set') {
                    newQty = Number(stockInput);
                } else {
                    newQty = currentQty + Number(stockInput);
                }

                if (newQty < 0) {
                    throw new Error("จำนวนสินค้าคงเหลือไม่สามารถติดลบได้");
                }

                updates.quantity = newQty;

                // For facility items, if stock was 1 and now it's > 1, make it bulk
                if (initialProduct.type === 'unique') {
                    updates.type = 'bulk';
                }

                // Update status if stock availability changes
                const borrowed = initialProduct.borrowedCount || 0;
                if (newQty - borrowed > 0) {
                    updates.status = 'available';
                } else {
                    updates.status = 'out_of_stock';
                }
            }

            // Stats Update (Simplified for Facility - currently only overall tracked if at all via aggregation)
            // If we implement specific facility aggregations

            await updateDoc(productRef, updates);

            // Log Activity
            const { logActivity } = await import("@/utils/logger");
            await logActivity({
                action: 'update',
                productName: formData.name,
                userName: getDisplayName(),
                details: `แก้ไขข้อมูล. ${stockInput !== 0 ? `อัปเดตสต๊อก: ${stockInput > 0 && stockMode === 'add' ? '+' : ''}${stockInput}` : ''}`,
                imageUrl: updates.imageUrl || initialProduct.imageUrl,
                targetCollection: 'facility_activities'
            });

            toast.success("อัปเดตข้อมูลวัสดุ/อุปกรณ์เรียบร้อยแล้ว");
            router.push('/manage/inventory?tab=facility');

        } catch (err: any) {
            console.error("Error updating facility inventory:", err);
            setError(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
            toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            await deleteDoc(doc(db, "facility_inventory", id));

            // Log Activity
            const { logActivity } = await import("@/utils/logger");
            await logActivity({
                action: 'delete',
                productName: initialProduct.name,
                userName: getDisplayName(),
                details: `ลบ ${initialProduct.name} ออกจากระบบ`,
                imageUrl: initialProduct.imageUrl,
                targetCollection: 'facility_activities'
            });

            // Note: Should also decrement stats if implemented for facility

            toast.success("ลบรายการออกจากระบบเรียบร้อยแล้ว");
            router.push('/manage/inventory?tab=facility');
        } catch (err: any) {
            console.error("Error deleting product:", err);
            toast.error("เกิดข้อผิดพลาดในการลบรายการ");
            setLoading(false);
        }
    };

    if (authLoading || initialLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-amber-500">
                <Loader2 size={40} className="animate-spin mb-4" />
                <p>กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    if (!user || !hasAccess || !initialProduct) return null;

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="ลบรายการ"
                message={`คุณแน่ใจหรือไม่ที่จะลบ "${initialProduct.name}" ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้`}
                confirmText="ลบรายการถาวร"
                isDangerous={true}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 bg-white dark:bg-card border border-border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <ArrowLeft size={20} className="text-text" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Edit className="text-amber-500" />
                            แก้ไขรายการ: {initialProduct.name}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            อัปเดตข้อมูลหรือปรับปรุงสต๊อกของอุปกรณ์
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="flex flex-col md:flex-row items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-sm font-bold"
                >
                    <Trash2 size={18} /> <span className="hidden md:inline">ลบรายการนี้</span>
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-start gap-3">
                    <Info className="shrink-0 mt-0.5" size={18} />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Form Sections Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column: Image & Stock */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Image Upload Box */}
                        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Upload size={16} /> รูปภาพ
                            </h3>
                            <div
                                className={`relative w-full aspect-square rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden group
                                ${imagePreview ? 'border-amber-500/50 bg-amber-500/5' : 'border-gray-300 dark:border-white/20 hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-white/5'}`}
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
                                        <p className="text-xs text-gray-500 dark:text-white/60 font-medium">คลิกหรือลากรูปมาวาง</p>
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

                        {/* Stock Quantity Editor */}
                        <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5 shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider flex items-center gap-2">
                                <CheckCircle2 size={16} /> การจัดการสต็อกอัตโนมัติ
                            </h3>

                            <div className="flex justify-between items-center text-sm mb-2 text-text">
                                <span>เดิมทั้งหมด:</span>
                                <span className="font-bold text-lg">{initialProduct.quantity || 0}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm mb-4 text-text">
                                <span>ถูกยืม (รอนำส่งคืน):</span>
                                <span className="font-bold">{initialProduct.borrowedCount || 0}</span>
                            </div>

                            <hr className="border-amber-200 dark:border-amber-800/50" />

                            <div className="pt-2">
                                <label className="text-xs font-bold text-amber-600 mb-2 block">รูปแบบการอัปเดต</label>
                                <div className="flex bg-white dark:bg-card rounded-lg border border-amber-200 dark:border-amber-800/50 p-1 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setStockMode('add')}
                                        className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${stockMode === 'add' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40'}`}
                                    >
                                        เพิ่ม / ลด
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStockMode('set')}
                                        className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${stockMode === 'set' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40'}`}
                                    >
                                        ตั้งค่าใหม่
                                    </button>
                                </div>

                                <label className="text-xs text-text-secondary block mb-1">
                                    {stockMode === 'add' ? 'จำนวนชิ้นที่เพิ่มเข้า (ใส่ติดลบเพื่อนำออก)' : 'จำนวนทั้งหมดที่แน่นอน'}
                                </label>
                                <input
                                    type="number"
                                    value={stockInput}
                                    onChange={(e) => setStockInput(parseInt(e.target.value) || 0)}
                                    className="input-field border-amber-300 focus:border-amber-500 font-mono font-bold text-center text-lg"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Details */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">

                            <div>
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 border-b border-border pb-2">
                                    ข้อมูลพื้นฐาน
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2">
                                        <label className="label">ชื่อวัสดุ / อุปกรณ์ <span className="text-red-500">*</span></label>
                                        <input
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className="input-field border-amber-200 focus:border-amber-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="label">ยี่ห้อ / แบรนด์</label>
                                        <input name="brand" value={formData.brand} onChange={handleInputChange} className="input-field" />
                                    </div>

                                    <div>
                                        <label className="label">รุ่น (Model)</label>
                                        <input name="model" value={formData.model} onChange={handleInputChange} className="input-field" />
                                    </div>

                                    <div>
                                        <label className="label flex items-center gap-1">
                                            <Box size={14} className="text-amber-500" /> หมวดหมู่ <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="category"
                                            value={categories.find(c => c.label === formData.category)?.id || ""}
                                            onChange={(e) => {
                                                const selectedLabel = categories.find(c => c.id === e.target.value)?.label || e.target.value;
                                                setFormData(prev => ({ ...prev, category: selectedLabel }));
                                            }}
                                            className="input-field appearance-none"
                                            required
                                        >
                                            <option value="">-- เลือกหมวดหมู่ --</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="label flex items-center gap-1">
                                            <Hash size={14} className="text-blue-500" /> รหัสอาคาร/รหัสครุภัณฑ์ (Stock ID)
                                        </label>
                                        <input
                                            name="stockId"
                                            value={formData.stockId}
                                            onChange={handleInputChange}
                                            className="input-field font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 border-b border-border pb-2">
                                    รายละเอียดการจัดเก็บ
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="label">สถานที่จัดเก็บ</label>
                                        <input name="location" value={formData.location} onChange={handleInputChange} className="input-field" />
                                    </div>

                                    <div>
                                        <label className="label">S/N หรือ รหัสเฉพาะ</label>
                                        <input name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="input-field font-mono" />
                                    </div>

                                    <div>
                                        <label className="label">ราคาต้นทุน (บาท)</label>
                                        <input type="number" name="price" value={formData.price} onChange={handleInputChange} className="input-field" min="0" />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="label">รายละเอียดเพิ่มเติม / หมายเหตุ</label>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            className="input-field h-24 resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-border mt-8">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-xl font-bold bg-white dark:bg-card border border-border text-text hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-xl disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                        {loading ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                    </button>
                </div>
            </form>
        </div>
    );
}
