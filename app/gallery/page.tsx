"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Camera, Search, Calendar, ExternalLink, User, Filter, X, ChevronLeft, ChevronRight, Pencil, Link, Save, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PhotographyJob } from "@/types";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

// Thai months for filter
const THAI_MONTHS = [
    { value: 1, label: "มกราคม" },
    { value: 2, label: "กุมภาพันธ์" },
    { value: 3, label: "มีนาคม" },
    { value: 4, label: "เมษายน" },
    { value: 5, label: "พฤษภาคม" },
    { value: 6, label: "มิถุนายน" },
    { value: 7, label: "กรกฎาคม" },
    { value: 8, label: "สิงหาคม" },
    { value: 9, label: "กันยายน" },
    { value: 10, label: "ตุลาคม" },
    { value: 11, label: "พฤศจิกายน" },
    { value: 12, label: "ธันวาคม" },
];

// Generate years (current Buddhist year and 2 years back)
const currentBuddhistYear = new Date().getFullYear() + 543;
const YEARS = [
    { value: currentBuddhistYear, label: `${currentBuddhistYear}` },
    { value: currentBuddhistYear - 1, label: `${currentBuddhistYear - 1}` },
    { value: currentBuddhistYear - 2, label: `${currentBuddhistYear - 2}` },
];

export default function GalleryPage() {
    const { user, role } = useAuth();
    const [jobs, setJobs] = useState<PhotographyJob[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Edit Modal State
    const [editingJob, setEditingJob] = useState<PhotographyJob | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDriveLink, setEditDriveLink] = useState("");
    const [editFacebookLink, setEditFacebookLink] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Check if user can edit (admin, moderator, or assigned photographer)
    const canEditJob = (job: PhotographyJob): boolean => {
        if (!user) return false;
        if (role === 'admin' || role === 'moderator') return true;
        return job.assigneeIds?.includes(user.uid) || false;
    };

    // Open edit modal
    const openEditModal = (job: PhotographyJob) => {
        setEditingJob(job);
        setEditTitle(job.title || "");
        setEditDriveLink(job.driveLink || "");
        setEditFacebookLink(job.facebookPermalink || "");
    };

    // Close edit modal
    const closeEditModal = () => {
        setEditingJob(null);
        setEditTitle("");
        setEditDriveLink("");
        setEditFacebookLink("");
    };

    // Save edit
    const handleSaveEdit = async () => {
        if (!editingJob?.id) return;

        setIsSaving(true);
        try {
            await updateDoc(doc(db, "photography_jobs", editingJob.id), {
                title: editTitle,
                driveLink: editDriveLink || null,
                facebookPermalink: editFacebookLink || null,
            });
            toast.success("บันทึกสำเร็จ");
            closeEditModal();
        } catch (error) {
            console.error("Error updating job:", error);
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSaving(false);
        }
    };

    // Fetch completed jobs — ใช้ getDocs แทน onSnapshot
    // completed jobs ไม่เปลี่ยนแปลง ไม่จำเป็นต้องใช้ realtime listener
    useEffect(() => {
        const fetchJobs = async () => {
            const q = query(
                collection(db, "photography_jobs"),
                where("status", "==", "completed"),
                orderBy("endTime", "desc")
            );
            const snapshot = await getDocs(q);
            const fetchedJobs: PhotographyJob[] = [];
            snapshot.forEach((doc) => {
                fetchedJobs.push({ id: doc.id, ...doc.data() } as PhotographyJob);
            });
            setJobs(fetchedJobs);
            setLoading(false);
        };
        fetchJobs();
    }, []);

    // Filter logic
    const filteredJobs = useMemo(() => {
        return jobs.filter((job) => {
            const jobDate = job.endTime?.toDate ? job.endTime.toDate() : new Date();
            const jobMonth = jobDate.getMonth() + 1;
            const jobYear = jobDate.getFullYear() + 543;
            const jobDateStr = jobDate.toISOString().split('T')[0]; // YYYY-MM-DD format

            // Search filter - check title, photographer name, and location
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchTitle = job.title.toLowerCase().includes(query);
                const matchPhotographer = (job.assigneeNames?.join(' ') || (job as any).assigneeName || '').toLowerCase().includes(query);
                const matchLocation = (job.location || '').toLowerCase().includes(query);
                if (!matchTitle && !matchPhotographer && !matchLocation) {
                    return false;
                }
            }

            // Day filter
            if (selectedDay !== null && jobDate.getDate() !== selectedDay) {
                return false;
            }

            // Month filter
            if (selectedMonth !== null && jobMonth !== selectedMonth) {
                return false;
            }

            // Year filter
            if (selectedYear !== null && jobYear !== selectedYear) {
                return false;
            }

            return true;
        });
    }, [jobs, searchQuery, selectedDay, selectedMonth, selectedYear]);

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedDay(null);
        setSelectedMonth(null);
        setSelectedYear(null);
    };

    const hasActiveFilters = searchQuery || selectedDay !== null || selectedMonth !== null || selectedYear !== null;

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedDay, selectedMonth, selectedYear]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);
    const paginatedJobs = filteredJobs.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ประมวลภาพกิจกรรม</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{filteredJobs.length} กิจกรรม</p>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${hasActiveFilters
                        ? 'bg-gray-900 border-gray-900 text-white dark:bg-white dark:border-white dark:text-gray-900'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                        }`}
                >
                    <Filter size={14} />
                    ตัวกรอง
                </button>
            </div>

            {/* Search + Filters */}
            <div className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาชื่อกิจกรรม, ตากล้อง, สถานที่..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600"
                    />
                </div>

                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="flex flex-wrap gap-2 pt-1">
                                <select
                                    value={selectedDay ?? ''}
                                    onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : null)}
                                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                                >
                                    <option value="">ทุกวัน</option>
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                                <select
                                    value={selectedMonth ?? ''}
                                    onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : null)}
                                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                                >
                                    <option value="">ทุกเดือน</option>
                                    {THAI_MONTHS.map((m) => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                                <select
                                    value={selectedYear ?? ''}
                                    onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                                >
                                    <option value="">ทุกปี</option>
                                    {YEARS.map((y) => (
                                        <option key={y.value} value={y.value}>{y.label}</option>
                                    ))}
                                </select>
                                {hasActiveFilters && (
                                    <button onClick={clearFilters} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1.5">
                                        <X size={14} />
                                        ล้างตัวกรอง
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Content */}
            <div>
                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-500">กำลังโหลด...</p>
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="text-center py-20">
                        <Camera size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">ไม่พบกิจกรรม</h3>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                            {hasActiveFilters ? "ลองปรับตัวกรองใหม่" : "ยังไม่มีภาพกิจกรรมในระบบ"}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {paginatedJobs.map((job, index) => (
                                <motion.div
                                    key={job.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="group bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200"
                                >
                                    {/* Cover Image */}
                                    <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 relative overflow-hidden">
                                        {job.coverImage ? (
                                            <img
                                                src={job.coverImage}
                                                alt={job.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Camera size={48} className="text-gray-300 dark:text-gray-600" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="p-4">
                                        <h3 className="font-semibold text-gray-900 dark:text-white transition-colors line-clamp-2">
                                            {job.title}
                                        </h3>

                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                <Calendar size={14} />
                                                <span>
                                                    {job.endTime?.toDate().toLocaleDateString('th-TH', {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                <User size={14} />
                                                <span>ถ่ายโดย: {job.assigneeNames?.join(', ') || (job as any).assigneeName || 'ไม่ระบุ'}</span>
                                            </div>
                                        </div>

                                        {/* Location & Links Row */}
                                        {(job.location || job.driveLink || job.facebookPostId) && (
                                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                                                {job.location ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400">
                                                        📍 {job.location}
                                                    </span>
                                                ) : <span />}
                                                <div className="flex items-center gap-1.5">
                                                    {job.driveLink && (
                                                        <a
                                                            href={job.driveLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="เปิด Google Drive"
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                        >
                                                            <img src="/Google_Drive_icon.png" alt="Drive" className="w-5 h-5 object-contain" />
                                                        </a>
                                                    )}
                                                    {(job.facebookPostId || job.facebookPermalink) && (
                                                        <a
                                                            href={job.facebookPermalink || (job.facebookPostId ? `https://www.facebook.com/permalink.php?story_fbid=${job.facebookPostId.split('_')[1] || job.facebookPostId}&id=${job.facebookPostId.split('_')[0]}` : '#')}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="เปิดโพส Facebook"
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                        >
                                                            <img src="/facebook-logo.png" alt="Facebook" className="w-5 h-5 object-contain" />
                                                        </a>
                                                    )}
                                                    {canEditJob(job) && (
                                                        <button
                                                            onClick={() => openEditModal(job)}
                                                            title="แก้ไขข้อมูล"
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-800/50 text-amber-600 dark:text-amber-400 transition-colors"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div className="flex items-center gap-1">
                                    {(() => {
                                        const pages: (number | string)[] = [];
                                        if (totalPages <= 7) {
                                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                                        } else {
                                            if (currentPage <= 4) {
                                                pages.push(1, 2, 3, 4, 5, '...', totalPages);
                                            } else if (currentPage >= totalPages - 3) {
                                                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                                            } else {
                                                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                                            }
                                        }
                                        return pages.map((page, idx) => (
                                            page === '...' ? (
                                                <span key={`ellipsis-${idx}`} className="w-10 h-10 flex items-center justify-center text-gray-500">...</span>
                                            ) : (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page as number)}
                                                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${page === currentPage
                                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        ));
                                    })()}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingJob && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={closeEditModal}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl w-full max-w-md overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Pencil size={20} className="text-amber-500" />
                                    แก้ไขข้อมูลกิจกรรม
                                </h3>
                                <button
                                    onClick={closeEditModal}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-4">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        หัวข้อกิจกรรม
                                    </label>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                        placeholder="ชื่อกิจกรรม"
                                    />
                                </div>

                                {/* Google Drive Link */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                        <img src="/Google_Drive_icon.png" alt="Drive" className="w-4 h-4" />
                                        Google Drive Link
                                    </label>
                                    <input
                                        type="url"
                                        value={editDriveLink}
                                        onChange={(e) => setEditDriveLink(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                        placeholder="https://drive.google.com/..."
                                    />
                                </div>

                                {/* Facebook Link */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                        <img src="/facebook-logo.png" alt="Facebook" className="w-4 h-4" />
                                        Facebook Post Link
                                    </label>
                                    <input
                                        type="url"
                                        value={editFacebookLink}
                                        onChange={(e) => setEditFacebookLink(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                        placeholder="https://www.facebook.com/..."
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                                <button
                                    onClick={closeEditModal}
                                    className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={isSaving}
                                    className="px-5 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            กำลังบันทึก...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            บันทึก
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
