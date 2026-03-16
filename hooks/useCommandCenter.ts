"use client";

import { useState, useEffect, useCallback } from "react";
import {
    collection, query, where, getDocs, Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { startOfDay, endOfDay, subDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DatePreset = 'today' | '7d' | '30d' | 'custom';
export type ModuleFilter = 'all' | 'repair' | 'facility' | 'photography' | 'borrow';

export interface CommandDateRange {
    start: Date;
    end: Date;
    preset: DatePreset;
}

export function getDefaultDateRange(): CommandDateRange {
    return {
        start: startOfDay(subDays(new Date(), 6)),
        end: endOfDay(new Date()),
        preset: '7d',
    };
}

export interface StaffRepairKPI {
    technicianId: string;
    technicianName: string;
    total: number;
    pending: number;
    inProgress: number;
    waitingParts: number;
    completed: number;
    avgHoursToComplete: number | null;
}

export interface StaffFacilityKPI {
    technicianId: string;
    technicianName: string;
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    urgentPending: number;
}

export interface StaffPhotoKPI {
    uid: string;
    name: string;
    total: number;
    completed: number;
    pending: number;
    completionRate: number;
}

export interface StaffBorrowKPI {
    key: string;
    name: string;
    borrowCount: number;
    requisitionCount: number;
    overdueCount: number;
    total: number;
}

export interface CommandCenterSummary {
    repair: {
        total: number;
        pending: number;
        inProgress: number;
        waitingParts: number;
        completed: number;
        resolutionRate: number;
    };
    facility: {
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
        urgentPending: number;
    };
    photography: {
        total: number;
        completed: number;
        pendingAssign: number;
        assigned: number;
        completionRate: number;
    };
    borrow: {
        total: number;
        borrow: number;
        requisition: number;
        overdue: number;
    };
}

export interface CommandCenterData {
    summary: CommandCenterSummary;
    repairKPIs: StaffRepairKPI[];
    facilityKPIs: StaffFacilityKPI[];
    photoKPIs: StaffPhotoKPI[];
    borrowKPIs: StaffBorrowKPI[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

// ─── Empty defaults ───────────────────────────────────────────────────────────

const emptySummary: CommandCenterSummary = {
    repair: { total: 0, pending: 0, inProgress: 0, waitingParts: 0, completed: 0, resolutionRate: 0 },
    facility: { total: 0, pending: 0, inProgress: 0, completed: 0, urgentPending: 0 },
    photography: { total: 0, completed: 0, pendingAssign: 0, assigned: 0, completionRate: 0 },
    borrow: { total: 0, borrow: 0, requisition: 0, overdue: 0 },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCommandCenter(dateRange: CommandDateRange): CommandCenterData {
    const [summary, setSummary] = useState<CommandCenterSummary>(emptySummary);
    const [repairKPIs, setRepairKPIs] = useState<StaffRepairKPI[]>([]);
    const [facilityKPIs, setFacilityKPIs] = useState<StaffFacilityKPI[]>([]);
    const [photoKPIs, setPhotoKPIs] = useState<StaffPhotoKPI[]>([]);
    const [borrowKPIs, setBorrowKPIs] = useState<StaffBorrowKPI[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);

        const startTs = Timestamp.fromDate(dateRange.start);
        const endTs = Timestamp.fromDate(dateRange.end);
        const now = new Date();

        try {
            // Fetch all 4 collections in parallel
            const [repairSnap, facilitySnap, photoSnap, borrowSnap] = await Promise.all([
                getDocs(query(collection(db, "repair_tickets"),
                    where("createdAt", ">=", startTs),
                    where("createdAt", "<=", endTs)
                )),
                getDocs(query(collection(db, "facility_tickets"),
                    where("createdAt", ">=", startTs),
                    where("createdAt", "<=", endTs)
                )),
                getDocs(query(collection(db, "photography_jobs"),
                    where("startTime", ">=", startTs),
                    where("startTime", "<=", endTs)
                )),
                getDocs(query(collection(db, "transactions"),
                    where("transactionDate", ">=", startTs),
                    where("transactionDate", "<=", endTs)
                )),
            ]);

            const s: CommandCenterSummary = {
                repair: { total: 0, pending: 0, inProgress: 0, waitingParts: 0, completed: 0, resolutionRate: 0 },
                facility: { total: 0, pending: 0, inProgress: 0, completed: 0, urgentPending: 0 },
                photography: { total: 0, completed: 0, pendingAssign: 0, assigned: 0, completionRate: 0 },
                borrow: { total: 0, borrow: 0, requisition: 0, overdue: 0 },
            };

            // ─── Repair ─────────────────────────────────────────────────────
            const repairMap = new Map<string, StaffRepairKPI & { _hours: number[] }>();

            repairSnap.forEach(docSnap => {
                const d = docSnap.data();
                s.repair.total++;
                if (d.status === "completed") s.repair.completed++;
                else if (d.status === "in_progress") s.repair.inProgress++;
                else if (d.status === "waiting_parts") s.repair.waitingParts++;
                else s.repair.pending++;

                const tid = d.technicianId || "__unassigned__";
                const tname = d.technicianName || "ไม่ระบุ";
                const existing = repairMap.get(tid) ?? {
                    technicianId: tid, technicianName: tname,
                    total: 0, pending: 0, inProgress: 0, waitingParts: 0, completed: 0,
                    avgHoursToComplete: null, _hours: [] as number[],
                };
                existing.total++;
                if (d.status === "completed") {
                    existing.completed++;
                    if (d.createdAt && d.updatedAt) {
                        const created = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
                        const updated = d.updatedAt.toDate ? d.updatedAt.toDate() : new Date(d.updatedAt);
                        const hours = (updated.getTime() - created.getTime()) / 3600000;
                        if (hours > 0) existing._hours.push(hours);
                    }
                } else if (d.status === "in_progress") existing.inProgress++;
                else if (d.status === "waiting_parts") existing.waitingParts++;
                else existing.pending++;

                repairMap.set(tid, existing);
            });

            s.repair.resolutionRate = s.repair.total > 0
                ? Math.round((s.repair.completed / s.repair.total) * 100) : 0;

            const newRepairKPIs: StaffRepairKPI[] = Array.from(repairMap.values()).map(r => ({
                technicianId: r.technicianId,
                technicianName: r.technicianName,
                total: r.total,
                pending: r.pending,
                inProgress: r.inProgress,
                waitingParts: r.waitingParts,
                completed: r.completed,
                avgHoursToComplete: r._hours.length > 0
                    ? Math.round(r._hours.reduce((a, b) => a + b, 0) / r._hours.length * 10) / 10
                    : null,
            })).sort((a, b) => b.total - a.total);

            // ─── Facility ────────────────────────────────────────────────────
            const facilityMap = new Map<string, StaffFacilityKPI>();

            facilitySnap.forEach(docSnap => {
                const d = docSnap.data();
                s.facility.total++;
                if (d.status === "completed") s.facility.completed++;
                else if (d.status === "in_progress") s.facility.inProgress++;
                else {
                    s.facility.pending++;
                    if (d.priority === "urgent") s.facility.urgentPending++;
                }

                const tid = d.technicianId || "__unassigned__";
                const tname = d.technicianName || "ไม่ระบุ";
                const existing = facilityMap.get(tid) ?? {
                    technicianId: tid, technicianName: tname,
                    total: 0, pending: 0, inProgress: 0, completed: 0, urgentPending: 0,
                };
                existing.total++;
                if (d.status === "completed") existing.completed++;
                else if (d.status === "in_progress") existing.inProgress++;
                else {
                    existing.pending++;
                    if (d.priority === "urgent") existing.urgentPending++;
                }
                facilityMap.set(tid, existing);
            });

            const newFacilityKPIs: StaffFacilityKPI[] = Array.from(facilityMap.values())
                .sort((a, b) => b.total - a.total);

            // ─── Photography ─────────────────────────────────────────────────
            const photoMap = new Map<string, Omit<StaffPhotoKPI, "completionRate">>();

            photoSnap.forEach(docSnap => {
                const d = docSnap.data();
                s.photography.total++;
                if (d.status === "completed") s.photography.completed++;
                else if (d.status === "pending_assign") s.photography.pendingAssign++;
                else s.photography.assigned++;

                const ids: string[] = d.assigneeIds ?? [];
                const names: string[] = d.assigneeNames ?? [];
                ids.forEach((uid, i) => {
                    const name = names[i] || "ไม่ระบุ";
                    const existing = photoMap.get(uid) ?? { uid, name, total: 0, completed: 0, pending: 0 };
                    existing.total++;
                    if (d.status === "completed") existing.completed++;
                    else existing.pending++;
                    photoMap.set(uid, existing);
                });
            });

            s.photography.completionRate = s.photography.total > 0
                ? Math.round((s.photography.completed / s.photography.total) * 100) : 0;

            const newPhotoKPIs: StaffPhotoKPI[] = Array.from(photoMap.values()).map(p => ({
                ...p,
                completionRate: p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0,
            })).sort((a, b) => b.total - a.total);

            // ─── Borrow/Requisition ──────────────────────────────────────────
            const borrowMap = new Map<string, StaffBorrowKPI>();

            borrowSnap.forEach(docSnap => {
                const d = docSnap.data();
                s.borrow.total++;
                if (d.type === "borrow") s.borrow.borrow++;
                else s.borrow.requisition++;

                const isOverdue =
                    d.type === "borrow" &&
                    d.status !== "completed" &&
                    d.returnDate &&
                    (d.returnDate.toDate ? d.returnDate.toDate() : new Date(d.returnDate)) < now;
                if (isOverdue) s.borrow.overdue++;

                const key = d.borrowerEmail || d.requesterEmail || d.userName || "__unknown__";
                const name = d.userName || d.borrowerEmail || d.requesterEmail || "ไม่ระบุ";
                const existing = borrowMap.get(key) ?? {
                    key, name, borrowCount: 0, requisitionCount: 0, overdueCount: 0, total: 0,
                };
                existing.total++;
                if (d.type === "borrow") existing.borrowCount++;
                else existing.requisitionCount++;
                if (isOverdue) existing.overdueCount++;
                borrowMap.set(key, existing);
            });

            const newBorrowKPIs: StaffBorrowKPI[] = Array.from(borrowMap.values())
                .sort((a, b) => b.total - a.total);

            setSummary(s);
            setRepairKPIs(newRepairKPIs);
            setFacilityKPIs(newFacilityKPIs);
            setPhotoKPIs(newPhotoKPIs);
            setBorrowKPIs(newBorrowKPIs);
        } catch (err: any) {
            console.error("Command Center fetch error:", err);
            setError(err.message ?? "เกิดข้อผิดพลาดในการโหลดข้อมูล");
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { summary, repairKPIs, facilityKPIs, photoKPIs, borrowKPIs, loading, error, refetch };
}
