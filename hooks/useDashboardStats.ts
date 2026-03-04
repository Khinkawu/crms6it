"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, getCountFromServer, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types";

// ============================================================================
// Types
// ============================================================================

export interface DashboardStats {
    repairs: {
        pending: number;
        in_progress: number;
        waiting_parts: number;
        completed: number;
        total: number;
    };
    bookings: {
        pending: number;
        approved: number;
        rejected: number;
        total: number;
    };
    photography: {
        pending_assign: number;
        assigned: number;
        completed: number;
        total: number;
    };
    inventory: {
        total: number;
        available: number;
        lowStock: number;
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

const EMPTY_STATS: DashboardStats = {
    repairs: { pending: 0, in_progress: 0, waiting_parts: 0, completed: 0, total: 0 },
    bookings: { pending: 0, approved: 0, rejected: 0, total: 0 },
    photography: { pending_assign: 0, assigned: 0, completed: 0, total: 0 },
    inventory: { total: 0, available: 0, lowStock: 0 },
    users: { total: 0 },
};

// ============================================================================
// Hook
// ============================================================================

export function useDashboardStats() {
    const { user, role, isPhotographer } = useAuth();
    const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
    const [personStats, setPersonStats] = useState<PersonStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !role) return;

        const fetchStats = async () => {
            setLoading(true);
            try {
                const newStats = { ...EMPTY_STATS };
                const persons: PersonStat[] = [];

                // ----- Repairs (IT) -----
                if (canSee(role, isPhotographer, 'repairs')) {
                    // Try pre-computed first
                    const repairSnap = await getDoc(doc(db, "stats", "repairs"));
                    if (repairSnap.exists()) {
                        const d = repairSnap.data();
                        newStats.repairs = {
                            pending: d.pending || 0,
                            in_progress: d.in_progress || 0,
                            waiting_parts: d.waiting_parts || 0,
                            completed: d.completed || 0,
                            total: d.total || 0,
                        };
                        // Per-technician
                        if (d.perTechnician) {
                            Object.entries(d.perTechnician).forEach(([id, data]: [string, any]) => {
                                persons.push({
                                    id,
                                    name: data.name || id,
                                    pending: data.pending || 0,
                                    in_progress: data.in_progress || 0,
                                    completed: data.completed || 0,
                                    total: data.total || 0,
                                });
                            });
                        }
                    } else {
                        // Fallback: getCountFromServer (5 reads instead of 1)
                        const [pending, inProgress, waitingParts] = await Promise.all([
                            getCountFromServer(query(collection(db, "repair_tickets"), where("status", "==", "pending"))),
                            getCountFromServer(query(collection(db, "repair_tickets"), where("status", "==", "in_progress"))),
                            getCountFromServer(query(collection(db, "repair_tickets"), where("status", "==", "waiting_parts"))),
                        ]);
                        newStats.repairs = {
                            pending: pending.data().count,
                            in_progress: inProgress.data().count,
                            waiting_parts: waitingParts.data().count,
                            completed: 0,
                            total: pending.data().count + inProgress.data().count + waitingParts.data().count,
                        };
                    }
                }

                // ----- Bookings -----
                if (canSee(role, isPhotographer, 'bookings')) {
                    const bookingSnap = await getDoc(doc(db, "stats", "bookings"));
                    if (bookingSnap.exists()) {
                        const d = bookingSnap.data();
                        newStats.bookings = {
                            pending: d.pending || 0,
                            approved: d.approved || 0,
                            rejected: d.rejected || 0,
                            total: d.total || 0,
                        };
                    } else {
                        const pendingBookings = await getCountFromServer(
                            query(collection(db, "bookings"), where("status", "==", "pending"))
                        );
                        newStats.bookings.pending = pendingBookings.data().count;
                    }
                }

                // ----- Photography -----
                if (canSee(role, isPhotographer, 'photography')) {
                    const photoSnap = await getDoc(doc(db, "stats", "photography"));
                    if (photoSnap.exists()) {
                        const d = photoSnap.data();
                        newStats.photography = {
                            pending_assign: d.pending_assign || 0,
                            assigned: d.assigned || 0,
                            completed: d.completed || 0,
                            total: d.total || 0,
                        };
                    }
                }

                // ----- Inventory -----
                if (canSee(role, isPhotographer, 'inventory')) {
                    const invSnap = await getDoc(doc(db, "stats", "inventory"));
                    if (invSnap.exists()) {
                        const d = invSnap.data();
                        newStats.inventory = {
                            total: d.total || 0,
                            available: d.available || 0,
                            lowStock: 0,
                        };
                    }
                    // Low stock count (always fresh, cheap query)
                    const lowStockSnap = await getCountFromServer(
                        query(collection(db, "products"), where("quantity", "<", 5))
                    );
                    newStats.inventory.lowStock = lowStockSnap.data().count;
                }

                // ----- Users (admin only) -----
                if (role === 'admin') {
                    const usersSnap = await getCountFromServer(collection(db, "users"));
                    newStats.users.total = usersSnap.data().count;
                }

                setStats(newStats);
                setPersonStats(persons);
            } catch (error) {
                console.error("Error fetching dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user, role, isPhotographer]);

    return { stats, personStats, loading };
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
