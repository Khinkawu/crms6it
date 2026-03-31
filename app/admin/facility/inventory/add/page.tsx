"use client";

import React, { useState, useRef } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Box, Hash, Upload, ArrowLeft, PackagePlus, Info, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { incrementStats } from "@/utils/aggregation";

export default function AddFacilityInventoryPage() {
    const router = useRouter();
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

    // Stock Management
    const [quantity, setQuantity] = useState<number>(1);

    // Image Upload State
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    if (authLoading) return <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>;
    if (!user || !hasAccess) {
        if (typeof window !== 'undefined') router.push('/manage/dashboard');
        return null;
    }

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

        if (quantity < 1) {
            setError("จำนวนต้องมากกว่า 0");
            return;
        }

        setLoading(true);

        try {
            let imageUrl = "";

            // Handle Image Upload First
            if (imageFile) {
                const resizedImageBlob = await resizeImage(imageFile);
                const storageRef = ref(storage, `facility_inventory/${Date.now()}_${imageFile.name.replace(/\.[^/.]+$/, "")}.webp`);
                const snapshot = await uploadBytes(storageRef, resizedImageBlob);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            // Determine type and status based on quantity and serial number
            // If serial number is provided AND quantity is exactly 1, we might consider it 'unique'
            // Otherwise, typically facility parts are 'bulk' (consumables or bulk items like lightbulbs, screws, chairs)
            // We'll default to 'bulk' for facility unless quantity is 1 and S/N is given, but making them all bulk is safer for simple requisitioning.
            // Let's use 'bulk' for everything in facility if quantity > 1, or if quantity == 1 we can still use bulk or unique.
            // For simplicity, let's mirror IT: unique if S/N exists, else bulk.
            const isUnique = !!formData.serialNumber && quantity === 1;
            const itemType = isUnique ? "unique" : "bulk";
            const initialStatus = "available";

            const newProduct = {
                ...formData,
                price: Number(formData.price),
                quantity: quantity,
                borrowedCount: 0,
                type: itemType,
                status: initialStatus,
                imageUrl,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            const docRef = await addDoc(collection(db, "facility_inventory"), newProduct);

            // Fetch and update category prefix if no stockId was manually given
            if (!formData.stockId) {
                // Not generating one automatically here to keep it simple, 
                // but could generate based on category prefix + docRef.id if desired.
            }

            // Update Stats
            await incrementStats('total');
            await incrementStats('available');

            // Log Activity
            const { logActivity } = await import("@/utils/logger");
            await logActivity({
                action: 'add',
                productName: formData.name,
                userName: getDisplayName(),
                details: `เพิ่มเข้าระบบอาคารสถานที่ (${quantity} หน่วย)`,
                imageUrl: imageUrl,
                targetCollection: 'facility_activities' // Use the facility log collection
            });

            toast.success("เพิ่มวัสดุ/อุปกรณ์ใหม่เข้าคลังอาคารเรียบร้อยแล้ว");
            router.push('/manage/inventory?tab=facility');

        } catch (err: any) {
            console.error("Error adding facility inventory:", err);
            setError(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
            toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.back()}
                    className="p-2 bg-white dark:bg-card border border-border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                    <ArrowLeft size={20} className="text-text" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <PackagePlus className="text-amber-500" />
                        เพิ่มรายการวัสดุ/อุปกรณ์ (คลังอาคาร)
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        บันทึกข้อมูลอะไหล่, เครื่องมือ หรือวัสดุสิ้นเปลืองสำหรับงานซ่อมบำรุงอาคาร
                    </p>
                </div>
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

                        {/* Stock Quantity */}
                        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <CheckCircle2 size={16} /> จำนวนตั้งต้น
                            </h3>
                            <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-500/20">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-10 h-10 rounded-lg bg-white dark:bg-card border border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-100 transition-colors flex items-center justify-center"
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="flex-1 text-center font-bold text-xl bg-transparent border-none focus:outline-none text-gray-900 dark:text-white w-20 appearance-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="w-10 h-10 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 transition-colors flex items-center justify-center"
                                >
                                    +
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-3 text-center">
                                * หากมีจำนวนมากกว่า 1 ชิ้น ระบบจะตั้งเป็น &ldquo;วัสดุสิ้นเปลือง&rdquo; (Bulk) อัตโนมัติ
                            </p>
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
                                            placeholder="เช่น หลอดไฟ LED 18W, เก้าอี้สำนักงาน, ไขควง"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="label">ยี่ห้อ / แบรนด์</label>
                                        <input name="brand" value={formData.brand} onChange={handleInputChange} className="input-field" placeholder="ระบุยี่ห้อ..." />
                                    </div>

                                    <div>
                                        <label className="label">รุ่น (Model)</label>
                                        <input name="model" value={formData.model} onChange={handleInputChange} className="input-field" placeholder="ระบุรุ่น..." />
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
                                            className="input-field font-mono"
                                            placeholder="เว้นว่างไว้เพื่อสร้างอัตโนมัติภายหลัง"
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
                                        <label className="label">สถานที่จัดเก็บ <span className="text-amber-500">(แนะนำ)</span></label>
                                        <input name="location" value={formData.location} onChange={handleInputChange} className="input-field" placeholder="เช่น ชั้น 2 ห้องช่างอาคาร, ตู้ C4" />
                                    </div>

                                    <div>
                                        <label className="label">S/N หรือ รหัสเฉพาะ</label>
                                        <input name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="input-field font-mono" placeholder="ถ้ามี..." />
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
                                            placeholder="คุณสมบัติ, สเปค, หรือบันทึกข้อควรระวัง..."
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
                        {loading ? "กำลังบันทึก..." : "เพิ่มเข้าสต๊อกอาคาร"}
                    </button>
                </div>
            </form>
        </div>
    );
}
