"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
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
        const q = query(
            collection(db, "activities"),
            orderBy("timestamp", "desc"),
            limit(limitCount)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let logs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ActivityLog[];

            // Filter for repair logs only if option is set
            if (filterRepairOnly) {
                logs = logs.filter(log =>
                    log.action === 'repair' || log.action === 'repair_update'
                ).slice(0, 10);
            }

            setActivities(logs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [limitCount, filterRepairOnly]);

    return { activities, loading };
}
