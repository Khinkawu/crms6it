"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { RepairTicket, RepairStatus, Product } from "../types";

interface UseRepairTicketsOptions {
    filterStatus?: RepairStatus | 'all';
    searchQuery?: string;
    dateRange?: { start: Date | null; end: Date | null };
}

interface UseRepairTicketsReturn {
    tickets: RepairTicket[];
    filteredTickets: RepairTicket[];
    loading: boolean;
    stats: {
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
    };
    inventory: Product[];
}

/**
 * Hook for fetching repair tickets from Firestore
 * Includes filtering, stats calculation, and spare parts inventory
 */
export function useRepairTickets(options: UseRepairTicketsOptions = {}): UseRepairTicketsReturn {
    const { filterStatus = 'all', searchQuery = '', dateRange } = options;

    const [tickets, setTickets] = useState<RepairTicket[]>([]);
    const [inventory, setInventory] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch repair tickets
    useEffect(() => {
        const q = query(collection(db, "repair_tickets"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ticketsList: RepairTicket[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as RepairTicket));
            setTickets(ticketsList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Fetch spare parts inventory
    useEffect(() => {
        const q = query(collection(db, "products"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: Product[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Product));
            // Filter only bulk items with available quantity
            setInventory(items.filter(i => i.type === 'bulk' && (i.quantity || 0) > 0));
        });

        return () => unsubscribe();
    }, []);

    // Filter tickets
    const filteredTickets = tickets.filter(t => {
        const matchesFilter = filterStatus === 'all' || t.status === filterStatus;
        const matchesSearch =
            (t.room || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.requesterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());

        let matchesDate = true;
        if (dateRange?.start && dateRange?.end && t.createdAt) {
            const ticketDate = t.createdAt.toDate();
            const start = new Date(dateRange.start);
            start.setHours(0, 0, 0, 0);
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);
            matchesDate = ticketDate >= start && ticketDate <= end;
        }

        return matchesFilter && matchesSearch && matchesDate;
    });

    // Calculate stats
    const stats = {
        total: tickets.length,
        pending: tickets.filter(t => t.status === 'pending').length,
        inProgress: tickets.filter(t => t.status === 'in_progress' || t.status === 'waiting_parts').length,
        completed: tickets.filter(t => t.status === 'completed').length
    };

    return { tickets, filteredTickets, loading, stats, inventory };
}

// Helper functions
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
