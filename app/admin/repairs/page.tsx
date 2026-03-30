"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { Wrench, Building2 } from "lucide-react";
import ITRepairsView from "./ITRepairsView";
import FacilityRepairsView from "./FacilityRepairsView";

function CombinedRepairDashboardContent() {
    const { user, role, hasAtlasRole, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Access Control
    // Atlas users with the 'repair' sub-role can access IT repairs
    const canAccessIT = useMemo(
        () => role === 'admin' || role === 'technician' || role === 'moderator' || (role === 'atlas' && hasAtlasRole('repair')),
        [role, hasAtlasRole]
    );
    const canAccessFacility = useMemo(() => role === 'admin' || role === 'facility_technician' || role === 'moderator', [role]);

    // Tab State: default from URL param, else facility_technician → facility, else it
    const initialTab = useMemo<'it' | 'facility'>(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'facility') return 'facility';
        if (tabParam === 'it') return 'it';
        if (role === 'facility_technician') return 'facility';
        return 'it';
    }, [role, searchParams]);

    const [activeTab, setActiveTab] = useState<'it' | 'facility'>(initialTab);

    // Auth check + keep tab in sync if role changes
    useEffect(() => {
        if (!authLoading) {
            if (!user || (!canAccessIT && !canAccessFacility)) {
                router.push("/");
            }
        }
    }, [user, authLoading, router, canAccessIT, canAccessFacility]);

    if (authLoading) {
        return <PageSkeleton />;
    }

    if (!user || (!canAccessIT && !canAccessFacility)) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {activeTab === 'it' ? 'จัดการงานซ่อมโสตฯ' : 'จัดการซ่อมอาคาร'}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {activeTab === 'it' ? 'ติดตามและจัดการรายการซ่อมคอมพิวเตอร์และอุปกรณ์' : 'ติดตามและจัดการรายการซ่อมบำรุงอาคารสถานที่'}
                    </p>
                </div>

                {canAccessIT && canAccessFacility && (
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('it')}
                            className={`flex-1 sm:flex-none sm:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2
                                ${activeTab === 'it' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            <Wrench size={15} />
                            โสตทัศนศึกษา
                        </button>
                        <button
                            onClick={() => setActiveTab('facility')}
                            className={`flex-1 sm:flex-none sm:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2
                                ${activeTab === 'facility' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            <Building2 size={15} />
                            อาคารสถานที่
                        </button>
                    </div>
                )}
            </div>

            {/* View Content */}
            <div>
                {activeTab === 'it' ? (
                    canAccessIT ? <ITRepairsView /> : <div className="text-center py-20 text-gray-400">คุณไม่มีสิทธิ์เข้าถึงส่วนนี้</div>
                ) : (
                    canAccessFacility ? <FacilityRepairsView /> : <div className="text-center py-20 text-gray-400">คุณไม่มีสิทธิ์เข้าถึงส่วนนี้</div>
                )}
            </div>
        </div>
    );
}

export default function CombinedRepairDashboard() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <CombinedRepairDashboardContent />
        </Suspense>
    );
}
