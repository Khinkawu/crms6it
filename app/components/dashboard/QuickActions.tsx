"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "../../../types";
import {
    User, Globe, AlertTriangle, Calendar as CalendarIcon,
    Plus, RefreshCw, Zap
} from "lucide-react";

interface QuickAction {
    name: string;
    icon: React.ReactNode;
    path: string;
    role: UserRole[];
    external?: boolean;
}

const quickActions: QuickAction[] = [
    { name: "โปรไฟล์", icon: <User size={24} />, path: "/profile", role: ['admin', 'technician', 'user', 'moderator'] },
    { name: "Wi-Fi Users", icon: <Globe size={24} />, path: "https://sites.google.com/tesaban6.ac.th/crms6wifiusers", role: ['admin', 'technician', 'user', 'moderator'], external: true },
    { name: "แจ้งซ่อม", icon: <AlertTriangle size={24} />, path: "/repair", role: ['admin', 'technician', 'user', 'moderator'] },
    { name: "จองห้องประชุม", icon: <CalendarIcon size={24} />, path: "/booking", role: ['admin', 'technician', 'user', 'moderator'] },
    { name: "เพิ่มอุปกรณ์", icon: <Plus size={24} />, path: "/admin/inventory", role: ['admin'] },
    { name: "รีเซ็ตค่าสถิติ", icon: <RefreshCw size={24} />, path: "/admin/init-stats", role: ['admin'] },
];

interface QuickActionsProps {
    role: UserRole | null;
}

export default function QuickActions({ role }: QuickActionsProps) {
    const router = useRouter();

    const filteredActions = quickActions.filter(action =>
        !role || action.role.includes(role)
    );

    return (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" /> เมนูด่วน
            </h2>
            <div className="grid grid-cols-2 gap-3">
                {filteredActions.map((action, index) => (
                    <button
                        key={index}
                        onClick={() => {
                            if (action.external) {
                                window.open(action.path, '_blank');
                            } else {
                                router.push(action.path);
                            }
                        }}
                        className="stagger-item tap-scale flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-input-bg border border-transparent hover:border-primary-start/30 hover:bg-primary-start/5 transition-all group h-full w-full aspect-[4/3] sm:aspect-auto hover-lift"
                    >
                        <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 group-hover:text-primary-start group-hover:scale-110 transition-all">
                            {action.icon}
                        </div>
                        <span className="text-sm font-medium text-text group-hover:text-primary-start transition-colors text-center leading-tight">
                            {action.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
