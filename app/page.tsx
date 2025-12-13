"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { Lightbulb, Sparkles, TrendingUp, Calendar as CalendarIcon } from "lucide-react";

// Custom Hooks
import { useBookings, BookingEvent } from "../hooks/useBookings";
import { useActivityLogs } from "../hooks/useActivityLogs";

// Lazy-loaded Components for better performance
import {
    LazyCalendarSection,
    LazyActivityFeed,
    LazyBookingDetailsModal
} from "./components/LazyComponents";
import QuickActions from "./components/dashboard/QuickActions";
import { PageSkeleton } from "./components/ui/Skeleton";

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

    // Show skeleton while auth is loading
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

    // Stats for the hero section
    const pendingBookings = visibleEvents.filter(e => e.status === 'pending').length;
    const todayActivities = activities.filter(a => {
        const actDate = a.timestamp?.toDate?.();
        if (!actDate) return false;
        const today = new Date();
        return actDate.toDateString() === today.toDateString();
    }).length;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Hero Section - Premium Glassmorphism */}
            <div className="relative overflow-hidden rounded-3xl">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400"></div>

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-300/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>
                <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>

                {/* Content */}
                <div className="relative z-10 p-6 md:p-8">
                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                        {/* Left: Greeting */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
                                <Sparkles size={16} />
                                <span>{today}</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
                                {getGreeting()}, {user.displayName?.split(' ')[0] || "User"}! 👋
                            </h1>
                            <p className="text-white/80 text-sm md:text-base max-w-md">
                                ยินดีต้อนรับกลับมา ระบบพร้อมให้บริการแล้วครับ
                            </p>
                        </div>

                        {/* Right: Quick Stats */}
                        <div className="flex gap-3 flex-wrap">
                            <div className="bg-white/15 backdrop-blur-xl rounded-2xl px-5 py-4 border border-white/20 min-w-[140px]">
                                <div className="flex items-center gap-2 text-white/70 text-xs font-medium mb-1">
                                    <CalendarIcon size={14} />
                                    รอการอนุมัติ
                                </div>
                                <p className="text-2xl font-bold text-white">{pendingBookings}</p>
                            </div>
                            <div className="bg-white/15 backdrop-blur-xl rounded-2xl px-5 py-4 border border-white/20 min-w-[140px]">
                                <div className="flex items-center gap-2 text-white/70 text-xs font-medium mb-1">
                                    <TrendingUp size={14} />
                                    กิจกรรมวันนี้
                                </div>
                                <p className="text-2xl font-bold text-white">{todayActivities}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Calendar (Takes 2 cols) - Lazy Loaded */}
                <LazyCalendarSection
                    events={visibleEvents}
                    view={view}
                    setView={setView}
                    date={date}
                    setDate={setDate}
                    onSelectEvent={handleSelectEvent}
                />

                {/* Right Column: Quick Actions & Tips */}
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <QuickActions role={role} />

                    {/* Tips Card - Premium Design */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 rounded-3xl p-5 text-white shadow-xl shadow-purple-500/20">
                        {/* Decorative */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <Lightbulb size={18} />
                                </div>
                                <h3 className="font-bold">เคล็ดลับ</h3>
                            </div>
                            <p className="text-white/90 text-sm leading-relaxed">
                                เชื่อมต่อบัญชี LINE ที่หน้าโปรไฟล์ เพื่อรับการแจ้งเตือนอัตโนมัติเมื่อมีการอัปเดตสถานะงานซ่อม
                            </p>
                            <button
                                onClick={() => router.push('/profile')}
                                className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-sm font-medium transition-colors tap-scale"
                            >
                                ไปที่โปรไฟล์ →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity (Full Width) - Lazy Loaded */}
            <LazyActivityFeed activities={activities} />

            {/* Booking Details Modal - Lazy Loaded */}
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