"use client";

import React from "react";

interface StatCardProps {
    label: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    trend?: string;
}

export default function StatCard({ label, value, icon: Icon, color, trend }: StatCardProps) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/30">
            <div className={`p-2.5 rounded-xl ${color}`}>
                <Icon size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
            {trend && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                    {trend}
                </span>
            )}
        </div>
    );
}
