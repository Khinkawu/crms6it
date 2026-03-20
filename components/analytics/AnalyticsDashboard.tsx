"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
    MessageSquare, AlertTriangle, Clock, Users,
    Activity, Wrench, CalendarCheck, RefreshCw, HelpCircle,
    Download, TrendingUp, TrendingDown, Minus
} from "lucide-react";

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

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const LINE_TYPE_LABELS: Record<string, string> = {
    text: 'ข้อความ',
    image: 'รูปภาพ',
    track_status: 'ติดตามสถานะ',
    push_notify: 'Push แจ้งเตือน',
    unknown: 'ไม่ทราบ',
};

const EVENT_LABELS: Record<string, string> = {
    repair_submit: 'แจ้งซ่อม IT',
    repair_status_update: 'อัปเดตสถานะซ่อม',
    booking_create: 'จองห้อง',
    booking_approve: 'อนุมัติจอง',
    booking_reject: 'ปฏิเสธจอง',
    photo_upload: 'อัปโหลดภาพ',
    photo_assign: 'มอบหมายช่างภาพ',
    gallery_view: 'ดูภาพถ่าย',
    video_upload: 'อัปโหลดวิดีโอ',
    knowledge_create: 'เพิ่มคลังความรู้',
    user_login: 'เข้าสู่ระบบ',
    line_link: 'ผูก LINE',
    otp_send: 'ส่ง OTP',
    otp_verify: 'ยืนยัน OTP',
    fcm_send: 'ส่ง FCM',
    api_error: 'API Error',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
    icon: Icon,
    label,
    value,
    sub,
    color = 'blue',
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}) {
    const colorMap = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        red: 'bg-red-50 text-red-600',
        purple: 'bg-purple-50 text-purple-600',
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
                    {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
                </div>
                <div className={`p-2 rounded-lg ${colorMap[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
        </div>
    );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
    );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <SectionTitle title={title} subtitle={subtitle} />
            {children}
        </div>
    );
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatTs(iso: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('th-TH', {
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
    });
}

// ── Export helpers ─────────────────────────────────────────────────────────────

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

    // LINE Daily
    rows.push('=== LINE Bot Daily ===');
    rows.push('Date,OK,Error');
    data.lineDailyChart.forEach(r => rows.push(`${r.date},${r.ok},${r.error}`));

    // Missed Intents
    rows.push('');
    rows.push('=== Missed Intents ===');
    rows.push('Timestamp,UserMessage,BotReply');
    data.recentMissedIntents.forEach(m =>
        rows.push(`${m.timestamp},"${m.userMessage.replace(/"/g, '""')}","${(m.aiReply || '').replace(/"/g, '""')}"`)
    );

    // Web Events Daily
    rows.push('');
    rows.push('=== Web Events Daily ===');
    rows.push('Date,Events');
    data.usageDailyChart.forEach(r => rows.push(`${r.date},${r.events}`));

    // Feature Usage
    rows.push('');
    rows.push('=== Feature Usage ===');
    rows.push('Event,Count');
    data.usageByEventChart.forEach(r => rows.push(`${r.event},${r.count}`));

    // LINE Type Distribution
    rows.push('');
    rows.push('=== LINE Message Types ===');
    rows.push('Type,Count');
    data.lineTypeChart.forEach(r => rows.push(`${r.type},${r.count}`));

    // System Stats
    rows.push('');
    rows.push('=== System Stats ===');
    rows.push(`Total Repairs IT,${data.systemStats.totalRepairs}`);
    rows.push(`Pending Repairs IT,${data.systemStats.pendingRepairs}`);
    rows.push(`Total Facility Tickets,${data.systemStats.totalFacilityTickets}`);
    rows.push(`Pending Facility,${data.systemStats.pendingFacilityTickets}`);
    rows.push(`Total Bookings,${data.systemStats.totalBookings}`);
    rows.push(`Pending Bookings,${data.systemStats.pendingBookings}`);

    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(rows.join('\n'), `crms6it-analytics-${dateStr}.csv`, 'text/csv');
}

function exportJSON(data: AnalyticsData) {
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(JSON.stringify(data, null, 2), `crms6it-analytics-${dateStr}.json`, 'application/json');
}

// ── Trend helpers ─────────────────────────────────────────────────────────────

function calcTrend(chart: { ok?: number; error?: number; events?: number; missed?: number }[], key: string): { current: number; previous: number; pctChange: number } {
    const half = Math.ceil(chart.length / 2);
    const recentHalf = chart.slice(half);
    const olderHalf = chart.slice(0, half);

    const sum = (arr: any[], k: string) => arr.reduce((s, r) => s + (r[k] || 0), 0);
    const current = sum(recentHalf, key);
    const previous = sum(olderHalf, key);

    const pctChange = previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);
    return { current, previous, pctChange };
}

function TrendBadge({ pctChange, inverted = false }: { pctChange: number; inverted?: boolean }) {
    const isPositive = inverted ? pctChange < 0 : pctChange > 0;
    const isNeutral = pctChange === 0;
    const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
    const color = isNeutral ? 'text-gray-400' : isPositive ? 'text-emerald-600' : 'text-red-500';
    const bg = isNeutral ? 'bg-gray-50' : isPositive ? 'bg-emerald-50' : 'bg-red-50';

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color} ${bg}`}>
            <Icon className="w-3 h-3" />
            {pctChange > 0 ? '+' : ''}{pctChange}%
        </span>
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
        return data.recentMissedIntents.filter(m =>
            m.userMessage.toLowerCase().includes(q)
        );
    }, [data, missedSearch]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                <span className="ml-3 text-gray-500">กำลังโหลดข้อมูล...</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <p className="text-gray-500">{error || 'ไม่มีข้อมูล'}</p>
                <button
                    onClick={fetchData}
                    className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                >
                    ลองใหม่
                </button>
            </div>
        );
    }

    const { overview, lineDailyChart, lineTypeChart, usageDailyChart, usageByEventChart, systemStats } = data;

    return (
        <div className="space-y-6">

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    {[7, 14, 30, 60].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
                                days === d
                                    ? 'bg-sky-600 text-white border-sky-600'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300'
                            }`}
                        >
                            {d} วัน
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => exportCSV(data)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                    </button>
                    <button
                        onClick={() => exportJSON(data)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                        <Download className="w-3.5 h-3.5" />
                        JSON
                    </button>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        รีเฟรช
                    </button>
                </div>
            </div>

            {/* KPI Row 1 — LINE Bot */}
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">LINE Bot</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <KpiCard icon={MessageSquare} label={`ข้อความ ${days} วัน`} value={overview.lineMessages.toLocaleString()} color="blue" />
                    <KpiCard icon={Users} label="User ไม่ซ้ำ" value={overview.lineUniqueUsers.toLocaleString()} color="green" />
                    <KpiCard icon={Clock} label="Avg Response" value={`${overview.avgResponseMs.toLocaleString()} ms`} color="purple" />
                    <KpiCard icon={HelpCircle} label="Missed Intents" value={overview.missedIntents.toLocaleString()} color="amber" />
                    <KpiCard
                        icon={AlertTriangle}
                        label="Error Rate"
                        value={`${overview.lineErrorRate}%`}
                        color={overview.lineErrorRate > 5 ? 'red' : 'green'}
                    />
                </div>
            </div>

            {/* KPI Row 2 — System */}
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">ระบบ</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <KpiCard icon={Wrench} label="ซ่อม IT ทั้งหมด" value={systemStats.totalRepairs.toLocaleString()} color="blue" />
                    <KpiCard icon={Wrench} label="ซ่อม IT รอดำเนิน" value={systemStats.pendingRepairs.toLocaleString()} color={systemStats.pendingRepairs > 10 ? 'amber' : 'green'} />
                    <KpiCard icon={Wrench} label="ซ่อมอาคารทั้งหมด" value={systemStats.totalFacilityTickets.toLocaleString()} color="purple" />
                    <KpiCard icon={Wrench} label="ซ่อมอาคารรอ" value={systemStats.pendingFacilityTickets.toLocaleString()} color={systemStats.pendingFacilityTickets > 10 ? 'amber' : 'green'} />
                    <KpiCard icon={CalendarCheck} label="จองห้องทั้งหมด" value={systemStats.totalBookings.toLocaleString()} color="blue" />
                    <KpiCard icon={CalendarCheck} label="จองรออนุมัติ" value={systemStats.pendingBookings.toLocaleString()} color={systemStats.pendingBookings > 5 ? 'amber' : 'green'} />
                </div>
            </div>

            {/* Trend Comparison */}
            {days >= 14 && (() => {
                const msgTrend = calcTrend(lineDailyChart, 'ok');
                const errTrend = calcTrend(lineDailyChart, 'error');
                const missedTrend = calcTrend(data.missedDailyChart, 'missed');
                const webTrend = calcTrend(usageDailyChart, 'events');

                return (
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <SectionTitle title="Trend เปรียบเทียบ" subtitle={`ครึ่งแรก vs ครึ่งหลังของ ${days} วัน`} />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">LINE Messages</p>
                                    <p className="text-lg font-bold text-gray-800">{msgTrend.current}</p>
                                </div>
                                <TrendBadge pctChange={msgTrend.pctChange} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">Errors</p>
                                    <p className="text-lg font-bold text-gray-800">{errTrend.current}</p>
                                </div>
                                <TrendBadge pctChange={errTrend.pctChange} inverted />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">Missed Intents</p>
                                    <p className="text-lg font-bold text-gray-800">{missedTrend.current}</p>
                                </div>
                                <TrendBadge pctChange={missedTrend.pctChange} inverted />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">Web Events</p>
                                    <p className="text-lg font-bold text-gray-800">{webTrend.current}</p>
                                </div>
                                <TrendBadge pctChange={webTrend.pctChange} />
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* LINE messages per day */}
                <div className="lg:col-span-2">
                    <ChartCard title="ข้อความ LINE Bot รายวัน" subtitle={`${days} วันย้อนหลัง`}>
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={lineDailyChart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip
                                    labelFormatter={(v) => `วันที่ ${v}`}
                                    formatter={(val, name) => [val, name === 'ok' ? 'สำเร็จ' : 'Error']}
                                />
                                <Legend formatter={(v) => v === 'ok' ? 'สำเร็จ' : 'Error'} />
                                <Line type="monotone" dataKey="ok" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="error" stroke="#ef4444" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>

                {/* LINE type distribution */}
                <ChartCard title="ประเภทข้อความ LINE" subtitle="ตลอดช่วงที่เลือก">
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={lineTypeChart}
                                dataKey="count"
                                nameKey="type"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ name, percent }) =>
                                    `${LINE_TYPE_LABELS[String(name)] || name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                }
                                labelLine={false}
                            >
                                {lineTypeChart.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(val, name) => [val, LINE_TYPE_LABELS[String(name)] || name]} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Web events per day */}
                <ChartCard title="Web/API Events รายวัน" subtitle="จาก usage_events collection">
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={usageDailyChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip labelFormatter={(v) => `วันที่ ${v}`} />
                            <Line type="monotone" dataKey="events" name="Events" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Top features */}
                <ChartCard title="Feature ที่ใช้บ่อย" subtitle="นับจาก API route calls">
                    {usageByEventChart.length === 0 ? (
                        <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
                            ยังไม่มีข้อมูล — เพิ่ม logWebEvent() ใน API routes
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={usageByEventChart.slice(0, 8)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis
                                    dataKey="event"
                                    type="category"
                                    width={120}
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(v) => EVENT_LABELS[v] || v}
                                />
                                <Tooltip formatter={(val, _, props) => [val, EVENT_LABELS[props.payload.event] || props.payload.event]} />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* Missed Intents Daily Chart */}
            <ChartCard title="Missed Intents รายวัน" subtitle="จำนวนข้อความที่ Bot ไม่เข้าใจ">
                <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data.missedDailyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip labelFormatter={(v) => `วันที่ ${v}`} />
                        <Bar dataKey="missed" name="Missed" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* Missed Intents Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-base font-semibold text-gray-800">Missed Intents</h2>
                        <p className="text-xs text-gray-400 mt-0.5">ข้อความที่ LINE Bot ไม่เข้าใจ — ใช้วิเคราะห์เพื่อพัฒนา Intent ใหม่</p>
                    </div>
                    <input
                        type="text"
                        placeholder="ค้นหาข้อความ..."
                        value={missedSearch}
                        onChange={e => setMissedSearch(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 w-48"
                    />
                </div>

                {filteredMissed.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                        {missedSearch ? 'ไม่พบข้อความที่ตรงกัน' : 'ยังไม่มี Missed Intents 🎉'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ข้อความ</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">เวลา</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase w-40">Bot ตอบ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredMissed.map(m => (
                                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3 text-gray-800 max-w-sm">
                                            <span className="line-clamp-2">{m.userMessage}</span>
                                        </td>
                                        <td className="px-5 py-3 text-gray-400 whitespace-nowrap text-xs">
                                            {formatTs(m.timestamp)}
                                        </td>
                                        <td className="px-5 py-3 text-gray-400 text-xs">
                                            {m.aiReply ? (
                                                <span className="line-clamp-2 text-gray-600">{m.aiReply}</span>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {filteredMissed.length > 0 && (
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            แสดง {filteredMissed.length} รายการ (สูงสุด 50 รายการล่าสุด)
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <p className="text-xs text-gray-300 text-right">
                ข้อมูล ณ {data.meta.generatedAt ? new Date(data.meta.generatedAt).toLocaleString('th-TH') : '-'}
            </p>
        </div>
    );
}
