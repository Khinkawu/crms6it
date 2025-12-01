/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { Toaster, toast } from 'react-hot-toast';
import { logActivity } from "../../utils/logger";

export default function RepairPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
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

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

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
                requesterName: user?.displayName || "Unknown",
                requesterEmail: user?.email || "Unknown",
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
                    requesterName: user?.displayName || "Unknown",
                    room: formData.room,
                    zone: formData.zone,
                    description: formData.description,
                    imageOneUrl: imageUrls.length > 0 ? imageUrls[0] : null
                })
            }).catch(err => console.error("Failed to send LINE notification:", err));

            // 4. Log Activity
            await logActivity({
                action: 'repair',
                productName: `แจ้งซ่อม: ${formData.room}`,
                userName: user?.displayName || "Unknown",
                details: formData.description,
                imageUrl: imageUrls.length > 0 ? imageUrls[0] : undefined
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

    if (authLoading || !user) return null;

    return (
        <div className="w-full max-w-6xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col md:flex-row h-auto md:h-[85vh] max-h-[900px] animate-fade-in">
            <Toaster position="top-center" />

            {/* Left Side: Form Inputs */}
            <div className="w-full md:w-7/12 p-6 md:p-8 overflow-y-auto custom-scrollbar">
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
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                            </svg>
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
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.006.003.002.001.001.001zm4.961-9.422a1 1 0 11-1.414-1.414 3 3 0 00-4.242 0 1 1 0 01-1.414-1.414 5 5 0 017.07 0z" clipRule="evenodd" />
                            </svg>
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
                                <div className="flex gap-2">
                                    {[
                                        { value: 'junior_high', label: 'ม.ต้น', icon: '🏫' },
                                        { value: 'senior_high', label: 'ม.ปลาย', icon: '🏢' },
                                        { value: 'common', label: 'ส่วนกลาง', icon: '🌳' }
                                    ].map((option) => (
                                        <label
                                            key={option.value}
                                            className={`
                                                flex-1 flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg border cursor-pointer transition-all
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
            <div className="w-full md:w-5/12 bg-gray-50 p-6 md:p-8 flex flex-col border-l border-gray-100">
                <div className="flex-1 space-y-5">
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-800 flex justify-between items-center">
                            <span>รูปภาพประกอบ <span className="text-red-500">*</span></span>
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
                                        <span className="text-xs">×</span>
                                    </button>
                                </div>
                            ))}

                            {images.length < 5 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square rounded-lg bg-white border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all"
                                >
                                    <span className="text-xl leading-none">+</span>
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
                        <label className="text-sm font-semibold text-gray-800">รายละเอียด <span className="text-red-500">*</span></label>
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
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                กำลังบันทึก...
                            </>
                        ) : (
                            "แจ้งซ่อม"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
