"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar, momentLocalizer, Views, View, ToolbarProps } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "moment/locale/th";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BookingEvent } from "../../../hooks/useBookings";

moment.locale('th');
const localizer = momentLocalizer(moment);

// Agenda Event Component
const AgendaEvent = ({ event }: { event: BookingEvent }) => (
    <div className="flex flex-col gap-1.5 py-1">
        <div className="font-bold text-gray-800 dark:text-gray-200 text-base">{event.title}</div>
        <div className="flex flex-wrap gap-2 items-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                📍 {event.roomName}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                👤 {event.requesterName}
            </div>
        </div>
    </div>
);

// Custom Toolbar Component
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

interface CalendarSectionProps {
    events: BookingEvent[];
    view: View;
    setView: (view: View) => void;
    date: Date;
    setDate: (date: Date) => void;
    onSelectEvent?: (event: BookingEvent) => void;
}

export default function CalendarSection({
    events,
    view,
    setView,
    date,
    setDate,
    onSelectEvent
}: CalendarSectionProps) {
    const router = useRouter();

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

    return (
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
                events={events}
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
                onDrillDown={(drillDate) => {
                    setDate(moment(drillDate).startOf('day').toDate());
                    setView(Views.AGENDA);
                }}
                onSelectEvent={(event) => {
                    if (onSelectEvent) {
                        onSelectEvent(event);
                    }
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
    );
}
