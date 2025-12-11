"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { Zap, Lightbulb } from "lucide-react";

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

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/20 text-white p-8 md:p-10">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-2">
                            สวัสดี, {user.displayName?.split(' ')[0] || "User"}! 👋
                        </h1>
                        <p className="text-white/90 text-lg font-medium opacity-90">
                            {today}
                        </p>
                    </div>
                </div>

                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/5 rounded-full blur-2xl"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                <div className="space-y-8">
                    {/* Quick Actions */}
                    <QuickActions role={role} />

                    {/* Tips */}
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                <Lightbulb className="w-5 h-5" /> ทริกการใช้งาน
                            </h3>
                            <p className="text-white/90 text-sm leading-relaxed">
                                คุณสามารถเชื่อมต่อ Line ได้ที่หน้า Profile เพื่อให้ได้รับข้อมูลแจ้งเตือนอัตโนมัติ
                            </p>
                        </div>
                        <div className="absolute -bottom-4 -right-4 opacity-10">
                            <Zap size={100} />
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