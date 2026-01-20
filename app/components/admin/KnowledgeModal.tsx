"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, AlertCircle } from "lucide-react";
import { addDoc, collection, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface KnowledgeItem {
    id?: string;
    question: string;
    answer: string;
    keywords: string[];
    category: string;
}

interface KnowledgeModalProps {
    isOpen: boolean;
    onClose: () => void;
    editItem?: KnowledgeItem | null;
    onSuccess: () => void;
}

export default function KnowledgeModal({ isOpen, onClose, editItem, onSuccess }: KnowledgeModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Form States
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [keywordsInput, setKeywordsInput] = useState("");
    const [category, setCategory] = useState("General");

    useEffect(() => {
        if (editItem) {
            setQuestion(editItem.question);
            setAnswer(editItem.answer);
            setKeywordsInput(editItem.keywords.join(", "));
            setCategory(editItem.category || "General");
        } else {
            // Reset for create mode
            setQuestion("");
            setAnswer("");
            setKeywordsInput("");
            setCategory("General");
        }
        setError("");
    }, [editItem, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const keywords = keywordsInput.split(",").map(k => k.trim()).filter(k => k.length > 0);

            const dataToSave = {
                question,
                answer,
                keywords,
                category,
                updatedAt: Timestamp.now()
            };

            if (editItem?.id) {
                // Update
                await updateDoc(doc(db, "it_knowledge_base", editItem.id), dataToSave);
            } else {
                // Create
                await addDoc(collection(db, "it_knowledge_base"), {
                    ...dataToSave,
                    createdAt: Timestamp.now()
                });
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error saving knowledge item:", err);
            setError(err.message || "Failed to save data");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {editItem ? "แก้ไขข้อมูล" : "เพิ่มข้อมูลใหม่"}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                คำถาม / ปัญหา
                            </label>
                            <input
                                required
                                type="text"
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                                placeholder="เช่น รหัส Wifi โรงเรียนอะไร"
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                คำตอบ (รองรับ Markdown)
                            </label>
                            <textarea
                                required
                                rows={4}
                                value={answer}
                                onChange={e => setAnswer(e.target.value)}
                                placeholder="เช่น ชื่อ WiFi: ABC, รหัส: 1234"
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    หมวดหมู่
                                </label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
                                >
                                    <option value="General">ทั่วไป</option>
                                    <option value="Network">Network / WiFi</option>
                                    <option value="Printer">Printer</option>
                                    <option value="Software">Software</option>
                                    <option value="Hardware">Hardware</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Keywords (คั่นด้วยจุลภาค)
                                </label>
                                <input
                                    type="text"
                                    value={keywordsInput}
                                    onChange={e => setKeywordsInput(e.target.value)}
                                    placeholder="wifi, internet, รหัส"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                <Save size={18} />
                                {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
