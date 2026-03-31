"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import { useFacilityAdmin } from "@/hooks/useFacilityAdmin";
import FacilityActionsBar from "@/components/admin/FacilityActionsBar";
import { FacilityTicketCard, FacilityTicketList } from "@/components/facility/FacilityTicketCard";
import StatsCard from "@/components/shared/StatsCard";
import { ClipboardList, Clock, Settings, CheckCircle2, Search, LayoutGrid, List, Building2 } from "lucide-react";
import { RepairStatus, FacilityTicket } from "@/types";
import { FacilityZoneFilter } from "@/hooks/useFacilityFilter";

// Lazy load the modal for better performance
const LazyFacilityModal = dynamic<any>(
    () => import("@/components/facility/FacilityModal"),
    { loading: () => null, ssr: false }
);

export default function FacilityRepairsView() {
    const { user, role } = useAuth();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Use custom hook for all facility logic
    const {
        filteredTickets,
        inventory,
        stats,
        filter,
        setFilter,
        searchQuery,
        setSearchQuery,
        setDateRange,
        zoneFilter,
        setZoneFilter,
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
    } = useFacilityAdmin({
        userId: user?.uid,
        userName: user?.displayName || undefined
    });

    const isReadOnly = role === 'moderator';

    const filterTabs = [
        { id: 'all', label: 'ทั้งหมด', count: stats.total },
        { id: 'pending', label: 'รอดำเนินการ', count: stats.pending },
        { id: 'in_progress', label: 'กำลังดำเนินการ', count: stats.inProgress },
        { id: 'waiting_parts', label: 'รออุปกรณ์', count: stats.waitingParts || 0 },
        { id: 'completed', label: 'เสร็จสิ้น', count: stats.completed },
        { id: 'cancelled', label: 'ยกเลิก', count: stats.cancelled || 0 }
    ];

    if (loading) return null;

    return (
        <div className="space-y-6">
            {/* Facility Actions Bar */}
            <FacilityActionsBar
                data={filteredTickets}
                onFilterChange={(start: Date | null, end: Date | null) => setDateRange({ start, end })}
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
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    {/* Left: Search + Zone Filter */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-start sm:items-center">
                        {/* Search */}
                        <div className="relative w-full sm:w-72">
                            <input
                                type="text"
                                placeholder="ค้นหา (สถานที่, อาการ, ผู้แจ้ง)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
                            />
                            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>

                        {/* Zone Filter */}
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 shrink-0">
                            {([
                                { id: 'all', label: 'ทุกโซน' },
                                { id: 'junior_high', label: 'ม.ต้น' },
                                { id: 'senior_high', label: 'ม.ปลาย' },
                            ] as { id: FacilityZoneFilter; label: string }[]).map(z => (
                                <button
                                    key={z.id}
                                    onClick={() => setZoneFilter(z.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${zoneFilter === z.id
                                            ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white'
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    {z.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Status Filters + View Toggle */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-start sm:items-center">
                        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
                            {filterTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id as RepairStatus | 'all')}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 ${filter === tab.id
                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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

                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 shrink-0">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
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
                        {filteredTickets.map((ticket: FacilityTicket) => (
                            <FacilityTicketCard
                                key={ticket.id}
                                ticket={ticket}
                                onManage={openModal}
                                isReadOnly={isReadOnly}
                            />
                        ))}
                    </div>
                ) : (
                    <FacilityTicketList
                        tickets={filteredTickets}
                        onManage={openModal}
                        isReadOnly={isReadOnly}
                    />
                )}

                {filteredTickets.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 dark:bg-gray-800 flex items-center justify-center text-amber-400">
                            <Building2 size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">ไม่พบรายการแจ้งซ่อมอาคาร</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
                    </div>
                )}
            </div>

            {/* Lazy Loaded Modal */}
            <LazyFacilityModal
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
                onUsePart={async (signatureDataUrl: string) => {
                    if (!selectedPartId) return;
                    await handleUsePart(signatureDataUrl);
                }}
                isRequisitioning={isRequisitioning}
                onSubmit={handleUpdateTicket}
                isUpdating={isUpdating}
                isReadOnly={isReadOnly}
            />
        </div>
    );
}
