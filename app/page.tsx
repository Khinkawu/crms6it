"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import {
    Sparkles, TrendingUp, Calendar as CalendarIcon,
    Wrench, Package, Clock,
    AlertCircle, Users, Camera, Image as ImageIcon
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

// Dashboard Components
import { Widget, QuickAction } from "./components/dashboard/widgets";
import HeroSection from "./components/dashboard/HeroSection";
import RecentActivityList from "./components/dashboard/RecentActivityList";
import StatsWidgetContent from "./components/dashboard/StatsWidgetContent";
import PhotoGalleryList from "./components/dashboard/PhotoGalleryList";

// Lazy Components
import {
    LazyCalendarSection,
    LazyBookingDetailsModal
} from "./components/LazyComponents";
import { PageSkeleton } from "./components/ui/Skeleton";

export default function Dashboard() {
    const { user, role, isPhotographer, loading, getDisplayName } = useAuth();
    const router = useRouter();

    // Custom hooks for data fetching
    const { visibleEvents, view, setView, date, setDate, loading: eventsLoading } = useBookings({ filterApprovedOnly: true, includePhotographyJobs: true });
    const { activities, loading: activitiesLoading } = useActivityLogs({ filterRepairOnly: true });
    const { stats: repairStats } = useRepairTickets();

    // Modal state
    const [selectedEvent, setSelectedEvent] = useState<BookingEvent | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

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

    const handleSelectEvent = (event: BookingEvent) => {
        setSelectedEvent(event);
        setIsDetailsModalOpen(true);
    };

    const handleTodayClick = () => {
        setView(Views.AGENDA);
        setDate(new Date());
        document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    // Stats calculations
    const todayActivities = visibleEvents.filter(e => {
        const today = new Date();
        return e.start.toDateString() === today.toDateString() && e.status === 'approved';
    }).length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Hero Section */}
            <HeroSection displayName={getDisplayName()} />

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">

                {/* Quick Actions Widget */}
                <Widget className="lg:col-span-4 h-full" title="เริ่มต้นใช้งาน" icon={Sparkles}>
                    <div className="grid grid-cols-2 gap-3">
                        <QuickAction icon={Wrench} title="แจ้งซ่อม" description="แจ้งปัญหาอุปกรณ์" href="/repair" gradient="from-orange-500 to-red-500" delay={0.1} />
                        <QuickAction icon={CalendarIcon} title="จองห้อง" description="จองห้องประชุม" href="/booking" gradient="from-blue-500 to-cyan-500" delay={0.15} />
                        <QuickAction icon={Camera} title="ภาพกิจกรรม" description="ประมวลภาพกิจกรรม" href="/gallery" gradient="from-amber-500 to-yellow-500" delay={0.2} />

                        {(role === 'admin' || role === 'moderator') && (
                            <>
                                <QuickAction icon={Wrench} title="จัดการซ่อม" description="จัดการงานซ่อม" href="/admin/repairs" gradient="from-amber-500 to-orange-500" delay={0.2} />
                                <QuickAction icon={CalendarIcon} title="จัดการการจอง" description="จัดการการจอง" href="/admin/bookings" gradient="from-rose-500 to-pink-600" delay={0.3} />
                            </>
                        )}

                        {isPhotographer && (
                            <QuickAction icon={Camera} title="งานของฉัน" description="ดูภาพรวมและประวัติงาน" href="/my-work" gradient="from-indigo-500 to-purple-600" delay={0.35} badge={pendingPhotoJobsCount} />
                        )}

                        {(role === 'admin' || role === 'technician' || isPhotographer) && (
                            <QuickAction icon={Package} title="อุปกรณ์" description="จัดการอุปกรณ์" href="/admin/inventory" gradient="from-violet-500 to-purple-500" delay={0.3} />
                        )}

                        {role === 'admin' && (
                            <QuickAction icon={Users} title="ผู้ใช้งาน" description="จัดการผู้ใช้" href="/admin/users" gradient="from-emerald-500 to-teal-500" delay={0.35} />
                        )}

                        {role !== 'admin' && (
                            <QuickAction icon={AlertCircle} title="แจ้งปัญหา" description="แจ้งปัญหาการใช้งาน" onClick={() => setIsReportModalOpen(true)} gradient="from-gray-500 to-slate-600" delay={0.3} />
                        )}
                    </div>
                </Widget>

                {/* Report Issue Modal */}
                <ReportIssueModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />

                {/* Stats Widget */}
                <Widget className="lg:col-span-4 h-full" title="การจองห้องประชุมประจำวัน" icon={TrendingUp}>
                    <StatsWidgetContent
                        todayActivities={todayActivities}
                        repairStats={repairStats}
                        onTodayClick={handleTodayClick}
                    />
                </Widget>

                {/* Recent Activity Widget */}
                <Widget className="lg:col-span-4 h-full" title="สถานะการแจ้งซ่อมล่าสุด" icon={Clock}>
                    <RecentActivityList activities={activities} />
                </Widget>

                {/* Calendar + Gallery Section */}
                <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
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
                            <PhotoGalleryList photoJobs={photoJobs} />
                        </Widget>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isDetailsModalOpen && (
                <LazyBookingDetailsModal
                    isOpen={isDetailsModalOpen}
                    onClose={() => setIsDetailsModalOpen(false)}
                    event={selectedEvent}
                />
            )}

            <PhotographyJobModal
                isOpen={isJobModalOpen}
                onClose={() => setIsJobModalOpen(false)}
                requesterId={user?.uid || ''}
            />

            <MyPhotographyJobsModal
                isOpen={isMyJobsModalOpen}
                onClose={() => setIsMyJobsModalOpen(false)}
                userId={user?.uid || ''}
            />
        </div>
    );
}