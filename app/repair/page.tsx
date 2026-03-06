"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import RepairForm from "@/components/repair/RepairForm";
import FacilityForm from "@/components/facility/FacilityForm";
import { Wrench, Building2 } from "lucide-react";

function RepairContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'it' | 'facility'>('it');

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab === "facility") setActiveTab("facility");
        else if (tab === "it") setActiveTab("it");
    }, [searchParams]);

    const handleTabChange = (tab: 'it' | 'facility') => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        router.push(`/repair?${params.toString()}`, { scroll: false });
    };

    const isIT = activeTab === 'it';

    return (
        <div className="max-w-2xl mx-auto space-y-6">

            {/* Page Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">แจ้งซ่อม</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {isIT ? 'แจ้งปัญหาคอมพิวเตอร์ อินเทอร์เน็ต และอุปกรณ์โสตฯ' : 'แจ้งปัญหาไฟฟ้า ประปา แอร์ โครงสร้างอาคาร'}
                    </p>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button
                    onClick={() => handleTabChange('it')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2
                        ${isIT ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    <Wrench size={15} />
                    โสตทัศนศึกษา
                </button>
                <button
                    onClick={() => handleTabChange('facility')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2
                        ${!isIT ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    <Building2 size={15} />
                    อาคารสถานที่
                </button>
            </div>

            {/* Form */}
            <div className="transition-all duration-300">
                {isIT ? <RepairForm /> : <FacilityForm />}
            </div>
        </div>
    );
}

export default function RepairPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>}>
            <RepairContent />
        </Suspense>
    );
}
