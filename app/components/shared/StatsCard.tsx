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
    gray: {
        bg: "from-gray-500 to-slate-600",
        light: "bg-gray-100 dark:bg-gray-800",
        text: "text-gray-600 dark:text-gray-300"
    },
    amber: {
        bg: "from-amber-500 to-orange-500",
        light: "bg-amber-50 dark:bg-amber-900/20",
        text: "text-amber-600 dark:text-amber-400"
    },
    blue: {
        bg: "from-blue-500 to-cyan-500",
        light: "bg-blue-50 dark:bg-blue-900/20",
        text: "text-blue-600 dark:text-blue-400"
    },
    emerald: {
        bg: "from-emerald-500 to-teal-500",
        light: "bg-emerald-50 dark:bg-emerald-900/20",
        text: "text-emerald-600 dark:text-emerald-400"
    },
    purple: {
        bg: "from-purple-500 to-indigo-500",
        light: "bg-purple-50 dark:bg-purple-900/20",
        text: "text-purple-600 dark:text-purple-400"
    },
    red: {
        bg: "from-red-500 to-rose-500",
        light: "bg-red-50 dark:bg-red-900/20",
        text: "text-red-600 dark:text-red-400"
    }
};

export default function StatsCard({
    icon: Icon,
    label,
    value,
    color = 'gray'
}: StatsCardProps) {
    const colors = colorMap[color];

    return (
        <div className="group relative overflow-hidden bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
            {/* Subtle gradient overlay on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>

            <div className="relative z-10 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors.bg} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={24} />
                </div>
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
            </div>
        </div>
    );
}
