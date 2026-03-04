"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Wrench, Calendar, Package, Users, Camera, Clock,
    TrendingUp, ClipboardList, FileSpreadsheet, Printer,
    BookOpen, Building2, ArrowRight, ChevronRight, Activity
} from "lucide-react";
import { useDashboardStats, canSee, PersonStat } from "@/hooks/useDashboardStats";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import PersonFilter from "@/app/components/dashboard/PersonFilter";
import { exportDashboardToExcel, printDashboardStats } from "@/utils/dashboardExport";
import toast from "react-hot-toast";

// ============================================================================
// Stat Card — Clean, data-focused
// ============================================================================

function StatCard({
    label, value, icon: Icon, accent, href, sub, delay = 0
}: {
    label: string; value: number; icon: React.ElementType;
    accent: string; href?: string; sub?: string; delay?: number;
}) {
    const inner = (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.2, ease: [0, 0, 0.2, 1] }}
            className={`relative rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md ${href ? 'cursor-pointer group' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-sm text-text-secondary truncate">{label}</p>
                    <p className="text-3xl font-bold text-text tabular-nums">{value.toLocaleString()}</p>
                    {sub && <p className="text-xs text-text-secondary">{sub}</p>}
                </div>
                <div className={`size-10 rounded-xl ${accent} flex items-center justify-center text-white shrink-0`}>
                    <Icon size={20} />
                </div>
            </div>
            {href && (
                <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
        </motion.div>
    );

    return href ? <Link href={href}>{inner}</Link> : inner;
}

// ============================================================================
// Section Header
// ============================================================================

function SectionHeader({ title, icon: Icon, actions }: {
    title: string; icon: React.ElementType; actions?: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text text-balance">
                <Icon size={18} className="text-cyan-500" />
                {title}
            </h2>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
    );
}

// ============================================================================
// Quick Link
// ============================================================================

function QuickLink({ title, icon: Icon, href, count }: {
    title: string; icon: React.ElementType; href: string; count?: number;
}) {
    return (
        <Link href={href}>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-background group">
                <div className="size-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                    <Icon size={16} />
                </div>
                <span className="text-sm font-medium text-text-secondary group-hover:text-text transition-colors flex-1 truncate">
                    {title}
                </span>
                {count !== undefined && count > 0 && (
                    <span className="text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full tabular-nums">
                        {count}
                    </span>
                )}
                <ArrowRight size={14} className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
        </Link>
    );
}

// ============================================================================
// Main Dashboard
// ============================================================================

export default function AdminDashboard() {
    const { user, role, isPhotographer, loading, getDisplayName } = useAuth();
    const router = useRouter();
    const { stats, personStats, loading: statsLoading } = useDashboardStats();
    const { activities } = useActivityLogs({ limitCount: 10, filterRepairOnly: false });

    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

    // Access control
    const hasAccess = role === 'admin' || role === 'moderator' || role === 'technician' || role === 'facility_technician' || isPhotographer;

    React.useEffect(() => {
        if (!loading && (!user || !hasAccess)) {
            router.push("/");
        }
    }, [user, role, loading, hasAccess, router]);

    if (loading || !user || !hasAccess) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="size-8 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin" />
            </div>
        );
    }

    const filteredPersonStats: PersonStat[] = selectedPerson
        ? personStats.filter(p => p.id === selectedPerson)
        : personStats;

    const today = new Date().toLocaleDateString('th-TH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const roleName: Record<string, string> = {
        admin: 'ผู้ดูแลระบบ', moderator: 'Moderator',
        technician: 'ช่าง IT/โสตฯ', facility_technician: 'ช่างอาคาร'
    };

    const handleExport = () => {
        exportDashboardToExcel(stats, personStats, getDisplayName());
        toast.success("ส่งออก Excel สำเร็จ");
    };
    const handlePrint = () => printDashboardStats(stats, personStats, getDisplayName());

    // Time-ago helper
    const timeAgo = (ts: any) => {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        const m = Math.floor((Date.now() - d.getTime()) / 60000);
        if (m < 1) return 'เมื่อกี้';
        if (m < 60) return `${m} นาทีที่แล้ว`;
        if (m < 1440) return `${Math.floor(m / 60)} ชม.ที่แล้ว`;
        return `${Math.floor(m / 1440)} วันที่แล้ว`;
    };

    const actionLabel: Record<string, string> = {
        repair: 'แจ้งซ่อม', repair_update: 'อัปเดตงานซ่อม',
        borrow: 'ยืมอุปกรณ์', return: 'คืนอุปกรณ์',
        requisition: 'เบิกอุปกรณ์', add: 'เพิ่มอุปกรณ์',
        create: 'สร้าง', delete: 'ลบ', update: 'แก้ไข',
    };

    const actionDot = (a: string) => {
        if (a.includes('repair')) return 'bg-rose-500';
        if (a.includes('borrow') || a.includes('return')) return 'bg-blue-500';
        return 'bg-gray-400';
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">

            {/* ───────── Header ───────── */}
            <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-sm text-text-secondary flex items-center gap-1.5">
                            <Clock size={14} /> {today}
                        </p>
                        <h1 className="text-2xl font-bold text-text text-balance">
                            สวัสดี, {getDisplayName().split(' ')[0]}! 👋
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2.5 py-0.5 rounded-full">
                                {roleName[role || ''] || role}
                            </span>
                            {isPhotographer && (
                                <span className="text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full">
                                    📸 ช่างภาพ
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleExport}
                            aria-label="Export to Excel"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card text-text-secondary text-sm hover:bg-background hover:text-text transition-colors"
                        >
                            <FileSpreadsheet size={16} />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button
                            onClick={handlePrint}
                            aria-label="Print report"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card text-text-secondary text-sm hover:bg-background hover:text-text transition-colors"
                        >
                            <Printer size={16} />
                            <span className="hidden sm:inline">Print</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ───────── Stats Grid ───────── */}
            {statsLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-[110px] bg-card border border-border rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {canSee(role, isPhotographer, 'repairs') && (
                        <>
                            <StatCard
                                label="งานซ่อม IT — รอ"
                                value={stats.repairs.pending}
                                icon={Wrench}
                                accent="bg-rose-500"
                                href="/admin/repairs"
                                sub={`${stats.repairs.in_progress} กำลังดำเนินการ`}
                                delay={0}
                            />
                            <StatCard
                                label="งานซ่อม IT — เสร็จ"
                                value={stats.repairs.completed}
                                icon={Wrench}
                                accent="bg-emerald-500"
                                href="/admin/repairs"
                                sub={`${stats.repairs.total} ทั้งหมด`}
                                delay={0.04}
                            />
                        </>
                    )}
                    {canSee(role, isPhotographer, 'bookings') && (
                        <StatCard
                            label="การจอง — รออนุมัติ"
                            value={stats.bookings.pending}
                            icon={Calendar}
                            accent="bg-amber-500"
                            href="/admin/bookings"
                            sub={`${stats.bookings.approved} อนุมัติแล้ว`}
                            delay={0.08}
                        />
                    )}
                    {canSee(role, isPhotographer, 'photography') && (
                        <StatCard
                            label="งานถ่ายภาพ — มอบหมาย"
                            value={stats.photography.assigned}
                            icon={Camera}
                            accent="bg-indigo-500"
                            href="/admin/photography"
                            sub={`${stats.photography.completed} เสร็จสิ้น`}
                            delay={0.12}
                        />
                    )}
                    {canSee(role, isPhotographer, 'inventory') && (
                        <StatCard
                            label="อุปกรณ์ใกล้หมด"
                            value={stats.inventory.lowStock}
                            icon={Package}
                            accent="bg-blue-500"
                            href="/admin/inventory"
                            sub="ต่ำกว่า 5 ชิ้น"
                            delay={0.16}
                        />
                    )}
                    {canSee(role, isPhotographer, 'users') && (
                        <StatCard
                            label="ผู้ใช้งานทั้งหมด"
                            value={stats.users.total}
                            icon={Users}
                            accent="bg-teal-500"
                            href="/admin/users"
                            delay={0.2}
                        />
                    )}
                </div>
            )}

            {/* ───────── Per-Person Table ───────── */}
            {personStats.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5">
                    <SectionHeader
                        title="สถิติรายบุคคล"
                        icon={Users}
                        actions={
                            <PersonFilter
                                persons={personStats}
                                selectedId={selectedPerson}
                                onChange={setSelectedPerson}
                            />
                        }
                    />
                    <div className="overflow-x-auto -mx-5 px-5">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-text-secondary text-left">
                                    <th className="pb-3 pr-4 font-medium">ชื่อ</th>
                                    <th className="pb-3 px-4 font-medium text-center w-20">รอ</th>
                                    <th className="pb-3 px-4 font-medium text-center w-20">กำลังทำ</th>
                                    <th className="pb-3 px-4 font-medium text-center w-20">เสร็จ</th>
                                    <th className="pb-3 pl-4 font-medium text-center w-20">รวม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPersonStats.map(p => (
                                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                                        <td className="py-3 pr-4 font-medium text-text">{p.name}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-medium tabular-nums bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                                {p.pending}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-medium tabular-nums bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                {p.in_progress}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-medium tabular-nums bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                {p.completed}
                                            </span>
                                        </td>
                                        <td className="py-3 pl-4 text-center font-bold text-text tabular-nums">{p.total}</td>
                                    </tr>
                                ))}
                                {filteredPersonStats.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center text-text-secondary text-sm">
                                            ยังไม่มีข้อมูลรายบุคคล
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ───────── Quick Links + Activity ───────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* Quick Links */}
                <div className="lg:col-span-4 rounded-2xl border border-border bg-card p-5">
                    <SectionHeader title="เมนูลัด" icon={ClipboardList} />
                    <div className="space-y-0.5">
                        {canSee(role, isPhotographer, 'repairs') && (
                            <QuickLink title="จัดการงานซ่อม" icon={Wrench} href="/admin/repairs" count={stats.repairs.pending} />
                        )}
                        {canSee(role, isPhotographer, 'bookings') && (
                            <QuickLink title="จัดการการจอง" icon={Calendar} href="/admin/bookings" count={stats.bookings.pending} />
                        )}
                        {canSee(role, isPhotographer, 'inventory') && (
                            <QuickLink title="คลังอุปกรณ์" icon={Package} href="/admin/inventory" />
                        )}
                        {canSee(role, isPhotographer, 'photography') && (
                            <QuickLink title="งานตากล้อง" icon={Camera} href="/admin/photography" />
                        )}
                        {canSee(role, isPhotographer, 'users') && (
                            <QuickLink title="จัดการผู้ใช้" icon={Users} href="/admin/users" />
                        )}
                        <QuickLink title="คลังความรู้ IT" icon={BookOpen} href="/admin/knowledge-base" />
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="lg:col-span-8 rounded-2xl border border-border bg-card p-5">
                    <SectionHeader title="กิจกรรมล่าสุด" icon={Activity} />

                    {activities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                            <Clock size={28} className="mb-2 opacity-40" />
                            <p className="text-sm">ยังไม่มีกิจกรรม</p>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {activities.map((a, i) => (
                                <div
                                    key={a.id || i}
                                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-background transition-colors"
                                >
                                    <div className={`size-2 mt-2 rounded-full shrink-0 ${actionDot(a.action)}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-text text-pretty">
                                            <span className="font-medium">{a.userName}</span>
                                            {' '}
                                            <span className="text-text-secondary">
                                                {actionLabel[a.action] || a.action}
                                            </span>
                                        </p>
                                        {(a.productName || a.details) && (
                                            <p className="text-sm text-cyan-600 dark:text-cyan-400 font-medium truncate">
                                                {a.productName || a.details}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs text-text-secondary tabular-nums shrink-0 mt-0.5">
                                        {timeAgo(a.timestamp)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
