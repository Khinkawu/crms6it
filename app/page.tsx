"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Sparkles, TrendingUp, Calendar as CalendarIcon,
    Wrench, Package, ChevronRight, Clock,
    AlertCircle, CheckCircle2, Timer, User
} from "lucide-react";

// Custom Hooks
import { useBookings, BookingEvent } from "../hooks/useBookings";
import { useActivityLogs } from "../hooks/useActivityLogs";

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
        href: string;
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
                            <Link
                                href={action.href}
                                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 tap-scale"
                            >
                                {action.label}
                                <ChevronRight size={14} />
                            </Link>
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
    href: string;
    gradient: string;
    delay: number;
}

function QuickAction({ icon: Icon, title, description, href, gradient, delay }: QuickActionProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay }}
        >
            <Link
                href={href}
                className="group block p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all tap-scale"
            >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg mb-3`}>
                    <Icon size={22} className="text-white" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {description}
                </p>
            </Link>
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
    const { user, role, loading } = useAuth();
    const router = useRouter();

    // Custom hooks for data fetching
    const { visibleEvents, view, setView, date, setDate, loading: eventsLoading } = useBookings();
    const { activities, loading: activitiesLoading } = useActivityLogs({ filterRepairOnly: true });

    // Modal state
    const [selectedEvent, setSelectedEvent] = useState<BookingEvent | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    // Greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "สวัสดีตอนเช้า";
        if (hour < 17) return "สวัสดีตอนบ่าย";
        return "สวัสดีตอนเย็น";
    };

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
    const todayActivities = activities.filter(a => {
        const actDate = a.timestamp?.toDate?.();
        if (!actDate) return false;
        const today = new Date();
        return actDate.toDateString() === today.toDateString();
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
                                {getGreeting()}, {user.displayName?.split(' ')[0] || "User"}! 👋
                            </h1>
                        </div>

                        {/* Quick Stats Pills */}
                        <div className="flex gap-2 flex-wrap">
                            <div className="bg-white/15 backdrop-blur-xl rounded-full px-4 py-2 border border-white/20 flex items-center gap-2">
                                <Timer size={14} className="text-white/70" />
                                <span className="text-sm font-medium text-white">{pendingBookings} รอการอนุมัติ</span>
                            </div>
                            <div className="bg-white/15 backdrop-blur-xl rounded-full px-4 py-2 border border-white/20 flex items-center gap-2">
                                <TrendingUp size={14} className="text-white/70" />
                                <span className="text-sm font-medium text-white">{todayActivities} กิจกรรมวันนี้</span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">

                {/* Quick Actions Widget (4 cols) */}
                <Widget
                    className="lg:col-span-4"
                    title="เริ่มต้นใช้งาน"
                    icon={Sparkles}
                >
                    <div className="grid grid-cols-2 gap-3">
                        <QuickAction
                            icon={Wrench}
                            title="แจ้งซ่อม"
                            description="แจ้งปัญหาอุปกรณ์"
                            href="/repair"
                            gradient="from-orange-500 to-red-500"
                            delay={0.1}
                        />
                        <QuickAction
                            icon={CalendarIcon}
                            title="จองห้อง"
                            description="จองห้องประชุม"
                            href="/booking"
                            gradient="from-blue-500 to-cyan-500"
                            delay={0.15}
                        />
                        {isAdmin && (
                            <>
                                <QuickAction
                                    icon={Package}
                                    title="อุปกรณ์"
                                    description="จัดการอุปกรณ์"
                                    href="/admin/inventory"
                                    gradient="from-violet-500 to-purple-500"
                                    delay={0.2}
                                />
                                <QuickAction
                                    icon={User}
                                    title="ผู้ใช้"
                                    description="จัดการผู้ใช้"
                                    href="/admin/users"
                                    gradient="from-emerald-500 to-teal-500"
                                    delay={0.25}
                                />
                            </>
                        )}
                    </div>
                </Widget>

                {/* Stats Widget (4 cols) */}
                <Widget
                    className="lg:col-span-4"
                    title="สถิติ"
                    icon={TrendingUp}
                >
                    <div className="space-y-3">
                        <StatCard
                            label="รอการอนุมัติ"
                            value={pendingBookings}
                            icon={AlertCircle}
                            color="bg-amber-500"
                        />
                        <StatCard
                            label="การจองที่อนุมัติแล้ว"
                            value={approvedBookings}
                            icon={CheckCircle2}
                            color="bg-emerald-500"
                        />
                        <StatCard
                            label="กิจกรรมวันนี้"
                            value={todayActivities}
                            icon={Clock}
                            color="bg-blue-500"
                        />
                    </div>
                </Widget>

                {/* Recent Activity Widget (4 cols) */}
                <Widget
                    className="lg:col-span-4"
                    title="กิจกรรมล่าสุด"
                    icon={Clock}
                    action={{ label: "ดูทั้งหมด", href: "/admin/repairs" }}
                >
                    <div className="space-y-2">
                        {activities.slice(0, 4).map((activity, index) => (
                            <motion.div
                                key={activity.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-start gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                            >
                                <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                                        {activity.description || activity.action}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {activity.timestamp?.toDate?.()?.toLocaleTimeString('th-TH', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                        {activities.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-4">
                                ยังไม่มีกิจกรรม
                            </p>
                        )}
                    </div>
                </Widget>

                {/* Calendar Widget (Full width) */}
                <div className="lg:col-span-12">
                    <LazyCalendarSection
                        events={visibleEvents}
                        view={view}
                        setView={setView}
                        date={date}
                        setDate={setDate}
                        onSelectEvent={handleSelectEvent}
                    />
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
        </div>
    );
}