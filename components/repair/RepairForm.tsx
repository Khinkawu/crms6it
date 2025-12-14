/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { Toaster, toast } from 'react-hot-toast';
import { logActivity } from "../../utils/logger";
import {
    User, MapPin, Image as ImageIcon, FileText,
    Send, Loader2, X, Plus, Wrench, Phone, Building
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
            const imageUrls: string[] = [];
            for (const image of images) {
                const storageRef = ref(storage, `repair_images/${Date.now()}_${image.name}`);
                const snapshot = await uploadBytes(storageRef, image);
                const url = await getDownloadURL(snapshot.ref);
                imageUrls.push(url);
            }

            const docRef = await addDoc(collection(db, "repair_tickets"), {
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

            fetch('/api/notify-repair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: docRef.id,
                    requesterName: user.displayName || "Unknown",
                    room: formData.room,
                    zone: formData.zone,
                    description: formData.description,
                    imageOneUrl: imageUrls.length > 0 ? imageUrls[0] : null
                })
            }).catch(err => console.error("Failed to send LINE notification:", err));

            await logActivity({
                action: 'repair',
                productName: formData.room,
                userName: user.displayName || "Unknown",
                details: formData.description,
                imageUrl: imageUrls.length > 0 ? imageUrls[0] : undefined,
                zone: formData.zone
            });

            toast.success("แจ้งซ่อมเรียบร้อยแล้ว", { id: toastId });

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

    if (authLoading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">กำลังโหลด...</div>;
    if (!user) return <div className="p-8 text-center text-red-500">กรุณาเข้าสู่ระบบ</div>;

    return (
        <div className="w-full max-w-4xl mx-auto animate-fade-in">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30 mb-4">
                    <Wrench size={32} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">แจ้งซ่อม</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">แจ้งปัญหาอุปกรณ์ชำรุดหรือเสียหาย</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* User Info Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                        <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <User size={16} />
                        </div>
                        ข้อมูลผู้แจ้ง
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">ชื่อผู้แจ้ง</label>
                            <input
                                type="text"
                                value={user.displayName || user.email || ""}
                                disabled
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">ตำแหน่ง</label>
                            <select
                                name="position"
                                value={formData.position}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 outline-none"
                            >
                                <option value="ผู้บริหาร">ผู้บริหาร</option>
                                <option value="ครู">ครู</option>
                                <option value="ครู LS">ครู LS</option>
                                <option value="บุคลากร">บุคลากร</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block flex items-center gap-1">
                                <Phone size={12} />
                                เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                placeholder="08x-xxx-xxxx"
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 outline-none placeholder:text-gray-400"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Location Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                        <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            <MapPin size={16} />
                        </div>
                        สถานที่
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block flex items-center gap-1">
                                <Building size={12} />
                                ห้อง / สถานที่ <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="room"
                                value={formData.room}
                                onChange={handleInputChange}
                                placeholder="เช่น ห้อง 101, ห้องประชุม ฯลฯ"
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 outline-none placeholder:text-gray-400"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">โซน <span className="text-red-500">*</span></label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'junior_high', label: 'ม.ต้น', icon: '🏫' },
                                    { value: 'senior_high', label: 'ม.ปลาย', icon: '🎓' },
                                ].map((option) => (
                                    <label
                                        key={option.value}
                                        className={`
                                            flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
                                            ${formData.zone === option.value
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                                                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                                        <span className="text-xl">{option.icon}</span>
                                        <span className="font-medium">{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Images Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                <ImageIcon size={16} />
                            </div>
                            รูปภาพประกอบ <span className="text-red-500">*</span>
                        </div>
                        <span className="text-xs text-gray-400 font-medium">{images.length}/5</span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {previews.map((src, index) => (
                            <div key={index} className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-600 group bg-gray-100 dark:bg-gray-700">
                                <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}

                        {images.length < 5 && (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-all bg-gray-50 dark:bg-gray-700/30"
                            >
                                <Plus size={24} />
                                <span className="text-xs mt-1">เพิ่มรูป</span>
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

                {/* Description Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                        <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <FileText size={16} />
                        </div>
                        รายละเอียดอาการเสีย <span className="text-red-500">*</span>
                    </div>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="ระบุอาการเสียหรือปัญหาที่พบ..."
                        className="w-full min-h-[120px] px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 outline-none resize-none placeholder:text-gray-400"
                        required
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold shadow-xl shadow-orange-500/30 hover:shadow-orange-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 transition-all text-base flex items-center justify-center gap-2 tap-scale"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            กำลังบันทึก...
                        </>
                    ) : (
                        <>
                            <Send size={20} />
                            ส่งแจ้งซ่อม
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
