"use client";

import React, { useEffect, useState, useCallback, useDeferredValue } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/ui/Skeleton";

const AnalyticsDashboard = dynamic(
    () => import("@/components/analytics/AnalyticsDashboard"),
    { loading: () => <PageSkeleton />, ssr: false }
);

export default function AnalyticsPage() {
    const { user, role, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && (!user || role !== 'admin')) {
            router.push("/");
        }
    }, [user, role, authLoading, router]);

    if (authLoading) return <PageSkeleton />;
    if (!user || role !== 'admin') return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">ข้อมูลการใช้งานระบบ CRMS6IT — เฉพาะ Admin</p>
                </div>
                <AnalyticsDashboard />
            </div>
        </div>
    );
}
