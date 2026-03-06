"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    Wrench, Calendar as CalendarIcon, Camera, Video,
    Clock, TrendingUp, CheckCircle2, AlertCircle,
    Package, Users, Download, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PhotographyJob } from "@/types";

import { useBookings, BookingEvent } from "@/hooks/useBookings";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { useRepairTickets } from "@/hooks/useRepairTickets";
import { PageSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Views } from "react-big-calendar";

import RecentActivityList from "@/components/dashboard/RecentActivityList";
import CalendarSection from "@/components/dashboard/CalendarSection";
import BookingDetailsModal from "@/components/BookingDetailsModal";
import PhotographyJobModal from "@/components/PhotographyJobModal";
import ReportIssueModal from "@/components/ReportIssueModal";
import PhotoGalleryList from "@/components/dashboard/PhotoGalleryList";
import RepairRingsCard from "@/components/dashboard/RepairRingsCard";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "สวัสดีตอนเช้า";
    if (h < 17) return "สวัสดีตอนบ่าย";
    return "สวัสดีตอนเย็น";
}

function getThaiDate() {
    return new Date().toLocaleDateString("th-TH", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
}

function getTime() {
    return new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: number | string;
    icon: React.ElementType;
    trend?: { value: string; up: boolean };
    loading?: boolean;
}

function StatCard({ label, value, icon: Icon, trend, loading }: StatCardProps) {
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                    <Icon size={16} className="text-gray-500 dark:text-gray-400" />
                </div>
            </div>
            {loading ? (
                <Skeleton className="h-8 w-16" />
            ) : (
                <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
            )}
            {trend && (
                <div className={`flex items-center gap-1 text-xs font-medium ${trend.up ? "text-emerald-600" : "text-red-500"}`}>
                    {trend.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    <span>{trend.value}</span>
                </div>
            )}
        </div>
    );
}

// ── Quick Action Card ─────────────────────────────────────────────────────────

function QuickActionCard({ icon: Icon, title, description, href, badge }: {
    icon: React.ElementType; title: string; description: string; href: string; badge?: number;
}) {
    return (
        <a href={href} className="group flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-400 dark:hover:border-gray-600 transition-all">
            <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors relative">
                <Icon size={18} className="text-gray-700 dark:text-gray-300" />
                {badge != null && badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{badge}</span>
                )}
            </div>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
                <p className="text-xs text-gray-400 truncate">{description}</p>
            </div>
            <ArrowUpRight size={14} className="ml-auto text-gray-300 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors flex-shrink-0" />
        </a>
    );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
            {action}
        </div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
    const { user, role, isPhotographer, loading, getDisplayName } = useAuth();
    const router = useRouter();
    const [now, setNow] = useState(getTime());

    const isReady = !!user && !loading;
    const { events, visibleEvents, view, setView, date, setDate, loading: eventsLoading } = useBookings({ filterApprovedOnly: true, includePhotographyJobs: true, enabled: isReady, realtime: false });
    const { activities, loading: activitiesLoading } = useActivityLogs({ filterRepairOnly: true, enabled: isReady, realtime: false });
    const { stats: repairStats, loading: statsLoading } = useRepairTickets({ enabled: isReady, fetchInventory: false, realtime: false });

    const [selectedEvent, setSelectedEvent] = useState<BookingEvent | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [photoJobs, setPhotoJobs] = useState<PhotographyJob[]>([]);
    const [photoJobsLoading, setPhotoJobsLoading] = useState(true);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [pendingPhotoJobsCount, setPendingPhotoJobsCount] = useState(0);
    const [facilityStats, setFacilityStats] = useState({ total: 0, pending: 0, inProgress: 0, completed: 0 });
    const [facilityLoading, setFacilityLoading] = useState(true);

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setNow(getTime()), 30000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (!isReady || !isPhotographer) return;
        const q = query(collection(db, "photography_jobs"), where("assigneeIds", "array-contains", user.uid), where("status", "==", "assigned"));
        getDocs(q).then(s => setPendingPhotoJobsCount(s.size));
    }, [user, isPhotographer, isReady]);

    useEffect(() => {
        if (!isReady) return;
        const q = query(collection(db, "photography_jobs"), where("status", "==", "completed"), orderBy("endTime", "desc"), limit(5));
        getDocs(q).then(s => {
            setPhotoJobs(s.docs.map(d => ({ id: d.id, ...d.data() } as PhotographyJob)));
            setPhotoJobsLoading(false);
        }).catch(() => setPhotoJobsLoading(false));
    }, [isReady]);

    // Fetch facility tickets stats
    useEffect(() => {
        if (!isReady) return;
        const q = query(collection(db, "facility_tickets"), limit(200));
        getDocs(q).then(snapshot => {
            const docs = snapshot.docs.map(d => d.data());
            setFacilityStats({
                total: docs.length,
                pending: docs.filter(d => d.status === 'pending').length,
                inProgress: docs.filter(d => d.status === 'in_progress' || d.status === 'waiting_parts').length,
                completed: docs.filter(d => d.status === 'completed').length,
            });
            setFacilityLoading(false);
        }).catch(() => setFacilityLoading(false));
    }, [isReady]);

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [user, loading, router]);

    if (loading || !user) return <PageSkeleton />;

    const todayActivities = events.filter(e => {
        const isToday = e.start.toDateString() === new Date().toDateString();
        if (e.eventType === 'photography') return isToday;
        return isToday && e.status === 'approved';
    }).length;

    const handleSelectEvent = (event: BookingEvent) => {
        setSelectedEvent(event);
        setIsDetailsModalOpen(true);
    };

    const handleTodayClick = () => {
        setView(Views.AGENDA);
        setDate(new Date());
        document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    const quickActions = [
        { icon: Wrench, title: "แจ้งซ่อม", description: "แจ้งปัญหาอุปกรณ์", href: "/repair" },
        { icon: CalendarIcon, title: "จองห้อง / คิว", description: "จองห้องหรือคิวช่างภาพ", href: "/booking" },
        { icon: Camera, title: "ภาพกิจกรรม", description: "ประมวลภาพกิจกรรม", href: "/gallery" },
        { icon: Video, title: "คลังวิดีโอ", description: "รวมวิดีโอกิจกรรม", href: "/video-gallery" },
        ...(isPhotographer ? [{ icon: Camera, title: "งานของฉัน", description: "ดูภาพรวมและประวัติงาน", href: "/my-work", badge: pendingPhotoJobsCount }] : []),
        ...(role === 'admin' ? [{ icon: Users, title: "ผู้ใช้งาน", description: "จัดการผู้ใช้ระบบ", href: "/admin/users" }] : []),
    ];

    return (
        <div className="space-y-6">

            {/* ── Page Header ── */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ภาพรวมระบบสารสนเทศงานโสตทัศนศึกษา</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <CalendarIcon size={14} />
                    <span>{getThaiDate()}</span>
                </div>
            </div>

            {/* ── Welcome Banner ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gray-900 dark:bg-gray-800 p-6 text-white">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/30 via-transparent to-transparent" />
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-sm text-white/60 mb-1">{getThaiDate()}</p>
                        <h2 className="text-xl font-bold">
                            {getGreeting()}, {getDisplayName().split(' ')[0] || 'User'} 👋
                        </h2>
                        <p className="text-white/60 text-sm mt-1">พร้อมทำงานแล้ววันนี้!</p>
                    </div>
                    <div className="text-right">
                        <p className="text-4xl font-bold tracking-tight">{now}</p>
                        <p className="text-white/50 text-xs mt-1">โรงเรียนเทศบาล 6 นครเชียงราย</p>
                    </div>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="งานซ่อมทั้งหมด"
                    value={repairStats?.total ?? 0}
                    icon={Wrench}
                    loading={statsLoading}
                />
                <StatCard
                    label="รอดำเนินการ"
                    value={repairStats?.pending ?? 0}
                    icon={AlertCircle}
                    loading={statsLoading}
                    trend={repairStats?.pending > 0 ? { value: "ต้องดำเนินการ", up: false } : undefined}
                />
                <StatCard
                    label="กำลังซ่อม"
                    value={repairStats?.inProgress ?? 0}
                    icon={Clock}
                    loading={statsLoading}
                />
                <StatCard
                    label="กิจกรรมวันนี้"
                    value={todayActivities}
                    icon={CalendarIcon}
                    loading={eventsLoading}
                    trend={todayActivities > 0 ? { value: `${todayActivities} รายการ`, up: true } : undefined}
                />
            </div>

            {/* ── Quick Actions + Recent Activity ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                {/* Quick Actions + Repair Rings */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    <div>
                        <SectionHeader title="เริ่มต้นใช้งาน" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {quickActions.map((a) => (
                                <QuickActionCard key={a.href} {...a} />
                            ))}
                        </div>
                    </div>
                    <RepairRingsCard
                        itStats={repairStats ?? { total: 0, pending: 0, inProgress: 0, completed: 0 }}
                        facilityStats={facilityStats}
                        loading={statsLoading || facilityLoading}
                    />
                </div>

                {/* Recent Activity */}
                <div className="lg:col-span-7 flex flex-col">
                    <SectionHeader
                        title="สถานะงานซ่อมล่าสุด"
                        action={
                            <a href="/repair" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                ดูทั้งหมด →
                            </a>
                        }
                    />
                    <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col">
                        {activitiesLoading ? (
                            <div className="space-y-3">
                                {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                            </div>
                        ) : (
                            <RecentActivityList activities={activities} />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Calendar + Gallery ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Calendar */}
                <div id="calendar-section" className="lg:col-span-8">
                    {eventsLoading ? (
                        <Skeleton className="h-[580px] w-full rounded-2xl" />
                    ) : (
                        <CalendarSection
                            events={visibleEvents}
                            view={view}
                            setView={setView}
                            date={date}
                            setDate={setDate}
                            onSelectEvent={handleSelectEvent}
                        />
                    )}
                </div>

                {/* Photo Gallery */}
                <div className="lg:col-span-4">
                    <SectionHeader
                        title="ภาพกิจกรรมล่าสุด"
                        action={
                            role === 'admin'
                                ? <button onClick={() => setIsJobModalOpen(true)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">มอบหมายงาน →</button>
                                : <a href="/gallery" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">ดูทั้งหมด →</a>
                        }
                    />
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                        {photoJobsLoading ? (
                            <div className="space-y-3">
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} className="flex gap-3">
                                        <Skeleton className="w-14 h-14 flex-shrink-0" rounded="lg" />
                                        <div className="flex-1 space-y-2 pt-1">
                                            <Skeleton className="h-3 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : photoJobs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                <Camera size={28} className="mb-2 opacity-40" />
                                <p className="text-sm">ยังไม่มีภาพกิจกรรม</p>
                            </div>
                        ) : (
                            <PhotoGalleryList photoJobs={photoJobs} />
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <ReportIssueModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />
            {isDetailsModalOpen && (
                <BookingDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} event={selectedEvent} />
            )}
            <PhotographyJobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} requesterId={user?.uid || ''} />
        </div>
    );
}
