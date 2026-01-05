"use client";

import { useState, useEffect, useMemo } from "react";
import { RepairTicket, RepairStatus } from "../types";

interface RepairStats {
    total: number;
    pending: number;
    inProgress: number;
    waitingParts: number;
    completed: number;
    cancelled: number;
}

interface DateRange {
    start: Date | null;
    end: Date | null;
}

interface UseRepairFilterOptions {
    tickets: RepairTicket[];
}

interface UseRepairFilterReturn {
    filteredTickets: RepairTicket[];
    stats: RepairStats;
    filter: RepairStatus | 'all';
    setFilter: (f: RepairStatus | 'all') => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    dateRange: DateRange;
    setDateRange: (range: DateRange) => void;
}

export function useRepairFilter({ tickets }: UseRepairFilterOptions): UseRepairFilterReturn {
    const [filter, setFilter] = useState<RepairStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

    // Filter logic
    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            const matchesFilter = filter === 'all' || t.status === filter;
            const matchesSearch =
                (t.room || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.requesterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());

            let matchesDate = true;
            if (dateRange.start && dateRange.end && t.createdAt) {
                const ticketDate = t.createdAt.toDate();
                const start = new Date(dateRange.start); start.setHours(0, 0, 0, 0);
                const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999);
                matchesDate = ticketDate >= start && ticketDate <= end;
            }

            return matchesFilter && matchesSearch && matchesDate;
        });
    }, [tickets, filter, searchQuery, dateRange]);

    // Stats
    const stats = useMemo<RepairStats>(() => ({
        total: tickets.length,
        pending: tickets.filter(t => t.status === 'pending').length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        waitingParts: tickets.filter(t => t.status === 'waiting_parts').length,
        completed: tickets.filter(t => t.status === 'completed').length,
        cancelled: tickets.filter(t => t.status === 'cancelled').length
    }), [tickets]);

    return {
        filteredTickets,
        stats,
        filter,
        setFilter,
        searchQuery,
        setSearchQuery,
        dateRange,
        setDateRange
    };
}
