"use client";

import React from "react";
import { Calendar as CalendarIcon, ChevronRight } from "lucide-react";

interface RepairStats {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
}

interface StatsWidgetContentProps {
    todayActivities: number;
    repairStats: RepairStats;
    onTodayClick: () => void;
}

export default function StatsWidgetContent({ todayActivities, repairStats, onTodayClick }: StatsWidgetContentProps) {
    return (
        <div className="space-y-4">
            {/* Today Activities - clickable */}
            <button
                onClick={onTodayClick}
                className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-xl transition-colors group"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <CalendarIcon size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">กิจกรรมวันนี้</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{todayActivities}</span>
                    <ChevronRight size={16} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                </div>
            </button>

            {/* Divider */}
            <div className="h-px bg-gray-100 dark:bg-gray-700" />

            {/* Repair Stats Header */}
            <div className="px-1 pt-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">สถิติงานซ่อม</h3>
            </div>

            {/* Ring Charts for Repairs */}
            <div className="flex justify-between items-center pb-4 px-2">
                {/* Total Repairs Ring */}
                <RingChart
                    value={repairStats.total}
                    percentage={repairStats.total > 0 ? 100 : 0}
                    color="text-amber-500"
                    label="ทั้งหมด"
                />

                {/* Pending Repairs Ring */}
                <RingChart
                    value={repairStats.pending + repairStats.inProgress}
                    percentage={repairStats.total > 0 ? ((repairStats.pending + repairStats.inProgress) / repairStats.total) * 100 : 0}
                    color="text-blue-500"
                    label="กำลังซ่อม"
                />

                {/* Completed Repairs Ring */}
                <RingChart
                    value={repairStats.completed}
                    percentage={repairStats.total > 0 ? (repairStats.completed / repairStats.total) * 100 : 0}
                    color="text-emerald-500"
                    label="เสร็จสิ้น"
                />
            </div>
        </div>
    );
}

// Ring Chart Sub-component
function RingChart({ value, percentage, color, label }: { value: number; percentage: number; color: string; label: string }) {
    const strokeDasharray = `${(percentage / 100) * 88} 88`;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3"
                        className={color}
                        strokeDasharray={strokeDasharray}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
                </div>
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</span>
        </div>
    );
}
