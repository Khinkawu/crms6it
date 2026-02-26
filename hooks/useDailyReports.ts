"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { DailyReport } from "../types";

interface UseDailyReportsOptions {
    userId?: string;
}

interface UseDailyReportsReturn {
    reports: DailyReport[];
    loading: boolean;
}

/**
 * Hook for fetching daily photography reports created by the current user
 */
export function useDailyReports({ userId }: UseDailyReportsOptions): UseDailyReportsReturn {
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "daily_reports"),
            where("userId", "==", userId),
            orderBy("reportDate", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedReports: DailyReport[] = [];
            snapshot.forEach((doc) => {
                fetchedReports.push({ id: doc.id, ...doc.data() } as DailyReport);
            });
            setReports(fetchedReports);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching daily reports:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    return { reports, loading };
}
