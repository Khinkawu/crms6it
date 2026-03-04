"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Wrench, Calendar, Package, Users, Camera, Clock,
    FileSpreadsheet, Printer, ArrowUpRight, Loader2,
    AlertTriangle, TrendingUp, TrendingDown, MoreVertical,
    Building2, Activity, CheckCircle2, Timer, PauseCircle
} from "lucide-react";
import { useDashboardStats, canSee } from "@/hooks/useDashboardStats";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { exportDashboardToExcel, printDashboardStats } from "@/utils/dashboardExport";
import toast from "react-hot-toast";

// ─── Stat Card ──────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconBg, iconColor, href, change, changeLabel }: {
    label: string; value: number; icon: React.ElementType;
    iconBg: string; iconColor: string; href?: string;
    change?: number; changeLabel?: string;
}) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-slate-700">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
                    <Icon size={22} className={iconColor} />
                </div>
                {href && (
                    <Link href={href} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <MoreVertical size={18} />
                    </Link>
                )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value.toLocaleString()}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                {change !== undefined ? (
                    <span className={`flex items-center gap-1 text-xs font-medium ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {change >= 0 ? '+' : ''}{change}%
                    </span>
                ) : (
                    <span />
                )}
                {href && (
                    <Link href={href} className="text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                        ดูรายละเอียด <ArrowUpRight size={11} />
                    </Link>
                )}
            </div>
        </div>
    );
}

// ─── Status Chip ────────────────────────────────────────────────────
function StatusChip({ icon: Icon, label, value, bg, textColor }: {
    icon: React.ElementType; label: string; value: number; bg: string; textColor: string;
}) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${bg}`}>
            <div className={`w-9 h-9 rounded-lg bg-white/60 dark:bg-white/10 flex items-center justify-center ${textColor}`}>
                <Icon size={18} />
            </div>
            <div>
                <p className={`text-lg font-bold tabular-nums ${textColor}`}>{value.toLocaleString()}</p>
                <p className={`text-xs ${textColor} opacity-70`}>{label}</p>
            </div>
        </div>
    );
}

// ─── Technician Row ─────────────────────────────────────────────────
function TechnicianRow({ name, pending, inProgress, completed, total, rank }: {
    name: string; pending: number; inProgress: number; completed: number; total: number; rank: number;
}) {
    const initials = name.slice(0, 2);
    const avatarColors = [
        'bg-indigo-100 text-indigo-600', 'bg-emerald-100 text-emerald-600',
        'bg-amber-100 text-amber-600', 'bg-rose-100 text-rose-600',
        'bg-cyan-100 text-cyan-600', 'bg-purple-100 text-purple-600',
    ];
    const color = avatarColors[rank % avatarColors.length];
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="flex items-center gap-4 py-3.5 px-5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-sm font-bold shrink-0`}>
                {initials}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
                <p className="text-xs text-gray-400">{total} งาน</p>
            </div>
            <div className="flex items-center gap-6 tabular-nums text-sm">
                <div className="text-center hidden sm:block">
                    <p className="font-semibold text-amber-500">{pending}</p>
                    <p className="text-[10px] text-gray-400">รอ</p>
                </div>
                <div className="text-center hidden sm:block">
                    <p className="font-semibold text-blue-500">{inProgress}</p>
                    <p className="text-[10px] text-gray-400">ทำ</p>
                </div>
                <div className="text-center hidden sm:block">
                    <p className="font-semibold text-emerald-500">{completed}</p>
                    <p className="text-[10px] text-gray-400">เสร็จ</p>
                </div>
                <div className="w-16 text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${completionRate >= 80 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            completionRate >= 50 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                        {completionRate}%
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Page ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const { user, role, isPhotographer, loading, getDisplayName } = useAuth();
    const router = useRouter();
    const { stats, personStats, loading: statsLoading } = useDashboardStats();
    const { activities } = useActivityLogs({ limitCount: 8, filterRepairOnly: false });

    const hasAccess = role === 'admin' || role === 'moderator' || role === 'technician' || role === 'facility_technician' || isPhotographer;

    React.useEffect(() => {
        if (!loading && (!user || !hasAccess)) router.push("/");
    }, [user, role, loading, hasAccess, router]);

    if (loading || !user || !hasAccess) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 size={24} className="animate-spin text-indigo-500" />
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
        if (m < 60) return `${m} นาที`;
        if (m < 1440) return `${Math.floor(m / 60)} ชม.`;
        return `${Math.floor(m / 1440)} วัน`;
    };

    const actionLabels: Record<string, string> = {
        repair: 'แจ้งซ่อม', repair_update: 'อัปเดตงานซ่อม',
        borrow: 'ยืมอุปกรณ์', return: 'คืนอุปกรณ์',
        requisition: 'เบิกอุปกรณ์', add: 'เพิ่มอุปกรณ์',
    };

    const actionColors: Record<string, string> = {
        repair: 'bg-rose-500', repair_update: 'bg-orange-500',
        borrow: 'bg-blue-500', return: 'bg-emerald-500',
        requisition: 'bg-purple-500', add: 'bg-cyan-500',
    };

    const showRepairs = canSee(role, isPhotographer, 'repairs');
    const showBookings = canSee(role, isPhotographer, 'bookings');
    const showPhotography = canSee(role, isPhotographer, 'photography');
    const showInventory = canSee(role, isPhotographer, 'inventory');
    const showUsers = canSee(role, isPhotographer, 'users');

    const displayName = getDisplayName();
    const today = new Date().toLocaleDateString('th-TH', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const roleBadges: Record<string, { label: string; color: string }> = {
        admin: { label: 'Admin', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
        moderator: { label: 'Moderator', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
        technician: { label: 'ช่าง IT', color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400' },
        facility_technician: { label: 'ช่างอาคาร', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    };
    const badge = roleBadges[role || ''] || { label: role, color: 'bg-gray-100 text-gray-600' };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-fade-in">

            {/* ─── Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            สวัสดี, {displayName.split(' ')[0]} 👋
                        </h1>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badge.color}`}>
                            {badge.label}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{today}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors shadow-sm"
                    >
                        <FileSpreadsheet size={16} />
                        Export
                    </button>
                    <button
                        onClick={() => printDashboardStats(stats, personStats, displayName)}
                        className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-sm text-white transition-colors shadow-sm shadow-indigo-500/20"
                    >
                        <Printer size={16} />
                        Print
                    </button>
                </div>
            </div>

            {/* ─── Stat Cards ─── */}
            {statsLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-40 bg-white dark:bg-slate-800 rounded-2xl animate-pulse border border-gray-100 dark:border-slate-700" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {showRepairs && (
                        <StatCard
                            label="งานซ่อมรอดำเนินการ"
                            value={stats.repairs.pending}
                            icon={Wrench}
                            iconBg="bg-rose-50 dark:bg-rose-900/20"
                            iconColor="text-rose-500"
                            href="/admin/repairs"
                        />
                    )}
                    {showBookings && (
                        <StatCard
                            label="การจองรออนุมัติ"
                            value={stats.bookings.pending}
                            icon={Calendar}
                            iconBg="bg-amber-50 dark:bg-amber-900/20"
                            iconColor="text-amber-500"
                            href="/admin/bookings"
                        />
                    )}
                    {showInventory && (
                        <StatCard
                            label="อุปกรณ์ใกล้หมด"
                            value={stats.inventory.lowStock}
                            icon={Package}
                            iconBg="bg-blue-50 dark:bg-blue-900/20"
                            iconColor="text-blue-500"
                            href="/admin/inventory"
                        />
                    )}
                    {showUsers && (
                        <StatCard
                            label="ผู้ใช้งานทั้งหมด"
                            value={stats.users.total}
                            icon={Users}
                            iconBg="bg-indigo-50 dark:bg-indigo-900/20"
                            iconColor="text-indigo-500"
                            href="/admin/users"
                        />
                    )}
                    {showPhotography && (
                        <StatCard
                            label="งานถ่ายภาพที่มอบหมาย"
                            value={stats.photography.assigned}
                            icon={Camera}
                            iconBg="bg-purple-50 dark:bg-purple-900/20"
                            iconColor="text-purple-500"
                            href="/admin/photography"
                        />
                    )}
                </div>
            )}

            {/* ─── Repair Breakdown + Booking Breakdown ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {showRepairs && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Wrench size={16} className="text-rose-500" />
                                สถานะงานซ่อม
                            </h2>
                            <Link href="/admin/repairs" className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">ดูทั้งหมด →</Link>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <StatusChip icon={Timer} label="รอดำเนินการ" value={stats.repairs.pending} bg="bg-amber-50 dark:bg-amber-900/10" textColor="text-amber-600 dark:text-amber-400" />
                            <StatusChip icon={Loader2} label="กำลังดำเนินการ" value={stats.repairs.in_progress} bg="bg-blue-50 dark:bg-blue-900/10" textColor="text-blue-600 dark:text-blue-400" />
                            <StatusChip icon={PauseCircle} label="รออะไหล่" value={stats.repairs.waiting_parts} bg="bg-orange-50 dark:bg-orange-900/10" textColor="text-orange-600 dark:text-orange-400" />
                            <StatusChip icon={CheckCircle2} label="เสร็จสิ้น" value={stats.repairs.completed} bg="bg-emerald-50 dark:bg-emerald-900/10" textColor="text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                )}

                {showBookings && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Calendar size={16} className="text-amber-500" />
                                สถานะการจอง
                            </h2>
                            <Link href="/admin/bookings" className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">ดูทั้งหมด →</Link>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <StatusChip icon={Timer} label="รออนุมัติ" value={stats.bookings.pending} bg="bg-amber-50 dark:bg-amber-900/10" textColor="text-amber-600 dark:text-amber-400" />
                            <StatusChip icon={CheckCircle2} label="อนุมัติ" value={stats.bookings.approved} bg="bg-emerald-50 dark:bg-emerald-900/10" textColor="text-emerald-600 dark:text-emerald-400" />
                            <StatusChip icon={Activity} label="ทั้งหมด" value={stats.bookings.total} bg="bg-gray-50 dark:bg-slate-700/50" textColor="text-gray-600 dark:text-gray-300" />
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Per-Person Table + Activity Feed ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* Technician Leaderboard */}
                <div className={`${personStats.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden`}>
                    {personStats.length > 0 ? (
                        <>
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Users size={16} className="text-indigo-500" />
                                    ช่างเทคนิค
                                </h2>
                                <span className="text-xs text-gray-400">{personStats.length} คน</span>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                {personStats.map((p, i) => (
                                    <TechnicianRow
                                        key={p.id}
                                        name={p.name}
                                        pending={p.pending}
                                        inProgress={p.in_progress}
                                        completed={p.completed}
                                        total={p.total}
                                        rank={i}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        /* Activity takes full width when no person stats */
                        <>
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Activity size={16} className="text-indigo-500" />
                                    กิจกรรมล่าสุด
                                </h2>
                            </div>
                            {activities.length === 0 ? (
                                <div className="py-12 text-center text-gray-400 text-sm">ยังไม่มีกิจกรรม</div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {activities.map((a, i) => (
                                        <div key={a.id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${actionColors[a.action] || 'bg-gray-400'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-900 dark:text-white">
                                                    <span className="font-medium">{a.userName}</span>
                                                    {' '}
                                                    <span className="text-gray-500 dark:text-gray-400">{actionLabels[a.action] || a.action}</span>
                                                </p>
                                                {(a.productName || a.details) && (
                                                    <p className="text-xs text-gray-400 truncate">{a.productName || a.details}</p>
                                                )}
                                            </div>
                                            <span className="text-xs text-gray-400 tabular-nums shrink-0">{timeAgo(a.timestamp)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Activity Feed (shown alongside technician table) */}
                {personStats.length > 0 && (
                    <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Activity size={16} className="text-indigo-500" />
                                กิจกรรมล่าสุด
                            </h2>
                        </div>
                        {activities.length === 0 ? (
                            <div className="py-12 text-center text-gray-400 text-sm">ยังไม่มีกิจกรรม</div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                {activities.map((a, i) => (
                                    <div key={a.id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${actionColors[a.action] || 'bg-gray-400'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-900 dark:text-white">
                                                <span className="font-medium">{a.userName}</span>
                                                {' '}
                                                <span className="text-gray-500 dark:text-gray-400">{actionLabels[a.action] || a.action}</span>
                                            </p>
                                            {(a.productName || a.details) && (
                                                <p className="text-xs text-gray-400 truncate">{a.productName || a.details}</p>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-400 tabular-nums shrink-0">{timeAgo(a.timestamp)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
