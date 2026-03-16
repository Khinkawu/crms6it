"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import {
    collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc,
    getDocs, where, Timestamp, getCountFromServer, limit, startAfter
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { createNotification } from "@/lib/notifications";
import { toast } from "react-hot-toast";
import {
    Calendar, CheckCircle, XCircle, Clock, Trash2,
    Search, MapPin, User, Phone, FileText, Edit, Users as UsersIcon,
    Camera, BarChart2, ChevronDown, ChevronUp, TrendingUp, AlertCircle
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { subDays, format, startOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { Booking } from "../../../types";
import ConfirmationModal from "@/components/ConfirmationModal";
import EditBookingModal from "@/components/EditBookingModal";

// ─── Booking Stats Types ──────────────────────────────────────────────────────

interface BookingStats {
    topRooms: { name: string; count: number }[];
    dailyTrend: { date: string; count: number }[];
    photographerPending: number;
    upcoming7Days: number;
    avgAttendees: number;
}

// ─── Mini KPI Card ────────────────────────────────────────────────────────────

function StatCard({
    label, value, icon: Icon, accent, sub,
}: {
    label: string;
    value: number | string;
    icon: React.ElementType;
    accent: string;
    sub?: string;
}) {
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums leading-tight">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                {sub && <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Dashboard Stats Section ──────────────────────────────────────────────────

function BookingDashboard({ counts, stats, statsLoading }: {
    counts: { pending: number; approved: number; rejected: number };
    stats: BookingStats | null;
    statsLoading: boolean;
}) {
    const [open, setOpen] = useState(true);

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Toggle header */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <BarChart2 size={17} className="text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-gray-800 dark:text-white text-sm">สถิติการจอง</span>
                    {counts.pending > 0 && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full">
                            รออนุมัติ {counts.pending}
                        </span>
                    )}
                </div>
                {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            {open && (
                <div className="px-5 pb-5 space-y-5 border-t border-gray-100 dark:border-gray-800 pt-4">

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard
                            label="รออนุมัติ"
                            value={counts.pending}
                            icon={Clock}
                            accent="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                        />
                        <StatCard
                            label="อนุมัติแล้ว"
                            value={counts.approved}
                            icon={CheckCircle}
                            accent="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                        />
                        <StatCard
                            label="ปฏิเสธ / ยกเลิก"
                            value={counts.rejected}
                            icon={XCircle}
                            accent="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
                        />
                        <StatCard
                            label="ต้องการช่างภาพ"
                            value={statsLoading ? "…" : (stats?.photographerPending ?? 0)}
                            icon={Camera}
                            accent="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                            sub="รออนุมัติ"
                        />
                    </div>

                    {/* Extra stats + Chart */}
                    {statsLoading ? (
                        <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                            กำลังโหลดสถิติ…
                        </div>
                    ) : stats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                            {/* Daily Trend */}
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                    การจอง 14 วันล่าสุด
                                </p>
                                {stats.dailyTrend.every(d => d.count === 0) ? (
                                    <div className="h-32 flex items-center justify-center text-gray-300 text-sm">ยังไม่มีข้อมูล</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={120}>
                                        <BarChart data={stats.dailyTrend} barCategoryGap="20%">
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                                axisLine={false}
                                                tickLine={false}
                                                allowDecimals={false}
                                                width={22}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    background: "rgba(255,255,255,0.97)",
                                                    border: "1px solid #E5E7EB",
                                                    borderRadius: "10px",
                                                    fontSize: "12px",
                                                }}
                                                formatter={(v: any) => [`${v} รายการ`, "การจอง"]}
                                            />
                                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                                {stats.dailyTrend.map((_, i) => (
                                                    <Cell
                                                        key={i}
                                                        fill={_ .count > 0 ? "#3B82F6" : "#E5E7EB"}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* Top Rooms */}
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                    ห้องที่จองมากที่สุด (30 วัน)
                                </p>
                                {stats.topRooms.length === 0 ? (
                                    <div className="h-32 flex items-center justify-center text-gray-300 text-sm">ยังไม่มีข้อมูล</div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {stats.topRooms.slice(0, 5).map((room, i) => {
                                            const max = stats.topRooms[0]?.count || 1;
                                            const pct = Math.round((room.count / max) * 100);
                                            return (
                                                <div key={room.name} className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-400 w-4 shrink-0 tabular-nums">{i + 1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{room.name}</span>
                                                            <span className="text-xs text-gray-500 tabular-nums shrink-0 ml-2">{room.count} ครั้ง</span>
                                                        </div>
                                                        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 rounded-full transition-all"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Upcoming alert */}
                    {!statsLoading && stats && stats.upcoming7Days > 0 && (
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                            <TrendingUp size={15} />
                            <span>มีการจองที่อนุมัติแล้วอีก <strong>{stats.upcoming7Days} รายการ</strong> ใน 7 วันข้างหน้า</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookingManagement() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [filterStatus, setFilterStatus] = useState<"pending" | "approved" | "rejected">("pending");
    const [searchTerm, setSearchTerm] = useState("");
    const [isInitialLoad, setIsInitialLoad] = useState(true); // full-page spinner on first load only
    const [isTabLoading, setIsTabLoading] = useState(false);  // subtle inline indicator on tab switch
    const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

    // Analytics stats
    const [stats, setStats] = useState<BookingStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    // Edit Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

    // Confirmation Modal
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: "status" | "delete"; id: string; payload?: any } | null>(null);
    const [confirmMessage, setConfirmMessage] = useState({ title: "", message: "", confirmText: "", isDangerous: false });

    // ─── Auth guard ───────────────────────────────────────────────────────────

    useEffect(() => {
        if (!loading && !user) { router.push("/login"); return; }
        if (!loading && role !== "admin" && role !== "moderator") {
            toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
            router.push("/");
        }
    }, [user, role, loading, router]);

    // ─── Live booking list (current filter tab) ───────────────────────────────

    useEffect(() => {
        if (!user) return;
        const statusFilter = filterStatus === "rejected"
            ? where("status", "in", ["rejected", "cancelled"])
            : where("status", "==", filterStatus);

        const q = query(
            collection(db, "bookings"),
            statusFilter,
            orderBy("createdAt", "desc"),
            limit(50)
        );
        // Tab switch: don't clear page — show old bookings while loading new ones
        if (!isInitialLoad) setIsTabLoading(true);
        const unsub = onSnapshot(q, snap => {
            setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Booking[]);
            setIsInitialLoad(false);
            setIsTabLoading(false);
        });
        return () => unsub();
    }, [user, filterStatus]);

    // ─── Status counts (fast server-side) ────────────────────────────────────

    const fetchCounts = async () => {
        if (!user) return;
        const [pending, approved, rejected] = await Promise.all([
            getCountFromServer(query(collection(db, "bookings"), where("status", "==", "pending"))),
            getCountFromServer(query(collection(db, "bookings"), where("status", "==", "approved"))),
            getCountFromServer(query(collection(db, "bookings"), where("status", "in", ["rejected", "cancelled"]))),
        ]);
        setCounts({
            pending: pending.data().count,
            approved: approved.data().count,
            rejected: rejected.data().count,
        });
    };

    useEffect(() => { if (user) fetchCounts(); }, [user]);

    // ─── Analytics: one-shot fetch for stats dashboard ────────────────────────

    useEffect(() => {
        if (!user) return;

        const fetchAnalytics = async () => {
            setStatsLoading(true);
            try {
                const now = new Date();
                const start30 = Timestamp.fromDate(startOfDay(subDays(now, 29)));
                const start14 = startOfDay(subDays(now, 13));
                const next7End = Timestamp.fromDate(new Date(now.getTime() + 7 * 24 * 3600000));

                const [recentSnap, photographerSnap, upcomingSnap] = await Promise.all([
                    // All bookings in last 30 days for top-rooms + daily trend
                    getDocs(query(
                        collection(db, "bookings"),
                        where("createdAt", ">=", start30),
                        limit(500)
                    )),
                    // Pending bookings that need photographer
                    getCountFromServer(query(
                        collection(db, "bookings"),
                        where("status", "==", "pending"),
                        where("needsPhotographer", "==", true)
                    )),
                    // Approved bookings in next 7 days
                    getCountFromServer(query(
                        collection(db, "bookings"),
                        where("status", "==", "approved"),
                        where("startTime", ">=", Timestamp.fromDate(now)),
                        where("startTime", "<=", next7End)
                    )),
                ]);

                // Daily trend (14 days)
                const dayMap: Record<string, number> = {};
                for (let i = 13; i >= 0; i--) {
                    const d = subDays(now, i);
                    dayMap[format(d, "yyyy-MM-dd")] = 0;
                }
                recentSnap.forEach(docSnap => {
                    const d = docSnap.data();
                    if (!d.createdAt) return;
                    const ts: Date = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
                    if (ts >= start14) {
                        const key = format(ts, "yyyy-MM-dd");
                        if (key in dayMap) dayMap[key]++;
                    }
                });
                const dailyTrend = Object.entries(dayMap).map(([dateStr, count]) => ({
                    date: format(new Date(dateStr), "d/M", { locale: th }),
                    count,
                }));

                // Top rooms (30 days, all statuses)
                const roomMap: Record<string, number> = {};
                let totalAttendees = 0;
                let attendeeCount = 0;
                recentSnap.forEach(docSnap => {
                    const d = docSnap.data();
                    const room = d.roomName || d.room || "ไม่ระบุห้อง";
                    roomMap[room] = (roomMap[room] ?? 0) + 1;
                    if (d.attendees) { totalAttendees += Number(d.attendees); attendeeCount++; }
                });
                const topRooms = Object.entries(roomMap)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count);

                setStats({
                    topRooms,
                    dailyTrend,
                    photographerPending: photographerSnap.data().count,
                    upcoming7Days: upcomingSnap.data().count,
                    avgAttendees: attendeeCount > 0 ? Math.round(totalAttendees / attendeeCount) : 0,
                });
            } catch (err) {
                console.error("Booking analytics error:", err);
            } finally {
                setStatsLoading(false);
            }
        };

        fetchAnalytics();
    }, [user]);

    // ─── Action handlers ──────────────────────────────────────────────────────

    const handleUpdateStatus = (id: string, newStatus: string) => {
        setConfirmAction({ type: "status", id, payload: newStatus });
        setConfirmMessage({
            title: `ยืนยันการ${newStatus === "approved" ? "อนุมัติ" : newStatus === "rejected" ? "ไม่อนุมัติ" : "เปลี่ยนสถานะ"}`,
            message: `คุณต้องการเปลี่ยนสถานะรายการนี้เป็น "${newStatus === "approved" ? "อนุมัติ" : newStatus === "rejected" ? "ไม่อนุมัติ" : "รอพิจารณา"}" ใช่หรือไม่?`,
            confirmText: "ตกลง",
            isDangerous: newStatus === "rejected",
        });
        setIsConfirmOpen(true);
    };

    const handleDelete = (id: string) => {
        setConfirmAction({ type: "delete", id });
        setConfirmMessage({
            title: "ยืนยันการลบ",
            message: "คุณแน่ใจหรือไม่ที่จะลบรายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้",
            confirmText: "ลบรายการ",
            isDangerous: true,
        });
        setIsConfirmOpen(true);
    };

    const handleEdit = (booking: Booking) => {
        setEditingBooking(booking);
        setIsEditModalOpen(true);
    };

    const executeConfirmAction = async () => {
        if (!confirmAction) return;
        try {
            if (confirmAction.type === "status") {
                if (confirmAction.payload === "approved") {
                    const booking = bookings.find(b => b.id === confirmAction.id);
                    if (booking?.startTime && booking?.endTime && booking?.roomId) {
                        const conflictQuery = query(
                            collection(db, "bookings"),
                            where("roomId", "==", booking.roomId),
                            where("status", "==", "approved"),
                            where("startTime", "<", booking.endTime)
                        );
                        const conflicts = await getDocs(conflictQuery);
                        const bookingStartMs = (booking.startTime as Timestamp).toMillis();
                        const realConflicts = conflicts.docs.filter(d =>
                            d.id !== confirmAction.id &&
                            (d.data().endTime as Timestamp).toMillis() > bookingStartMs
                        );
                        if (realConflicts.length > 0) {
                            toast.error("ไม่สามารถอนุมัติได้ — ห้องนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว");
                            setIsConfirmOpen(false);
                            setConfirmAction(null);
                            return;
                        }
                    }
                }
                const target = bookings.find(b => b.id === confirmAction.id);
                await updateDoc(doc(db, "bookings", confirmAction.id), { status: confirmAction.payload });
                if (target?.requesterId) {
                    const isApproved = confirmAction.payload === "approved";
                    createNotification({
                        userId: target.requesterId,
                        type: "booking_result",
                        title: isApproved ? "การจองได้รับอนุมัติ" : "การจองถูกปฏิเสธ",
                        body: `${target.title} — ${target.roomName}`,
                        linkTo: "/booking",
                        metadata: { bookingId: confirmAction.id },
                    }).catch(() => { });
                }
                toast.success("อัปเดตสถานะเรียบร้อย");
            } else {
                await deleteDoc(doc(db, "bookings", confirmAction.id));
                toast.success("ลบรายการจองเรียบร้อย");
            }
            fetchCounts();
        } catch {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsConfirmOpen(false);
            setConfirmAction(null);
        }
    };

    // ─── Filter ───────────────────────────────────────────────────────────────

    const filteredBookings = useMemo(() =>
        bookings.filter(b =>
            b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.roomName || "").toLowerCase().includes(searchTerm.toLowerCase())
        ), [bookings, searchTerm]);

    // ─── Helpers ──────────────────────────────────────────────────────────────

    const formatDate = (ts: Timestamp) =>
        ts?.toDate().toLocaleDateString("th-TH", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        }) ?? "";

    const formatTime = (ts: Timestamp) =>
        ts?.toDate().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) ?? "";

    // ─── Loading ──────────────────────────────────────────────────────────────

    if (loading || isInitialLoad) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-white rounded-full" />
            </div>
        );
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5 pb-20 animate-fade-in">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    <Calendar size={20} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">จัดการการจอง</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ตรวจสอบ อนุมัติ และติดตามรายการจองห้อง</p>
                </div>
            </div>

            {/* ── Stats Dashboard ──────────────────────────────────────────── */}
            <BookingDashboard counts={counts} stats={stats} statsLoading={statsLoading} />

            {/* ── Status Tabs ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 items-center">
                {[
                    { id: "pending", label: "รออนุมัติ", icon: <Clock size={15} />, count: counts.pending },
                    { id: "approved", label: "อนุมัติแล้ว", icon: <CheckCircle size={15} />, count: counts.approved },
                    { id: "rejected", label: "ไม่อนุมัติ", icon: <XCircle size={15} />, count: counts.rejected },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setSearchTerm(""); setFilterStatus(tab.id as any); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            filterStatus === tab.id
                                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                        <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
                            filterStatus === tab.id ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700"
                        }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {isTabLoading && (
                <div className="h-0.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden -mt-3">
                    <div className="h-full bg-blue-500 rounded-full animate-[shimmer_1s_ease-in-out_infinite]" style={{ width: "40%" }} />
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                <input
                    type="text"
                    placeholder="ค้นหา (หัวข้อ, ผู้จอง, ห้อง)…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-blue-400/30 outline-none transition-all"
                />
            </div>

            {/* ── Booking List ─────────────────────────────────────────────── */}
            <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
                        <FileText size={32} className="mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">ไม่มีรายการจอง</h3>
                        <p className="text-sm text-gray-400 mt-1">ไม่มีรายการในสถานะนี้</p>
                    </div>
                ) : filteredBookings.map(booking => (
                    <div
                        key={booking.id}
                        className="group relative overflow-hidden bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200"
                    >
                        {/* Status accent bar */}
                        <div className={`absolute top-0 left-0 right-0 h-0.5 ${
                            booking.status === "pending" ? "bg-amber-400" :
                            booking.status === "approved" ? "bg-emerald-400" : "bg-red-400"
                        }`} />

                        <div className="p-5 pt-6">
                            <div className="flex flex-col lg:flex-row gap-5">

                                {/* Left: Room & Time */}
                                <div className="lg:w-56 space-y-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                            <MapPin size={16} />
                                        </div>
                                        <span className="font-bold text-gray-900 dark:text-white">{booking.roomName}</span>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-2 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400 text-xs">เริ่ม</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-xs">{formatDate(booking.startTime)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400 text-xs">ถึง</span>
                                            <span className="font-medium text-gray-900 dark:text-white text-xs">{formatTime(booking.endTime)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Center: Details */}
                                <div className="flex-1 min-w-0 space-y-3">
                                    <div>
                                        <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{booking.title}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{booking.description || "—"}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 text-sm">
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                            <User size={13} className="text-gray-400" />
                                            <span className="font-medium">{booking.requesterName}</span>
                                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                                                {booking.position}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                            <Phone size={13} />
                                            <span className="text-sm">{booking.phoneNumber}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {booking.attendees && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                                                <UsersIcon size={11} /> {booking.attendees} คน
                                            </span>
                                        )}
                                        {booking.roomLayout && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                                {booking.roomLayout === "u_shape" ? "ตัว U" :
                                                    booking.roomLayout === "classroom" ? "แถวหน้ากระดาน" :
                                                    booking.roomLayout === "empty" ? "โล่ง" : "อื่นๆ"}
                                            </span>
                                        )}
                                        {booking.equipment?.slice(0, 3).map((eq, i) => (
                                            <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                                {eq}
                                            </span>
                                        ))}
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                updateDoc(doc(db, "bookings", booking.id), {
                                                    needsPhotographer: !booking.needsPhotographer,
                                                })
                                                    .then(() => toast.success(booking.needsPhotographer ? "ยกเลิกช่างภาพ" : "เพิ่มช่างภาพเรียบร้อย"))
                                                    .catch(() => toast.error("บันทึกไม่สำเร็จ"));
                                            }}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                                booking.needsPhotographer
                                                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100"
                                                    : "bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100 hover:text-gray-700"
                                            }`}
                                        >
                                            <Camera size={11} />
                                            {booking.needsPhotographer ? "ต้องการช่างภาพ" : "ไม่มีช่างภาพ"}
                                        </button>
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className="lg:w-40 flex flex-row lg:flex-col flex-wrap gap-2 lg:justify-center pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 lg:pl-5">
                                    {booking.status === "pending" && (
                                        <>
                                            <button
                                                onClick={() => handleUpdateStatus(booking.id, "approved")}
                                                className="flex-1 lg:w-full py-2 px-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
                                            >
                                                <CheckCircle size={15} /> อนุมัติ
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(booking.id, "rejected")}
                                                className="flex-1 lg:w-full py-2 px-3 rounded-xl bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            >
                                                <XCircle size={15} /> ไม่อนุมัติ
                                            </button>
                                        </>
                                    )}
                                    {booking.status === "approved" && (
                                        <button
                                            onClick={() => handleUpdateStatus(booking.id, "pending")}
                                            className="flex-1 lg:w-full py-2 px-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                        >
                                            <Clock size={15} /> รอพิจารณา
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleEdit(booking)}
                                        className="flex-1 lg:w-full py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all"
                                    >
                                        <Edit size={15} /> แก้ไข
                                    </button>
                                    <button
                                        onClick={() => handleDelete(booking.id)}
                                        className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                        title="ลบรายการ"
                                    >
                                        <Trash2 size={17} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modals */}
            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={executeConfirmAction}
                title={confirmMessage.title}
                message={confirmMessage.message}
                confirmText={confirmMessage.confirmText}
                isDangerous={confirmMessage.isDangerous}
            />
            {editingBooking && (
                <EditBookingModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    booking={{
                        ...editingBooking,
                        roomId: editingBooking.roomId || editingBooking.room || "",
                        id: editingBooking.id,
                        title: editingBooking.title,
                        requesterName: editingBooking.requesterName,
                        department: editingBooking.department,
                        startTime: editingBooking.startTime,
                        endTime: editingBooking.endTime,
                        roomName: editingBooking.roomName || "",
                        description: editingBooking.description || "",
                        phoneNumber: editingBooking.phoneNumber || "",
                        status: editingBooking.status,
                        equipment: editingBooking.equipment || [],
                    } as any}
                    onUpdate={() => { }}
                />
            )}
        </div>
    );
}
