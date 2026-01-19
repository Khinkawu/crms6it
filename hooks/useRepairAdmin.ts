"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, limit, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { RepairTicket, RepairStatus, Product } from "../types";

// Re-export sub-hooks for granular usage
export { useRepairFilter } from "./useRepairFilter";
export { useRepairModal } from "./useRepairModal";
export { useRepairActions } from "./useRepairActions";

// Import sub-hooks
import { useRepairFilter } from "./useRepairFilter";
import { useRepairModal } from "./useRepairModal";
import { useRepairActions } from "./useRepairActions";

interface UseRepairAdminOptions {
    userId?: string;
    userName?: string;
}

/**
 * Main hook that composes all repair admin functionality.
 * For more granular control, use the individual hooks directly:
 * - useRepairFilter: filtering and stats
 * - useRepairModal: modal state management
 * - useRepairActions: update and spare parts actions
 */
export function useRepairAdmin({ userId, userName }: UseRepairAdminOptions = {}) {
    const [tickets, setTickets] = useState<RepairTicket[]>([]);
    const [inventory, setInventory] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Compose sub-hooks
    const filterHook = useRepairFilter({ tickets });
    const modalHook = useRepairModal();
    const actionsHook = useRepairActions({ userId, userName });

    // Fetch tickets and inventory
    useEffect(() => {
        if (!userId) return;

        // Limit to recent 100 tickets to reduce Firestore reads
        const ticketsQuery = query(
            collection(db, "repair_tickets"),
            orderBy("createdAt", "desc"),
            limit(100)
        );
        const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
            const ticketsList: RepairTicket[] = [];
            snapshot.forEach((doc) => {
                ticketsList.push({ id: doc.id, ...doc.data() } as RepairTicket);
            });
            setTickets(ticketsList);
            setLoading(false);
        });

        // Limit to 200 products and only fetch bulk items with quantity > 0
        const inventoryQuery = query(
            collection(db, "products"),
            where("type", "==", "bulk"),
            limit(200)
        );
        const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
            const items: Product[] = [];
            snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as Product);
            });
            setInventory(items.filter(i => (i.quantity || 0) > 0));
        });

        return () => {
            unsubTickets();
            unsubInventory();
        };
    }, [userId]);

    // Wrapper for handleUpdateTicket to match old API
    const handleUpdateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        await actionsHook.handleUpdateTicket(
            modalHook.selectedTicket,
            modalHook.status,
            modalHook.technicianNote,
            modalHook.completionImage,
            modalHook.closeModal
        );
    };

    // Wrapper for handleUsePart to match old API
    const handleUsePart = async (signatureDataUrl?: string) => {
        const part = inventory.find(p => p.id === modalHook.selectedPartId);
        const success = await actionsHook.handleUsePart(
            modalHook.selectedTicket,
            part,
            modalHook.useQuantity,
            signatureDataUrl
        );
        if (success) {
            modalHook.setSelectedPartId("");
            modalHook.setUseQuantity(1);
        }
    };

    return {
        tickets,
        filteredTickets: filterHook.filteredTickets,
        inventory,
        stats: filterHook.stats,
        filter: filterHook.filter,
        setFilter: filterHook.setFilter,
        searchQuery: filterHook.searchQuery,
        setSearchQuery: filterHook.setSearchQuery,
        dateRange: filterHook.dateRange,
        setDateRange: filterHook.setDateRange,
        loading,
        selectedTicket: modalHook.selectedTicket,
        isModalOpen: modalHook.isModalOpen,
        openModal: modalHook.openModal,
        closeModal: modalHook.closeModal,
        status: modalHook.status,
        setStatus: modalHook.setStatus,
        technicianNote: modalHook.technicianNote,
        setTechnicianNote: modalHook.setTechnicianNote,
        completionImage: modalHook.completionImage,
        setCompletionImage: modalHook.setCompletionImage,
        selectedPartId: modalHook.selectedPartId,
        setSelectedPartId: modalHook.setSelectedPartId,
        useQuantity: modalHook.useQuantity,
        setUseQuantity: modalHook.setUseQuantity,
        handleUpdateTicket,
        handleUsePart,
        isUpdating: actionsHook.isUpdating,
        isRequisitioning: actionsHook.isRequisitioning
    };
}

// Utility functions
export const getThaiStatus = (s: RepairStatus): string => {
    switch (s) {
        case 'pending': return 'รอดำเนินการ';
        case 'in_progress': return 'กำลังดำเนินการ';
        case 'waiting_parts': return 'รออะไหล่';
        case 'completed': return 'เสร็จสิ้น';
        case 'cancelled': return 'ยกเลิกงาน';
        default: return s;
    }
};

export const getStatusColor = (s: RepairStatus): string => {
    switch (s) {
        case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
        case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
        case 'waiting_parts': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
        case 'completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
        default: return 'bg-slate-500/10 text-slate-600';
    }
};
