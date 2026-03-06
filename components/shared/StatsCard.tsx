"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
    icon: LucideIcon;
    label: string;
    value: number | string;
    color?: 'gray' | 'amber' | 'blue' | 'emerald' | 'purple' | 'red';
}

const colorMap = {
    gray:    { icon: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
    amber:   { icon: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500" },
    blue:    { icon: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500" },
    emerald: { icon: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500" },
    purple:  { icon: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-500" },
    red:     { icon: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-500" },
};

export default function StatsCard({
    icon: Icon,
    label,
    value,
    color = 'gray'
}: StatsCardProps) {
    const colors = colorMap[color];

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
                <Icon size={20} />
            </div>
            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
}
