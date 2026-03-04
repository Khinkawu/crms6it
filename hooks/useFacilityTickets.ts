"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, getDocs, limit, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { FacilityTicket, FacilityTicketStatus, FacilityItem } from "../types";

// Helper functions for UI
export function getFacilityStatusThai(status: FacilityTicketStatus) {
    switch (status) {
        case 'pending': return 'รอดำเนินการ';
        case 'in_progress': return 'กำลังดำเนินการ';
        case 'waiting_parts': return 'รออะไหล่';
        case 'completed': return 'เสร็จสิ้น';
        case 'cancelled': return 'ยกเลิก';
        default: return status;
    }
}

export function getFacilityStatusColor(status: FacilityTicketStatus) {
    switch (status) {
        case 'pending': return 'bg-amber-100 text-amber-500';
        case 'in_progress': return 'bg-blue-100 text-blue-500';
        case 'waiting_parts': return 'bg-orange-100 text-orange-500';
        case 'completed': return 'bg-emerald-100 text-emerald-500';
        case 'cancelled': return 'bg-rose-100 text-rose-500';
        default: return 'bg-gray-100 text-gray-500';
    }
}

interface UseFacilityTicketsOptions {
    filterStatus?: FacilityTicketStatus | 'all';
    searchQuery?: string;
    dateRange?: { start: Date | null; end: Date | null };
    enabled?: boolean;
    fetchInventory?: boolean;
    realtime?: boolean;
}

interface UseFacilityTicketsReturn {
    tickets: FacilityTicket[];
    filteredTickets: FacilityTicket[];
    loading: boolean;
    stats: {
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
    };
    inventory: FacilityItem[];
}

export function useFacilityTickets(options: UseFacilityTicketsOptions = {}): UseFacilityTicketsReturn {
    const { filterStatus = 'all', searchQuery = '', dateRange, enabled = true, fetchInventory = true, realtime = true } = options;

    const [tickets, setTickets] = useState<FacilityTicket[]>([]);
    const [inventory, setInventory] = useState<FacilityItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch facility tickets
    useEffect(() => {
        if (!enabled) { setLoading(false); return; }
        const q = query(
            collection(db, "facility_tickets"),
            orderBy("createdAt", "desc"),
            limit(100)
        );

        if (!realtime) {
            getDocs(q).then(snapshot => {
                setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FacilityTicket)));
                setLoading(false);
            }).catch(() => setLoading(false));
            return;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FacilityTicket)));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [enabled, realtime]);

    // Fetch facility inventory (skip if not needed)
    useEffect(() => {
        if (!enabled || !fetchInventory) return;

        const q = query(
            collection(db, "facility_inventory"),
            orderBy("name", "asc"),
            limit(200)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: FacilityItem[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FacilityItem));

            setInventory(items.filter(i => (i.quantity || 0) > 0));
        });

        return () => unsubscribe();
    }, [enabled, fetchInventory]);

    // Filter tickets
    const filteredTickets = tickets.filter(t => {
        const matchesFilter = filterStatus === 'all' || t.status === filterStatus;
        const matchesSearch =
            (t.room || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.requesterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.issueCategory || "").toLowerCase().includes(searchQuery.toLowerCase());

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
