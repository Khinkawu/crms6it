"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, limit, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { LogAction } from "../types";

export interface ActivityLog {
    id: string;
    action: LogAction;
    productName: string;
    userName: string;
    imageUrl?: string;
    details?: string;
    zone?: string;
    status?: string;
    timestamp: any;
}

interface UseActivityLogsOptions {
    limitCount?: number;
    filterRepairOnly?: boolean;
}

interface UseActivityLogsReturn {
    activities: ActivityLog[];
    loading: boolean;
}

/**
 * Hook for fetching activity logs from Firestore
 * @param options - Configuration options
 * @returns Activity logs and loading state
 */
export function useActivityLogs(options: UseActivityLogsOptions = {}): UseActivityLogsReturn {
    const { limitCount = 10, filterRepairOnly = true } = options;

    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const constraints: any[] = [orderBy("timestamp", "desc")];

        // Filter server-side when filterRepairOnly is set
        if (filterRepairOnly) {
            constraints.unshift(where("action", "in", ["repair", "repair_update"]));
        }

        constraints.push(limit(limitCount));

        const q = query(collection(db, "activities"), ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ActivityLog[];

            setActivities(logs);
            setLoading(false);
        }, (error) => {
            console.error("[useActivityLogs]", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [limitCount, filterRepairOnly]);

    return { activities, loading };
}
