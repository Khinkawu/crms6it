"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    Wrench, Calendar as CalendarIcon, Camera, Video,
    Users, ArrowUpRight, UserCircle, AlertCircle, BarChart2,
} from "lucide-react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PhotographyJob } from "@/types";

import { NotificationInbox } from "@/components/NotificationInbox";
import { useBookings, BookingEvent } from "@/hooks/useBookings";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { useRepairTickets } from "@/hooks/useRepairTickets";
import { PageSkeleton, Skeleton } from "@/components/ui/Skeleton";


import RecentActivityList from "@/components/dashboard/RecentActivityList";
import CalendarSection from "@/components/dashboard/CalendarSection";
import BookingDetailsModal from "@/components/BookingDetailsModal";
import PhotographyJobModal from "@/components/PhotographyJobModal";
import ReportIssueModal from "@/components/ReportIssueModal";
import PhotoGalleryList from "@/components/dashboard/PhotoGalleryList";
import RepairRingsCard from "@/components/dashboard/RepairRingsCard";
import StaffMiniCard from "@/components/TeamStatus/StaffMiniCard";
import { useStaffStatus } from "@/hooks/useStaffStatus";
import Image from "next/image";
import {
    AVAILABILITY_COLOR,
    AVAILABILITY_PRO_LABEL,
    type StaffStatus,
} from "@/types/staffStatus";

const STATUS_RING: Record<string, string> = {
    available: 'ring-emerald-500',
    busy:      'ring-amber-500',
    away:      'ring-sky-500',
    day_off:   'ring-red-500',
    leave:     'ring-red-500',
}

function StaffAvatarBubble({ staff, priority }: { staff: StaffStatus; priority?: boolean }) {
    const ring  = STATUS_RING[staff.availability] ?? 'ring-gray-300'
    const dot   = AVAILABILITY_COLOR[staff.availability]
    const label = AVAILABILITY_PRO_LABEL[staff.availability]
    const firstName = staff.displayName.split(' ')[0]

    return (
        <a href="/team-status" className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="relative">
                {staff.photoURL ? (
                    /* ring อยู่ที่ outer, overflow-hidden อยู่ที่ inner — ไม่ clip กัน */
                    <div className={`w-14 h-14 rounded-full ring-[3px] ring-offset-2 ring-offset-white dark:ring-offset-gray-950 ${ring}`}>
                        <div className="w-full h-full rounded-full overflow-hidden">
                            <Image
                                src={staff.photoURL}
                                alt={staff.displayName}
                                width={56}
                                height={56}
                                className="w-full h-full object-cover"
                                unoptimized
                                priority={priority}
                            />
                        </div>
                    </div>
                ) : (
                    <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl ring-[3px] ring-offset-2 ring-offset-white dark:ring-offset-gray-950 ${ring}`}>
                        {staff.displayName.charAt(0).toUpperCase()}
                    </div>
                )}
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-950 ${dot}`} />
            </div>
            <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
            </div>
        </a>
    )
}

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

// ── Quick Action Card ─────────────────────────────────────────────────────────

function QuickActionCard({ icon: Icon, title, description, href, badge, onClick }: {
    icon: React.ElementType; title: string; description: string; href?: string; badge?: number; onClick?: () => void;
}) {
    const cls = "group flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-gray-400 dark:hover:border-gray-600 transition-all cursor-pointer text-left w-full";
    const inner = (
        <>
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
        </>
    );
    if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>;
    return <a href={href} className={cls}>{inner}</a>;
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
    const { visibleEvents, view, setView, date, setDate, loading: eventsLoading } = useBookings({ filterApprovedOnly: true, includePhotographyJobs: true, enabled: isReady, realtime: false });
    const { activities, loading: activitiesLoading } = useActivityLogs({ filterRepairOnly: true, enabled: isReady, realtime: false });
    const { stats: repairStats, loading: statsLoading } = useRepairTickets({ enabled: isReady, fetchInventory: false, realtime: false });
    const { staff: allStaff, loading: staffLoading } = useStaffStatus(isReady);
    const teamStaff = allStaff.filter(m => m.role !== 'admin');

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

    const handleSelectEvent = (event: BookingEvent) => {
        setSelectedEvent(event);
        setIsDetailsModalOpen(true);
    };

    const isAdminRole = role === 'admin' || role === 'moderator';
    const quickActions = [
        ...(!isAdminRole ? [{ icon: Wrench, title: "แจ้งซ่อม", description: "แจ้งปัญหาอุปกรณ์", href: "/repair" }] : []),
        ...(!isAdminRole ? [{ icon: CalendarIcon, title: "จองห้อง / คิว", description: "จองห้องหรือคิวช่างภาพ", href: "/booking" }] : []),
        { icon: Camera, title: "ภาพกิจกรรม", description: "ประมวลภาพกิจกรรม", href: "/gallery" },
        ...(!isAdminRole ? [{ icon: Video, title: "คลังวิดีโอ", description: "รวมวิดีโอกิจกรรม", href: "/video-gallery" }] : []),
        ...(isAdminRole ? [{ icon: CalendarIcon, title: "จัดการการจอง", description: "อนุมัติและติดตามการจอง", href: "/admin/bookings" }] : []),
        { icon: UserCircle, title: "โปรไฟล์", description: "ข้อมูลและการตั้งค่าบัญชี", href: "/profile" },
        ...(!isAdminRole ? [{ icon: AlertCircle, title: "แจ้งปัญหา", description: "รายงานปัญหาการใช้งาน", onClick: () => setIsReportModalOpen(true) }] : []),
        ...(isPhotographer ? [{ icon: Camera, title: "งานของฉัน", description: "ดูภาพรวมและประวัติงาน", href: "/my-work", badge: pendingPhotoJobsCount }] : []),
        ...(role === 'admin' ? [{ icon: BarChart2, title: "Analytics", description: "สถิติและภาพรวมระบบ", href: "/admin/analytics" }] : []),
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
                <div className="flex items-center gap-2">
                    <div className="md:hidden">
                        <NotificationInbox />
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <CalendarIcon size={14} />
                        <span>{getThaiDate()}</span>
                    </div>
                </div>
            </div>

            {/* ── Welcome Banner ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gray-900 dark:bg-gray-800 p-6 text-white">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/30 via-transparent to-transparent" />
                <div className="relative flex flex-row items-center justify-between gap-4">
                    <div>
                        <p className="text-xs text-white/60 mb-0.5">{getThaiDate()}</p>
                        <h2 className="text-lg sm:text-xl font-bold">
                            {getGreeting()}, {getDisplayName().split(' ')[0] || 'User'} 👋
                        </h2>
                        <p className="text-white/60 text-xs sm:text-sm mt-0.5">พร้อมทำงานแล้ววันนี้!</p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-3xl sm:text-4xl font-bold tracking-tight">{now}</p>
                        <p className="text-white/50 text-xs mt-0.5">โรงเรียนเทศบาล 6 นครเชียงราย</p>
                    </div>
                </div>
            </div>

            {/* ── Team Status Row ── */}
            <div>
                <SectionHeader
                    title="สถานะทีมโสตฯ"
                    action={
                        <a href="/team-status" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            ดูทั้งหมด →
                        </a>
                    }
                />
                {staffLoading ? (
                    <>
                        {/* Mobile skeleton */}
                        <div className="sm:hidden flex gap-4 overflow-x-auto pb-1 justify-center">
                            {[0, 1, 2, 3, 4].map(i => (
                                <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                    <Skeleton className="w-14 h-14 rounded-full" />
                                    <Skeleton className="h-2.5 w-10 rounded" />
                                </div>
                            ))}
                        </div>
                        {/* Desktop skeleton */}
                        <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
                        </div>
                    </>
                ) : teamStaff.length === 0 ? (
                    <div className="text-center py-6 text-sm text-gray-400">ยังไม่มีข้อมูลทีม</div>
                ) : (
                    <>
                        {/* Mobile — avatar bubbles แถวเดียว */}
                        <div className="sm:hidden flex gap-5 overflow-x-auto py-2 scrollbar-none justify-center">
                            {teamStaff.map((member, i) => (
                                <StaffAvatarBubble key={member.uid} staff={member} priority={i < 6} />
                            ))}
                        </div>
                        {/* Desktop/Tablet — card grid */}
                        <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {teamStaff.map((member, i) => (
                                <StaffMiniCard key={member.uid} staff={member} priority={i < 5} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ── Quick Actions + Calendar ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                {/* Quick Actions + Repair Rings */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    <div>
                        <SectionHeader title="เริ่มต้นใช้งาน" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {quickActions.map((a) => (
                                <QuickActionCard key={a.title} {...a} />
                            ))}
                        </div>
                    </div>
                    <RepairRingsCard
                        itStats={repairStats ?? { total: 0, pending: 0, inProgress: 0, completed: 0 }}
                        facilityStats={facilityStats}
                        loading={statsLoading || facilityLoading}
                    />
                </div>

                {/* Calendar */}
                <div id="calendar-section" className="lg:col-span-7 flex flex-col">
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
            </div>

            {/* ── Recent Activity + Gallery ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Recent Activity */}
                <div className="lg:col-span-8 flex flex-col">
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
