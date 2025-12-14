"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Camera, Search, Calendar, ExternalLink, User, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PhotographyJob } from "../../types";

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
    const [jobs, setJobs] = useState<PhotographyJob[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Fetch completed jobs
    useEffect(() => {
        const q = query(
            collection(db, "photography_jobs"),
            where("status", "==", "completed"),
            orderBy("endTime", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedJobs: PhotographyJob[] = [];
            snapshot.forEach((doc) => {
                fetchedJobs.push({ id: doc.id, ...doc.data() } as PhotographyJob);
            });
            setJobs(fetchedJobs);
            setLoading(false);
        });

        return () => unsubscribe();
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
                const matchPhotographer = (job.assigneeName || '').toLowerCase().includes(query);
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30">
                                <Camera size={24} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">ประมวลภาพกิจกรรม</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{filteredJobs.length} กิจกรรม</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2.5 rounded-xl border transition-all ${hasActiveFilters
                                ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-700'
                                : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                                }`}
                        >
                            <Filter size={20} />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ค้นหาชื่อกิจกรรม, ตากล้อง, สถานที่..."
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Filter Panel */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="pt-4 flex flex-wrap gap-3">
                                    <select
                                        value={selectedDay ?? ''}
                                        onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : null)}
                                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                                    >
                                        <option value="">ทุกวัน</option>
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>

                                    <select
                                        value={selectedMonth ?? ''}
                                        onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : null)}
                                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                                    >
                                        <option value="">ทุกเดือน</option>
                                        {THAI_MONTHS.map((m) => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>

                                    <select
                                        value={selectedYear ?? ''}
                                        onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                                    >
                                        <option value="">ทุกปี</option>
                                        {YEARS.map((y) => (
                                            <option key={y.value} value={y.value}>{y.label}</option>
                                        ))}
                                    </select>

                                    {hasActiveFilters && (
                                        <button
                                            onClick={clearFilters}
                                            className="px-4 py-2 rounded-xl bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-sm flex items-center gap-2"
                                        >
                                            <X size={16} />
                                            ล้างตัวกรอง
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
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
                                <motion.a
                                    key={job.id}
                                    href={job.driveLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700"
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
                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="p-2 rounded-lg bg-white/90 backdrop-blur shadow-lg">
                                                <ExternalLink size={18} className="text-gray-700" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-4">
                                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
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
                                                <span>ถ่ายโดย: {job.assigneeName || 'ไม่ระบุ'}</span>
                                            </div>
                                        </div>

                                        {job.location && (
                                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400">
                                                    📍 {job.location}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </motion.a>
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
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${page === currentPage
                                                    ? 'bg-blue-500 text-white'
                                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
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
        </div>
    );
}
