"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { Package, Building2 } from "lucide-react";
import ITInventoryView from "./ITInventoryView";
import FacilityInventoryView from "./FacilityInventoryView";
import { Suspense } from "react";

function InventoryDashboardContent() {
    const { user, role, isPhotographer, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Tab State: 'it' or 'facility'
    const [activeTab, setActiveTab] = useState<'it' | 'facility'>('it');

    // Access Control
    const canAccessIT = useMemo(() => role === 'admin' || role === 'technician' || isPhotographer, [role, isPhotographer]);
    const canAccessFacility = useMemo(() => role === 'admin' || role === 'facility_technician' || role === 'moderator', [role]);

    // Role-based default tab and auth check
    useEffect(() => {
        if (!authLoading) {
            if (!user || (!canAccessIT && !canAccessFacility)) {
                router.push("/");
                return;
            }

            // Set default tab based on role if it's not admin
            if (role === 'facility_technician' && !canAccessIT) {
                setActiveTab('facility');
            } else if ((role === 'technician' || isPhotographer) && !canAccessFacility) {
                setActiveTab('it');
            }

            // Allow override via URL param
            const tabParam = searchParams.get('tab');
            if (tabParam === 'it' && canAccessIT) {
                setActiveTab('it');
            } else if (tabParam === 'facility' && canAccessFacility) {
                setActiveTab('facility');
            }
        }
    }, [user, role, isPhotographer, authLoading, router, canAccessIT, canAccessFacility, searchParams]);

    if (authLoading) {
        return <PageSkeleton />;
    }

    if (!user || (!canAccessIT && !canAccessFacility)) {
        return null;
    }

    return (
        <div className="animate-fade-in pb-20">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header & Tab Switcher */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                <Package size={20} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {activeTab === 'it' ? 'ระบบจัดการคลังโสตฯ' : 'ระบบจัดการคลังอาคาร'}
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {activeTab === 'it' ? 'จัดการและติดตามวัสดุและครุภัณฑ์คอมพิวเตอร์' : 'จัดการและติดตามวัสดุและอุปกรณ์ซ่อมบำรุงอาคาร'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs Control - Only show if user has access to both */}
                    {canAccessIT && canAccessFacility && (
                        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-full md:w-auto h-12">
                            <button
                                onClick={() => setActiveTab('it')}
                                className={`flex-1 md:flex-none md:px-8 h-full rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'it'
                                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <Package size={16} />
                                คลังโสตฯ
                            </button>
                            <button
                                onClick={() => setActiveTab('facility')}
                                className={`flex-1 md:flex-none md:px-8 h-full rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'facility'
                                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <Building2 size={16} />
                                คลังอาคาร
                            </button>
                        </div>
                    )}
                </div>

                {/* View Content */}
                <div className="transition-all duration-500 animate-in fade-in slide-in-from-bottom-2">
                    {activeTab === 'it' ? (
                        canAccessIT ? <ITInventoryView /> : <div className="text-center py-20 text-text-secondary">คุณไม่มีสิทธิ์เข้าถึงส่วนนี้</div>
                    ) : (
                        canAccessFacility ? <FacilityInventoryView /> : <div className="text-center py-20 text-text-secondary">คุณไม่มีสิทธิ์เข้าถึงส่วนนี้</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function InventoryDashboard() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <InventoryDashboardContent />
        </Suspense>
    );
}
