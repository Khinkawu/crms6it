"use client";

import React, { useState, useId } from "react";
import { useRouter } from "next/navigation";
import {
    Wrench, Building2, Camera, Package,
    FileSpreadsheet, Printer, FileText, Loader2,
    RefreshCw, ChevronDown, ChevronUp, AlertTriangle,
    CheckCircle2, Clock, TrendingUp, Users, Timer,
} from "lucide-react";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import { th } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import {
    useCommandCenter,
    getDefaultDateRange,
    type CommandDateRange,
    type DatePreset,
    type ModuleFilter,
    type StaffRepairKPI,
    type StaffFacilityKPI,
    type StaffPhotoKPI,
    type StaffBorrowKPI,
} from "@/hooks/useCommandCenter";
import {
    exportCommandCenterToExcel,
    exportCommandCenterToPDF,
    printCommandCenter,
} from "@/utils/commandCenterExport";
import toast from "react-hot-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULE_TABS: { key: ModuleFilter; label: string; icon: React.ElementType; color: string }[] = [
    { key: "all", label: "ทั้งหมด", icon: TrendingUp, color: "text-gray-600 dark:text-gray-300" },
    { key: "repair", label: "ซ่อมโสต", icon: Wrench, color: "text-red-600 dark:text-red-400" },
    { key: "facility", label: "ซ่อมอาคาร", icon: Building2, color: "text-orange-600 dark:text-orange-400" },
    { key: "photography", label: "ถ่ายภาพ", icon: Camera, color: "text-purple-600 dark:text-purple-400" },
    { key: "borrow", label: "ยืมคืน", icon: Package, color: "text-blue-600 dark:text-blue-400" },
];

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
    { key: "today", label: "วันนี้" },
    { key: "7d", label: "7 วัน" },
    { key: "30d", label: "30 วัน" },
    { key: "custom", label: "กำหนดเอง" },
];

function makeDateRange(preset: DatePreset, customStart?: Date, customEnd?: Date): CommandDateRange {
    const now = new Date();
    switch (preset) {
        case "today":
            return { start: startOfDay(now), end: endOfDay(now), preset };
        case "30d":
            return { start: startOfDay(subDays(now, 29)), end: endOfDay(now), preset };
        case "custom":
            return {
                start: startOfDay(customStart ?? subDays(now, 6)),
                end: endOfDay(customEnd ?? now),
                preset,
            };
        default: // '7d'
            return { start: startOfDay(subDays(now, 6)), end: endOfDay(now), preset };
    }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
    icon: Icon,
    title,
    total,
    completed,
    pending,
    rate,
    iconBg,
    accent,
    extra,
}: {
    icon: React.ElementType;
    title: string;
    total: number;
    completed?: number;
    pending?: number;
    rate?: number;
    iconBg: string;
    accent: string;
    extra?: React.ReactNode;
}) {
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
                    <Icon size={18} className={accent} />
                </div>
                {rate !== undefined && (
                    <span className={`text-sm font-bold tabular-nums ${accent}`}>{rate}%</span>
                )}
            </div>
            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{title}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{total}</p>
            </div>
            <div className="flex gap-3 text-xs">
                {completed !== undefined && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={11} /> {completed} เสร็จ
                    </span>
                )}
                {pending !== undefined && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Clock size={11} /> {pending} ค้าง
                    </span>
                )}
                {extra}
            </div>
        </div>
    );
}

function Pill({ label, value, color }: { label: string; value: number | string; color: string }) {
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
            <span className="font-bold tabular-nums">{value}</span>
            <span className="opacity-75">{label}</span>
        </div>
    );
}

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
    if (!dir) return <ChevronDown size={13} className="text-gray-300" />;
    return dir === "asc"
        ? <ChevronUp size={13} className="text-blue-500" />
        : <ChevronDown size={13} className="text-blue-500" />;
}

type SortConfig<T> = { key: keyof T; dir: "asc" | "desc" } | null;

function useSortable<T>(items: T[]) {
    const [sort, setSort] = useState<SortConfig<T>>(null);
    const sorted = React.useMemo(() => {
        if (!sort) return items;
        return [...items].sort((a, b) => {
            const av = a[sort.key] as any;
            const bv = b[sort.key] as any;
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return sort.dir === "asc" ? cmp : -cmp;
        });
    }, [items, sort]);
    const toggleSort = (key: keyof T) =>
        setSort(prev =>
            prev?.key === key
                ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
                : { key, dir: "desc" }
        );
    return { sorted, sort, toggleSort };
}

function Th({ label, sortKey, sort, onSort }: {
    label: string;
    sortKey?: string;
    sort?: SortConfig<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSort?: (k: any) => void;
}) {
    const active = sort?.key === sortKey;
    return (
        <th
            className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap select-none
                ${sortKey ? "cursor-pointer hover:text-gray-900 dark:hover:text-white" : ""}`}
            onClick={() => sortKey && onSort?.(sortKey)}
        >
            <div className="flex items-center gap-1">
                {label}
                {sortKey && <SortIcon dir={active ? sort!.dir : null} />}
            </div>
        </th>
    );
}

// ─── Table: Repair ────────────────────────────────────────────────────────────

function RepairTable({ data }: { data: StaffRepairKPI[] }) {
    const { sorted, sort, toggleSort } = useSortable(data.filter(r => r.technicianId !== "__unassigned__"));
    const unassigned = data.find(r => r.technicianId === "__unassigned__");

    if (data.length === 0)
        return <EmptyState label="ไม่มีข้อมูลงานซ่อมโสตในช่วงนี้" />;

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
                <thead className="border-b border-gray-200 dark:border-gray-800">
                    <tr>
                        <Th label="#" />
                        <Th label="ชื่อช่าง" sortKey="technicianName" sort={sort} onSort={toggleSort} />
                        <Th label="รวม" sortKey="total" sort={sort} onSort={toggleSort} />
                        <Th label="รอ" sortKey="pending" sort={sort} onSort={toggleSort} />
                        <Th label="กำลังทำ" sortKey="inProgress" sort={sort} onSort={toggleSort} />
                        <Th label="รออะไหล่" sortKey="waitingParts" sort={sort} onSort={toggleSort} />
                        <Th label="เสร็จ" sortKey="completed" sort={sort} onSort={toggleSort} />
                        <Th label="เฉลี่ย (ชม.)" sortKey="avgHoursToComplete" sort={sort} onSort={toggleSort} />
                        <Th label="อัตราสำเร็จ" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {sorted.map((r, i) => {
                        const rate = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
                        return (
                            <tr key={r.technicianId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-sm">{r.technicianName}</td>
                                <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white tabular-nums">{r.total}</td>
                                <td className="px-4 py-3 text-center tabular-nums">
                                    <span className={`font-semibold ${r.pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}`}>{r.pending}</span>
                                </td>
                                <td className="px-4 py-3 text-center tabular-nums">
                                    <span className={`font-semibold ${r.inProgress > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>{r.inProgress}</span>
                                </td>
                                <td className="px-4 py-3 text-center tabular-nums">
                                    <span className={`font-semibold ${r.waitingParts > 0 ? "text-orange-500" : "text-gray-400"}`}>{r.waitingParts}</span>
                                </td>
                                <td className="px-4 py-3 text-center tabular-nums">
                                    <span className={`font-semibold ${r.completed > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>{r.completed}</span>
                                </td>
                                <td className="px-4 py-3 text-center text-sm tabular-nums text-gray-600 dark:text-gray-300">
                                    {r.avgHoursToComplete !== null ? `${r.avgHoursToComplete}h` : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-3">
                                    <RateBar rate={rate} />
                                </td>
                            </tr>
                        );
                    })}
                    {unassigned && unassigned.total > 0 && (
                        <tr className="bg-gray-50 dark:bg-gray-800/30">
                            <td className="px-4 py-3 text-xs text-gray-400">—</td>
                            <td className="px-4 py-3 text-xs text-gray-400 italic">ยังไม่มอบหมาย</td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500 tabular-nums">{unassigned.total}</td>
                            <td colSpan={6} />
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ─── Table: Facility ──────────────────────────────────────────────────────────

function FacilityTable({ data }: { data: StaffFacilityKPI[] }) {
    const { sorted, sort, toggleSort } = useSortable(data.filter(r => r.technicianId !== "__unassigned__"));
    const unassigned = data.find(r => r.technicianId === "__unassigned__");

    if (data.length === 0)
        return <EmptyState label="ไม่มีข้อมูลงานซ่อมอาคารในช่วงนี้" />;

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
                <thead className="border-b border-gray-200 dark:border-gray-800">
                    <tr>
                        <Th label="#" />
                        <Th label="ชื่อช่าง" sortKey="technicianName" sort={sort} onSort={toggleSort} />
                        <Th label="รวม" sortKey="total" sort={sort} onSort={toggleSort} />
                        <Th label="รอ" sortKey="pending" sort={sort} onSort={toggleSort} />
                        <Th label="กำลังทำ" sortKey="inProgress" sort={sort} onSort={toggleSort} />
                        <Th label="เสร็จ" sortKey="completed" sort={sort} onSort={toggleSort} />
                        <Th label="เร่งด่วนค้าง" sortKey="urgentPending" sort={sort} onSort={toggleSort} />
                        <Th label="อัตราสำเร็จ" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {sorted.map((r, i) => {
                        const rate = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
                        return (
                            <tr key={r.technicianId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-sm">{r.technicianName}</td>
                                <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white tabular-nums">{r.total}</td>
                                <td className="px-4 py-3 text-center tabular-nums">
                                    <span className={`font-semibold ${r.pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}`}>{r.pending}</span>
                                </td>
                                <td className="px-4 py-3 text-center tabular-nums">
                                    <span className={`font-semibold ${r.inProgress > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>{r.inProgress}</span>
                                </td>
                                <td className="px-4 py-3 text-center tabular-nums">
                                    <span className={`font-semibold ${r.completed > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>{r.completed}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {r.urgentPending > 0
                                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                                            <AlertTriangle size={10} /> {r.urgentPending}
                                        </span>
                                        : <span className="text-gray-300">—</span>
                                    }
                                </td>
                                <td className="px-4 py-3"><RateBar rate={rate} /></td>
                            </tr>
                        );
                    })}
                    {unassigned && unassigned.total > 0 && (
                        <tr className="bg-gray-50 dark:bg-gray-800/30">
                            <td className="px-4 py-3 text-xs text-gray-400">—</td>
                            <td className="px-4 py-3 text-xs text-gray-400 italic">ยังไม่มอบหมาย</td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500 tabular-nums">{unassigned.total}</td>
                            <td colSpan={5} />
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ─── Table: Photography ───────────────────────────────────────────────────────

function PhotoTable({ data }: { data: StaffPhotoKPI[] }) {
    const { sorted, sort, toggleSort } = useSortable(data);
    if (data.length === 0)
        return <EmptyState label="ไม่มีข้อมูลงานถ่ายภาพในช่วงนี้" />;
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
                <thead className="border-b border-gray-200 dark:border-gray-800">
                    <tr>
                        <Th label="#" />
                        <Th label="ชื่อช่างภาพ" sortKey="name" sort={sort} onSort={toggleSort} />
                        <Th label="รวม" sortKey="total" sort={sort} onSort={toggleSort} />
                        <Th label="เสร็จ" sortKey="completed" sort={sort} onSort={toggleSort} />
                        <Th label="ค้าง" sortKey="pending" sort={sort} onSort={toggleSort} />
                        <Th label="อัตราสำเร็จ" sortKey="completionRate" sort={sort} onSort={toggleSort} />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {sorted.map((p, i) => (
                        <tr key={p.uid} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-sm">{p.name}</td>
                            <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white tabular-nums">{p.total}</td>
                            <td className="px-4 py-3 text-center tabular-nums">
                                <span className={`font-semibold ${p.completed > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>{p.completed}</span>
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums">
                                <span className={`font-semibold ${p.pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}`}>{p.pending}</span>
                            </td>
                            <td className="px-4 py-3"><RateBar rate={p.completionRate} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Table: Borrow ────────────────────────────────────────────────────────────

function BorrowTable({ data }: { data: StaffBorrowKPI[] }) {
    const { sorted, sort, toggleSort } = useSortable(data);
    if (data.length === 0)
        return <EmptyState label="ไม่มีข้อมูลการยืมคืนในช่วงนี้" />;
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
                <thead className="border-b border-gray-200 dark:border-gray-800">
                    <tr>
                        <Th label="#" />
                        <Th label="ชื่อ" sortKey="name" sort={sort} onSort={toggleSort} />
                        <Th label="ยืม" sortKey="borrowCount" sort={sort} onSort={toggleSort} />
                        <Th label="เบิก" sortKey="requisitionCount" sort={sort} onSort={toggleSort} />
                        <Th label="รวม" sortKey="total" sort={sort} onSort={toggleSort} />
                        <Th label="เกินกำหนด" sortKey="overdueCount" sort={sort} onSort={toggleSort} />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {sorted.map((b, i) => (
                        <tr key={b.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-sm">{b.name}</td>
                            <td className="px-4 py-3 text-center tabular-nums text-blue-600 dark:text-blue-400 font-semibold">{b.borrowCount}</td>
                            <td className="px-4 py-3 text-center tabular-nums text-gray-600 dark:text-gray-300 font-semibold">{b.requisitionCount}</td>
                            <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white tabular-nums">{b.total}</td>
                            <td className="px-4 py-3 text-center">
                                {b.overdueCount > 0
                                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                                        <AlertTriangle size={10} /> {b.overdueCount}
                                    </span>
                                    : <span className="text-gray-300 text-xs">—</span>
                                }
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function RateBar({ rate }: { rate: number }) {
    const color = rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500";
    return (
        <div className="flex items-center gap-2 min-w-[90px]">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${rate}%` }} />
            </div>
            <span className="text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300 w-8 text-right">{rate}%</span>
        </div>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <TrendingUp size={32} className="mb-3 opacity-30" />
            <p className="text-sm">{label}</p>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
    const { user, role, isPhotographer, loading: authLoading, getDisplayName } = useAuth();
    const router = useRouter();

    const [dateRange, setDateRange] = useState<CommandDateRange>(getDefaultDateRange);
    const [module, setModule] = useState<ModuleFilter>("all");
    const [customStart, setCustomStart] = useState<string>(
        format(subDays(new Date(), 6), "yyyy-MM-dd")
    );
    const [customEnd, setCustomEnd] = useState<string>(
        format(new Date(), "yyyy-MM-dd")
    );

    const hasAccess = role === "admin" || role === "moderator";

    React.useEffect(() => {
        if (!authLoading && (!user || !hasAccess)) router.push("/");
    }, [user, role, authLoading, hasAccess, router]);

    const { summary, repairKPIs, facilityKPIs, photoKPIs, borrowKPIs, loading, error, refetch } =
        useCommandCenter(dateRange);

    // ─── Date range handlers ─────────────────────────────────────────────────

    const handlePreset = (preset: DatePreset) => {
        if (preset === "custom") return; // handled separately
        setDateRange(makeDateRange(preset));
    };

    const handleCustomApply = () => {
        if (!customStart || !customEnd) return;
        const s = new Date(customStart);
        const e = new Date(customEnd);
        if (s > e) { toast.error("วันเริ่มต้นต้องน้อยกว่าวันสิ้นสุด"); return; }
        setDateRange({ start: startOfDay(s), end: endOfDay(e), preset: "custom" });
    };

    // ─── Export handlers ─────────────────────────────────────────────────────

    const exportParams = {
        summary,
        repairKPIs,
        facilityKPIs,
        photoKPIs,
        borrowKPIs,
        dateRange,
        exporterName: getDisplayName(),
        module,
    };

    const handleExcelExport = () => {
        try {
            exportCommandCenterToExcel(exportParams);
            toast.success("ส่งออก Excel สำเร็จ");
        } catch (e) {
            toast.error("เกิดข้อผิดพลาดในการส่งออก Excel");
        }
    };

    const handlePdfExport = () => {
        exportCommandCenterToPDF(exportParams);
        toast.success("เปิดหน้าต่าง PDF แล้ว");
    };

    const handlePrint = () => {
        printCommandCenter(exportParams);
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    if (authLoading || !user || !hasAccess) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
        );
    }

    const dateLabel = dateRange.preset === "today"
        ? "วันนี้"
        : dateRange.preset === "7d"
            ? "7 วันล่าสุด"
            : dateRange.preset === "30d"
                ? "30 วันล่าสุด"
                : `${format(dateRange.start, "d MMM", { locale: th })} – ${format(dateRange.end, "d MMM yyyy", { locale: th })}`;

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-28 px-1">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        Command Center
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {dateLabel} · อัปเดตล่าสุด {format(new Date(), "HH:mm")} น.
                    </p>
                </div>

                {/* Export bar */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleExcelExport}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
                    >
                        <FileSpreadsheet size={15} className="text-emerald-600" />
                        Excel
                    </button>
                    <button
                        onClick={handlePdfExport}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
                    >
                        <FileText size={15} className="text-red-500" />
                        PDF
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
                    >
                        <Printer size={15} className="text-gray-500" />
                        พิมพ์
                    </button>
                    <button
                        onClick={refetch}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        รีเฟรช
                    </button>
                </div>
            </div>

            {/* ── Date Range Bar ──────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                {DATE_PRESETS.map(p => (
                    <button
                        key={p.key}
                        onClick={() => {
                            if (p.key !== "custom") handlePreset(p.key);
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                            dateRange.preset === p.key
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600"
                        }`}
                    >
                        {p.label}
                    </button>
                ))}

                {/* Custom date inputs — always visible, apply on click */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5">
                    <input
                        type="date"
                        value={customStart}
                        onChange={e => setCustomStart(e.target.value)}
                        className="text-sm text-gray-700 dark:text-gray-200 bg-transparent outline-none"
                    />
                    <span className="text-gray-400 text-sm">–</span>
                    <input
                        type="date"
                        value={customEnd}
                        onChange={e => setCustomEnd(e.target.value)}
                        className="text-sm text-gray-700 dark:text-gray-200 bg-transparent outline-none"
                    />
                    <button
                        onClick={handleCustomApply}
                        className="ml-1 px-2.5 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
                    >
                        ใช้
                    </button>
                </div>
            </div>

            {/* ── Error ───────────────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-400 text-sm">
                    <AlertTriangle size={16} />
                    {error}
                    <button onClick={refetch} className="ml-auto underline text-xs">ลองใหม่</button>
                </div>
            )}

            {/* ── Summary KPI Cards ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                    icon={Wrench}
                    title="ซ่อมโสต"
                    total={summary.repair.total}
                    completed={summary.repair.completed}
                    pending={summary.repair.pending + summary.repair.inProgress + summary.repair.waitingParts}
                    rate={summary.repair.resolutionRate}
                    iconBg="bg-red-50 dark:bg-red-900/20"
                    accent="text-red-600 dark:text-red-400"
                    extra={summary.repair.waitingParts > 0 && (
                        <span className="text-xs text-orange-500 flex items-center gap-1">
                            <Timer size={10} /> รออะไหล่ {summary.repair.waitingParts}
                        </span>
                    )}
                />
                <SummaryCard
                    icon={Building2}
                    title="ซ่อมอาคาร"
                    total={summary.facility.total}
                    completed={summary.facility.completed}
                    pending={summary.facility.pending + summary.facility.inProgress}
                    iconBg="bg-orange-50 dark:bg-orange-900/20"
                    accent="text-orange-600 dark:text-orange-400"
                    extra={summary.facility.urgentPending > 0 && (
                        <span className="text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle size={10} /> เร่งด่วน {summary.facility.urgentPending}
                        </span>
                    )}
                />
                <SummaryCard
                    icon={Camera}
                    title="ถ่ายภาพ"
                    total={summary.photography.total}
                    completed={summary.photography.completed}
                    pending={summary.photography.assigned + summary.photography.pendingAssign}
                    rate={summary.photography.completionRate}
                    iconBg="bg-purple-50 dark:bg-purple-900/20"
                    accent="text-purple-600 dark:text-purple-400"
                    extra={summary.photography.pendingAssign > 0 && (
                        <span className="text-xs text-amber-500 flex items-center gap-1">
                            <Users size={10} /> รอมอบหมาย {summary.photography.pendingAssign}
                        </span>
                    )}
                />
                <SummaryCard
                    icon={Package}
                    title="ยืมคืน"
                    total={summary.borrow.total}
                    iconBg="bg-blue-50 dark:bg-blue-900/20"
                    accent="text-blue-600 dark:text-blue-400"
                    extra={
                        <div className="flex gap-2 flex-wrap">
                            <span className="text-xs text-blue-500">ยืม {summary.borrow.borrow}</span>
                            <span className="text-xs text-gray-500">เบิก {summary.borrow.requisition}</span>
                            {summary.borrow.overdue > 0 && (
                                <span className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertTriangle size={10} /> เกิน {summary.borrow.overdue}
                                </span>
                            )}
                        </div>
                    }
                />
            </div>

            {/* ── Module Tabs + KPI Table ─────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
                {/* Tab bar */}
                <div className="flex items-center gap-1 px-4 pt-4 border-b border-gray-200 dark:border-gray-800 overflow-x-auto pb-0">
                    {MODULE_TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = module === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setModule(tab.key)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 whitespace-nowrap transition-all ${
                                    active
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10"
                                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                                }`}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Table content */}
                <div className="p-4">
                    {loading ? (
                        <LoadingState />
                    ) : module === "all" ? (
                        <div className="space-y-8">
                            <Section title="ซ่อมโสต" icon={Wrench} count={repairKPIs.filter(r => r.technicianId !== "__unassigned__").length} accent="text-red-600">
                                <RepairTable data={repairKPIs} />
                            </Section>
                            <Section title="ซ่อมอาคาร" icon={Building2} count={facilityKPIs.filter(r => r.technicianId !== "__unassigned__").length} accent="text-orange-600">
                                <FacilityTable data={facilityKPIs} />
                            </Section>
                            <Section title="ถ่ายภาพ" icon={Camera} count={photoKPIs.length} accent="text-purple-600">
                                <PhotoTable data={photoKPIs} />
                            </Section>
                            <Section title="ยืมคืน" icon={Package} count={borrowKPIs.length} accent="text-blue-600">
                                <BorrowTable data={borrowKPIs} />
                            </Section>
                        </div>
                    ) : module === "repair" ? (
                        <RepairTable data={repairKPIs} />
                    ) : module === "facility" ? (
                        <FacilityTable data={facilityKPIs} />
                    ) : module === "photography" ? (
                        <PhotoTable data={photoKPIs} />
                    ) : (
                        <BorrowTable data={borrowKPIs} />
                    )}
                </div>
            </div>

        </div>
    );
}

function Section({
    title, icon: Icon, count, accent, children,
}: {
    title: string;
    icon: React.ElementType;
    count: number;
    accent: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <Icon size={15} className={accent} />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</span>
                {count > 0 && (
                    <span className="ml-1 text-xs text-gray-400">{count} คน</span>
                )}
            </div>
            {children}
        </div>
    );
}
