"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Sparkles, TrendingUp, Calendar as CalendarIcon,
    Wrench, Package, ChevronRight, Clock,
    AlertCircle, CheckCircle2, Timer, User, ClipboardList, Users,
    Camera, Image as ImageIcon, ExternalLink, Plus, Check
} from "lucide-react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { PhotographyJob } from "../types";
import PhotographyJobModal from "./components/PhotographyJobModal";

// Custom Hooks
import { useBookings, BookingEvent } from "../hooks/useBookings";
import { useActivityLogs } from "../hooks/useActivityLogs";
import ReportIssueModal from "./components/ReportIssueModal";

import MyPhotographyJobsModal from "./components/MyPhotographyJobsModal";
import { useRepairTickets } from "../hooks/useRepairTickets";
import { Views } from "react-big-calendar";

// Components
import {
    LazyCalendarSection,
    LazyBookingDetailsModal
} from "./components/LazyComponents";
import { PageSkeleton } from "./components/ui/Skeleton";
import Link from "next/link";

// Widget Component
interface WidgetProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    icon?: React.ElementType;
    action?: {
        label: string;
        href?: string;
        action?: () => void;
    };
    gradient?: string;
}

function Widget({ children, className = "", title, icon: Icon, action, gradient }: WidgetProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg shadow-gray-200/20 dark:shadow-none ${className}`}
        >
            {gradient && (
                <div className={`absolute inset-0 opacity-5 ${gradient}`} />
            )}
            <div className="relative z-10 h-full flex flex-col">
                {(title || action) && (
                    <div className="flex items-center justify-between p-5 pb-3">
                        <div className="flex items-center gap-2">
                            {Icon && (
                                <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700/50">
                                    <Icon size={18} className="text-gray-600 dark:text-gray-300" />
                                </div>
                            )}
                            {title && (
                                <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                            )}
                        </div>
                        {action && (
                            typeof action.action === 'function' ? (
                                <button
                                    onClick={action.action}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 tap-scale"
                                >
                                    {action.label}
                                    <Plus size={14} />
                                </button>
                            ) : (
                                <Link
                                    href={action.href!}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 tap-scale"
                                >
                                    {action.label}
                                    <ChevronRight size={14} />
                                </Link>
                            )
                        )}
                    </div>
                )}
                <div className="flex-1 px-5 pb-5">
                    {children}
                </div>
            </div>
        </motion.div>
    );
}

// Quick Action Card
interface QuickActionProps {
    icon: React.ElementType;
    title: string;
    description: string;
    href?: string;
    onClick?: () => void;
    gradient: string;
    delay: number;
    badge?: number; // Optional badge count
}

function QuickAction({ icon: Icon, title, description, href, onClick, gradient, delay, badge }: QuickActionProps) {
    const content = (
        <>
            <div className="relative inline-flex">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg mb-3`}>
                    <Icon size={22} className="text-white" />
                </div>
                {badge !== undefined && badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                {description}
            </p>
        </>
    );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay }}
        >
            {href ? (
                <Link
                    href={href}
                    className="group block p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all tap-scale"
                >
                    {content}
                </Link>
            ) : (
                <button
                    onClick={onClick}
                    className="group w-full text-left block p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all tap-scale"
                >
                    {content}
                </button>
            )}
        </motion.div>
    );
}

// Stats Mini Card
interface StatCardProps {
    label: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    trend?: string;
}

function StatCard({ label, value, icon: Icon, color, trend }: StatCardProps) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/30">
            <div className={`p-2.5 rounded-xl ${color}`}>
                <Icon size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
            {trend && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                    {trend}
                </span>
            )}
        </div>
    );
}

export default function Dashboard() {
    const { user, role, isPhotographer, loading, getDisplayName } = useAuth();
    const router = useRouter();

    // Custom hooks for data fetching
    const { visibleEvents, view, setView, date, setDate, loading: eventsLoading } = useBookings({ filterApprovedOnly: true });
    const { activities, loading: activitiesLoading } = useActivityLogs({ filterRepairOnly: true });
    const { stats: repairStats } = useRepairTickets();

    // Modal state
    const [historyType, setHistoryType] = useState<'repair' | 'booking' | 'borrow' | 'requisition'>('repair');
    const [selectedEvent, setSelectedEvent] = useState<BookingEvent | null>(null);

    // Photography Jobs State
    const [photoJobs, setPhotoJobs] = useState<PhotographyJob[]>([]);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [isMyJobsModalOpen, setIsMyJobsModalOpen] = useState(false);
    const [pendingPhotoJobsCount, setPendingPhotoJobsCount] = useState(0);

    // Fetch pending photography jobs count for photographer
    useEffect(() => {
        if (!user || !isPhotographer) return;

        const q = query(
            collection(db, "photography_jobs"),
            where("assigneeIds", "array-contains", user.uid),
            where("status", "==", "assigned")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const count = snapshot.size;
            setPendingPhotoJobsCount(count);

            // Update PWA app badge for supported platforms (Chrome, Edge on Windows/macOS/Android)
            if ('setAppBadge' in navigator) {
                if (count > 0) {
                    (navigator as any).setAppBadge(count).catch(() => { });
                } else {
                    (navigator as any).clearAppBadge().catch(() => { });
                }
            }
        });

        return () => unsubscribe();
    }, [user, isPhotographer]);

    // Fetch Completed Photography Jobs
    useEffect(() => {
        const q = query(
            collection(db, "photography_jobs"),
            where("status", "==", "completed"),
            orderBy("endTime", "desc"),
            limit(4)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const jobs: PhotographyJob[] = [];
            snapshot.forEach((doc) => {
                jobs.push({ id: doc.id, ...doc.data() } as PhotographyJob);
            });
            setPhotoJobs(jobs);
        });

        return () => unsubscribe();
    }, []);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    // Greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "สวัสดีตอนเช้า";
        if (hour < 17) return "สวัสดีตอนบ่าย";
        return "สวัสดีตอนเย็น";
    };
    // State for Report Issue Modal
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // Initial load
    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
            return;
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return <PageSkeleton />;
    }

    const today = new Date().toLocaleDateString('th-TH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const handleSelectEvent = (event: BookingEvent) => {
        setSelectedEvent(event);
        setIsDetailsModalOpen(true);
    };

    // Stats calculations
    const pendingBookings = visibleEvents.filter(e => e.status === 'pending').length;
    const approvedBookings = visibleEvents.filter(e => e.status === 'approved').length;
    const todayActivities = visibleEvents.filter(e => {
        const today = new Date();
        return e.start.toDateString() === today.toDateString() && e.status === 'approved';
    }).length;

    const isAdmin = role === 'admin' || role === 'moderator' || role === 'technician';

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Hero Section - Compact */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-300/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

                <div className="relative z-10 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                                <Sparkles size={14} />
                                <span>{today}</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">
                                {getGreeting()}, {getDisplayName().split(' ')[0] || "User"}! 👋
                            </h1>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">

                {/* Quick Actions Widget (4 cols) */}
                <Widget
                    className="lg:col-span-4 h-full"
                    title="เริ่มต้นใช้งาน"
                    icon={Sparkles}
                >
                    <div className="grid grid-cols-2 gap-3">
                        {/* แจ้งซ่อม - Everyone */}
                        <QuickAction
                            icon={Wrench}
                            title="แจ้งซ่อม"
                            description="แจ้งปัญหาอุปกรณ์"
                            href="/repair"
                            gradient="from-orange-500 to-red-500"
                            delay={0.1}
                        />
                        {/* จองห้อง - Everyone */}
                        <QuickAction
                            icon={CalendarIcon}
                            title="จองห้อง"
                            description="จองห้องประชุม"
                            href="/booking"
                            gradient="from-blue-500 to-cyan-500"
                            delay={0.15}
                        />
                        {/* ประมวลภาพกิจกรรม - Everyone */}
                        <QuickAction
                            icon={Camera}
                            title="ภาพกิจกรรม"
                            description="ประมวลภาพกิจกรรม"
                            href="/gallery"
                            gradient="from-amber-500 to-yellow-500"
                            delay={0.2}
                        />
                        {/* จัดการงานซ่อม - admin, moderator */}
                        {(role === 'admin' || role === 'moderator') && (
                            <QuickAction
                                icon={ClipboardList}
                                title="จัดการซ่อม"
                                description="จัดการงานซ่อม"
                                href="/admin/repairs"
                                gradient="from-amber-500 to-orange-500"
                                delay={0.2}
                            />
                        )}
                        {/* Booking Management - Admin Only */}
                        {(role === 'admin' || role === 'moderator') && (
                            <QuickAction
                                icon={CalendarIcon}
                                title="จัดการการจอง"
                                description="จัดการการจอง"
                                href="/admin/bookings"
                                gradient="from-rose-500 to-pink-600"
                                delay={0.3}
                            />
                        )}

                        {/* งานของฉัน - Only for users with isPhotographer flag */}
                        {isPhotographer && (
                            <QuickAction
                                icon={Camera}
                                title="งานของฉัน"
                                description="ดูภาพรวมและประวัติงาน"
                                href="/my-work"
                                gradient="from-indigo-500 to-purple-600"
                                delay={0.35}
                                badge={pendingPhotoJobsCount}
                            />
                        )}
                        {/* อุปกรณ์ - admin or photographer */}
                        {(role === 'admin' || role === 'technician' || isPhotographer) && (
                            <QuickAction
                                icon={Package}
                                title="อุปกรณ์"
                                description="จัดการอุปกรณ์"
                                href="/admin/inventory"
                                gradient="from-violet-500 to-purple-500"
                                delay={0.3}
                            />
                        )}
                        {/* ผู้ใช้งาน - admin only */}
                        {role === 'admin' && (
                            <QuickAction
                                icon={Users}
                                title="ผู้ใช้งาน"
                                description="จัดการผู้ใช้"
                                href="/admin/users"
                                gradient="from-emerald-500 to-teal-500"
                                delay={0.35}
                            />
                        )}
                        {/* Report Issue - Non-Admin Users */}
                        {role !== 'admin' && (
                            <QuickAction
                                icon={AlertCircle}
                                title="แจ้งปัญหา"
                                description="แจ้งปัญหาการใช้งาน"
                                onClick={() => setIsReportModalOpen(true)}
                                gradient="from-gray-500 to-slate-600"
                                delay={0.3}
                            />
                        )}
                    </div>
                </Widget>

                {/* Report Issue Modal */}
                <ReportIssueModal
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                />

                {/* Stats Widget (4 cols) */}
                <Widget
                    className="lg:col-span-4 h-full"
                    title="การจองห้องประชุมประจำวัน"
                    icon={TrendingUp}
                >
                    <div className="space-y-4">
                        {/* Today Activities - clickable */}
                        <button
                            onClick={() => {
                                setView(Views.AGENDA);
                                setDate(new Date());
                                document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-xl transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                                    <CalendarIcon size={18} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-sm text-gray-600 dark:text-gray-300">กิจกรรมวันนี้</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{todayActivities}</span>
                                <ChevronRight size={16} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>

                        {/* Divider */}
                        <div className="h-px bg-gray-100 dark:bg-gray-700" />

                        {/* Repair Stats Header */}
                        <div className="px-1 pt-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">สถิติงานซ่อม</h3>
                        </div>

                        {/* Ring Charts for Repairs */}
                        <div className="flex justify-between items-center pb-4 px-2">
                            {/* Total Repairs Ring */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="relative w-24 h-24">
                                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
                                        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3"
                                            className="text-amber-500"
                                            strokeDasharray={`${repairStats.total > 0 ? 88 : 0} 88`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{repairStats.total}</span>
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">ทั้งหมด</span>
                            </div>

                            {/* Pending Repairs Ring */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="relative w-24 h-24">
                                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
                                        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3"
                                            className="text-blue-500"
                                            strokeDasharray={`${repairStats.total > 0 ? ((repairStats.pending + repairStats.inProgress) / repairStats.total) * 88 : 0} 88`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{repairStats.pending + repairStats.inProgress}</span>
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">กำลังซ่อม</span>
                            </div>

                            {/* Completed Repairs Ring */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="relative w-24 h-24">
                                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
                                        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3"
                                            className="text-emerald-500"
                                            strokeDasharray={`${repairStats.total > 0 ? (repairStats.completed / repairStats.total) * 88 : 0} 88`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{repairStats.completed}</span>
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">เสร็จสิ้น</span>
                            </div>
                        </div>
                    </div>
                </Widget>

                {/* Recent Activity Widget (4 cols) */}
                <Widget
                    className="lg:col-span-4 h-full"
                    title="สถานะการแจ้งซ่อมล่าสุด"
                    icon={Clock}
                >
                    <div className="space-y-3">
                        {activities.slice(0, 3).map((activity, index) => {
                            // Helper to translate zone
                            const getZoneThai = (zone: string) => {
                                switch (zone) {
                                    case 'senior_high': return 'ม.ปลาย';
                                    case 'junior_high': return 'ม.ต้น';
                                    case 'common': return 'ส่วนกลาง';
                                    case 'elementary': return 'ประถม';
                                    case 'kindergarten': return 'อนุบาล';
                                    case 'auditorium': return 'หอประชุม';
                                    default: return zone || '';
                                }
                            };

                            // Helper for status badge
                            const getStatusBadge = (status: string) => {
                                switch (status) {
                                    case 'pending': return { text: 'รอดำเนินการ', color: 'bg-amber-100 text-amber-700' };
                                    case 'in_progress': return { text: 'กำลังดำเนินการ', color: 'bg-blue-100 text-blue-700' };
                                    case 'waiting_parts': return { text: 'รออะไหล่', color: 'bg-purple-100 text-purple-700' };
                                    case 'completed': return { text: 'เสร็จสิ้น', color: 'bg-emerald-100 text-emerald-700' };
                                    default: return { text: 'ใหม่', color: 'bg-orange-100 text-orange-700' };
                                }
                            };

                            const status = getStatusBadge(activity.status || '');
                            const roomNumber = activity.productName || '-';
                            const zoneThai = getZoneThai(activity.zone || '');

                            return (
                                <motion.div
                                    key={activity.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    {/* Header: Status + Time */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                                            {status.text}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {activity.timestamp?.toDate?.()?.toLocaleTimeString('th-TH', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {/* Location */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            ห้อง {roomNumber}
                                        </span>
                                        {zoneThai && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                                                {zoneThai}
                                            </span>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">
                                        {activity.details || 'แจ้งซ่อม'}
                                    </p>

                                    {/* Reporter */}
                                    {activity.userName && (
                                        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                                            <User size={12} />
                                            {activity.userName}
                                        </p>
                                    )}
                                </motion.div>
                            );
                        })}
                        {activities.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-6">
                                ยังไม่มีกิจกรรม
                            </p>
                        )}
                    </div>
                </Widget>

                {/* Calendar Widget (Full width) */}
                {/* Split Section: Calendar (8) + Gallery (4) */}
                <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Calendar - Left Side */}
                    <div id="calendar-section" className="lg:col-span-8">
                        <LazyCalendarSection
                            events={visibleEvents}
                            view={view}
                            setView={setView}
                            date={date}
                            setDate={setDate}
                            onSelectEvent={handleSelectEvent}
                        />
                    </div>

                    {/* Gallery - Right Side */}
                    <div className="lg:col-span-4 space-y-6">
                        <Widget
                            title="ภาพกิจกรรมล่าสุด"
                            icon={ImageIcon}
                            className="h-full"
                            action={role === 'admin' ? {
                                label: "มอบหมายงาน",
                                action: () => setIsJobModalOpen(true)
                            } : {
                                label: "ดูทั้งหมด",
                                href: "/gallery"
                            }}
                        >
                            {photoJobs.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <Camera size={40} className="mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">ยังไม่มีภาพกิจกรรม</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-1">
                                    {photoJobs.slice(0, 5).map((job) => (
                                        <div
                                            key={job.id}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                                        >
                                            {/* Thumbnail */}
                                            <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                                                {job.coverImage ? (
                                                    <img
                                                        src={job.coverImage}
                                                        alt={job.title}
                                                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <ImageIcon className="text-gray-400" size={20} />
                                                    </div>
                                                )}
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-sm text-gray-900 dark:text-white transition-colors truncate">
                                                    {job.title}
                                                </h4>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    <CalendarIcon size={11} />
                                                    <span>{job.endTime?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            {/* Action Icons */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {job.driveLink && (
                                                    <a
                                                        href={job.driveLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="เปิด Google Drive"
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <img src="/Google_Drive_icon.png" alt="Drive" className="w-5 h-5 object-contain" />
                                                    </a>
                                                )}
                                                {job.facebookPostId && (
                                                    <a
                                                        href={`https://www.facebook.com/${job.facebookPostId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="เปิดโพส Facebook"
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <img src="/facebook-logo.png" alt="Facebook" className="w-5 h-5 object-contain" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Widget>
                    </div>
                </div>
            </div>

            {/* Booking Details Modal */}
            {isDetailsModalOpen && (
                <LazyBookingDetailsModal
                    isOpen={isDetailsModalOpen}
                    onClose={() => setIsDetailsModalOpen(false)}
                    event={selectedEvent}
                />
            )}

            {/* Photography Job Creation Modal */}
            <PhotographyJobModal
                isOpen={isJobModalOpen}
                onClose={() => setIsJobModalOpen(false)}
                requesterId={user?.uid || ''}
            />

            {/* My Photography Jobs Modal */}
            <MyPhotographyJobsModal
                isOpen={isMyJobsModalOpen}
                onClose={() => setIsMyJobsModalOpen(false)}
                userId={user?.uid || ''}
            />
        </div>
    );
}