"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Wrench, Calendar, Package, Users, Camera, Clock,
    TrendingUp, ClipboardList, FileSpreadsheet, Printer,
    BookOpen, AlertCircle, Building2, ArrowUpRight
} from "lucide-react";
import { useDashboardStats, canSee, PersonStat } from "@/hooks/useDashboardStats";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import PersonFilter from "@/app/components/dashboard/PersonFilter";
import { exportDashboardToExcel, printDashboardStats } from "@/utils/dashboardExport";
import toast from "react-hot-toast";

// ============================================================================
// Sub-components
// ============================================================================

interface StatCardProps {
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
    href?: string;
    description?: string;
    delay?: number;
}

function StatCard({ label, value, icon: Icon, color, href, description, delay = 0 }: StatCardProps) {
    const content = (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`relative overflow-hidden rounded-2xl p-4 bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all group ${href ? 'cursor-pointer' : ''}`}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                    {description && (
                        <p className="text-xs text-gray-400 mt-1">{description}</p>
                    )}
                </div>
                <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center text-white shadow-lg`}>
                    <Icon size={20} />
                </div>
            </div>
            {href && (
                <ArrowUpRight size={14} className="absolute top-3 right-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
        </motion.div>
    );

    return href ? <Link href={href}>{content}</Link> : content;
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
    return (
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <Icon size={20} className="text-blue-500" />
            {children}
        </h2>
    );
}

// ============================================================================
// Main Dashboard
// ============================================================================

export default function AdminDashboard() {
    const { user, role, isPhotographer, loading, getDisplayName } = useAuth();
    const router = useRouter();
    const { stats, personStats, loading: statsLoading } = useDashboardStats();
    const { activities } = useActivityLogs({ limitCount: 8, filterRepairOnly: false });

    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

    // Access control — technician & facility_technician can now access
    const hasAccess = role === 'admin' || role === 'moderator' || role === 'technician' || role === 'facility_technician' || isPhotographer;

    // Redirect if no access
    React.useEffect(() => {
        if (!loading && (!user || !hasAccess)) {
            router.push("/");
        }
    }, [user, role, loading, hasAccess, router]);

    if (loading || !user || !hasAccess) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent" />
            </div>
        );
    }

    // Filter person stats if selected
    const filteredPersonStats: PersonStat[] = selectedPerson
        ? personStats.filter(p => p.id === selectedPerson)
        : personStats;

    // Helpers
    const today = new Date().toLocaleDateString('th-TH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const getRoleBadge = () => {
        switch (role) {
            case 'admin': return { label: 'Admin', color: 'bg-purple-500' };
            case 'moderator': return { label: 'Moderator', color: 'bg-orange-500' };
            case 'technician': return { label: 'ช่าง IT/โสตฯ', color: 'bg-cyan-500' };
            case 'facility_technician': return { label: 'ช่างอาคาร', color: 'bg-emerald-500' };
            default: return { label: 'User', color: 'bg-gray-500' };
        }
    };

    const handleExport = () => {
        exportDashboardToExcel(stats, personStats, getDisplayName());
        toast.success("ส่งออก Excel สำเร็จ");
    };

    const handlePrint = () => {
        printDashboardStats(stats, personStats, getDisplayName());
    };

    const formatTimeAgo = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
        if (diffMin < 1) return 'เมื่อกี้';
        if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
        if (diffMin < 1440) return `${Math.floor(diffMin / 60)} ชม.ที่แล้ว`;
        return `${Math.floor(diffMin / 1440)} วันที่แล้ว`;
    };

    const getActionLabel = (action: string) => {
        const map: Record<string, string> = {
            repair: 'แจ้งซ่อม', repair_update: 'อัปเดตงานซ่อม',
            borrow: 'ยืมอุปกรณ์', return: 'คืนอุปกรณ์',
            requisition: 'เบิกอุปกรณ์', add: 'เพิ่มอุปกรณ์',
            create: 'สร้าง', delete: 'ลบ', update: 'แก้ไข'
        };
        return map[action] || action;
    };

    const getActionDot = (action: string) => {
        if (action.includes('repair')) return 'bg-rose-500';
        if (action.includes('borrow') || action.includes('return')) return 'bg-blue-500';
        if (action.includes('requisition')) return 'bg-purple-500';
        return 'bg-gray-400';
    };

    const badge = getRoleBadge();

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* ========== Header ========== */}
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
                                สวัสดี, {getDisplayName().split(' ')[0]}! 👋
                            </h1>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`${badge.color} text-white text-xs px-2.5 py-0.5 rounded-full font-medium`}>
                                    {badge.label}
                                </span>
                                {isPhotographer && (
                                    <span className="bg-yellow-500 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
                                        📸 ช่างภาพ
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Export / Print */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm transition-all"
                            >
                                <FileSpreadsheet size={16} />
                                Export
                            </button>
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm transition-all"
                            >
                                <Printer size={16} />
                                Print
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ========== Stats Grid ========== */}
            {statsLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-28 bg-white/50 dark:bg-gray-800/30 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Repairs */}
                    {canSee(role, isPhotographer, 'repairs') && (
                        <>
                            <StatCard
                                label="งานซ่อม IT - รอ"
                                value={stats.repairs.pending}
                                icon={Wrench}
                                color="bg-gradient-to-br from-rose-500 to-orange-500"
                                href="/admin/repairs"
                                description={`${stats.repairs.in_progress} กำลังทำ`}
                                delay={0}
                            />
                            <StatCard
                                label="งานซ่อม IT - เสร็จ"
                                value={stats.repairs.completed}
                                icon={Wrench}
                                color="bg-gradient-to-br from-emerald-500 to-teal-500"
                                href="/admin/repairs"
                                description={`${stats.repairs.total} ทั้งหมด`}
                                delay={0.05}
                            />
                        </>
                    )}

                    {/* Bookings */}
                    {canSee(role, isPhotographer, 'bookings') && (
                        <StatCard
                            label="การจอง - รออนุมัติ"
                            value={stats.bookings.pending}
                            icon={Calendar}
                            color="bg-gradient-to-br from-amber-500 to-yellow-500"
                            href="/admin/bookings"
                            description={`${stats.bookings.approved} อนุมัติแล้ว`}
                            delay={0.1}
                        />
                    )}

                    {/* Photography */}
                    {canSee(role, isPhotographer, 'photography') && (
                        <StatCard
                            label="งานถ่ายภาพ - มอบหมาย"
                            value={stats.photography.assigned}
                            icon={Camera}
                            color="bg-gradient-to-br from-purple-500 to-indigo-500"
                            href="/admin/photography"
                            description={`${stats.photography.completed} เสร็จสิ้น`}
                            delay={0.15}
                        />
                    )}

                    {/* Inventory */}
                    {canSee(role, isPhotographer, 'inventory') && (
                        <StatCard
                            label="อุปกรณ์ใกล้หมด"
                            value={stats.inventory.lowStock}
                            icon={Package}
                            color="bg-gradient-to-br from-blue-500 to-cyan-500"
                            href="/admin/inventory"
                            description="ต่ำกว่า 5 ชิ้น"
                            delay={0.2}
                        />
                    )}

                    {/* Users (admin only) */}
                    {canSee(role, isPhotographer, 'users') && (
                        <StatCard
                            label="ผู้ใช้งานทั้งหมด"
                            value={stats.users.total}
                            icon={Users}
                            color="bg-gradient-to-br from-emerald-500 to-green-500"
                            href="/admin/users"
                            delay={0.25}
                        />
                    )}
                </div>
            )}

            {/* ========== Per-Person Section ========== */}
            {personStats.length > 0 && (
                <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <SectionTitle icon={Users}>สถิติรายบุคคล</SectionTitle>
                        <PersonFilter
                            persons={personStats}
                            selectedId={selectedPerson}
                            onChange={setSelectedPerson}
                        />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                    <th className="pb-3 font-medium">ชื่อ</th>
                                    <th className="pb-3 font-medium text-center">รอ</th>
                                    <th className="pb-3 font-medium text-center">กำลังทำ</th>
                                    <th className="pb-3 font-medium text-center">เสร็จ</th>
                                    <th className="pb-3 font-medium text-center">รวม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPersonStats.map(p => (
                                    <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800">
                                        <td className="py-3 text-gray-900 dark:text-white font-medium">{p.name}</td>
                                        <td className="py-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                {p.pending}
                                            </span>
                                        </td>
                                        <td className="py-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                {p.in_progress}
                                            </span>
                                        </td>
                                        <td className="py-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                {p.completed}
                                            </span>
                                        </td>
                                        <td className="py-3 text-center font-bold text-gray-900 dark:text-white">{p.total}</td>
                                    </tr>
                                ))}
                                {filteredPersonStats.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                                            ยังไม่มีข้อมูลรายบุคคล
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========== Quick Links + Recent Activity ========== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Quick Links */}
                <div className="lg:col-span-4 bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                    <SectionTitle icon={ClipboardList}>เมนูลัด</SectionTitle>
                    <div className="space-y-2 mt-4">
                        {canSee(role, isPhotographer, 'repairs') && (
                            <QuickLink title="จัดการงานซ่อม" icon={Wrench} href="/admin/repairs" color="from-orange-500 to-red-500" />
                        )}
                        {canSee(role, isPhotographer, 'bookings') && (
                            <QuickLink title="จัดการการจอง" icon={Calendar} href="/admin/bookings" color="from-blue-500 to-cyan-500" />
                        )}
                        {canSee(role, isPhotographer, 'inventory') && (
                            <QuickLink title="คลังอุปกรณ์" icon={Package} href="/admin/inventory" color="from-violet-500 to-purple-500" />
                        )}
                        {canSee(role, isPhotographer, 'photography') && (
                            <QuickLink title="งานตากล้อง" icon={Camera} href="/admin/photography" color="from-purple-500 to-indigo-500" />
                        )}
                        {canSee(role, isPhotographer, 'users') && (
                            <QuickLink title="จัดการผู้ใช้" icon={Users} href="/admin/users" color="from-emerald-500 to-teal-500" />
                        )}
                        <QuickLink title="คลังความรู้ IT" icon={BookOpen} href="/admin/knowledge-base" color="from-sky-500 to-blue-600" />
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="lg:col-span-8 bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                    <SectionTitle icon={Clock}>กิจกรรมล่าสุด</SectionTitle>
                    {activities.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Clock size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">ยังไม่มีกิจกรรม</p>
                        </div>
                    ) : (
                        <div className="space-y-1 mt-4">
                            {activities.map((activity, index) => (
                                <motion.div
                                    key={activity.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: index * 0.03 }}
                                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                >
                                    <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${getActionDot(activity.action)}`} />
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
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {formatTimeAgo(activity.timestamp)}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Quick Link Sub-component
// ============================================================================

function QuickLink({ title, icon: Icon, href, color }: { title: string; icon: React.ElementType; href: string; color: string }) {
    return (
        <Link href={href}>
            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all group cursor-pointer">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon size={18} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {title}
                </span>
                <ArrowUpRight size={14} className="ml-auto text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </Link>
    );
}
