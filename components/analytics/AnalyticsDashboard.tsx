"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
    MessageSquare, AlertTriangle, Clock, Users,
    Wrench, CalendarCheck, RefreshCw, HelpCircle,
    Download, TrendingUp, TrendingDown, Minus,
    Bot, Zap, Search, Building2, BarChart3, ChevronRight
} from "lucide-react";
import ErrorLogSection from "./ErrorLogSection";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsData {
    overview: {
        lineMessages: number;
        lineErrorRate: number;
        avgResponseMs: number;
        missedIntents: number;
        lineUniqueUsers: number;
        webEvents: number;
    };
    lineDailyChart: { date: string; ok: number; error: number }[];
    lineTypeChart: { type: string; count: number }[];
    recentMissedIntents: { id: string; userMessage: string; timestamp: string; userId: string; aiReply?: string }[];
    missedDailyChart: { date: string; missed: number }[];
    usageDailyChart: { date: string; events: number }[];
    usageByEventChart: { event: string; count: number }[];
    systemStats: {
        totalRepairs: number;
        pendingRepairs: number;
        totalFacilityTickets: number;
        pendingFacilityTickets: number;
        totalBookings: number;
        pendingBookings: number;
    };
    meta: { days: number; generatedAt: string };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_COLORS = {
    blue: '#2563EB',
    blueLight: '#93C5FD',
    green: '#059669',
    greenLight: '#6EE7B7',
    amber: '#D97706',
    amberLight: '#FCD34D',
    red: '#DC2626',
    redLight: '#FCA5A5',
    purple: '#7C3AED',
    purpleLight: '#C4B5FD',
    indigo: '#4F46E5',
    rose: '#E11D48',
    teal: '#0D9488',
    slate: '#475569',
};

const PIE_COLORS = [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.amber, CHART_COLORS.purple, CHART_COLORS.rose, CHART_COLORS.teal];

const LINE_TYPE_LABELS: Record<string, string> = {
    text: 'ข้อความ',
    image: 'รูปภาพ',
    track_status: 'ติดตามสถานะ',
    push_notify: 'แจ้งเตือน',
    unknown: 'อื่น ๆ',
};

const EVENT_LABELS: Record<string, string> = {
    repair_submit: 'แจ้งซ่อม',
    repair_status_update: 'อัปเดตสถานะ',
    booking_create: 'จองห้อง',
    booking_approve: 'อนุมัติจอง',
    booking_reject: 'ปฏิเสธจอง',
    photo_upload: 'อัปโหลดภาพ',
    photo_assign: 'มอบหมายงาน',
    gallery_view: 'ดูแกลเลอรี',
    video_upload: 'อัปโหลดวิดีโอ',
    knowledge_create: 'คลังความรู้',
    user_login: 'เข้าสู่ระบบ',
    line_link: 'ผูก LINE',
    otp_send: 'ส่ง OTP',
    otp_verify: 'ยืนยัน OTP',
    fcm_send: 'ส่ง Push',
    api_error: 'API Error',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatTs(iso: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function calcTrend(chart: Record<string, unknown>[], key: string): { current: number; previous: number; pctChange: number } {
    const half = Math.ceil(chart.length / 2);
    const sum = (arr: Record<string, unknown>[], k: string) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const current = sum(chart.slice(half), key);
    const previous = sum(chart.slice(0, half), key);
    const pctChange = previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);
    return { current, previous, pctChange };
}

function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function exportCSV(data: AnalyticsData) {
    const rows: string[] = [];
    rows.push('=== LINE Bot Daily ===');
    rows.push('Date,OK,Error');
    data.lineDailyChart.forEach(r => rows.push(`${r.date},${r.ok},${r.error}`));
    rows.push('');
    rows.push('=== Missed Intents ===');
    rows.push('Timestamp,UserMessage,BotReply');
    data.recentMissedIntents.forEach(m =>
        rows.push(`${m.timestamp},"${m.userMessage.replace(/"/g, '""')}","${(m.aiReply || '').replace(/"/g, '""')}"`)
    );
    rows.push('');
    rows.push('=== Web Events Daily ===');
    rows.push('Date,Events');
    data.usageDailyChart.forEach(r => rows.push(`${r.date},${r.events}`));
    rows.push('');
    rows.push('=== Feature Usage ===');
    rows.push('Event,Count');
    data.usageByEventChart.forEach(r => rows.push(`${r.event},${r.count}`));
    rows.push('');
    rows.push('=== LINE Message Types ===');
    rows.push('Type,Count');
    data.lineTypeChart.forEach(r => rows.push(`${r.type},${r.count}`));
    rows.push('');
    rows.push('=== System Stats ===');
    rows.push(`Total Repairs IT,${data.systemStats.totalRepairs}`);
    rows.push(`Pending Repairs IT,${data.systemStats.pendingRepairs}`);
    rows.push(`Total Facility Tickets,${data.systemStats.totalFacilityTickets}`);
    rows.push(`Pending Facility,${data.systemStats.pendingFacilityTickets}`);
    rows.push(`Total Bookings,${data.systemStats.totalBookings}`);
    rows.push(`Pending Bookings,${data.systemStats.pendingBookings}`);
    downloadFile(rows.join('\n'), `crms6it-analytics-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

function exportJSON(data: AnalyticsData) {
    downloadFile(JSON.stringify(data, null, 2), `crms6it-analytics-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TrendBadge({ pctChange, inverted = false }: { pctChange: number; inverted?: boolean }) {
    const isPositive = inverted ? pctChange < 0 : pctChange > 0;
    const isNeutral = pctChange === 0;
    const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
    const cls = isNeutral
        ? 'text-slate-400 bg-slate-50'
        : isPositive
            ? 'text-emerald-700 bg-emerald-50'
            : 'text-red-600 bg-red-50';
    return (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums ${cls}`}>
            <Icon className="w-3 h-3" />
            {pctChange > 0 ? '+' : ''}{pctChange}%
        </span>
    );
}

function KpiCard({
    icon: Icon,
    label,
    value,
    trend,
    trendInverted,
    accent,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    trend?: { pctChange: number };
    trendInverted?: boolean;
    accent: string;
}) {
    return (
        <div className="group relative bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-200 transition-all duration-200">
            <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl" style={{ background: accent }} />
            <div className="flex items-start justify-between gap-2 pt-1">
                <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider truncate">{label}</p>
                    <div className="flex items-baseline gap-2 mt-1.5">
                        <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums leading-none">{value}</p>
                        {trend && <TrendBadge pctChange={trend.pctChange} inverted={trendInverted} />}
                    </div>
                </div>
                <div className="shrink-0 p-2 rounded-xl bg-slate-50 group-hover:bg-slate-100 transition-colors">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                </div>
            </div>
        </div>
    );
}

function SystemStatCard({
    icon: Icon,
    label,
    total,
    pending,
    color,
}: {
    icon: React.ElementType;
    label: string;
    total: number;
    pending: number;
    color: string;
}) {
    const pct = total > 0 ? Math.round((pending / total) * 100) : 0;
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2.5 mb-3">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}14` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-xs font-medium text-slate-500">{label}</p>
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{total.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">ทั้งหมด</p>
                </div>
                {pending > 0 && (
                    <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                              style={{ backgroundColor: `${color}14`, color }}>
                            {pending} รอดำเนินการ
                        </span>
                    </div>
                )}
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(100 - pct, 0)}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

function SectionHeader({ icon: Icon, title, subtitle, action }: {
    icon: React.ElementType;
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-100">
                    <Icon className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
                    {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

function ChartCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}>
            {children}
        </div>
    );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, labelMap }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string; labelMap?: Record<string, string> }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
            <p className="font-semibold text-slate-700 mb-1">{label}</p>
            {payload.map((entry: { name?: string; value?: number; color?: string }, i: number) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-500">{labelMap?.[entry.name ?? ''] ?? entry.name}</span>
                    <span className="font-semibold text-slate-800 ml-auto tabular-nums">{entry.value?.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonDashboard() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="flex gap-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-9 w-16 bg-slate-100 rounded-lg" />)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 h-28">
                        <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
                        <div className="h-8 w-16 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 h-72" />
                <div className="bg-white rounded-2xl border border-slate-100 h-72" />
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(30);
    const [missedSearch, setMissedSearch] = useState('');

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/analytics?days=${days}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (e) {
            setError('โหลดข้อมูลไม่ได้ กรุณาลองใหม่');
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [user, days]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredMissed = useMemo(() => {
        if (!data) return [];
        if (!missedSearch) return data.recentMissedIntents;
        const q = missedSearch.toLowerCase();
        return data.recentMissedIntents.filter(m => m.userMessage.toLowerCase().includes(q));
    }, [data, missedSearch]);

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) return <SkeletonDashboard />;

    // ── Error ─────────────────────────────────────────────────────────────────
    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="p-4 rounded-2xl bg-red-50">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-slate-500 text-sm">{error || 'ไม่มีข้อมูล'}</p>
                <button
                    onClick={fetchData}
                    className="px-5 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                    ลองใหม่
                </button>
            </div>
        );
    }

    const { overview, lineDailyChart, lineTypeChart, usageDailyChart, usageByEventChart, systemStats } = data;

    const msgTrend = days >= 14 ? calcTrend(lineDailyChart, 'ok') : undefined;
    const missedTrend = days >= 14 ? calcTrend(data.missedDailyChart, 'missed') : undefined;

    // Donut total for center label
    const pieTotal = lineTypeChart.reduce((s, r) => s + r.count, 0);

    return (
        <div className="space-y-8">

            {/* ── Controls ─────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5">
                    {[7, 14, 30, 60].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                                days === d
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {d}D
                        </button>
                    ))}
                </div>
                <div className="flex gap-1.5">
                    <button
                        onClick={() => exportCSV(data)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                        aria-label="Export CSV"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">CSV</span>
                    </button>
                    <button
                        onClick={() => exportJSON(data)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                        aria-label="Export JSON"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">JSON</span>
                    </button>
                    <button
                        onClick={fetchData}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                        aria-label="Refresh data"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">รีเฟรช</span>
                    </button>
                </div>
            </div>

            {/* ── LINE Bot KPIs ─────────────────────────────────────────────────── */}
            <section>
                <SectionHeader icon={Bot} title="LINE Bot" subtitle={`สถิติ ${days} วันย้อนหลัง`} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <KpiCard icon={MessageSquare} label="ข้อความทั้งหมด" value={overview.lineMessages.toLocaleString()} trend={msgTrend} accent={CHART_COLORS.blue} />
                    <KpiCard icon={Users} label="ผู้ใช้ไม่ซ้ำ" value={overview.lineUniqueUsers.toLocaleString()} accent={CHART_COLORS.green} />
                    <KpiCard icon={Clock} label="Avg Response" value={`${(overview.avgResponseMs / 1000).toFixed(1)}s`} accent={CHART_COLORS.purple} />
                    <KpiCard icon={HelpCircle} label="Missed Intents" value={overview.missedIntents.toLocaleString()} trend={missedTrend} trendInverted accent={CHART_COLORS.amber} />
                    <KpiCard
                        icon={AlertTriangle}
                        label="Error Rate"
                        value={`${overview.lineErrorRate}%`}
                        accent={overview.lineErrorRate > 5 ? CHART_COLORS.red : CHART_COLORS.green}
                    />
                </div>
            </section>

            {/* ── Charts Row 1: LINE Daily + Donut ──────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard className="lg:col-span-2">
                    <SectionHeader
                        icon={BarChart3}
                        title="ข้อความรายวัน"
                        subtitle="สำเร็จ vs Error"
                    />
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={lineDailyChart}>
                            <defs>
                                <linearGradient id="gradOk" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.15} />
                                    <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradErr" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={CHART_COLORS.red} stopOpacity={0.15} />
                                    <stop offset="100%" stopColor={CHART_COLORS.red} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
                            <Tooltip content={<CustomTooltip labelMap={{ ok: 'สำเร็จ', error: 'Error' }} />} />
                            <Area type="monotone" dataKey="ok" stroke={CHART_COLORS.blue} strokeWidth={2} fill="url(#gradOk)" dot={false} activeDot={{ r: 4, fill: CHART_COLORS.blue, strokeWidth: 0 }} />
                            <Area type="monotone" dataKey="error" stroke={CHART_COLORS.red} strokeWidth={2} fill="url(#gradErr)" dot={false} activeDot={{ r: 4, fill: CHART_COLORS.red, strokeWidth: 0 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard>
                    <SectionHeader icon={MessageSquare} title="ประเภทข้อความ" />
                    <div className="relative">
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={lineTypeChart}
                                    dataKey="count"
                                    nameKey="type"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={80}
                                    paddingAngle={3}
                                    strokeWidth={0}
                                >
                                    {lineTypeChart.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const p = payload[0];
                                        return (
                                            <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
                                                <span className="font-semibold text-slate-700">{LINE_TYPE_LABELS[String(p.name)] || p.name}</span>
                                                <span className="ml-2 tabular-nums text-slate-900">{Number(p.value).toLocaleString()}</span>
                                            </div>
                                        );
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center label */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-8px' }}>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-slate-900 tabular-nums">{pieTotal.toLocaleString()}</p>
                                <p className="text-[10px] text-slate-400">ทั้งหมด</p>
                            </div>
                        </div>
                    </div>
                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 px-1">
                        {lineTypeChart.map((item, i) => (
                            <div key={item.type} className="flex items-center gap-2 text-xs text-slate-600">
                                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="truncate">{LINE_TYPE_LABELS[item.type] || item.type}</span>
                                <span className="ml-auto tabular-nums font-medium text-slate-400">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </ChartCard>
            </div>

            {/* ── System Stats ──────────────────────────────────────────────────── */}
            <section>
                <SectionHeader icon={Zap} title="ภาพรวมระบบ" subtitle="จำนวนรายการทั้งหมดและรอดำเนินการ" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <SystemStatCard icon={Wrench} label="ซ่อม IT" total={systemStats.totalRepairs} pending={systemStats.pendingRepairs} color={CHART_COLORS.blue} />
                    <SystemStatCard icon={Building2} label="ซ่อมอาคาร" total={systemStats.totalFacilityTickets} pending={systemStats.pendingFacilityTickets} color={CHART_COLORS.purple} />
                    <SystemStatCard icon={CalendarCheck} label="จองห้อง" total={systemStats.totalBookings} pending={systemStats.pendingBookings} color={CHART_COLORS.green} />
                </div>
            </section>

            {/* ── Charts Row 2: Web Events + Feature Usage ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard>
                    <SectionHeader icon={Zap} title="Web/API Events" subtitle="การใช้งานระบบรายวัน" />
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={usageDailyChart}>
                            <defs>
                                <linearGradient id="gradWeb" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={CHART_COLORS.green} stopOpacity={0.15} />
                                    <stop offset="100%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
                            <Tooltip content={<CustomTooltip labelMap={{ events: 'Events' }} />} />
                            <Area type="monotone" dataKey="events" name="Events" stroke={CHART_COLORS.green} strokeWidth={2} fill="url(#gradWeb)" dot={false} activeDot={{ r: 4, fill: CHART_COLORS.green, strokeWidth: 0 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard>
                    <SectionHeader icon={BarChart3} title="Feature Usage" subtitle="นับจากทุก API routes" />
                    {usageByEventChart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[200px] text-slate-400 text-sm gap-2">
                            <BarChart3 className="w-8 h-8 text-slate-200" />
                            <p>กำลังสะสมข้อมูล...</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={usageByEventChart.slice(0, 8)} layout="vertical" barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis
                                    dataKey="event"
                                    type="category"
                                    width={100}
                                    tick={{ fontSize: 10, fill: '#64748b' }}
                                    tickFormatter={(v) => EVENT_LABELS[v] || v}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const p = payload[0];
                                        return (
                                            <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
                                                <span className="font-semibold text-slate-700">{EVENT_LABELS[String(p.payload?.event)] || p.payload?.event}</span>
                                                <span className="ml-2 tabular-nums text-slate-900 font-bold">{Number(p.value).toLocaleString()}</span>
                                            </div>
                                        );
                                    }}
                                />
                                <Bar dataKey="count" fill={CHART_COLORS.indigo} radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* ── Missed Intents Daily ──────────────────────────────────────────── */}
            <ChartCard>
                <SectionHeader icon={HelpCircle} title="Missed Intents รายวัน" subtitle="ข้อความที่ Bot ยังไม่เข้าใจ" />
                <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={data.missedDailyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip labelMap={{ missed: 'Missed' }} />} />
                        <Bar dataKey="missed" name="Missed" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* ── Missed Intents Table ──────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-50">
                            <HelpCircle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-800">Missed Intents</h2>
                            <p className="text-[11px] text-slate-400">วิเคราะห์เพื่อพัฒนา Intent ใหม่</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาข้อความ..."
                            value={missedSearch}
                            onChange={e => setMissedSearch(e.target.value)}
                            className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 w-full sm:w-52 transition-all bg-slate-50 hover:bg-white"
                        />
                    </div>
                </div>

                {filteredMissed.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                        <HelpCircle className="w-8 h-8 text-slate-200" />
                        <p className="text-sm">{missedSearch ? 'ไม่พบข้อความที่ตรงกัน' : 'ยังไม่มี Missed Intents'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/70">
                                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ข้อความ User</th>
                                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-32">เวลา</th>
                                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Bot ตอบ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredMissed.map(m => (
                                    <tr key={m.id} className="hover:bg-blue-50/30 transition-colors duration-150">
                                        <td className="px-5 py-3.5 max-w-sm">
                                            <span className="line-clamp-2 text-slate-800 text-xs leading-relaxed">{m.userMessage}</span>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap text-[11px] tabular-nums">
                                            {formatTs(m.timestamp)}
                                        </td>
                                        <td className="px-5 py-3.5 max-w-xs">
                                            {m.aiReply ? (
                                                <span className="line-clamp-2 text-slate-500 text-xs leading-relaxed">{m.aiReply}</span>
                                            ) : (
                                                <span className="text-slate-200 text-xs">--</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {filteredMissed.length > 0 && (
                    <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-[11px] text-slate-400 tabular-nums">
                            {filteredMissed.length} รายการ {missedSearch && `(กรอง)`}
                        </p>
                        <p className="text-[11px] text-slate-300">สูงสุด 50 รายการล่าสุด</p>
                    </div>
                )}
            </div>

            {/* ── Error Monitor ────────────────────────────────────────────────── */}
            <ErrorLogSection />

            {/* ── Footer ───────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between pt-2 pb-4">
                <p className="text-[11px] text-slate-300">
                    CRMS6IT Analytics
                </p>
                <p className="text-[11px] text-slate-300 tabular-nums">
                    {data.meta.generatedAt ? new Date(data.meta.generatedAt).toLocaleString('th-TH') : '-'}
                </p>
            </div>
        </div>
    );
}
