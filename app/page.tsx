"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, onSnapshot, orderBy, limit, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { LogAction } from "../types";
import {
    Package, CheckCircle, Clock, Wrench,
    Plus, Camera, AlertTriangle, User, RefreshCw,
    Zap, Lightbulb, FileText, Edit, Trash2, PlusCircle, Calendar as CalendarIcon,
    ChevronLeft, ChevronRight, MapPin, Globe, CheckCircle2, PackageMinus, PackagePlus
} from "lucide-react";
import { Calendar, momentLocalizer, Views, View, ToolbarProps } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "moment/locale/th"; // Import Thai locale
import BookingDetailsModal from "./components/BookingDetailsModal";

// Setup the localizer
moment.locale('th');
const localizer = momentLocalizer(moment);

interface ActivityLog {
    id: string;
    action: LogAction;
    productName: string;
    userName: string;
    imageUrl?: string;
    details?: string;
    zone?: string;
    status?: string; // legacy or derived
    timestamp: any;
}

interface BookingEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource?: any;
    roomName: string;
    requesterName: string;
    status: string;
}

const AgendaEvent = ({ event }: { event: BookingEvent }) => (
    <div className="flex flex-col gap-1.5 py-1">
        <div className="font-bold text-gray-800 dark:text-gray-200 text-base">{event.title}</div>
        <div className="flex flex-wrap gap-2 items-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                <MapPin size={12} /> {event.roomName}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                <User size={12} /> {event.requesterName}
            </div>
        </div>
    </div>
);

const CustomToolbar = (toolbar: ToolbarProps<BookingEvent, object>) => {
    const goToBack = () => {
        const newDate = moment(toolbar.date).subtract(1, 'days').startOf('day').toDate();
        toolbar.onNavigate('DATE', newDate);
    };

    const goToNext = () => {
        const newDate = moment(toolbar.date).add(1, 'days').startOf('day').toDate();
        toolbar.onNavigate('DATE', newDate);
    };

    const goToCurrent = () => {
        const newDate = moment().startOf('day').toDate();
        toolbar.onNavigate('DATE', newDate);
    };

    const label = () => {
        const date = moment(toolbar.date);
        return (
            <span className="text-xl font-bold text-gray-800 dark:text-white capitalize">
                {date.format('D MMMM YYYY')}
            </span>
        );
    };

    return (
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 px-2">
            {/* Left: Navigation */}
            <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shadow-sm">
                    <button
                        onClick={goToBack}
                        className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded-md transition-all text-gray-600 dark:text-gray-300"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={goToCurrent}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 rounded-md transition-all"
                    >
                        {moment(toolbar.date).isSame(moment(), 'day') ? "วันนี้" : "วันที่"}
                    </button>
                    <button
                        onClick={goToNext}
                        className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded-md transition-all text-gray-600 dark:text-gray-300"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
                <div className="ml-2 hidden md:block">
                    {label()}
                </div>
            </div>

            {/* Center: Label (Mobile Only) */}
            <div className="md:hidden">
                {label()}
            </div>

            {/* Right: View Switcher */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shadow-sm">
                {[
                    { id: Views.MONTH, label: 'เดือน' },
                    { id: Views.WEEK, label: 'สัปดาห์' },
                    { id: Views.DAY, label: 'วัน' },
                    { id: Views.AGENDA, label: 'กำหนดการ' },
                ].map(view => (
                    <button
                        key={view.id}
                        onClick={() => toolbar.onView(view.id)}
                        className={`
                            px-4 py-1.5 text-sm font-medium rounded-md transition-all
                            ${toolbar.view === view.id
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}
                        `}
                    >
                        {view.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default function Dashboard() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

    // Calendar State
    const [events, setEvents] = useState<BookingEvent[]>([]);
    const [view, setView] = useState<View>(Views.MONTH);
    const [date, setDate] = useState(moment().startOf('day').toDate());
    const [selectedEvent, setSelectedEvent] = useState<BookingEvent | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
            return;
        }

        if (!user) return;

        // Recent Activity (Fetch recent and filter client-side to avoid index error)
        const activityQ = query(
            collection(db, "activities"),
            orderBy("timestamp", "desc"),
            limit(50)
        );
        const unsubActivity = onSnapshot(activityQ, (snapshot) => {
            const acts = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as ActivityLog[];

            // Filter for repair logs only
            const repairLogs = acts.filter(act =>
                act.action === 'repair' || act.action === 'repair_update'
            ).slice(0, 20);

            setRecentActivity(repairLogs);
        });

        // Listen for bookings
        const bookingQ = query(collection(db, "bookings"));
        const unsubBooking = onSnapshot(bookingQ, (snapshot) => {
            // Filter only approved bookings
            const loadedEvents: BookingEvent[] = snapshot.docs
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        title: `${data.title} (${data.roomName})`,
                        start: data.startTime.toDate(),
                        end: data.endTime.toDate(),
                        roomName: data.roomName,
                        requesterName: data.requesterName,
                        status: data.status,
                        resource: data
                    };
                })
                .filter(event => event.status === 'approved'); // CLIENT-SIDE FILTERING

            setEvents(loadedEvents);
        });

        return () => {
            unsubActivity();
            unsubBooking();
        };
    }, [user, loading, router]);

    const visibleEvents = useMemo(() => {
        if (view === Views.AGENDA) {
            return events.filter(event =>
                moment(event.start).isSame(date, 'day')
            );
        }
        return events;
    }, [events, view, date]);

    const eventStyleGetter = (event: BookingEvent) => {
        let backgroundColor = '#f59e0b'; // amber-500

        // Month/Week/Day view styles - DOT STYLE
        if (view !== Views.AGENDA) {
            return {
                style: {
                    backgroundColor: backgroundColor,
                    borderRadius: '50%',
                    width: '12px',
                    height: '12px',
                    padding: '0px',
                    border: '2px solid white',
                    margin: '2px auto',
                    display: 'block',
                    color: 'transparent',
                    overflow: 'hidden',
                    fontSize: '0px',
                    lineHeight: '0px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }
            };
        }

        // Agenda view styles
        return {
            className: 'rbc-agenda-custom-event',
            style: {
                borderLeft: `4px solid ${backgroundColor}`,
                backgroundColor: 'transparent',
            }
        };
    };

    const dayPropGetter = (calendarDate: Date) => {
        if (moment(calendarDate).isSame(date, 'day')) {
            return {
                style: {
                    boxShadow: 'inset 0 0 0 2px #3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                }
            };
        }
        return {};
    };

    if (loading || !user) return null;

    const quickActions = [
        { name: "โปรไฟล์", icon: <User size={24} />, path: "/profile", role: ['admin', 'technician', 'user', 'moderator'] },
        { name: "Wi-Fi Users", icon: <Globe size={24} />, path: "https://sites.google.com/tesaban6.ac.th/crms6wifiusers", role: ['admin', 'technician', 'user', 'moderator'], external: true },
        { name: "แจ้งซ่อม", icon: <AlertTriangle size={24} />, path: "/repair", role: ['admin', 'technician', 'user', 'moderator'] },
        { name: "จองห้องประชุม", icon: <CalendarIcon size={24} />, path: "/booking", role: ['admin', 'technician', 'user', 'moderator'] },
        { name: "เพิ่มอุปกรณ์", icon: <Plus size={24} />, path: "/admin/inventory", role: ['admin'] },
        { name: "รีเซ็ตค่าสถิติ", icon: <RefreshCw size={24} />, path: "/admin/init-stats", role: ['admin'] },
    ];

    const getActionStyle = (action: LogAction) => {
        switch (action) {
            case 'borrow': return { icon: <Clock size={18} />, label: 'ยืมอุปกรณ์', color: 'text-orange-600', bg: 'bg-orange-100' };
            case 'return': return { icon: <CheckCircle size={18} />, label: 'คืนอุปกรณ์', color: 'text-emerald-600', bg: 'bg-emerald-100' };
            case 'requisition': return { icon: <Package size={18} />, label: 'เบิกอุปกรณ์', color: 'text-purple-600', bg: 'bg-purple-100' };
            case 'repair': return { icon: <Wrench size={18} />, label: 'แจ้งซ่อม', color: 'text-red-600', bg: 'bg-red-100' };
            case 'repair_update': return { icon: <CheckCircle size={18} />, label: 'อัปเดตงานซ่อม', color: 'text-blue-600', bg: 'bg-blue-100' };
            case 'add':
            case 'create': return { icon: <PlusCircle size={18} />, label: 'เพิ่มอุปกรณ์ใหม่', color: 'text-blue-600', bg: 'bg-blue-100' };
            case 'update': return { icon: <Edit size={18} />, label: 'แก้ไขข้อมูล', color: 'text-amber-600', bg: 'bg-amber-100' };
            case 'delete': return { icon: <Trash2 size={18} />, label: 'ลบอุปกรณ์', color: 'text-gray-600', bg: 'bg-gray-100' };
            default: return { icon: <FileText size={18} />, label: 'กิจกรรม', color: 'text-gray-600', bg: 'bg-gray-100' };
        }
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate();
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return "เมื่อสักครู่";
        if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
        if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
        if (days === 1) return "เมื่อวาน";
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    };

    const today = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const getZoneLabel = (zone?: string) => {
        if (!zone) return "";
        switch (zone) {
            case 'junior_high': return '(ม.ต้น)';
            case 'senior_high': return '(ม.ปลาย)';
            case 'common': return '(ส่วนกลาง)';
            default: return `(${zone})`;
        }
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
                {/* Left Column: Calendar (Takes 2 cols) */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden p-6 h-[500px]">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <CalendarIcon className="text-blue-600" /> ปฏิทินการจองห้องประชุม
                        </h2>
                        <button
                            onClick={() => router.push('/booking')}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            จองห้องประชุม &rarr;
                        </button>
                    </div>

                    <style jsx global>{`
                        .rbc-calendar { font-family: 'Prompt', sans-serif; }
                        
                        /* Clean Grid */
                        .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: none !important; }
                        .rbc-header { 
                            padding: 12px 0; 
                            font-weight: 600; 
                            color: #6b7280; 
                            text-transform: uppercase; 
                            font-size: 0.85rem;
                            border-bottom: 1px solid #e5e7eb !important;
                        }
                        .dark .rbc-header { color: #9ca3af; border-bottom-color: #374151 !important; }
                        
                        .rbc-day-bg { border-left: 1px solid #f3f4f6 !important; }
                        .dark .rbc-day-bg { border-left-color: #374151 !important; }
                        
                        .rbc-off-range-bg { background-color: #f9fafb; }
                        .dark .rbc-off-range-bg { background-color: #111827; }
                        
                        /* Today Highlight */
                        .rbc-today { background-color: transparent !important; }
                        .rbc-date-cell { padding: 8px; font-size: 0.9rem; font-weight: 500; color: #374151; }
                        .dark .rbc-date-cell { color: #d1d5db; }
                        
                        .rbc-now .rbc-button-link {
                            background-color: #ef4444;
                            color: white;
                            width: 28px;
                            height: 28px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin-left: auto;
                        }

                        /* Events */
                        .rbc-event {
                            border-radius: 6px;
                            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                        }
                        
                        /* Time View Grid */
                        .rbc-time-content { border-top: 1px solid #e5e7eb !important; }
                        .dark .rbc-time-content { border-top-color: #374151 !important; }
                        .rbc-timeslot-group { border-bottom: 1px solid #f3f4f6 !important; }
                        .dark .rbc-timeslot-group { border-bottom-color: #374151 !important; }
                        .rbc-time-view-resources .rbc-time-gutter, .rbc-time-view-resources .rbc-time-header-gutter { border-right: 1px solid #e5e7eb !important; }
                        .dark .rbc-time-view-resources .rbc-time-gutter, .dark .rbc-time-view-resources .rbc-time-header-gutter { border-right-color: #374151 !important; }

                        /* Agenda View Customization */
                        .rbc-agenda-custom-event {
                            color: inherit !important;
                            border-bottom: 1px solid #f3f4f6;
                        }
                        .dark .rbc-agenda-custom-event {
                            color: #e5e7eb !important;
                            border-bottom-color: #374151;
                        }
                        .rbc-agenda-view table.rbc-agenda-table {
                            border: none !important;
                        }
                        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
                            padding: 12px 8px !important;
                            vertical-align: middle !important;
                        }
                        .rbc-agenda-date-cell {
                            font-weight: 600;
                            color: #4b5563;
                        }
                        .dark .rbc-agenda-date-cell {
                            color: #9ca3af;
                        }

                        /* Mobile Agenda View - Card Style */
                        @media (max-width: 768px) {
                            .rbc-agenda-view table.rbc-agenda-table thead { display: none; }
                            .rbc-agenda-view table.rbc-agenda-table tbody { display: block; }
                            .rbc-agenda-view table.rbc-agenda-table tr {
                                display: flex;
                                flex-direction: column;
                                background: white;
                                margin-bottom: 12px;
                                border: 1px solid #e5e7eb;
                                border-radius: 12px;
                                padding: 16px;
                                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                            }
                            .dark .rbc-agenda-view table.rbc-agenda-table tr {
                                background: #1f2937;
                                border-color: #374151;
                            }
                            
                            /* Hide Date Cell on Mobile */
                            .rbc-agenda-view table.rbc-agenda-table td.rbc-agenda-date-cell { display: none; }
                            
                            /* Time Cell */
                            .rbc-agenda-view table.rbc-agenda-table td.rbc-agenda-time-cell {
                                display: block;
                                width: 100%;
                                padding: 0 0 8px 0 !important;
                                font-size: 0.9rem;
                                color: #6b7280;
                                border: none !important;
                                font-weight: 600;
                                text-transform: uppercase;
                                letter-spacing: 0.05em;
                            }
                            .dark .rbc-agenda-view table.rbc-agenda-table td.rbc-agenda-time-cell {
                                color: #9ca3af;
                            }
                            
                            /* Event Cell */
                            .rbc-agenda-view table.rbc-agenda-table td.rbc-agenda-event-cell {
                                display: block;
                                width: 100%;
                                padding: 0 !important;
                                border: none !important;
                            }
                        }
                    `}</style>

                    <Calendar
                        localizer={localizer}
                        events={visibleEvents}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: '90%' }}
                        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                        view={view}
                        onView={setView}
                        date={date}
                        onNavigate={setDate}
                        components={{
                            toolbar: CustomToolbar,
                            agenda: {
                                event: AgendaEvent
                            }
                        }}
                        selectable
                        onSelectSlot={(slotInfo) => {
                            setDate(moment(slotInfo.start).startOf('day').toDate());
                            setView(Views.AGENDA);
                        }}
                        onDrillDown={(date) => {
                            setDate(moment(date).startOf('day').toDate());
                            setView(Views.AGENDA);
                        }}
                        onSelectEvent={(event) => {
                            setSelectedEvent(event);
                            setIsDetailsModalOpen(true);
                        }}
                        eventPropGetter={eventStyleGetter}
                        dayPropGetter={dayPropGetter}
                        messages={{
                            next: "ถัดไป",
                            previous: "ก่อนหน้า",
                            today: "วันนี้",
                            month: "เดือน",
                            week: "สัปดาห์",
                            day: "วัน",
                            agenda: "กำหนดการ",
                            date: "วันที่",
                            time: "เวลา",
                            event: "กิจกรรม",
                            noEventsInRange: "ไม่มีการจองในช่วงเวลานี้"
                        }}
                        length={1}
                    />
                </div>

                {/* Right Column: Quick Actions & Tips */}
                <div className="space-y-8">
                    {/* Quick Actions */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" /> เมนูด่วน
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            {quickActions.filter(action => !role || action.role.includes(role)).map((action, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        if (action.external) {
                                            window.open(action.path, '_blank');
                                        } else {
                                            router.push(action.path);
                                        }
                                    }}
                                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-input-bg border border-transparent hover:border-primary-start/30 hover:bg-primary-start/5 transition-all group h-full w-full aspect-[4/3] sm:aspect-auto"
                                >
                                    <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 group-hover:text-primary-start group-hover:scale-110 transition-all">
                                        {action.icon}
                                    </div>
                                    <span className="text-sm font-medium text-text group-hover:text-primary-start transition-colors text-center leading-tight">
                                        {action.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

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

            {/* Recent Activity (Full Width) */}
            {/* Recent Activity (Full Width) */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
                <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 className="text-lg font-bold text-text flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-500" /> กิจกรรมล่าสุด (งานซ่อม)
                    </h2>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-input-bg text-text-secondary">
                        {recentActivity.length} รายการ
                    </span>
                </div>

                <div className="overflow-y-auto custom-scrollbar p-0">
                    {recentActivity.length > 0 ? (
                        <div className="divide-y divide-border">
                            {recentActivity.map((act) => {
                                // 1. Parse Status and Details (Handle Legacy Data)
                                let derivedStatus = act.status;
                                let displayDetails = act.details || "";

                                if (act.action === 'repair_update' && !derivedStatus && displayDetails) {
                                    // Robust regex: allows optional spaces, optional dash/note
                                    const match = displayDetails.match(/สถานะ:\s*([a-zA-Z_]+)(?:\s*-\s*(.*))?/);
                                    if (match) {
                                        derivedStatus = match[1];
                                        displayDetails = match[2] || "";
                                    }
                                }

                                // 2. Determine Styling based on Action & Status
                                let iconColor = "bg-gray-400"; // Solid gray default
                                let actionLabel = "ทำรายการ";

                                if (act.action === 'repair') {
                                    iconColor = "bg-red-500"; // Solid Red
                                    actionLabel = "แจ้งซ่อม";
                                } else if (act.action === 'repair_update') {
                                    // Traffic Light Colors (Solid)
                                    if (derivedStatus === 'completed') {
                                        iconColor = "bg-emerald-500"; // Solid Green
                                    } else if (derivedStatus === 'in_progress' || derivedStatus === 'waiting_parts') {
                                        iconColor = "bg-amber-400"; // Solid Yellow (Amber-400 is brighter/yellowish)
                                    } else if (derivedStatus === 'pending') {
                                        iconColor = "bg-red-500"; // Solid Red
                                    } else {
                                        iconColor = "bg-blue-500"; // Solid Blue
                                    }
                                    actionLabel = "อัปเดตงานซ่อม";
                                } else if (act.action === 'borrow') {
                                    iconColor = "bg-amber-500";
                                    actionLabel = "ยืมอุปกรณ์";
                                } else if (act.action === 'return') {
                                    iconColor = "bg-emerald-500";
                                    actionLabel = "คืนอุปกรณ์";
                                }

                                // 3. Format Header Text
                                let headerText = act.productName;
                                let statusLabel = "";

                                if (act.action === 'repair') {
                                    // Clean potential prefix if already saved with one
                                    const rawName = act.productName.replace(/^แจ้งซ่อม: /, '');
                                    headerText = `แจ้งซ่อม: ${rawName}`;

                                    if (act.zone) {
                                        const zoneLabel = act.zone === 'junior_high' ? 'ม.ต้น' : act.zone === 'senior_high' ? 'ม.ปลาย' : act.zone;
                                        headerText += ` (${zoneLabel})`;
                                    }
                                } else if (act.action === 'repair_update') {
                                    // Clean potential double prefix
                                    const rawName = act.productName.replace(/^อัปเดตงานซ่อม: /, '');
                                    headerText = `อัปเดตงานซ่อม: ${rawName}`;

                                    if (derivedStatus) {
                                        // Map status to Thai
                                        switch (derivedStatus) {
                                            case 'pending': statusLabel = "(รอดำเนินการ)"; break;
                                            case 'in_progress': statusLabel = "(กำลังดำเนินการ)"; break;
                                            case 'waiting_parts': statusLabel = "(รออะไหล่)"; break;
                                            case 'completed': statusLabel = "(เสร็จสิ้น)"; break;
                                            case 'cancelled': statusLabel = "(ยกเลิก)"; break;
                                            default: statusLabel = `(${derivedStatus})`;
                                        }
                                    }
                                }

                                return (
                                    <div key={act.id} className="p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors flex gap-4 items-start group border-b border-gray-100 dark:border-gray-800 last:border-0">
                                        {/* Small Solid Status Dot */}
                                        <div className={`w-3 h-3 rounded-full ${iconColor} flex-shrink-0 shadow-sm mt-1.5 ring-2 ring-white dark:ring-gray-900`}></div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                                                    {headerText} <span className={`font-normal ml-1 ${derivedStatus === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>{statusLabel}</span>
                                                </h3>
                                                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2">
                                                    {formatTime(act.timestamp)}
                                                </span>
                                            </div>

                                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-2">
                                                <span>โดย {act.userName}</span>
                                                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                                                <span className="text-gray-400 dark:text-gray-500">{actionLabel}</span>
                                            </p>

                                            {/* Details Box */}
                                            {(displayDetails) && (
                                                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-lg p-3 shadow-sm text-xs text-gray-600 dark:text-gray-300 leading-relaxed group-hover:border-blue-100 dark:group-hover:border-blue-900/50 transition-colors">
                                                    <span>"{displayDetails}"</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Image (Optional) */}
                                        {act.imageUrl && (
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                                                <img src={act.imageUrl} alt="Active" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                            <div className="mb-3 opacity-20">
                                <FileText size={48} />
                            </div>
                            <p>ยังไม่มีกิจกรรมล่าสุด</p>
                        </div>
                    )}
                </div>
            </div>

            <BookingDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                event={selectedEvent}
            />
        </div >
    );
}