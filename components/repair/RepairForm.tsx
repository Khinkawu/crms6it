/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { Toaster, toast } from 'react-hot-toast';
import { logActivity } from "../../utils/logger";
import {
    User, MapPin, Image as ImageIcon, FileText,
    Send, Loader2, X, Plus
} from "lucide-react";

export default function RepairForm() {
    const { user, loading: authLoading } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        position: "ครู",
        phone: "",
        room: "",
        description: "",
        zone: "junior_high",
    });
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

            // Create previews
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

        // Validation
        if (!formData.phone || !formData.room || !formData.description) {
            toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
            return;
        }

        if (images.length === 0) {
            toast.error("กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป");
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading("กำลังบันทึกข้อมูล...");

        try {
            // 1. Upload Images
            const imageUrls: string[] = [];
            for (const image of images) {
                const storageRef = ref(storage, `repair_images/${Date.now()}_${image.name}`);
                const snapshot = await uploadBytes(storageRef, image);
                const url = await getDownloadURL(snapshot.ref);
                imageUrls.push(url);
            }

            // 2. Save to Firestore
            await addDoc(collection(db, "repair_tickets"), {
                requesterName: user.displayName || "Unknown",
                requesterEmail: user.email || "Unknown",
                position: formData.position,
                phone: formData.phone,
                room: formData.room,
                zone: formData.zone,
                description: formData.description,
                images: imageUrls,
                status: 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // 3. Notify Technician (Non-blocking)
            fetch('/api/notify-repair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requesterName: user.displayName || "Unknown",
                    room: formData.room,
                    zone: formData.zone,
                    description: formData.description,
                    imageOneUrl: imageUrls.length > 0 ? imageUrls[0] : null
                })
            }).catch(err => console.error("Failed to send LINE notification:", err));

            // 4. LogActivity
            await logActivity({
                action: 'repair',
                productName: `แจ้งซ่อม: ${formData.room}`,
                userName: user.displayName || "Unknown",
                details: formData.description,
                imageUrl: imageUrls.length > 0 ? imageUrls[0] : undefined,
                zone: formData.zone
            });

            toast.success("แจ้งซ่อมเรียบร้อยแล้ว", { id: toastId });

            // Reset form
            setFormData({
                position: "ครู",
                phone: "",
                room: "",
                description: "",
                zone: "junior_high",
            });
            setImages([]);
            setPreviews([]);
            if (fileInputRef.current) fileInputRef.current.value = "";

        } catch (err: any) {
            console.error("Error submitting repair ticket:", err);
            toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading) return <div className="p-8 text-center text-gray-500">Loading user data...</div>;
    if (!user) return <div className="p-8 text-center text-red-500">Please log in.</div>;

    return (
        <div className="w-full max-w-6xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 md:overflow-hidden flex flex-col md:flex-row h-auto md:h-[85vh] md:max-h-[900px] animate-fade-in">
            <Toaster position="top-center" />

            {/* Left Side: Form Inputs */}
            <div className="w-full md:w-7/12 p-6 md:p-8 md:overflow-y-auto md:custom-scrollbar">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
                        ระบบแจ้งซ่อม
                    </h1>
                    <p className="text-gray-500 text-sm ml-4">แจ้งปัญหาอุปกรณ์ชำรุดหรือเสียหาย</p>
                </div>

                <form id="repair-form" onSubmit={handleSubmit} className="space-y-5">
                    {/* 1. User Info */}
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4">
                        <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                            <User size={16} />
                            ข้อมูลผู้แจ้ง
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">ชื่อผู้แจ้ง</label>
                                <input
                                    type="text"
                                    value={user.displayName || user.email || ""}
                                    disabled
                                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">ตำแหน่ง</label>
                                <select
                                    name="position"
                                    value={formData.position}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="ผู้บริหาร">ผู้บริหาร</option>
                                    <option value="ครู">ครู</option>
                                    <option value="ครู LS">ครู LS</option>
                                    <option value="บุคลากร">บุคลากร</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-gray-500 mb-1 block">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    placeholder="08x-xxx-xxxx"
                                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Location */}
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4">
                        <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                            <MapPin size={16} />
                            สถานที่
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">ห้อง / สถานที่ <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="room"
                                    value={formData.room}
                                    onChange={handleInputChange}
                                    placeholder="ระบุห้อง..."
                                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">โซน <span className="text-red-500">*</span></label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { value: 'junior_high', label: 'ม.ต้น', icon: '' },
                                        { value: 'senior_high', label: 'ม.ปลาย', icon: '' },
                                        { value: 'common', label: 'ส่วนกลาง', icon: '' }
                                    ].map((option) => (
                                        <label
                                            key={option.value}
                                            className={`
                                                flex-1 min-w-[80px] flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg border cursor-pointer transition-all whitespace-nowrap
                                                ${formData.zone === option.value
                                                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }
                                            `}
                                        >
                                            <input
                                                type="radio"
                                                name="zone"
                                                value={option.value}
                                                checked={formData.zone === option.value}
                                                onChange={handleInputChange}
                                                className="hidden"
                                            />
                                            <span className="text-lg">{option.icon}</span>
                                            <span className="text-xs font-semibold">{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* Right Side: Details & Submit */}
            <div className="w-full md:w-5/12 bg-gray-50 p-6 md:p-8 flex flex-col md:border-l border-t md:border-t-0 border-gray-100">
                <div className="flex-1 space-y-5">
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-800 flex justify-between items-center">
                            <span className="flex items-center gap-2"><ImageIcon size={16} /> รูปภาพประกอบ <span className="text-red-500">*</span></span>
                            <span className="text-xs text-gray-400 font-normal">{images.length}/5</span>
                        </label>

                        <div className="grid grid-cols-4 gap-2">
                            {previews.map((src, index) => (
                                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group bg-white">
                                    <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(index)}
                                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}

                            {images.length < 5 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square rounded-lg bg-white border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all"
                                >
                                    <Plus size={24} />
                                </button>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            accept="image/*"
                            multiple
                            className="hidden"
                        />
                    </div>

                    <div className="space-y-2 flex-1 flex flex-col">
                        <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <FileText size={16} /> รายละเอียด <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="ระบุอาการเสีย..."
                            className="w-full flex-1 min-h-[150px] px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            required
                        />
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                        type="submit"
                        form="repair-form"
                        disabled={isSubmitting}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 transition-all text-base flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Send size={20} />
                                แจ้งซ่อม
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
