"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, limit, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { FacilityTicket, RepairStatus, Product } from "../types";

// Re-export sub-hooks for granular usage
export { useFacilityFilter } from "./useFacilityFilter";
export { useFacilityModal } from "./useFacilityModal";
export { useFacilityActions } from "./useFacilityActions";

// Import sub-hooks
import { useFacilityFilter } from "./useFacilityFilter";
import { useFacilityModal } from "./useFacilityModal";
import { useFacilityActions } from "./useFacilityActions";

interface UseFacilityAdminOptions {
    userId?: string;
    userName?: string;
}

/**
 * Main hook that composes all facility repair admin functionality.
 * For more granular control, use the individual hooks directly:
 * - useFacilityFilter: filtering and stats
 * - useFacilityModal: modal state management
 * - useFacilityActions: update and spare parts actions
 */
export function useFacilityAdmin({ userId, userName }: UseFacilityAdminOptions = {}) {
    const [tickets, setTickets] = useState<FacilityTicket[]>([]);
    const [inventory, setInventory] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Compose sub-hooks
    const filterHook = useFacilityFilter({ tickets });
    const modalHook = useFacilityModal();
    const actionsHook = useFacilityActions({ userId, userName });

    // Fetch tickets and inventory
    useEffect(() => {
        if (!userId) return;
        // Limit to recent 100 tickets to reduce Firestore reads
        const ticketsQuery = query(
            collection(db, "facility_tickets"),
            orderBy("createdAt", "desc"),
            limit(100)
        );
        const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
            const ticketsList: FacilityTicket[] = [];
            snapshot.forEach((doc) => {
                ticketsList.push({ id: doc.id, ...doc.data() } as FacilityTicket);
            });
            setTickets(ticketsList);
            setLoading(false);
        }, () => setLoading(false));

        // Limit to 200 products and only fetch bulk items with quantity > 0
        const inventoryQuery = query(
            collection(db, "facility_inventory"),
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

    // Wrapper for handleUpdateTicket
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

    // Wrapper for handleUsePart
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
        zoneFilter: filterHook.zoneFilter,
        setZoneFilter: filterHook.setZoneFilter,
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
        case 'waiting_parts': return 'รออะไหล่/อุปกรณ์';
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
