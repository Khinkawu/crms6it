"use client";

import React, { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Wrench, Calendar, Package, Users, Camera, Clock,
    FileSpreadsheet, Printer, ArrowUpRight, Loader2,
    CheckCircle2, Timer, PauseCircle, Activity, TrendingUp
} from "lucide-react";
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Legend
} from "recharts";
import { useDashboardStats, canSee } from "@/hooks/useDashboardStats";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { exportDashboardToExcel, printDashboardStats } from "@/utils/dashboardExport";
import toast from "react-hot-toast";

// ─── Colors ─────────────────────────────────────────────────────────
const COLORS = {
    pending: "#F59E0B",
    in_progress: "#3B82F6",
    waiting_parts: "#F97316",
    completed: "#10B981",
    cancelled: "#EF4444",
    approved: "#10B981",
    rejected: "#EF4444",
    assigned: "#8B5CF6",
    pending_assign: "#F59E0B",
};

// ─── Donut Chart Component ──────────────────────────────────────────
function DonutChart({ data, centerLabel, centerValue }: {
    data: { name: string; value: number; color: string }[];
    centerLabel: string;
    centerValue: number;
}) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                ยังไม่มีข้อมูล
            </div>
        );
    }

    return (
        <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                    >
                        {data.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            background: 'rgba(255,255,255,0.95)',
                            border: '1px solid #E5E7EB',
                            borderRadius: '12px',
                            fontSize: '13px',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value: number) => [`${value} รายการ`, '']}
                    />
                </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{centerValue}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{centerLabel}</span>
            </div>
        </div>
    );
}

// ─── Activity Bar Chart ─────────────────────────────────────────────
function ActivityBarChart({ activities }: { activities: any[] }) {
    const chartData = useMemo(() => {
        const last7 = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return {
                date: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
                dateKey: d.toISOString().slice(0, 10),
                ซ่อม: 0,
                อุปกรณ์: 0,
                อื่นๆ: 0,
            };
        });

        activities.forEach(a => {
            if (!a.timestamp) return;
            const ts = a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            const key = ts.toISOString().slice(0, 10);
            const day = last7.find(d => d.dateKey === key);
            if (day) {
                if (a.action?.includes('repair')) day['ซ่อม']++;
                else if (['borrow', 'return', 'requisition', 'add'].includes(a.action)) day['อุปกรณ์']++;
                else day['อื่นๆ']++;
            }
        });

        return last7;
    }, [activities]);

    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barCategoryGap="20%">
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                <Tooltip
                    contentStyle={{
                        background: 'rgba(255,255,255,0.95)',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        fontSize: '13px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                    }}
                />
                <Bar dataKey="ซ่อม" stackId="a" fill="#EF4444" radius={[0, 0, 0, 0]} />
                <Bar dataKey="อุปกรณ์" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="อื่นๆ" stackId="a" fill="#D1D5DB" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

// ─── Progress Ring ──────────────────────────────────────────────────
function ProgressRing({ percent, label, color, size = 72 }: {
    percent: number; label: string; color: string; size?: number;
}) {
    const r = (size - 8) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (percent / 100) * c;

    return (
        <div className="flex flex-col items-center gap-1.5">
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-gray-100 dark:text-slate-700" />
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={color} strokeWidth={6} strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
                <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{percent}%</span>
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 text-center">{label}</span>
        </div>
    );
}

// ─── Stat Mini Card ─────────────────────────────────────────────────
function MiniStat({ label, value, icon: Icon, iconBg, iconColor, href }: {
    label: string; value: number; icon: React.ElementType;
    iconBg: string; iconColor: string; href?: string;
}) {
    const inner = (
        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow">
            <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                <Icon size={20} className={iconColor} />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
            </div>
        </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Legend Dot ─────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {label}
        </div>
    );
}

// ─── Main ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const { user, role, isPhotographer, loading, getDisplayName } = useAuth();
    const router = useRouter();
    const { stats, personStats, loading: statsLoading } = useDashboardStats();
    const { activities } = useActivityLogs({ limitCount: 50, filterRepairOnly: false });

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

    const showRepairs = canSee(role, isPhotographer, 'repairs');
    const showBookings = canSee(role, isPhotographer, 'bookings');
    const showPhotography = canSee(role, isPhotographer, 'photography');
    const showInventory = canSee(role, isPhotographer, 'inventory');
    const showUsers = canSee(role, isPhotographer, 'users');

    const displayName = getDisplayName();
    const today = new Date().toLocaleDateString('th-TH', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const handleExport = () => {
        exportDashboardToExcel(stats, personStats, displayName);
        toast.success("ส่งออก Excel สำเร็จ");
    };

    // Repair donut data
    const repairDonut = [
        { name: 'รอดำเนินการ', value: stats.repairs.pending, color: COLORS.pending },
        { name: 'กำลังดำเนินการ', value: stats.repairs.in_progress, color: COLORS.in_progress },
        { name: 'รออะไหล่', value: stats.repairs.waiting_parts, color: COLORS.waiting_parts },
        { name: 'เสร็จสิ้น', value: stats.repairs.completed, color: COLORS.completed },
    ];

    // Booking donut data
    const bookingDonut = [
        { name: 'รออนุมัติ', value: stats.bookings.pending, color: COLORS.pending },
        { name: 'อนุมัติ', value: stats.bookings.approved, color: COLORS.approved },
        { name: 'ไม่อนุมัติ', value: stats.bookings.rejected, color: COLORS.rejected },
    ];

    // Completion rate
    const repairTotal = stats.repairs.pending + stats.repairs.in_progress + stats.repairs.waiting_parts + stats.repairs.completed;
    const repairCompletionRate = repairTotal > 0 ? Math.round((stats.repairs.completed / repairTotal) * 100) : 0;

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
        repair: 'แจ้งซ่อม', repair_update: 'อัปเดตซ่อม',
        borrow: 'ยืมอุปกรณ์', return: 'คืนอุปกรณ์',
        requisition: 'เบิกอุปกรณ์', add: 'เพิ่มอุปกรณ์',
    };

    const actionColors: Record<string, string> = {
        repair: 'bg-rose-500', repair_update: 'bg-orange-500',
        borrow: 'bg-blue-500', return: 'bg-emerald-500',
        requisition: 'bg-purple-500', add: 'bg-cyan-500',
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-24 animate-fade-in">

            {/* ────── Header ────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        ภาพรวมระบบ
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <Clock size={13} /> {today}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:border-indigo-300 transition-colors shadow-sm"
                    >
                        <FileSpreadsheet size={16} /> Export
                    </button>
                    <button
                        onClick={() => printDashboardStats(stats, personStats, displayName)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-sm text-white transition-colors shadow-sm"
                    >
                        <Printer size={16} /> Print
                    </button>
                </div>
            </div>

            {/* ────── Top Stats Row ────── */}
            {statsLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white dark:bg-slate-800 rounded-2xl animate-pulse" />)}
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {showRepairs && <MiniStat label="งานซ่อมรอ" value={stats.repairs.pending} icon={Wrench} iconBg="bg-rose-50 dark:bg-rose-900/20" iconColor="text-rose-500" href="/admin/repairs" />}
                    {showRepairs && <MiniStat label="กำลังดำเนินการ" value={stats.repairs.in_progress} icon={Timer} iconBg="bg-blue-50 dark:bg-blue-900/20" iconColor="text-blue-500" href="/admin/repairs" />}
                    {showBookings && <MiniStat label="การจองรออนุมัติ" value={stats.bookings.pending} icon={Calendar} iconBg="bg-amber-50 dark:bg-amber-900/20" iconColor="text-amber-500" href="/admin/bookings" />}
                    {showInventory && <MiniStat label="อุปกรณ์ใกล้หมด" value={stats.inventory.lowStock} icon={Package} iconBg="bg-orange-50 dark:bg-orange-900/20" iconColor="text-orange-500" href="/admin/inventory" />}
                    {showUsers && <MiniStat label="ผู้ใช้งาน" value={stats.users.total} icon={Users} iconBg="bg-indigo-50 dark:bg-indigo-900/20" iconColor="text-indigo-500" href="/admin/users" />}
                </div>
            )}

            {/* ────── Charts Row ────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* Repair Donut Chart */}
                {showRepairs && (
                    <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Wrench size={16} className="text-rose-500" /> สัดส่วนงานซ่อม
                            </h2>
                            <Link href="/admin/repairs" className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">ดูทั้งหมด →</Link>
                        </div>
                        <DonutChart data={repairDonut} centerLabel="ทั้งหมด" centerValue={repairTotal} />
                        <div className="flex flex-wrap gap-3 justify-center mt-2">
                            <LegendDot color={COLORS.pending} label="รอ" />
                            <LegendDot color={COLORS.in_progress} label="กำลังทำ" />
                            <LegendDot color={COLORS.waiting_parts} label="รออะไหล่" />
                            <LegendDot color={COLORS.completed} label="เสร็จ" />
                        </div>
                    </div>
                )}

                {/* Activity Bar Chart */}
                <div className={`${showRepairs ? 'lg:col-span-5' : 'lg:col-span-8'} bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Activity size={16} className="text-indigo-500" /> กิจกรรมย้อนหลัง 7 วัน
                        </h2>
                        <div className="flex gap-3">
                            <LegendDot color="#EF4444" label="ซ่อม" />
                            <LegendDot color="#3B82F6" label="อุปกรณ์" />
                            <LegendDot color="#D1D5DB" label="อื่นๆ" />
                        </div>
                    </div>
                    <ActivityBarChart activities={activities} />
                </div>

                {/* Completion Progress */}
                {showRepairs && (
                    <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                            <TrendingUp size={16} className="text-emerald-500" /> อัตราการทำงาน
                        </h2>
                        <div className="flex flex-col items-center gap-5 py-2">
                            <div className="relative">
                                <ProgressRing percent={repairCompletionRate} label="ซ่อมสำเร็จ" color="#10B981" size={100} />
                            </div>
                            {showBookings && (
                                <div className="w-full space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-gray-500 dark:text-gray-400">การจอง</span>
                                            <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                                                {stats.bookings.approved}/{stats.bookings.total}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full">
                                            <div
                                                className="h-2 bg-amber-500 rounded-full transition-all"
                                                style={{ width: `${stats.bookings.total > 0 ? (stats.bookings.approved / stats.bookings.total * 100) : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                    {showPhotography && (
                                        <div>
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-gray-500 dark:text-gray-400">ถ่ายภาพ</span>
                                                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                                                    {stats.photography.completed}/{stats.photography.total}
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full">
                                                <div
                                                    className="h-2 bg-purple-500 rounded-full transition-all"
                                                    style={{ width: `${stats.photography.total > 0 ? (stats.photography.completed / stats.photography.total * 100) : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ────── Bottom: Technicians + Activity Feed ────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* Technician Leaderboard */}
                {personStats.length > 0 && (
                    <div className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Users size={16} className="text-indigo-500" /> สถิติรายช่าง
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-700">
                                        <th className="text-left py-3 px-5 font-medium">ชื่อ</th>
                                        <th className="text-center py-3 px-3 font-medium">รอ</th>
                                        <th className="text-center py-3 px-3 font-medium">กำลังทำ</th>
                                        <th className="text-center py-3 px-3 font-medium">เสร็จ</th>
                                        <th className="text-center py-3 px-3 font-medium">รวม</th>
                                        <th className="text-center py-3 px-5 font-medium">%สำเร็จ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {personStats.map((p, i) => {
                                        const rate = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
                                        const avatarColors = ['bg-indigo-100 text-indigo-600', 'bg-emerald-100 text-emerald-600', 'bg-amber-100 text-amber-600', 'bg-rose-100 text-rose-600', 'bg-cyan-100 text-cyan-600'];
                                        return (
                                            <tr key={p.id} className="border-b border-gray-50 dark:border-slate-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="py-3 px-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-xs font-bold shrink-0`}>
                                                            {p.name.slice(0, 2)}
                                                        </div>
                                                        <span className="font-medium text-gray-900 dark:text-white truncate">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-center tabular-nums text-amber-500 font-medium">{p.pending}</td>
                                                <td className="py-3 px-3 text-center tabular-nums text-blue-500 font-medium">{p.in_progress}</td>
                                                <td className="py-3 px-3 text-center tabular-nums text-emerald-500 font-medium">{p.completed}</td>
                                                <td className="py-3 px-3 text-center tabular-nums font-bold text-gray-900 dark:text-white">{p.total}</td>
                                                <td className="py-3 px-5 text-center">
                                                    <div className="flex items-center gap-2 justify-center">
                                                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full">
                                                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: rate >= 80 ? '#10B981' : rate >= 50 ? '#F59E0B' : '#EF4444' }} />
                                                        </div>
                                                        <span className="text-xs font-medium tabular-nums text-gray-600 dark:text-gray-400">{rate}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Activity Feed */}
                <div className={`${personStats.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'} bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden`}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Clock size={16} className="text-indigo-500" /> กิจกรรมล่าสุด
                        </h2>
                    </div>
                    {activities.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-sm">ยังไม่มีกิจกรรม</div>
                    ) : (
                        <div className="divide-y divide-gray-50 dark:divide-slate-700/50 max-h-[380px] overflow-y-auto custom-scrollbar">
                            {activities.slice(0, 15).map((a, i) => (
                                <div key={a.id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${actionColors[a.action] || 'bg-gray-400'}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 dark:text-white">
                                            <span className="font-medium">{a.userName}</span>
                                            {' '}
                                            <span className="text-gray-500 dark:text-gray-400">{actionLabels[a.action] || a.action}</span>
                                        </p>
                                        {(a.productName || a.details) && (
                                            <p className="text-xs text-gray-400 truncate mt-0.5">{a.productName || a.details}</p>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-gray-400 tabular-nums shrink-0">{timeAgo(a.timestamp)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
