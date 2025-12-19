"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
    Wrench, Camera, ClipboardList, Clock, CheckCircle2, AlertCircle,
    Plus, FileSpreadsheet, Printer, ChevronLeft, ChevronRight, Search, X
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMyRepairs } from "@/hooks/useMyRepairs";
import { useMyPhotographyJobs } from "@/hooks/useMyPhotographyJobs";
import { PageSkeleton } from "../components/ui/Skeleton";
import StatsCard from "../components/shared/StatsCard";
import CreateJobModal from "../components/CreateJobModal";
import MyPhotographyJobsModal from "../components/MyPhotographyJobsModal";
import { RepairTicket, PhotographyJob } from "@/types";
import { getThaiStatus, getStatusColor } from "@/hooks/useRepairAdmin";
import { exportToExcel } from "@/utils/excelExport";
import { exportPhotographyToExcel } from "@/utils/photographyExport";
import toast from "react-hot-toast";

// Pagination
const ITEMS_PER_PAGE = 10;

export default function MyWorkPage() {
    const { user, role, isPhotographer, loading: authLoading, getDisplayName } = useAuth();
    const router = useRouter();

    // Determine user capabilities
    const isTechnician = role === 'technician';
    const canViewRepairs = isTechnician;
    const canViewPhotography = isPhotographer;

    // Active tab
    const [activeTab, setActiveTab] = useState<'repairs' | 'photography'>(
        canViewRepairs ? 'repairs' : 'photography'
    );

    // Data hooks
    const { currentJobs: currentRepairs, completedJobs: completedRepairs, allJobs: allRepairs, stats: repairStats, loading: repairsLoading } = useMyRepairs({
        userId: user?.uid,
        userName: getDisplayName()
    });

    const { assignedJobs, completedJobs: completedPhotoJobs, allJobs: allPhotoJobs, stats: photoStats, loading: photoLoading } = useMyPhotographyJobs({
        userId: user?.uid
    });

    // Pagination
    const [repairPage, setRepairPage] = useState(1);
    const [photoPage, setPhotoPage] = useState(1);

    // Filters
    const [photoSearch, setPhotoSearch] = useState("");

    // Modals
    const [isCreateJobModalOpen, setIsCreateJobModalOpen] = useState(false);
    const [isSubmitJobModalOpen, setIsSubmitJobModalOpen] = useState(false);

    // Filtered photo jobs
    const filteredPhotoJobs = useMemo(() => {
        if (!photoSearch) return allPhotoJobs;
        const searchLower = photoSearch.toLowerCase();
        return allPhotoJobs.filter(job => {
            const titleMatch = job.title?.toLowerCase().includes(searchLower);
            const locationMatch = job.location?.toLowerCase().includes(searchLower);
            const dateMatch = job.startTime?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).includes(searchLower);
            return titleMatch || locationMatch || dateMatch;
        });
    }, [allPhotoJobs, photoSearch]);

    // Set default tab based on role
    useEffect(() => {
        if (!authLoading) {
            if (canViewRepairs && !canViewPhotography) {
                setActiveTab('repairs');
            } else if (canViewPhotography && !canViewRepairs) {
                setActiveTab('photography');
            }
        }
    }, [authLoading, canViewRepairs, canViewPhotography]);

    // Auth check - only technician or photographer
    useEffect(() => {
        if (!authLoading && user && !canViewRepairs && !canViewPhotography) {
            router.push("/");
        }
    }, [authLoading, user, canViewRepairs, canViewPhotography, router]);

    // Reset page when filter changes
    useEffect(() => {
        setPhotoPage(1);
    }, [photoSearch]);

    if (authLoading || repairsLoading || photoLoading) {
        return <PageSkeleton />;
    }

    if (!user || (!canViewRepairs && !canViewPhotography)) {
        return null;
    }

    // Pagination helpers
    const paginatedRepairs = allRepairs.slice((repairPage - 1) * ITEMS_PER_PAGE, repairPage * ITEMS_PER_PAGE);
    const totalRepairPages = Math.ceil(allRepairs.length / ITEMS_PER_PAGE);

    const paginatedPhotos = filteredPhotoJobs.slice((photoPage - 1) * ITEMS_PER_PAGE, photoPage * ITEMS_PER_PAGE);
    const totalPhotoPages = Math.ceil(filteredPhotoJobs.length / ITEMS_PER_PAGE);

    // Export handlers - Repair
    const handleExportRepairExcel = () => {
        if (allRepairs.length === 0) {
            toast.error("ไม่มีข้อมูลให้ส่งออก");
            return;
        }
        exportToExcel(allRepairs, `My_Repairs_${new Date().toISOString().split('T')[0]}`);
        toast.success("ส่งออก Excel สำเร็จ");
    };

    // Export handlers - Photography
    const handleExportPhotoExcel = () => {
        if (filteredPhotoJobs.length === 0) {
            toast.error("ไม่มีข้อมูลให้ส่งออก");
            return;
        }
        exportPhotographyToExcel(filteredPhotoJobs, `My_Photography_${new Date().toISOString().split('T')[0]}`);
        toast.success("ส่งออก Excel สำเร็จ");
    };

    const handlePrintPhoto = async () => {
        if (filteredPhotoJobs.length === 0) {
            toast.error("ไม่มีข้อมูลให้พิมพ์");
            return;
        }
        toast.loading("กำลังเตรียมพิมพ์...", { id: 'print-photo' });
        try {
            const { generatePhotographyJobReport } = await import('@/lib/generateReport');
            await generatePhotographyJobReport(filteredPhotoJobs, 'print');
            toast.dismiss('print-photo');
        } catch (error) {
            console.error(error);
            toast.error("พิมพ์ไม่สำเร็จ", { id: 'print-photo' });
        }
    };

    const handlePrintRepair = async () => {
        if (allRepairs.length === 0) {
            toast.error("ไม่มีข้อมูลให้พิมพ์");
            return;
        }
        toast.loading("กำลังเตรียมพิมพ์...", { id: 'print-repair' });
        try {
            const { generateStockReport } = await import('@/lib/generateReport');
            const reportData = {
                ticketId: '',
                reportDate: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }),
                requester: getDisplayName() || 'ช่างเทคนิค',
                items: allRepairs.map(ticket => ({
                    requestDate: ticket.createdAt?.toDate().toLocaleString('th-TH') || '-',
                    requesterName: ticket.requesterName || '-',
                    code: ticket.id || '-',
                    name: ticket.description || '-',
                    zone: ticket.room || '-',
                    status: getThaiStatus(ticket.status)
                }))
            };
            await generateStockReport(reportData, 'print');
            toast.dismiss('print-repair');
        } catch (error) {
            console.error(error);
            toast.error("พิมพ์ไม่สำเร็จ", { id: 'print-repair' });
        }
    };

    return (
        <div className="animate-fade-in pb-24">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30">
                            <ClipboardList size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">งานของฉัน</h1>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">ดูภาพรวมและประวัติงานทั้งหมด</p>
                        </div>
                    </div>

                    {/* Photographer Actions - Compact for mobile */}
                    {canViewPhotography && activeTab === 'photography' && (
                        <div className="flex gap-1.5 sm:gap-2">
                            <button
                                onClick={() => setIsCreateJobModalOpen(true)}
                                className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs sm:text-sm font-medium shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all tap-scale"
                            >
                                <Plus size={16} />
                                <span className="hidden sm:inline">สร้างงานใหม่</span>
                                <span className="sm:hidden">สร้าง</span>
                            </button>
                            <button
                                onClick={() => setIsSubmitJobModalOpen(true)}
                                className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs sm:text-sm font-medium shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all tap-scale"
                            >
                                <CheckCircle2 size={16} />
                                <span className="hidden sm:inline">ส่งงาน</span>
                                <span className="sm:hidden">ส่ง</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                {canViewRepairs && canViewPhotography && (
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
                        <button
                            onClick={() => setActiveTab('repairs')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'repairs'
                                ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <Wrench size={16} />
                            งานซ่อม
                        </button>
                        <button
                            onClick={() => setActiveTab('photography')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'photography'
                                ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <Camera size={16} />
                            งานถ่ายภาพ
                        </button>
                    </div>
                )}

                {/* Content based on active tab */}
                <AnimatePresence mode="wait">
                    {activeTab === 'repairs' && canViewRepairs && (
                        <motion.div
                            key="repairs"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Stats */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatsCard icon={ClipboardList} label="ทั้งหมด" value={repairStats.total} color="gray" />
                                <StatsCard icon={Clock} label="รอดำเนินการ" value={repairStats.pending} color="amber" />
                                <StatsCard icon={AlertCircle} label="กำลังดำเนินการ" value={repairStats.inProgress} color="blue" />
                                <StatsCard icon={CheckCircle2} label="เสร็จสิ้น" value={repairStats.completed} color="emerald" />
                            </div>

                            {/* Current Jobs */}
                            {currentRepairs.length > 0 && (
                                <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 shadow-sm">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Clock size={18} className="text-blue-500" />
                                        งานปัจจุบัน ({currentRepairs.length})
                                    </h3>
                                    <div className="grid gap-3">
                                        {currentRepairs.map((ticket) => (
                                            <RepairJobCard key={ticket.id} ticket={ticket} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* History Table */}
                            <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                        <ClipboardList size={18} className="text-gray-500" />
                                        ประวัติงานทั้งหมด
                                    </h3>
                                    <div className="flex gap-2">
                                        <button onClick={handleExportRepairExcel} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-emerald-600" title="Export Excel">
                                            <FileSpreadsheet size={18} />
                                        </button>
                                        <button onClick={handlePrintRepair} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600" title="Print">
                                            <Printer size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                                <th className="pb-3 font-medium">ห้อง</th>
                                                <th className="pb-3 font-medium hidden sm:table-cell">อาการ</th>
                                                <th className="pb-3 font-medium">สถานะ</th>
                                                <th className="pb-3 font-medium hidden md:table-cell">วันที่</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedRepairs.map((ticket) => (
                                                <tr key={ticket.id} className="border-b border-gray-100 dark:border-gray-800">
                                                    <td className="py-3 text-gray-900 dark:text-white font-medium">{ticket.room}</td>
                                                    <td className="py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell truncate max-w-[200px]">{ticket.description}</td>
                                                    <td className="py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                                                            {getThaiStatus(ticket.status)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                                                        {ticket.createdAt?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalRepairPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-4">
                                        <button
                                            onClick={() => setRepairPage(p => Math.max(1, p - 1))}
                                            disabled={repairPage === 1}
                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {repairPage} / {totalRepairPages}
                                        </span>
                                        <button
                                            onClick={() => setRepairPage(p => Math.min(totalRepairPages, p + 1))}
                                            disabled={repairPage === totalRepairPages}
                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'photography' && canViewPhotography && (
                        <motion.div
                            key="photography"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Compact Stats Row */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-3 text-center">
                                    <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-gray-500 to-slate-600 flex items-center justify-center text-white mb-2">
                                        <ClipboardList size={20} />
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{photoStats.total}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">ทั้งหมด</p>
                                </div>
                                <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-3 text-center">
                                    <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white mb-2">
                                        <Camera size={20} />
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{photoStats.assigned}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">รอส่งงาน</p>
                                </div>
                                <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-3 text-center">
                                    <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white mb-2">
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{photoStats.completed}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">เสร็จสิ้น</p>
                                </div>
                            </div>

                            {/* Current Jobs */}
                            {assignedJobs.length > 0 && (
                                <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 shadow-sm">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Camera size={18} className="text-purple-500" />
                                        งานรอส่ง ({assignedJobs.length})
                                    </h3>
                                    <div className="grid gap-3">
                                        {assignedJobs.map((job) => (
                                            <PhotographyJobCard key={job.id} job={job} onSubmit={() => setIsSubmitJobModalOpen(true)} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* History */}
                            <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 shadow-sm">
                                {/* Header with search and export */}
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
                                        <ClipboardList size={18} className="text-gray-500" />
                                        ประวัติ ({filteredPhotoJobs.length})
                                    </h3>
                                    <div className="flex gap-1">
                                        <button onClick={handleExportPhotoExcel} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-emerald-600" title="Export Excel">
                                            <FileSpreadsheet size={18} />
                                        </button>
                                        <button onClick={handlePrintPhoto} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600" title="Print">
                                            <Printer size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Search */}
                                <div className="relative mb-4">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="ค้นหา..."
                                        value={photoSearch}
                                        onChange={(e) => setPhotoSearch(e.target.value)}
                                        className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                    />
                                    {photoSearch && (
                                        <button
                                            onClick={() => setPhotoSearch("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Mobile-friendly card list */}
                                <div className="space-y-2">
                                    {paginatedPhotos.length === 0 ? (
                                        <div className="py-8 text-center text-gray-400 text-sm">
                                            {photoSearch ? "ไม่พบผลลัพธ์" : "ไม่มีข้อมูล"}
                                        </div>
                                    ) : (
                                        paginatedPhotos.map((job) => (
                                            <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{job.title}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                        {job.location} • {job.startTime?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${job.status === 'completed'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                        }`}>
                                                        {job.status === 'completed' ? 'เสร็จสิ้น' : 'รอส่ง'}
                                                    </span>
                                                    {job.driveLink && (
                                                        <a
                                                            href={job.driveLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                        >
                                                            <Image src="/Google_Drive_icon.png" alt="Drive" width={18} height={18} className="object-contain" />
                                                        </a>
                                                    )}
                                                    {(job.facebookPostId || job.facebookPermalink) && (
                                                        <a
                                                            href={job.facebookPermalink || (job.facebookPostId ? `https://www.facebook.com/permalink.php?story_fbid=${job.facebookPostId.split('_')[1] || job.facebookPostId}&id=${job.facebookPostId.split('_')[0]}` : '#')}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                        >
                                                            <Image src="/facebook-logo.png" alt="Facebook" width={18} height={18} className="object-contain" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Pagination */}
                                {totalPhotoPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-4">
                                        <button
                                            onClick={() => setPhotoPage(p => Math.max(1, p - 1))}
                                            disabled={photoPage === 1}
                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {photoPage} / {totalPhotoPages}
                                        </span>
                                        <button
                                            onClick={() => setPhotoPage(p => Math.min(totalPhotoPages, p + 1))}
                                            disabled={photoPage === totalPhotoPages}
                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals */}
            {canViewPhotography && (
                <>
                    <CreateJobModal
                        isOpen={isCreateJobModalOpen}
                        onClose={() => setIsCreateJobModalOpen(false)}
                    />
                    <MyPhotographyJobsModal
                        isOpen={isSubmitJobModalOpen}
                        onClose={() => setIsSubmitJobModalOpen(false)}
                        userId={user?.uid || ''}
                    />
                </>
            )}
        </div>
    );
}

// Sub-components
function RepairJobCard({ ticket }: { ticket: RepairTicket }) {
    return (
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <Wrench size={18} />
                </div>
                <div>
                    <p className="font-medium text-gray-900 dark:text-white">{ticket.room}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{ticket.description}</p>
                </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                {getThaiStatus(ticket.status)}
            </span>
        </div>
    );
}

function PhotographyJobCard({ job, onSubmit }: { job: PhotographyJob; onSubmit: () => void }) {
    return (
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                    <Camera size={18} />
                </div>
                <div>
                    <p className="font-medium text-gray-900 dark:text-white">{job.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {job.location} • {job.startTime?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </p>
                </div>
            </div>
            <button
                onClick={onSubmit}
                className="px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
            >
                ส่งงาน
            </button>
        </div>
    );
}
