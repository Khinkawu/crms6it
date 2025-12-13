"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "../../../types";
import {
    User, Globe, Wrench, Calendar as CalendarIcon,
    Package, RefreshCw, ExternalLink, ArrowRight
} from "lucide-react";

interface QuickAction {
    name: string;
    description: string;
    icon: React.ReactNode;
    path: string;
    role: UserRole[];
    external?: boolean;
    color: string;
}

const quickActions: QuickAction[] = [
    {
        name: "โปรไฟล์",
        description: "ดูและแก้ไขข้อมูลส่วนตัว",
        icon: <User size={22} />,
        path: "/profile",
        role: ['admin', 'technician', 'user', 'moderator'],
        color: "from-violet-500 to-purple-500"
    },
    {
        name: "แจ้งซ่อม",
        description: "แจ้งปัญหาอุปกรณ์",
        icon: <Wrench size={22} />,
        path: "/repair",
        role: ['admin', 'technician', 'user', 'moderator'],
        color: "from-orange-500 to-red-500"
    },
    {
        name: "จองห้องประชุม",
        description: "จองห้องและอุปกรณ์",
        icon: <CalendarIcon size={22} />,
        path: "/booking",
        role: ['admin', 'technician', 'user', 'moderator'],
        color: "from-blue-500 to-cyan-500"
    },
    {
        name: "Wi-Fi Users",
        description: "เปิดหน้าเว็บ Wi-Fi",
        icon: <Globe size={22} />,
        path: "https://sites.google.com/tesaban6.ac.th/crms6wifiusers",
        role: ['admin', 'technician', 'user', 'moderator'],
        external: true,
        color: "from-emerald-500 to-teal-500"
    },
    {
        name: "คลังพัสดุ",
        description: "จัดการอุปกรณ์ทั้งหมด",
        icon: <Package size={22} />,
        path: "/admin/inventory",
        role: ['admin'],
        color: "from-cyan-500 to-blue-500"
    },
    {
        name: "รีเซ็ตสถิติ",
        description: "ล้างข้อมูลสถิติระบบ",
        icon: <RefreshCw size={22} />,
        path: "/admin/init-stats",
        role: ['admin'],
        color: "from-gray-500 to-slate-600"
    },
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
        <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">เมนูด่วน</h2>
                <span className="text-xs text-gray-400">{filteredActions.length} รายการ</span>
            </div>

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
                        className="group relative overflow-hidden p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-300 tap-scale text-left"
                    >
                        {/* Gradient overlay on hover */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>

                        <div className="relative z-10">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white shadow-lg mb-3 group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                                {action.icon}
                            </div>

                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-gray-700 dark:group-hover:text-gray-100 transition-colors">
                                        {action.name}
                                    </h3>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                        {action.description}
                                    </p>
                                </div>

                                {action.external ? (
                                    <ExternalLink size={14} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-shrink-0 mt-0.5" />
                                ) : (
                                    <ArrowRight size={14} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
