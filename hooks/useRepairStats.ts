"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getCountFromServer } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface RepairStats {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
}

/**
 * Lightweight hook for dashboard stats — all-time counts.
 * Uses Firestore getCountFromServer (aggregation) — reads 0 documents,
 * only returns counts. 4 parallel queries, each costs 1 read unit.
 */
export function useRepairStats(): { stats: RepairStats; loading: boolean } {
    const [stats, setStats] = useState<RepairStats>({
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const col = collection(db, "repair_tickets");

        Promise.all([
            getCountFromServer(col),
            getCountFromServer(query(col, where("status", "==", "pending"))),
            getCountFromServer(query(col, where("status", "in", ["in_progress", "waiting_parts"]))),
            getCountFromServer(query(col, where("status", "==", "completed"))),
        ]).then(([total, pending, inProgress, completed]) => {
            setStats({
                total: total.data().count,
                pending: pending.data().count,
                inProgress: inProgress.data().count,
                completed: completed.data().count,
            });
            setLoading(false);
        }).catch((err) => {
            console.error("[useRepairStats]", err);
            setLoading(false);
        });
    }, []);

    return { stats, loading };
}
