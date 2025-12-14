"use client";

import React, { useState } from "react";
import { X, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import toast from "react-hot-toast";

interface ReportIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ReportIssueModal({ isOpen, onClose }: ReportIssueModalProps) {
    const [details, setDetails] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!details.trim()) {
            toast.error("กรุณาระบุรายละเอียดปัญหา");
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "feedbacks"), {
                details: details.trim(),
                timestamp: serverTimestamp(),
                status: 'new',
                userAgent: window.navigator.userAgent
            });

            setIsSuccess(true);
            setDetails("");
            setTimeout(() => {
                onClose();
                setTimeout(() => setIsSuccess(false), 300); // Reset after close
            }, 3000);
        } catch (error) {
            console.error("Error submitting feedback:", error);
            toast.error("เกิดข้อผิดพลาดในการส่งข้อมูล");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden pointer-events-auto"
                        >
                            {!isSuccess ? (
                                <form onSubmit={handleSubmit} className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2 text-amber-500">
                                            <AlertTriangle size={24} />
                                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">แจ้งปัญหาการใช้งาน</h2>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <X size={20} className="text-gray-400" />
                                        </button>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                            พบปัญหาการใช้งาน หรือมีข้อเสนอแนะ? แจ้งเราได้เลย (ข้อมูลจะถูกส่งโดยไม่ระบุตัวตน)
                                        </p>
                                        <textarea
                                            value={details}
                                            onChange={(e) => setDetails(e.target.value)}
                                            placeholder="อธิบายปัญหาที่พบ หรือข้อเสนอแนะ..."
                                            className="w-full h-32 p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                                            required
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                            disabled={isSubmitting}
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-amber-500 hover:bg-amber-600 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? (
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Send size={16} />
                                            )}
                                            ส่งข้อมูล
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="p-8 flex flex-col items-center text-center">
                                    <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                        ขอบคุณสำหรับข้อมูล!
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        ข้อมูลของคุณถูกส่งเรียบร้อยแล้ว เราจะนำไปปรับปรุงระบบให้ดียิ่งขึ้น
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
