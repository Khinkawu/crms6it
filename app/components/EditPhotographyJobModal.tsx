"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Edit2, Image as ImageIcon } from "lucide-react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { PhotographyJob, UserProfile } from "@/types";
import toast from "react-hot-toast";
import { compressImage } from "@/utils/imageCompression";

interface EditPhotographyJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: PhotographyJob | null;
    photographers: UserProfile[];
}

export default function EditPhotographyJobModal({ isOpen, onClose, job, photographers }: EditPhotographyJobModalProps) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        location: '',
        startTime: '',
        endTime: '',
        assigneeIds: [] as string[],
        driveLink: '',
        status: 'assigned' as 'pending_assign' | 'assigned' | 'completed' | 'cancelled',
        coverImage: '',
        showInAgenda: true
    });
    const [saving, setSaving] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        if (job) {
            const startDate = job.startTime?.toDate?.() || new Date();
            const endDate = job.endTime?.toDate?.() || new Date();

            // Format date to local timezone for datetime-local input
            const formatLocalDateTime = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
            };

            setFormData({
                title: job.title || '',
                description: job.description || '',
                location: job.location || '',
                startTime: formatLocalDateTime(startDate),
                endTime: formatLocalDateTime(endDate),
                assigneeIds: job.assigneeIds || [],
                driveLink: job.driveLink || '',
                status: job.status || 'assigned',
                coverImage: job.coverImage || '',
                showInAgenda: job.showInAgenda !== false // Default to true if undefined
            });
            setImagePreview(job.coverImage || '');
            setImageFile(null);
        }
    }, [job]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview('');
        setFormData(prev => ({ ...prev, coverImage: '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!job?.id) return;

        setSaving(true);
        try {
            let coverImageUrl = formData.coverImage;

            // Upload new image if selected
            if (imageFile) {
                setUploadingImage(true);
                toast.loading('กำลังบีบอัดและอัปโหลดรูปภาพ...', { id: 'upload-image' });

                // Compress image before upload
                const compressedFile = await compressImage(imageFile, {
                    maxWidth: 1920,
                    maxHeight: 1080,
                    quality: 0.8,
                    maxSizeMB: 0.5
                });

                const fileName = `photography_jobs/${job.id}/cover_${Date.now()}.jpg`;
                const storageRef = ref(storage, fileName);

                await uploadBytes(storageRef, compressedFile);
                coverImageUrl = await getDownloadURL(storageRef);

                toast.success(`อัปโหลดสำเร็จ (${(compressedFile.size / 1024).toFixed(0)} KB)`, { id: 'upload-image' });
                setUploadingImage(false);
            }

            const assigneeNames = formData.assigneeIds.map(id => {
                const p = photographers.find(ph => ph.uid === id);
                return p?.displayName || '';
            }).filter(Boolean);

            await updateDoc(doc(db, "photography_jobs", job.id), {
                title: formData.title,
                description: formData.description,
                location: formData.location,
                startTime: Timestamp.fromDate(new Date(formData.startTime)),
                endTime: Timestamp.fromDate(new Date(formData.endTime)),
                assigneeIds: formData.assigneeIds,
                assigneeNames,
                driveLink: formData.driveLink,
                status: formData.status,
                coverImage: coverImageUrl,
                showInAgenda: formData.showInAgenda
            });

            toast.success("บันทึกสำเร็จ");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setSaving(false);
            setUploadingImage(false);
        }
    };

    const toggleAssignee = (uid: string) => {
        setFormData(prev => ({
            ...prev,
            assigneeIds: prev.assigneeIds.includes(uid)
                ? prev.assigneeIds.filter(id => id !== uid)
                : [...prev.assigneeIds, uid]
        }));
    };

    if (!isOpen || !job) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            แก้ไขงานตากล้อง
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                ชื่องาน
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* Cover Image */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                ภาพปก
                            </label>
                            <div className="space-y-3">
                                {/* Image Preview */}
                                {imagePreview ? (
                                    <div className="relative group">
                                        <img
                                            src={imagePreview}
                                            alt="Cover preview"
                                            className="w-full h-48 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                                            <label className="p-2 bg-white/90 rounded-lg cursor-pointer hover:bg-white transition-colors">
                                                <Edit2 size={18} className="text-gray-700" />
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                    className="hidden"
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                className="p-2 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                                            >
                                                <X size={18} className="text-white" />
                                            </button>
                                        </div>
                                        {uploadingImage && (
                                            <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                                                <div className="animate-spin h-8 w-8 border-3 border-white rounded-full border-t-transparent" />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                                        <ImageIcon size={32} className="text-gray-400 mb-2" />
                                        <span className="text-sm text-gray-500 dark:text-gray-400">คลิกเพื่อเลือกภาพปก</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">PNG, JPG สูงสุด 5MB</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                รายละเอียด
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                        </div>

                        {/* Location */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                สถานที่
                            </label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* Date/Time */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    เริ่มต้น
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    สิ้นสุด
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        </div>

                        {/* Assignees */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                ช่างภาพ
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {photographers.map((p) => (
                                    <button
                                        key={p.uid}
                                        type="button"
                                        onClick={() => toggleAssignee(p.uid)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${formData.assigneeIds.includes(p.uid)
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                            }`}
                                    >
                                        {p.displayName}
                                    </button>
                                ))}
                                {photographers.length === 0 && (
                                    <p className="text-sm text-gray-500">ไม่พบช่างภาพในระบบ</p>
                                )}
                            </div>
                        </div>

                        {/* Drive Link */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                ลิงก์ Google Drive
                            </label>
                            <input
                                type="url"
                                value={formData.driveLink}
                                onChange={(e) => setFormData(prev => ({ ...prev, driveLink: e.target.value }))}
                                placeholder="https://drive.google.com/..."
                                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Show in Agenda */}
                        <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800/50">
                            <input
                                type="checkbox"
                                id="editShowInAgenda"
                                checked={formData.showInAgenda}
                                onChange={(e) => setFormData(prev => ({ ...prev, showInAgenda: e.target.checked }))}
                                className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                            />
                            <label htmlFor="editShowInAgenda" className="flex-1 cursor-pointer">
                                <span className="text-sm font-medium text-purple-800 dark:text-purple-300 flex items-center gap-2">
                                    📅 แสดงในปฏิทิน (Agenda)
                                </span>
                                <span className="text-xs text-purple-600 dark:text-purple-400 block mt-0.5">
                                    ติ๊กเพื่อให้งานนี้ปรากฏในหน้า Dashboard ปฏิทิน
                                </span>
                            </label>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                สถานะ
                            </label>
                            <div className="flex gap-2">
                                {(['assigned', 'completed', 'cancelled'] as const).map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${formData.status === s
                                            ? s === 'assigned' ? 'bg-amber-500 text-white' :
                                                s === 'completed' ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                            }`}
                                    >
                                        {s === 'assigned' ? 'รอส่งงาน' : s === 'completed' ? 'เสร็จสิ้น' : 'ยกเลิก'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent" />
                            ) : (
                                <>
                                    <Save size={18} />
                                    บันทึก
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
