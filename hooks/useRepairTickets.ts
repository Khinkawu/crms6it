"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, limit, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { RepairTicket, RepairStatus, Product } from "../types";
export { getThaiStatus, getStatusColor } from '../utils/repairHelpers';

interface UseRepairTicketsOptions {
    filterStatus?: RepairStatus | 'all';
    searchQuery?: string;
    dateRange?: { start: Date | null; end: Date | null };
    enabled?: boolean; // If false, skip Firestore queries (wait for auth)
    fetchInventory?: boolean; // If false, skip inventory fetch (dashboard doesn't need it)
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
    const { filterStatus = 'all', searchQuery = '', dateRange, enabled = true, fetchInventory = true } = options;

    const [tickets, setTickets] = useState<RepairTicket[]>([]);
    const [inventory, setInventory] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch repair tickets
    useEffect(() => {
        if (!enabled) { setLoading(false); return; }
        // Limit to recent 100 tickets to reduce Firestore reads
        const q = query(
            collection(db, "repair_tickets"),
            orderBy("createdAt", "desc"),
            limit(100)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ticketsList: RepairTicket[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as RepairTicket));
            setTickets(ticketsList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [enabled]);

    // Fetch spare parts inventory (skip if not needed)
    useEffect(() => {
        if (!enabled || !fetchInventory) return;
        // Limit to 200 products and only fetch bulk items
        const q = query(
            collection(db, "products"),
            where("type", "==", "bulk"),
            limit(200)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: Product[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Product));
            // Filter only bulk items with available quantity
            setInventory(items.filter(i => (i.quantity || 0) > 0));
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

