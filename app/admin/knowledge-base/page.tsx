"use client";

import React, { useState, useEffect } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Plus,
    BookOpen,
    Edit2,
    Trash2,
    ArrowLeft,
    Tag
} from "lucide-react";
import Link from "next/link";
import KnowledgeModal from "@/app/components/admin/KnowledgeModal";

interface KnowledgeItem {
    id: string;
    question: string;
    answer: string;
    category: string;
    keywords: string[];
    createdAt: any;
}

export default function KnowledgeBasePage() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [items, setItems] = useState<KnowledgeItem[]>([]);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);

    // Auth Check
    useEffect(() => {
        if (!loading && (!user || (role !== 'admin' && role !== 'moderator'))) {
            router.push("/");
        }
    }, [user, role, loading, router]);

    // Real-time Fetch
    useEffect(() => {
        const q = query(
            collection(db, "it_knowledge_base"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedItems = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as KnowledgeItem[];
            setItems(fetchedItems);
        });

        return () => unsubscribe();
    }, []);

    // Filter Logic
    const filteredItems = items.filter(item => {
        const search = searchTerm.toLowerCase();
        return (
            item.question.toLowerCase().includes(search) ||
            item.answer.toLowerCase().includes(search) ||
            item.keywords.some(k => k.toLowerCase().includes(search))
        );
    });

    const handleEdit = (item: KnowledgeItem) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("คุณแน่ใจหรือไม่ที่จะลบข้อมูลนี้?")) {
            try {
                await deleteDoc(doc(db, "it_knowledge_base", id));
            } catch (err) {
                console.error("Error deleting item:", err);
                alert("ลบข้อมูลไม่สำเร็จ");
            }
        }
    };

    const handleAddNew = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-4 pb-24 md:p-6 space-y-6">

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <Link href="/admin/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                        <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <BookOpen className="text-blue-600" />
                            คลังความรู้ IT
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            จัดการคำถาม-คำตอบสำหรับ AI Q&A
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="ค้นหาข้อมูล..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full md:w-64 rounded-xl bg-gray-100 dark:bg-gray-900 border-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                    <button
                        onClick={handleAddNew}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/30"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">เพิ่มข้อมูล</span>
                    </button>
                </div>
            </header>

            {/* List */}
            <motion.div layout className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AnimatePresence>
                    {filteredItems.map((item) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            key={item.id}
                            className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-lg">
                                            {item.category}
                                        </span>
                                        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                                            {item.question}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                        {item.answer}
                                    </p>

                                    {/* Keywords */}
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {item.keywords.map((k, idx) => (
                                            <span key={idx} className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md">
                                                <Tag size={10} />
                                                {k}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEdit(item)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>

            {/* Empty State */}
            {filteredItems.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
                    <p>ไม่พบข้อมูลคลังความรู้</p>
                </div>
            )}

            {/* Modal */}
            <KnowledgeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editItem={editingItem}
                onSuccess={() => setIsModalOpen(false)}
            />
        </div>
    );
}
