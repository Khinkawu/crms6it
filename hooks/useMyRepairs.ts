"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, or } from "firebase/firestore";
import { db } from "../lib/firebase";
import { RepairTicket, RepairStatus } from "../types";

interface MyRepairStats {
    total: number;
    inProgress: number;
    completed: number;
    pending: number;
}

interface UseMyRepairsOptions {
    userId?: string;
    userName?: string;
}

interface UseMyRepairsReturn {
    currentJobs: RepairTicket[];
    completedJobs: RepairTicket[];
    allJobs: RepairTicket[];
    stats: MyRepairStats;
    loading: boolean;
}

/**
 * Hook for fetching repair tickets assigned to the current technician
 * Supports both technicianId (preferred) and technicianName (fallback for legacy data)
 */
export function useMyRepairs({ userId, userName }: UseMyRepairsOptions): UseMyRepairsReturn {
    const [allJobs, setAllJobs] = useState<RepairTicket[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId && !userName) {
            setLoading(false);
            return;
        }

        // Build query based on available values
        // Priority: technicianId (preferred), fallback to technicianName
        let q;
        if (userId && userName) {
            // If we have both, use OR query
            q = query(
                collection(db, "repair_tickets"),
                or(
                    where("technicianId", "==", userId),
                    where("technicianName", "==", userName)
                ),
                orderBy("updatedAt", "desc")
            );
        } else if (userId) {
            // Only userId available
            q = query(
                collection(db, "repair_tickets"),
                where("technicianId", "==", userId),
                orderBy("updatedAt", "desc")
            );
        } else {
            // Only userName available (fallback for legacy)
            q = query(
                collection(db, "repair_tickets"),
                where("technicianName", "==", userName),
                orderBy("updatedAt", "desc")
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const jobs: RepairTicket[] = [];
            snapshot.forEach((doc) => {
                jobs.push({ id: doc.id, ...doc.data() } as RepairTicket);
            });
            setAllJobs(jobs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching my repairs:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, userName]);

    // Split by status
    const currentJobs = allJobs.filter(j =>
        j.status === 'in_progress' || j.status === 'pending' || j.status === 'waiting_parts'
    );
    const completedJobs = allJobs.filter(j => j.status === 'completed');

    // Stats
    const stats: MyRepairStats = {
        total: allJobs.length,
        pending: allJobs.filter(j => j.status === 'pending').length,
        inProgress: allJobs.filter(j => j.status === 'in_progress' || j.status === 'waiting_parts').length,
        completed: completedJobs.length,
    };

    return { currentJobs, completedJobs, allJobs, stats, loading };
}
