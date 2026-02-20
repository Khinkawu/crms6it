"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Calendar, dateFnsLocalizer, Views, View, ToolbarProps } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfDay, addDays, subDays, isSameDay } from "date-fns";
import { th } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { BookingEvent } from "../../../hooks/useBookings";

const locales = { th };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

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

// Custom Toolbar Component - Modern Design
const CustomToolbar = (toolbar: ToolbarProps<BookingEvent, object>) => {
    const goToBack = () => {
        const newDate = startOfDay(subDays(toolbar.date, 1));
        toolbar.onNavigate('DATE', newDate);
    };

    const goToNext = () => {
        const newDate = startOfDay(addDays(toolbar.date, 1));
        toolbar.onNavigate('DATE', newDate);
    };

    const goToCurrent = () => {
        const newDate = startOfDay(new Date());
        toolbar.onNavigate('DATE', newDate);
    };

    const label = () => {
        return (
            <span className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                {format(toolbar.date, 'd MMMM yyyy', { locale: th })}
            </span>
        );
    };

    return (
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
            {/* Left: Navigation */}
            <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1">
                    <button
                        onClick={goToBack}
                        className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all text-gray-600 dark:text-gray-300"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={goToCurrent}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all"
                    >
                        วันนี้
                    </button>
                    <button
                        onClick={goToNext}
                        className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all text-gray-600 dark:text-gray-300"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
                <div className="hidden md:block">
                    {label()}
                </div>
            </div>

            {/* Center: Label (Mobile Only) */}
            <div className="md:hidden text-center">
                {label()}
            </div>

            {/* Right: View Switcher */}
            <div className="flex bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1">
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
                            px-3 py-1.5 text-xs font-medium rounded-lg transition-all
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

    const eventStyleGetter = () => {
        // Month view: Red dot style (hide text)
        if (view === Views.MONTH) {
            return {
                style: {
                    backgroundColor: '#ef4444 !important' as any, // red-500
                    borderRadius: '50%',
                    width: '8px',
                    height: '8px',
                    minHeight: '8px',
                    padding: '0',
                    border: 'none',
                    color: 'transparent',
                    fontSize: '0',
                    lineHeight: '0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    display: 'inline-block',
                    margin: '1px',
                    pointerEvents: 'none' as const,
                    cursor: 'default',
                }
            };
        }

        // Agenda/Week/Day view: No background color, just text
        return {
            style: {
                backgroundColor: 'transparent',
                borderRadius: '0',
                border: 'none',
                color: 'inherit',
                fontSize: '14px',
                padding: '4px 0',
                fontWeight: '500',
            }
        };
    };

    const dayPropGetter = (calendarDate: Date) => {
        if (isSameDay(calendarDate, date)) {
            return {
                style: {
                    boxShadow: 'inset 0 0 0 2px #3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                }
            };
        }
        return {};
    };

    return (
        <div className="lg:col-span-2 bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl rounded-3xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 overflow-hidden p-5 h-[520px]">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <CalendarIcon size={16} />
                    </div>
                    ปฏิทินการจอง
                </h2>
                <button
                    onClick={() => router.push('/booking')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors tap-scale"
                >
                    <Plus size={14} />
                    จองห้อง
                </button>
            </div>

            <style jsx global>{`
                .rbc-calendar { font-family: inherit; }

                /* Clean Grid */
                .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: none !important; border-radius: 12px; overflow: hidden; }
                .rbc-header {
                    padding: 10px 0;
                    font-weight: 600;
                    color: #6b7280;
                    text-transform: uppercase;
                    font-size: 0.7rem;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid #f3f4f6 !important;
                    background: #f9fafb;
                }
                .dark .rbc-header { color: #9ca3af; border-bottom-color: #374151 !important; background: #1f2937; }

                .rbc-day-bg { border-left: 1px solid #f3f4f6 !important; }
                .dark .rbc-day-bg { border-left-color: #374151 !important; }

                .rbc-off-range-bg { background-color: #fafafa; }
                .dark .rbc-off-range-bg { background-color: #111827; }

                /* Today Highlight */
                .rbc-today { background-color: transparent !important; }
                .rbc-date-cell { padding: 6px; font-size: 0.8rem; font-weight: 500; color: #374151; }
                .dark .rbc-date-cell { color: #d1d5db; }

                .rbc-now .rbc-button-link {
                    background: #ef4444;
                    color: white;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: auto;
                    font-weight: 700;
                    font-size: 0.8rem;
                    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
                }

                /* Events - Month View Dot Style */
                .rbc-month-view .rbc-event {
                    padding: 0 !important;
                    border: none !important;
                    background: #ef4444 !important;
                    width: 8px !important;
                    height: 8px !important;
                    border-radius: 50% !important;
                }
                .rbc-month-view .rbc-event-content {
                    display: none;
                }
                .rbc-row-segment {
                    display: flex;
                    justify-content: center;
                    padding: 2px 0;
                }
                .rbc-show-more {
                    display: none !important;
                }

                /* Agenda/Week/Day View - No background */
                .rbc-agenda-view .rbc-event,
                .rbc-time-view .rbc-event {
                    background: transparent !important;
                    color: inherit !important;
                }

                /* Time View Grid */
                .rbc-time-content { border-top: 1px solid #f3f4f6 !important; }
                .dark .rbc-time-content { border-top-color: #374151 !important; }
                .rbc-timeslot-group { border-bottom: 1px solid #f3f4f6 !important; }
                .dark .rbc-timeslot-group { border-bottom-color: #374151 !important; }

                /* Agenda View Customization */
                .rbc-agenda-view {
                    overflow-y: auto !important;
                    max-height: 100% !important;
                }
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
                    padding: 10px 8px !important;
                    vertical-align: middle !important;
                }
                .rbc-agenda-date-cell {
                    font-weight: 600;
                    color: #4b5563;
                    font-size: 0.85rem;
                }
                .dark .rbc-agenda-date-cell {
                    color: #9ca3af;
                }

                /* Row borders */
                .rbc-month-row { border-bottom: 1px solid #f3f4f6 !important; }
                .dark .rbc-month-row { border-bottom-color: #374151 !important; }

                /* Mobile Agenda View - Card Style */
                @media (max-width: 768px) {
                    .rbc-agenda-view table.rbc-agenda-table thead { display: none; }
                    .rbc-agenda-view table.rbc-agenda-table tbody { display: block; }
                    .rbc-agenda-view table.rbc-agenda-table tr {
                        display: flex;
                        flex-direction: column;
                        background: white;
                        margin-bottom: 10px;
                        border: 1px solid #e5e7eb;
                        border-radius: 12px;
                        padding: 14px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                    }
                    .dark .rbc-agenda-view table.rbc-agenda-table tr {
                        background: #1f2937;
                        border-color: #374151;
                    }

                    .rbc-agenda-view table.rbc-agenda-table td.rbc-agenda-date-cell { display: none; }

                    .rbc-agenda-view table.rbc-agenda-table td.rbc-agenda-time-cell {
                        display: block;
                        width: 100%;
                        padding: 0 0 6px 0 !important;
                        font-size: 0.8rem;
                        color: #6b7280;
                        border: none !important;
                        font-weight: 600;
                    }
                    .dark .rbc-agenda-view table.rbc-agenda-table td.rbc-agenda-time-cell {
                        color: #9ca3af;
                    }

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
                style={{ height: 'calc(100% - 50px)' }}
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
                    setDate(startOfDay(slotInfo.start));
                    setView(Views.AGENDA);
                }}
                onDrillDown={(drillDate) => {
                    setDate(startOfDay(drillDate));
                    setView(Views.AGENDA);
                }}
                onSelectEvent={view !== Views.MONTH && onSelectEvent ? (event) => onSelectEvent(event) : undefined}
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
