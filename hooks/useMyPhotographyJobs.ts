"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { PhotographyJob } from "../types";

interface MyPhotoStats {
    total: number;
    assigned: number;
    completed: number;
}

interface UseMyPhotographyJobsOptions {
    userId?: string;
}

interface UseMyPhotographyJobsReturn {
    assignedJobs: PhotographyJob[];
    completedJobs: PhotographyJob[];
    allJobs: PhotographyJob[];
    stats: MyPhotoStats;
    loading: boolean;
}

/**
 * Hook for fetching photography jobs assigned to the current user
 */
export function useMyPhotographyJobs({ userId }: UseMyPhotographyJobsOptions): UseMyPhotographyJobsReturn {
    const [allJobs, setAllJobs] = useState<PhotographyJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "photography_jobs"),
            where("assigneeIds", "array-contains", userId),
            orderBy("startTime", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const jobs: PhotographyJob[] = [];
            snapshot.forEach((doc) => {
                jobs.push({ id: doc.id, ...doc.data() } as PhotographyJob);
            });
            setAllJobs(jobs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching my photography jobs:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    // Split by status
    const assignedJobs = allJobs.filter(j => j.status === 'assigned');
    const completedJobs = allJobs.filter(j => j.status === 'completed');

    // Stats
    const stats: MyPhotoStats = {
        total: allJobs.length,
        assigned: assignedJobs.length,
        completed: completedJobs.length,
    };

    return { assignedJobs, completedJobs, allJobs, stats, loading };
}
