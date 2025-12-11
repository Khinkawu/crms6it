"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
    icon: LucideIcon;
    label: string;
    value: number | string;
    iconColor?: string;
    iconBgColor?: string;
}

export default function StatsCard({
    icon: Icon,
    label,
    value,
    iconColor = "text-gray-500",
    iconBgColor = "bg-gray-50 dark:bg-gray-800/50"
}: StatsCardProps) {
    return (
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4 shadow-sm">
            <div className={`w-14 h-14 rounded-2xl ${iconBgColor} flex items-center justify-center text-2xl shadow-sm ${iconColor}`}>
                <Icon size={28} />
            </div>
            <div>
                <p className="text-sm font-medium text-text-secondary">{label}</p>
                <p className="text-3xl font-bold text-text">{value}</p>
            </div>
        </div>
    );
}
