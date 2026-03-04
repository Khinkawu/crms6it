/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { toast } from 'react-hot-toast';
import { logActivity } from "../../utils/logger";
import { compressImage } from "../../utils/imageCompression";
import {
    User, MapPin, Image as ImageIcon, FileText,
    Send, Loader2, X, Plus, Phone, Building2, Tag
} from "lucide-react";
import { FacilityIssueCategory } from "../../types";

export default function FacilityForm() {
    const { user, loading: authLoading } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        position: "ครู",
        phone: "",
        room: "",
        description: "",
        zone: "junior_high",
        issueCategory: "หลอดไฟ" as FacilityIssueCategory,
    });
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const categories: FacilityIssueCategory[] = ['แอร์', 'ไฟฟ้า', 'ประปา', 'โครงสร้าง', 'เบ็ดเตล็ด'];

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const totalImages = images.length + newFiles.length;

            if (totalImages > 5) {
                toast.error("อัปโหลดภาพได้สูงสุด 5 ภาพ");
                return;
            }

            setImages(prev => [...prev, ...newFiles]);
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setPreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => {
            URL.revokeObjectURL(prev[index]);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            toast.error("กรุณาเข้าสู่ระบบ");
            return;
        }

        if (!formData.phone || !formData.room || !formData.description || !formData.issueCategory) {
            toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
            return;
        }

        if (images.length === 0) {
            toast.error("กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป");
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading("กำลังส่งข้อมูลแจ้งซ่อมอาคาร...");

        try {
            // Compress and upload images
            const imageUrls: string[] = [];
            for (const image of images) {
                const compressedImage = await compressImage(image, {
                    maxWidth: 1920,
                    maxHeight: 1080,
                    quality: 0.8,
                    maxSizeMB: 1
                });

                const storageRef = ref(storage, `facility_images/${Date.now()}_${compressedImage.name}`);
                const snapshot = await uploadBytes(storageRef, compressedImage);
                const url = await getDownloadURL(snapshot.ref);
                imageUrls.push(url);
            }

            // Save to facility_tickets collection
            const docRef = await addDoc(collection(db, "facility_tickets"), {
                requesterName: user.displayName || "Unknown",
                requesterEmail: user.email || "Unknown",
                position: formData.position,
                phone: formData.phone,
                room: formData.room,
                zone: formData.zone,
                issueCategory: formData.issueCategory,
                description: formData.description,
                images: imageUrls,
                status: 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Call LINE Notify API
            fetch('/api/notify-facility', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: docRef.id,
                    requesterName: user.displayName || "Unknown",
                    room: formData.room,
                    zone: formData.zone,
                    issueCategory: formData.issueCategory,
                    description: formData.description,
                    imageOneUrl: imageUrls.length > 0 ? imageUrls[0] : null
                })
            }).catch(err => console.error("Failed to send LINE notification:", err));

            await logActivity({
                action: 'create',
                productName: `ซ่อมอาคาร: ${formData.room}`,
                userName: user.displayName || "Unknown",
                details: `แจ้งซ่อมหมวด${formData.issueCategory} - ${formData.description}`,
                imageUrl: imageUrls.length > 0 ? imageUrls[0] : undefined,
                zone: formData.zone
            });

            toast.success("ส่งเรื่องแจ้งซ่อมอาคารเรียบร้อยแล้ว", { id: toastId });

            // Reset form
            setFormData({
                position: "ครู",
                phone: "",
                room: "",
                description: "",
                zone: "junior_high",
                issueCategory: "ไฟฟ้า",
            });
            setImages([]);
            setPreviews([]);
            if (fileInputRef.current) fileInputRef.current.value = "";

        } catch (err: any) {
            console.error("Error submitting facility ticket:", err);
            toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">กำลังโหลด...</div>;
    if (!user) return <div className="p-8 text-center text-red-500">กรุณาเข้าสู่ระบบ</div>;

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-8 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                                <Building2 size={24} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-bold">แจ้งซ่อมอาคารสถานที่</h2>
                        </div>
                        <p className="text-amber-50 opacity-90 pl-14">
                            รายงานปัญหา ไฟฟ้า ประปา แอร์ โครงสร้าง หรืออื่นๆ ภายในโรงเรียน
                        </p>
                    </div>
                </div>

                <div className="p-6 md:p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Section 1: ข้อมูลผู้แจ้ง */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <User size={18} className="text-amber-500" />
                                1. ข้อมูลผู้แจ้ง
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ตำแหน่ง / Role</label>
                                    <select
                                        name="position"
                                        value={formData.position}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                                    >
                                        <option value="ครู">ครู</option>
                                        <option value="นักเรียน">นักเรียน</option>
                                        <option value="เจ้าหน้าที่">เจ้าหน้าที่</option>
                                        <option value="ผู้บริหาร">ผู้บริหาร</option>
                                        <option value="อื่นๆ">อื่นๆ</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">เบอร์โทรศัพท์ติดต่อ <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Phone size={16} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="tel"
                                            name="phone"
                                            placeholder="08X-XXX-XXXX"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr className="border-gray-100 dark:border-slate-700" />

                        {/* Section 2: สถานที่และหมวดหมู่ */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <MapPin size={18} className="text-amber-500" />
                                2. สถานที่และปัญหา
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">โซน / ฝั่ง <span className="text-red-500">*</span></label>
                                    <select
                                        name="zone"
                                        value={formData.zone}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                                    >
                                        <option value="junior_high">มัธยมต้น (ม.1-3)</option>
                                        <option value="senior_high">มัธยมปลาย (ม.4-6)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">อาคาร/ห้อง/สถานที่ <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="room"
                                        placeholder="เช่น อาคาร 1 ห้อง 115"
                                        value={formData.room}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">หมวดหมู่ปัญหา <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                    {categories.map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, issueCategory: cat }))}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${formData.issueCategory === cat
                                                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-2 border-amber-500'
                                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-600 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <FileText size={16} className="text-gray-400" />
                                    รายละเอียดปัญหา/อาการเสีย <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    name="description"
                                    placeholder="อธิบายอาการเสียอย่างละเอียด เพื่อให้ช่างเตรียมเครื่องมือและอะไหล่ได้ถูกต้อง"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none resize-none"
                                    required
                                />
                            </div>
                        </div>

                        <hr className="border-gray-100 dark:border-slate-700" />

                        {/* Section 3: รูปภาพประกอบ */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <ImageIcon size={18} className="text-amber-500" />
                                3. รูปภาพประกอบ <span className="text-red-500 ml-1 text-sm">*</span>
                            </h3>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {previews.map((preview, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600 group">
                                        <img
                                            src={preview}
                                            alt={`Preview ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}

                                {images.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-square flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:border-amber-400 hover:text-amber-500 transition-all"
                                    >
                                        <Plus size={24} />
                                        <span className="text-sm font-medium">เพิ่มรูปภาพ</span>
                                        <span className="text-xs opacity-70">({images.length}/5)</span>
                                    </button>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageChange}
                                className="hidden"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                                ควรถ่ายภาพให้เห็นจุดที่ชำรุด หรือบริเวณกว้างเพื่อให้ทราบตำแหน่งชัดเจน (รองรับสูงสุด 5 ภาพ)
                            </p>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-medium shadow-sm transition-all ${isSubmitting
                                        ? "bg-amber-400 cursor-not-allowed"
                                        : "bg-amber-500 hover:bg-amber-600 hover:shadow-md active:scale-[0.98]"
                                    }`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        กำลังบันทึกข้อมูล...
                                    </>
                                ) : (
                                    <>
                                        <Send size={20} />
                                        ยืนยันการแจ้งซ่อมอาคารสถานที่
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
