"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Wrench,
    Calendar,
    Package,
    Users,
    ChevronRight,
    Clock,
    AlertCircle,
    CheckCircle2,
    TrendingUp,
    Camera,
    ClipboardList,
    User
} from "lucide-react";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useActivityLogs } from "@/hooks/useActivityLogs";

// Widget Component - same as main dashboard
interface WidgetProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    icon?: React.ElementType;
    action?: {
        label: string;
        href: string;
    };
}

function Widget({ children, className = "", title, icon: Icon, action }: WidgetProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg shadow-gray-200/20 dark:shadow-none ${className}`}
        >
            <div className="relative z-10 h-full flex flex-col">
                {(title || action) && (
                    <div className="flex items-center justify-between p-5 pb-3">
                        <div className="flex items-center gap-2">
                            {Icon && (
                                <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700/50">
                                    <Icon size={18} className="text-gray-600 dark:text-gray-300" />
                                </div>
                            )}
                            {title && (
                                <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                            )}
                        </div>
                        {action && (
                            <Link
                                href={action.href}
                                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                            >
                                {action.label}
                                <ChevronRight size={14} />
                            </Link>
                        )}
                    </div>
                )}
                <div className="flex-1 px-5 pb-5">
                    {children}
                </div>
            </div>
        </motion.div>
    );
}

// Stat Card
interface StatCardProps {
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
    href: string;
    description?: string;
}

function StatCard({ label, value, icon: Icon, color, href, description }: StatCardProps) {
    return (
        <Link href={href} className="block group">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all">
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon size={22} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                    {description && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
                    )}
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </div>
        </Link>
    );
}

// Quick Link
interface QuickLinkProps {
    title: string;
    description: string;
    icon: React.ElementType;
    href: string;
    color: string;
}

function QuickLink({ title, description, icon: Icon, href, color }: QuickLinkProps) {
    return (
        <Link
            href={href}
            className="group flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all"
        >
            <div className={`p-3 rounded-xl bg-gradient-to-br ${color}`}>
                <Icon size={20} className="text-white" />
            </div>
            <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
        </Link>
    );
}

export default function AdminDashboard() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const { activities } = useActivityLogs({ limitCount: 5, filterRepairOnly: false });

    const [stats, setStats] = useState({
        pendingRepairs: 0,
        inProgressRepairs: 0,
        pendingBookings: 0,
        lowStock: 0,
        totalUsers: 0
    });

    // Redirect non-admin users
    useEffect(() => {
        if (!loading && (!user || (role !== 'admin' && role !== 'moderator'))) {
            router.push("/");
        }
    }, [user, role, loading, router]);

    // Fetch stats on page load (not realtime to reduce reads)
    useEffect(() => {
        if (!user) return;

        const fetchStats = async () => {
            try {
                const [pendingRepairs, inProgressRepairs, pendingBookings, lowStock, totalUsers] = await Promise.all([
                    getDocs(query(collection(db, "repair_tickets"), where("status", "==", "pending"))),
                    getDocs(query(collection(db, "repair_tickets"), where("status", "==", "in_progress"))),
                    getDocs(query(collection(db, "bookings"), where("status", "==", "pending"))),
                    getDocs(query(collection(db, "products"), where("quantity", "<", 5))),
                    getDocs(collection(db, "users"))
                ]);

                setStats({
                    pendingRepairs: pendingRepairs.size,
                    inProgressRepairs: inProgressRepairs.size,
                    pendingBookings: pendingBookings.size,
                    lowStock: lowStock.size,
                    totalUsers: totalUsers.size
                });
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        };

        fetchStats();
    }, [user]);

    // Helper functions
    const formatTimeAgo = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

        if (diffInMinutes < 1) return 'เมื่อกี้';
        if (diffInMinutes < 60) return `${diffInMinutes} นาทีที่แล้ว`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} ชั่วโมงที่แล้ว`;
        return `${Math.floor(diffInMinutes / 1440)} วันที่แล้ว`;
    };

    const getActionLabel = (action: string) => {
        switch (action) {
            case 'repair': return 'แจ้งซ่อม';
            case 'repair_update': return 'อัปเดตงานซ่อม';
            case 'borrow': return 'ยืมอุปกรณ์';
            case 'return': return 'คืนอุปกรณ์';
            case 'requisition': return 'เบิกอุปกรณ์';
            case 'add': return 'เพิ่มอุปกรณ์';
            default: return action;
        }
    };

    const getActionColor = (action: string) => {
        if (action.includes('repair')) return 'bg-rose-500';
        if (action.includes('borrow') || action.includes('return')) return 'bg-blue-500';
        if (action.includes('requisition')) return 'bg-purple-500';
        return 'bg-gray-500';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent" />
            </div>
        );
    }

    const today = new Date().toLocaleDateString('th-TH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-500 to-pink-400" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

                <div className="relative z-10 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                                <Clock size={14} />
                                <span>{today}</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">
                                สวัสดี, {user?.displayName?.split(' ')[0] || 'Admin'}! 👋
                            </h1>
                            <p className="text-white/80 mt-1">นี่คือภาพรวมระบบของคุณวันนี้</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

                {/* Stats Overview */}
                <Widget
                    className="lg:col-span-8"
                    title="ภาพรวมระบบ"
                    icon={TrendingUp}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <StatCard
                            label="งานซ่อมรอดำเนินการ"
                            value={stats.pendingRepairs}
                            icon={Wrench}
                            color="bg-rose-500"
                            href="/admin/repairs"
                            description={`${stats.inProgressRepairs} กำลังดำเนินการ`}
                        />
                        <StatCard
                            label="การจองรออนุมัติ"
                            value={stats.pendingBookings}
                            icon={Calendar}
                            color="bg-amber-500"
                            href="/admin/bookings"
                        />
                        <StatCard
                            label="อุปกรณ์ใกล้หมด"
                            value={stats.lowStock}
                            icon={Package}
                            color="bg-blue-500"
                            href="/admin/inventory"
                            description="ต่ำกว่า 5 ชิ้น"
                        />
                        <StatCard
                            label="ผู้ใช้งานทั้งหมด"
                            value={stats.totalUsers}
                            icon={Users}
                            color="bg-emerald-500"
                            href="/admin/users"
                        />
                    </div>
                </Widget>

                {/* Quick Links */}
                <Widget
                    className="lg:col-span-4"
                    title="เมนูลัด"
                    icon={ClipboardList}
                >
                    <div className="space-y-3">
                        <QuickLink
                            title="จัดการงานซ่อม"
                            description="ดูและจัดการคำขอซ่อม"
                            icon={Wrench}
                            href="/admin/repairs"
                            color="from-orange-500 to-red-500"
                        />
                        <QuickLink
                            title="จัดการการจอง"
                            description="อนุมัติและจัดการการจองห้อง"
                            icon={Calendar}
                            href="/admin/bookings"
                            color="from-blue-500 to-cyan-500"
                        />
                        <QuickLink
                            title="คลังอุปกรณ์"
                            description="จัดการสต็อกและอุปกรณ์"
                            icon={Package}
                            href="/admin/inventory"
                            color="from-violet-500 to-purple-500"
                        />
                        {role === 'admin' && (
                            <QuickLink
                                title="จัดการผู้ใช้"
                                description="จัดการบัญชีและสิทธิ์"
                                icon={Users}
                                href="/admin/users"
                                color="from-emerald-500 to-teal-500"
                            />
                        )}
                    </div>
                </Widget>

                {/* Recent Activity */}
                <Widget
                    className="lg:col-span-12"
                    title="กิจกรรมล่าสุด"
                    icon={Clock}
                >
                    {activities.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Clock size={32} className="mx-auto mb-2 opacity-50" />
                            <p>ยังไม่มีกิจกรรม</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activities.map((activity, index) => (
                                <motion.div
                                    key={activity.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30"
                                >
                                    <div className={`w-2 h-2 mt-2 rounded-full ${getActionColor(activity.action)}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 dark:text-white">
                                            <span className="font-medium">{activity.userName}</span>
                                            {' '}
                                            <span className="text-gray-500 dark:text-gray-400">
                                                {getActionLabel(activity.action)}
                                            </span>
                                        </p>
                                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium truncate">
                                            {activity.productName || activity.details}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {formatTimeAgo(activity.timestamp)}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </Widget>
            </div>
        </div>
    );
}
