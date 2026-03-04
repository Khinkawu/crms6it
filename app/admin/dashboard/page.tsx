"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Wrench, Calendar, Package, Users, Camera, Clock,
    FileSpreadsheet, Printer, ArrowRight, ArrowUpRight,
    AlertTriangle, CheckCircle2, Loader2, Building2
} from "lucide-react";
import { useDashboardStats, canSee } from "@/hooks/useDashboardStats";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { exportDashboardToExcel, printDashboardStats } from "@/utils/dashboardExport";
import toast from "react-hot-toast";

// ─── Metric ─────────────────────────────────────────────────────────
function Metric({ label, value, href }: { label: string; value: number; href?: string }) {
    const inner = (
        <div className={`${href ? 'group cursor-pointer' : ''}`}>
            <p className="text-[13px] text-text-secondary">{label}</p>
            <p className="text-2xl font-semibold text-text tabular-nums mt-0.5">{value.toLocaleString()}</p>
        </div>
    );
    return href ? <Link href={href} className="hover:opacity-70 transition-opacity">{inner}</Link> : inner;
}

// ─── Activity Row ───────────────────────────────────────────────────
function ActivityRow({ userName, action, detail, time }: {
    userName: string; action: string; detail?: string; time: string;
}) {
    const labels: Record<string, string> = {
        repair: 'แจ้งซ่อม', repair_update: 'อัปเดตซ่อม',
        borrow: 'ยืม', return: 'คืน', requisition: 'เบิก',
        add: 'เพิ่ม', create: 'สร้าง', delete: 'ลบ', update: 'แก้ไข',
    };
    return (
        <div className="flex items-baseline gap-3 py-2.5 border-b border-border/50 last:border-0">
            <span className="text-[13px] text-text-secondary w-20 shrink-0 tabular-nums">{time}</span>
            <div className="flex-1 min-w-0">
                <span className="text-[13px] text-text">
                    <span className="font-medium">{userName}</span>
                    {' '}
                    <span className="text-text-secondary">{labels[action] || action}</span>
                    {detail && (
                        <span className="text-text-secondary"> — {detail}</span>
                    )}
                </span>
            </div>
        </div>
    );
}

// ─── Page ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const { user, role, isPhotographer, loading, getDisplayName } = useAuth();
    const router = useRouter();
    const { stats, personStats, loading: statsLoading } = useDashboardStats();
    const { activities } = useActivityLogs({ limitCount: 12, filterRepairOnly: false });

    const hasAccess = role === 'admin' || role === 'moderator' || role === 'technician' || role === 'facility_technician' || isPhotographer;

    React.useEffect(() => {
        if (!loading && (!user || !hasAccess)) router.push("/");
    }, [user, role, loading, hasAccess, router]);

    if (loading || !user || !hasAccess) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 size={24} className="animate-spin text-text-secondary" />
            </div>
        );
    }

    const handleExport = () => {
        exportDashboardToExcel(stats, personStats, getDisplayName());
        toast.success("ส่งออก Excel สำเร็จ");
    };

    const timeAgo = (ts: any) => {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        const m = Math.floor((Date.now() - d.getTime()) / 60000);
        if (m < 1) return 'เมื่อกี้';
        if (m < 60) return `${m}น.`;
        if (m < 1440) return `${Math.floor(m / 60)}ชม.`;
        return `${Math.floor(m / 1440)}ว.`;
    };

    const showRepairs = canSee(role, isPhotographer, 'repairs');
    const showBookings = canSee(role, isPhotographer, 'bookings');
    const showPhotography = canSee(role, isPhotographer, 'photography');
    const showInventory = canSee(role, isPhotographer, 'inventory');
    const showUsers = canSee(role, isPhotographer, 'users');

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fade-in">

            {/* ──── Header ──── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-text">ภาพรวม</h1>
                    <p className="text-[13px] text-text-secondary mt-0.5">
                        {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleExport}
                        aria-label="Export to Excel"
                        className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-card transition-colors"
                    >
                        <FileSpreadsheet size={18} />
                    </button>
                    <button
                        onClick={() => printDashboardStats(stats, personStats, getDisplayName())}
                        aria-label="Print report"
                        className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-card transition-colors"
                    >
                        <Printer size={18} />
                    </button>
                </div>
            </div>

            {/* ──── Metrics Bar ──── */}
            {statsLoading ? (
                <div className="h-20 bg-card border border-border rounded-xl animate-pulse" />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 p-5 bg-card border border-border rounded-xl">
                    {showRepairs && (
                        <Metric label="งานซ่อม — รอ" value={stats.repairs.pending} href="/admin/repairs" />
                    )}
                    {showRepairs && (
                        <Metric label="กำลังดำเนินการ" value={stats.repairs.in_progress} href="/admin/repairs" />
                    )}
                    {showBookings && (
                        <Metric label="จอง — รออนุมัติ" value={stats.bookings.pending} href="/admin/bookings" />
                    )}
                    {showInventory && (
                        <Metric label="อุปกรณ์ใกล้หมด" value={stats.inventory.lowStock} href="/admin/inventory" />
                    )}
                    {showUsers && (
                        <Metric label="ผู้ใช้งาน" value={stats.users.total} href="/admin/users" />
                    )}
                </div>
            )}

            {/* ──── Cards Grid ──── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Repair Summary */}
                {showRepairs && (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Wrench size={16} className="text-text-secondary" />
                                <h2 className="text-sm font-semibold text-text">งานซ่อม</h2>
                            </div>
                            <Link href="/admin/repairs" className="text-xs text-text-secondary hover:text-text flex items-center gap-1 transition-colors">
                                ดูทั้งหมด <ArrowRight size={12} />
                            </Link>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <StatusPill label="รอ" value={stats.repairs.pending} color="amber" />
                            <StatusPill label="กำลังทำ" value={stats.repairs.in_progress} color="blue" />
                            <StatusPill label="รออะไหล่" value={stats.repairs.waiting_parts} color="orange" />
                            <StatusPill label="เสร็จ" value={stats.repairs.completed} color="emerald" />
                        </div>
                    </div>
                )}

                {/* Booking Summary */}
                {showBookings && (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-text-secondary" />
                                <h2 className="text-sm font-semibold text-text">การจอง</h2>
                            </div>
                            <Link href="/admin/bookings" className="text-xs text-text-secondary hover:text-text flex items-center gap-1 transition-colors">
                                ดูทั้งหมด <ArrowRight size={12} />
                            </Link>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <StatusPill label="รออนุมัติ" value={stats.bookings.pending} color="amber" />
                            <StatusPill label="อนุมัติ" value={stats.bookings.approved} color="emerald" />
                            <StatusPill label="ทั้งหมด" value={stats.bookings.total} color="gray" />
                        </div>
                    </div>
                )}

                {/* Photography Summary */}
                {showPhotography && (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Camera size={16} className="text-text-secondary" />
                                <h2 className="text-sm font-semibold text-text">งานถ่ายภาพ</h2>
                            </div>
                            <Link href="/admin/photography" className="text-xs text-text-secondary hover:text-text flex items-center gap-1 transition-colors">
                                ดูทั้งหมด <ArrowRight size={12} />
                            </Link>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <StatusPill label="มอบหมาย" value={stats.photography.assigned} color="blue" />
                            <StatusPill label="เสร็จ" value={stats.photography.completed} color="emerald" />
                            <StatusPill label="ทั้งหมด" value={stats.photography.total} color="gray" />
                        </div>
                    </div>
                )}

                {/* Inventory Summary */}
                {showInventory && (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Package size={16} className="text-text-secondary" />
                                <h2 className="text-sm font-semibold text-text">คลังอุปกรณ์</h2>
                            </div>
                            <Link href="/admin/inventory" className="text-xs text-text-secondary hover:text-text flex items-center gap-1 transition-colors">
                                ดูทั้งหมด <ArrowRight size={12} />
                            </Link>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <StatusPill label="ทั้งหมด" value={stats.inventory.total} color="gray" />
                            <StatusPill label="พร้อมใช้" value={stats.inventory.available} color="emerald" />
                            <div className="flex flex-col items-center p-3 rounded-lg bg-rose-500/5">
                                <span className="text-lg font-semibold tabular-nums text-rose-600 dark:text-rose-400">{stats.inventory.lowStock}</span>
                                <span className="text-[11px] text-rose-500 dark:text-rose-400 flex items-center gap-0.5 mt-0.5">
                                    <AlertTriangle size={10} /> ใกล้หมด
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ──── Per-Person Table ──── */}
            {personStats.length > 0 && (
                <div className="bg-card border border-border rounded-xl">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                        <h2 className="text-sm font-semibold text-text">สถิติรายช่าง</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="text-text-secondary text-left border-b border-border">
                                    <th className="py-2.5 px-5 font-medium">ชื่อ</th>
                                    <th className="py-2.5 px-4 font-medium text-right">รอ</th>
                                    <th className="py-2.5 px-4 font-medium text-right">กำลังทำ</th>
                                    <th className="py-2.5 px-4 font-medium text-right">เสร็จ</th>
                                    <th className="py-2.5 px-5 font-medium text-right">รวม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {personStats.map(p => (
                                    <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-background/50 transition-colors">
                                        <td className="py-2.5 px-5 font-medium text-text">{p.name}</td>
                                        <td className="py-2.5 px-4 text-right tabular-nums text-amber-600 dark:text-amber-400">{p.pending}</td>
                                        <td className="py-2.5 px-4 text-right tabular-nums text-blue-600 dark:text-blue-400">{p.in_progress}</td>
                                        <td className="py-2.5 px-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{p.completed}</td>
                                        <td className="py-2.5 px-5 text-right tabular-nums font-semibold text-text">{p.total}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ──── Activity Feed ──── */}
            <div className="bg-card border border-border rounded-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-text">กิจกรรมล่าสุด</h2>
                </div>
                {activities.length === 0 ? (
                    <div className="py-12 text-center text-text-secondary text-sm">
                        ยังไม่มีกิจกรรม
                    </div>
                ) : (
                    <div className="px-5">
                        {activities.map((a, i) => (
                            <ActivityRow
                                key={a.id || i}
                                userName={a.userName}
                                action={a.action}
                                detail={a.productName || a.details}
                                time={timeAgo(a.timestamp)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Status Pill ────────────────────────────────────────────────────
function StatusPill({ label, value, color }: { label: string; value: number; color: string }) {
    const colorMap: Record<string, string> = {
        amber: 'bg-amber-500/5 text-amber-600 dark:text-amber-400',
        blue: 'bg-blue-500/5 text-blue-600 dark:text-blue-400',
        emerald: 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
        orange: 'bg-orange-500/5 text-orange-600 dark:text-orange-400',
        gray: 'bg-gray-500/5 text-text-secondary',
    };
    return (
        <div className={`flex flex-col items-center p-3 rounded-lg ${colorMap[color] || colorMap.gray}`}>
            <span className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</span>
            <span className="text-[11px] mt-0.5">{label}</span>
        </div>
    );
}
