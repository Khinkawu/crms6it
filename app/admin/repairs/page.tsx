"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useRepairAdmin, getThaiStatus, getStatusColor } from "../../../hooks/useRepairAdmin";
import ConfirmationModal from "../../components/ConfirmationModal";
import RepairActionsBar from "../../../components/admin/RepairActionsBar";
import { RepairTicketCard, RepairTicketList } from "../../components/repairs/RepairTicketCard";
import { PageSkeleton } from "../../components/ui/Skeleton";
import StatsCard from "../../components/shared/StatsCard";
import { ClipboardList, Clock, Settings, CheckCircle2, Search, LayoutGrid, List, Wrench } from "lucide-react";
import { RepairStatus } from "../../../types";

// Lazy load the modal for better performance
const LazyRepairModal = dynamic(
    () => import("../../components/repairs/RepairModal"),
    { loading: () => null, ssr: false }
);

export default function RepairDashboard() {
    const { user, role, loading: authLoading } = useAuth();
    const router = useRouter();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    // Use custom hook for all repair logic
    const {
        filteredTickets,
        inventory,
        stats,
        filter,
        setFilter,
        searchQuery,
        setSearchQuery,
        setDateRange,
        loading,
        selectedTicket,
        isModalOpen,
        openModal,
        closeModal,
        status,
        setStatus,
        technicianNote,
        setTechnicianNote,
        completionImage,
        setCompletionImage,
        selectedPartId,
        setSelectedPartId,
        useQuantity,
        setUseQuantity,
        handleUpdateTicket,
        handleUsePart,
        isUpdating,
        isRequisitioning
    } = useRepairAdmin({
        userId: user?.uid,
        userName: user?.displayName || undefined
    });

    // Auth check
    useEffect(() => {
        if (!authLoading && (!user || (role !== 'admin' && role !== 'technician' && role !== 'moderator'))) {
            router.push("/");
        }
    }, [user, role, authLoading, router]);

    // Deep link handling
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const ticketId = params.get('ticketId');
        if (ticketId && filteredTickets.length > 0 && !isModalOpen) {
            const target = filteredTickets.find(t => t.id === ticketId);
            if (target) {
                openModal(target);
                window.history.replaceState({}, '', '/admin/repairs');
            }
        }
    }, [filteredTickets, isModalOpen, openModal]);

    // Confirm spare part usage
    const handleUsePartClick = () => {
        if (!selectedPartId) return;
        setIsConfirmOpen(true);
    };

    const confirmUsePart = async () => {
        await handleUsePart();
        setIsConfirmOpen(false);
    };

    if (authLoading || loading) {
        return <PageSkeleton />;
    }

    if (!user || (role !== 'admin' && role !== 'technician' && role !== 'moderator')) {
        return null;
    }

    const isReadOnly = role === 'moderator';

    const filterTabs = [
        { id: 'all', label: 'ทั้งหมด', count: stats.total },
        { id: 'pending', label: 'รอดำเนินการ', count: stats.pending },
        { id: 'in_progress', label: 'กำลังดำเนินการ', count: stats.inProgress },
        { id: 'waiting_parts', label: 'รออะไหล่', count: stats.waitingParts || 0 },
        { id: 'completed', label: 'เสร็จสิ้น', count: stats.completed },
        { id: 'cancelled', label: 'ยกเลิก', count: stats.cancelled || 0 }
    ];

    return (
        <div className="animate-fade-in pb-20">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header - Modern Style */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30">
                                <Wrench size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ระบบงานซ่อม</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">จัดการและติดตามรายการแจ้งซ่อม</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Repair Actions Bar */}
                <RepairActionsBar
                    data={filteredTickets}
                    onFilterChange={(start, end) => setDateRange({ start, end })}
                />

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        icon={ClipboardList}
                        label="ทั้งหมด"
                        value={stats.total}
                        color="gray"
                    />
                    <StatsCard
                        icon={Clock}
                        label="รอดำเนินการ"
                        value={stats.pending}
                        color="amber"
                    />
                    <StatsCard
                        icon={Settings}
                        label="กำลังดำเนินการ"
                        value={stats.inProgress}
                        color="blue"
                    />
                    <StatsCard
                        icon={CheckCircle2}
                        label="เสร็จสิ้น"
                        value={stats.completed}
                        color="emerald"
                    />
                </div>

                {/* Control Bar - Glassmorphism */}
                <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                        {/* Search */}
                        <div className="relative w-full lg:w-80">
                            <input
                                type="text"
                                placeholder="ค้นหา (ห้อง, ผู้แจ้ง, อาการ)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                            />
                            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>

                        {/* Filters & Toggle */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-start sm:items-center">
                            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
                                {filterTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setFilter(tab.id as RepairStatus | 'all')}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all tap-scale flex items-center gap-2 ${filter === tab.id
                                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        {tab.label}
                                        {tab.count > 0 && (
                                            <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center ${filter === tab.id ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'
                                                }`}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="flex bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                >
                                    <LayoutGrid size={18} />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                >
                                    <List size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredTickets.map((ticket) => (
                                <RepairTicketCard
                                    key={ticket.id}
                                    ticket={ticket}
                                    onManage={openModal}
                                    isReadOnly={isReadOnly}
                                />
                            ))}
                        </div>
                    ) : (
                        <RepairTicketList
                            tickets={filteredTickets}
                            onManage={openModal}
                            isReadOnly={isReadOnly}
                        />
                    )}

                    {filteredTickets.length === 0 && (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                                <Wrench size={32} />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">ไม่พบรายการแจ้งซ่อม</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Lazy Loaded Modal */}
            <LazyRepairModal
                isOpen={isModalOpen}
                ticket={selectedTicket}
                onClose={closeModal}
                status={status}
                setStatus={setStatus}
                technicianNote={technicianNote}
                setTechnicianNote={setTechnicianNote}
                completionImage={completionImage}
                setCompletionImage={setCompletionImage}
                inventory={inventory}
                selectedPartId={selectedPartId}
                setSelectedPartId={setSelectedPartId}
                useQuantity={useQuantity}
                setUseQuantity={setUseQuantity}
                onUsePart={handleUsePartClick}
                isRequisitioning={isRequisitioning}
                onSubmit={handleUpdateTicket}
                isUpdating={isUpdating}
                isReadOnly={isReadOnly}
            />

            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={confirmUsePart}
                title="ยืนยันการเบิกอะไหล่"
                message={`คุณแน่ใจหรือไม่ที่จะเบิก ${useQuantity} ชิ้น ของ ${inventory.find(p => p.id === selectedPartId)?.name}?`}
                confirmText="ยืนยันเบิก"
            />
        </div>
    );
}
