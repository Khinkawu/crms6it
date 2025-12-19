"use client";

import React, { useState } from "react";
import { X, Camera, MapPin, Calendar, FileText, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

interface CreateJobModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreateJobModal({ isOpen, onClose }: CreateJobModalProps) {
    const { user, getDisplayName } = useAuth();

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        location: "",
        date: "",
        startTime: "",
        endTime: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Validation
        if (!formData.title || !formData.location || !formData.date) {
            toast.error("กรุณากรอกข้อมูลให้ครบ");
            return;
        }

        setIsSubmitting(true);
        try {
            // Create start and end timestamps
            const startDateTime = new Date(`${formData.date}T${formData.startTime || '09:00'}`);
            const endDateTime = new Date(`${formData.date}T${formData.endTime || '17:00'}`);

            await addDoc(collection(db, "photography_jobs"), {
                title: formData.title,
                description: formData.description || "",
                location: formData.location,
                startTime: Timestamp.fromDate(startDateTime),
                endTime: Timestamp.fromDate(endDateTime),
                assigneeIds: [user.uid],
                assigneeNames: [getDisplayName()],
                requesterId: user.uid,
                requestName: getDisplayName(),
                status: "assigned",
                isManualEntry: true, // Flag to indicate self-created job
                createdAt: serverTimestamp()
            });

            toast.success("สร้างงานใหม่สำเร็จ");
            setFormData({ title: "", description: "", location: "", date: "", startTime: "", endTime: "" });
            onClose();
        } catch (error) {
            console.error("Error creating job:", error);
            toast.error("เกิดข้อผิดพลาดในการสร้างงาน");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                                    <Camera size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">สร้างงานใหม่</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">งานนอกตาราง</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    <FileText size={14} className="inline mr-1" />
                                    ชื่องาน <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    placeholder="เช่น ถ่ายกิจกรรมชมรม"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    required
                                />
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    <MapPin size={14} className="inline mr-1" />
                                    สถานที่ <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    placeholder="สถานที่ถ่ายภาพ"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    required
                                />
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    <Calendar size={14} className="inline mr-1" />
                                    วันที่ <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    required
                                />
                            </div>

                            {/* Time Range */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        เวลาเริ่ม
                                    </label>
                                    <input
                                        type="time"
                                        name="startTime"
                                        value={formData.startTime}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        เวลาสิ้นสุด
                                    </label>
                                    <input
                                        type="time"
                                        name="endTime"
                                        value={formData.endTime}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    รายละเอียดเพิ่มเติม
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="รายละเอียดงาน (ถ้ามี)"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
                                />
                            </div>

                            {/* Assignee Info */}
                            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-sm text-emerald-700 dark:text-emerald-400">
                                <Users size={16} />
                                มอบหมายให้: {getDisplayName()}
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <button
                                type="submit"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium disabled:opacity-50 shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all"
                            >
                                {isSubmitting ? "กำลังสร้าง..." : "สร้างงาน"}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
