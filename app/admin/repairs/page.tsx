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
import { ClipboardList, Clock, Settings, CheckCircle2, Search, LayoutGrid, List } from "lucide-react";
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
        { id: 'all', label: 'ทั้งหมด' },
        { id: 'pending', label: 'รอดำเนินการ' },
        { id: 'in_progress', label: 'กำลังดำเนินการ' },
        { id: 'waiting_parts', label: 'รออะไหล่' },
        { id: 'completed', label: 'เสร็จสิ้น' },
        { id: 'cancelled', label: 'ยกเลิก' }
    ];

    return (
        <div className="animate-fade-in pb-20">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-text mb-1">ระบบงานซ่อม</h1>
                            <p className="text-text-secondary">จัดการและติดตามรายการแจ้งซ่อม</p>
                        </div>
                    </div>
                </div>

                {/* Repair Actions Bar */}
                <RepairActionsBar
                    data={filteredTickets}
                    onFilterChange={(start, end) => setDateRange({ start, end })}
                />

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            </div>

            {/* Control Bar */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-sm max-w-7xl mx-auto mt-8">
                {/* Search */}
                <div className="relative w-full lg:w-96">
                    <input
                        type="text"
                        placeholder="ค้นหา (ห้อง, ผู้แจ้ง, อาการ)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-text focus:outline-none focus:border-cyan-500/50 transition-all"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                        <Search size={20} />
                    </div>
                </div>

                {/* Filters & Toggle */}
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
                    <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
                        {filterTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as RepairStatus | 'all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all tap-scale ${filter === tab.id
                                    ? 'bg-cyan-500 text-white shadow-md'
                                    : 'bg-background border border-border text-text-secondary hover:bg-border/50'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex bg-background border border-border rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-card shadow-sm text-cyan-600' : 'text-text-secondary hover:text-text'}`}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-card shadow-sm text-cyan-600' : 'text-text-secondary hover:text-text'}`}
                        >
                            <List size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-7xl mx-auto mt-8">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                    <div className="text-center py-20 text-text-secondary">
                        ไม่พบรายการแจ้งซ่อม
                    </div>
                )}
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
