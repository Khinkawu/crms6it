"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, query, where, getCountFromServer, getDocs, Timestamp, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types";

// ============================================================================
// Types
// ============================================================================

export type DateRange = 'all' | 'today' | 'week' | 'month';

export interface ActionableStats {
    repairsPending: number;
    facilityPending: number;
    bookingsPending: number;
    photographyAssigned: number;
    inventoryLowStock: number;
}

export interface PerformanceStats {
    repairs: {
        new: number;
        in_progress: number;
        waiting_parts: number;
        completed: number;
        total: number;
    };
    facilityRepairs: {
        new: number;
        in_progress: number;
        completed: number;
        total: number;
    };
    bookings: {
        new: number;
        pending: number;
        approved: number;
        rejected: number;
        total: number;
    };
    photography: {
        assigned: number;
        completed: number;
        total: number;
    };
    users: {
        total: number;
    };
}

export interface PersonStat {
    id: string;
    name: string;
    pending: number;
    in_progress: number;
    completed: number;
    total: number;
}

const EMPTY_ACTIONABLE: ActionableStats = {
    repairsPending: 0,
    facilityPending: 0,
    bookingsPending: 0,
    photographyAssigned: 0,
    inventoryLowStock: 0,
};

const EMPTY_PERFORMANCE: PerformanceStats = {
    repairs: { new: 0, in_progress: 0, waiting_parts: 0, completed: 0, total: 0 },
    facilityRepairs: { new: 0, in_progress: 0, completed: 0, total: 0 },
    bookings: { new: 0, pending: 0, approved: 0, rejected: 0, total: 0 },
    photography: { assigned: 0, completed: 0, total: 0 },
    users: { total: 0 },
};

// ============================================================================
// Hook
// ============================================================================

export function useDashboardStats(dateRange: DateRange = 'all') {
    const { user, role, isPhotographer } = useAuth();
    const [actionable, setActionable] = useState<ActionableStats>(EMPTY_ACTIONABLE);
    const [performance, setPerformance] = useState<PerformanceStats>(EMPTY_PERFORMANCE);
    const [personStats, setPersonStats] = useState<PersonStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !role) return;

        const fetchStats = async () => {
            setLoading(true);
            try {
                const newActionable = { ...EMPTY_ACTIONABLE };
                const newPerf = {
                    repairs: { ...EMPTY_PERFORMANCE.repairs },
                    facilityRepairs: { ...EMPTY_PERFORMANCE.facilityRepairs },
                    bookings: { ...EMPTY_PERFORMANCE.bookings },
                    photography: { ...EMPTY_PERFORMANCE.photography },
                    users: { ...EMPTY_PERFORMANCE.users }
                };
                const persons: PersonStat[] = [];

                // ---------------------------------------------------------
                // 1. Actionable Items (Current State - Always Real-time)
                // ---------------------------------------------------------
                const actionablePromises = [];

                if (canSee(role, isPhotographer, 'repairs')) {
                    actionablePromises.push(
                        getCountFromServer(query(collection(db, "repair_tickets"), where("status", "==", "pending")))
                            .then(s => newActionable.repairsPending = s.data().count).catch(() => { })
                    );
                }
                if (canSee(role, isPhotographer, 'facility_repairs')) {
                    actionablePromises.push(
                        getCountFromServer(query(collection(db, "facility_tickets"), where("status", "==", "pending")))
                            .then(s => newActionable.facilityPending = s.data().count).catch(() => { })
                    );
                }
                if (canSee(role, isPhotographer, 'bookings')) {
                    actionablePromises.push(
                        getCountFromServer(query(collection(db, "bookings"), where("status", "==", "pending")))
                            .then(s => newActionable.bookingsPending = s.data().count).catch(() => { })
                    );
                }
                if (canSee(role, isPhotographer, 'photography')) {
                    actionablePromises.push(
                        getCountFromServer(query(collection(db, "photography_jobs"), where("status", "==", "assigned")))
                            .then(s => newActionable.photographyAssigned = s.data().count).catch(() => { })
                    );
                }
                if (canSee(role, isPhotographer, 'inventory')) {
                    actionablePromises.push(
                        getCountFromServer(query(collection(db, "products"), where("quantity", "<", 5)))
                            .then(s => newActionable.inventoryLowStock = s.data().count).catch(() => { })
                    );
                }

                await Promise.allSettled(actionablePromises);
                setActionable(newActionable);

                // ---------------------------------------------------------
                // 2. Performance Metrics (Filtered by Time)
                // ---------------------------------------------------------
                if (dateRange === 'all') {
                    // Fast path: use cached 'stats' documents for 'All Time'
                    if (canSee(role, isPhotographer, 'repairs')) {
                        const snap = await getDoc(doc(db, "stats", "repairs"));
                        const d = snap.exists() ? snap.data() : null;
                        const cachedTotal = d?.total || 0;

                        if (cachedTotal > 0) {
                            // Cache hit — single read, cheap
                            newPerf.repairs = {
                                new: d!.pending || 0,
                                in_progress: d!.in_progress || 0,
                                waiting_parts: d!.waiting_parts || 0,
                                completed: d!.completed || 0,
                                total: cachedTotal,
                            };
                            if (d!.perTechnician) {
                                Object.entries(d!.perTechnician).forEach(([id, data]: [string, any]) => {
                                    persons.push({
                                        id, name: data.name || id,
                                        pending: data.pending || 0, in_progress: data.in_progress || 0,
                                        completed: data.completed || 0, total: data.total || 0
                                    });
                                });
                            }
                        } else {
                            // Cache miss / empty — rebuild from source (parallel count queries)
                            const [cPending, cInProgress, cWaiting, cCompleted] = await Promise.all([
                                getCountFromServer(query(collection(db, "repair_tickets"), where("status", "==", "pending"))),
                                getCountFromServer(query(collection(db, "repair_tickets"), where("status", "==", "in_progress"))),
                                getCountFromServer(query(collection(db, "repair_tickets"), where("status", "==", "waiting_parts"))),
                                getCountFromServer(query(collection(db, "repair_tickets"), where("status", "==", "completed"))),
                            ]);
                            const counts = {
                                pending: cPending.data().count,
                                in_progress: cInProgress.data().count,
                                waiting_parts: cWaiting.data().count,
                                completed: cCompleted.data().count,
                            };
                            const total = counts.pending + counts.in_progress + counts.waiting_parts + counts.completed;
                            newPerf.repairs = {
                                new: counts.pending,
                                in_progress: counts.in_progress,
                                waiting_parts: counts.waiting_parts,
                                completed: counts.completed,
                                total,
                            };
                            // Write back to cache so next load is fast (fire-and-forget)
                            if (total > 0) {
                                setDoc(doc(db, "stats", "repairs"), { ...counts, total, updatedAt: new Date() }, { merge: true }).catch(() => { });
                            }
                        }
                    }
                    if (canSee(role, isPhotographer, 'bookings')) {
                        const snap = await getDoc(doc(db, "stats", "bookings"));
                        if (snap.exists()) {
                            const d = snap.data();
                            newPerf.bookings = {
                                new: d.pending || 0,
                                pending: d.pending || 0,
                                approved: d.approved || 0,
                                rejected: d.rejected || 0,
                                total: d.total || 0,
                            };
                        }
                    }
                    if (canSee(role, isPhotographer, 'photography')) {
                        const [pAssigned, pCompleted] = await Promise.all([
                            getCountFromServer(query(collection(db, "photography_jobs"), where("status", "==", "assigned"))),
                            getCountFromServer(query(collection(db, "photography_jobs"), where("status", "==", "completed")))
                        ]);
                        newPerf.photography = {
                            assigned: pAssigned.data().count,
                            completed: pCompleted.data().count,
                            total: pAssigned.data().count + pCompleted.data().count
                        };
                    }
                    if (canSee(role, isPhotographer, 'facility_repairs')) {
                        try {
                            const [fPending, fInProgress, fCompleted] = await Promise.all([
                                getCountFromServer(query(collection(db, "facility_tickets"), where("status", "==", "pending"))),
                                getCountFromServer(query(collection(db, "facility_tickets"), where("status", "==", "in_progress"))),
                                getCountFromServer(query(collection(db, "facility_tickets"), where("status", "==", "completed"))),
                            ]);
                            newPerf.facilityRepairs = {
                                new: fPending.data().count,
                                in_progress: fInProgress.data().count,
                                completed: fCompleted.data().count,
                                total: fPending.data().count + fInProgress.data().count + fCompleted.data().count,
                            };
                        } catch { }
                    }
                } else {
                    // Filter path: Local Aggregation (avoids composite index requirements)
                    const now = new Date();
                    if (dateRange === 'today') now.setHours(0, 0, 0, 0);
                    if (dateRange === 'week') { now.setDate(now.getDate() - 7); now.setHours(0, 0, 0, 0); }
                    if (dateRange === 'month') { now.setMonth(now.getMonth() - 1); now.setHours(0, 0, 0, 0); }
                    const startTimestamp = Timestamp.fromDate(now);

                    // For repairs, we look at 'updatedAt' to catch completed tickets this period
                    if (canSee(role, isPhotographer, 'repairs')) {
                        const snap = await getDocs(query(collection(db, "repair_tickets"), where("updatedAt", ">=", startTimestamp), limit(200)));
                        snap.forEach(doc => {
                            const d = doc.data();
                            newPerf.repairs.total++;
                            if (d.status === 'completed') newPerf.repairs.completed++;
                            else if (d.status === 'in_progress') newPerf.repairs.in_progress++;
                            else if (d.status === 'waiting_parts') newPerf.repairs.waiting_parts++;
                            else newPerf.repairs.new++; // Count pending as 'new' for KPI
                        });
                    }

                    if (canSee(role, isPhotographer, 'facility_repairs')) {
                        const snap = await getDocs(query(collection(db, "facility_tickets"), where("updatedAt", ">=", startTimestamp), limit(200)));
                        snap.forEach(doc => {
                            const d = doc.data();
                            newPerf.facilityRepairs.total++;
                            if (d.status === 'completed') newPerf.facilityRepairs.completed++;
                            else if (d.status === 'in_progress') newPerf.facilityRepairs.in_progress++;
                            else newPerf.facilityRepairs.new++;
                        });
                    }

                    if (canSee(role, isPhotographer, 'bookings')) {
                        // Bookings rely mainly on createdAt
                        const snap = await getDocs(query(collection(db, "bookings"), where("createdAt", ">=", startTimestamp), limit(200)));
                        snap.forEach(doc => {
                            const d = doc.data();
                            newPerf.bookings.total++;
                            if (d.status === 'approved') newPerf.bookings.approved++;
                            else if (d.status === 'rejected') newPerf.bookings.rejected++;
                            else if (d.status === 'pending') {
                                newPerf.bookings.pending++;
                                newPerf.bookings.new++;
                            }
                        });
                    }

                    if (canSee(role, isPhotographer, 'photography')) {
                        const snap = await getDocs(query(collection(db, "photography_jobs"), where("startTime", ">=", startTimestamp), limit(200)));
                        snap.forEach(doc => {
                            const d = doc.data();
                            newPerf.photography.total++;
                            if (d.status === 'completed') newPerf.photography.completed++;
                            else newPerf.photography.assigned++;
                        });
                    }
                }

                // Global Users KPI
                if (role === 'admin') {
                    const usersSnap = await getCountFromServer(collection(db, "users"));
                    newPerf.users.total = usersSnap.data().count;
                }

                setPerformance(newPerf);
                setPersonStats(persons);
            } catch (error) {
                console.error("Error fetching dashboard KPIs:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user, role, isPhotographer, dateRange]);

    return { actionable, performance, personStats, loading };
}

// ============================================================================
// Role-based visibility helper
// ============================================================================

export function canSee(
    role: UserRole | null,
    isPhotographer: boolean,
    section: 'repairs' | 'bookings' | 'photography' | 'inventory' | 'facility_repairs' | 'users'
): boolean {
    if (!role) return false;

    switch (section) {
        case 'repairs':
            return ['admin', 'moderator', 'technician'].includes(role);
        case 'bookings':
            return ['admin', 'moderator'].includes(role);
        case 'photography':
            return role === 'admin' || isPhotographer;
        case 'inventory':
            return ['admin', 'technician'].includes(role) || isPhotographer;
        case 'facility_repairs':
            return ['admin', 'facility_technician'].includes(role);
        case 'users':
            return role === 'admin';
        default:
            return false;
    }
}
