"use client";

import { useState, useMemo } from "react";
import { FacilityTicket, RepairStatus } from "../types";

export interface FacilityStats {
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

interface UseFacilityFilterOptions {
    tickets: FacilityTicket[];
}

export type FacilityZoneFilter = 'all' | 'junior_high' | 'senior_high';

export interface UseFacilityFilterReturn {
    filteredTickets: FacilityTicket[];
    stats: FacilityStats;
    filter: RepairStatus | 'all';
    setFilter: (f: RepairStatus | 'all') => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    dateRange: DateRange;
    setDateRange: (range: DateRange) => void;
    zoneFilter: FacilityZoneFilter;
    setZoneFilter: (z: FacilityZoneFilter) => void;
}

export function useFacilityFilter({ tickets }: UseFacilityFilterOptions): UseFacilityFilterReturn {
    const [filter, setFilter] = useState<RepairStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
    const [zoneFilter, setZoneFilter] = useState<FacilityZoneFilter>('all');

    // Filter logic
    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            const matchesFilter = filter === 'all' || t.status === filter;
            const matchesZone = zoneFilter === 'all' || t.zone === zoneFilter;
            const matchesSearch =
                (t.room || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.requesterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.phone || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.zone === 'junior_high' ? 'ม.ต้น' : 'ม.ปลาย').includes(searchQuery);

            let matchesDate = true;
            if (dateRange.start && dateRange.end && t.createdAt) {
                const ticketDate = t.createdAt.toDate();
                const start = new Date(dateRange.start); start.setHours(0, 0, 0, 0);
                const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999);
                matchesDate = ticketDate >= start && ticketDate <= end;
            }

            return matchesFilter && matchesZone && matchesSearch && matchesDate;
        });
    }, [tickets, filter, zoneFilter, searchQuery, dateRange]);

    // Stats (always based on all tickets, not filtered)
    const stats = useMemo<FacilityStats>(() => ({
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
        setDateRange,
        zoneFilter,
        setZoneFilter
    };
}

