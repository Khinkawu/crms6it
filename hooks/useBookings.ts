"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot, where, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { View, Views } from "react-big-calendar";
import { startOfDay, startOfMonth, endOfMonth, subMonths, addMonths, isSameDay } from "date-fns";

export interface BookingEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource?: any;
    roomName: string;
    requesterName: string;
    status: string;
    needsPhotographer?: boolean;
    eventType?: 'booking' | 'photography'; // New: distinguish event types
}

interface UseBookingsOptions {
    filterApprovedOnly?: boolean;
    monthsRange?: number; // How many months before and after to fetch
    includePhotographyJobs?: boolean; // New: include photography jobs with showInAgenda=true
    enabled?: boolean; // If false, skip Firestore queries (wait for auth)
}

interface UseBookingsReturn {
    events: BookingEvent[];
    loading: boolean;
    visibleEvents: BookingEvent[];
    view: View;
    setView: (view: View) => void;
    date: Date;
    setDate: (date: Date) => void;
}

/**
 * Hook for fetching booking events from Firestore
 * Provides calendar state management (view, date)
 * Only fetches bookings within specified months range to reduce reads
 * @param options - Configuration options
 * @returns Booking events and calendar state
 */
export function useBookings(options: UseBookingsOptions = {}): UseBookingsReturn {
    const { filterApprovedOnly = true, monthsRange = 1, includePhotographyJobs = false, enabled = true } = options;

    const [bookingEvents, setBookingEvents] = useState<BookingEvent[]>([]);
    const [photographyEvents, setPhotographyEvents] = useState<BookingEvent[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(true);
    const [photographyLoading, setPhotographyLoading] = useState(includePhotographyJobs);
    const [view, setView] = useState<View>(Views.MONTH);
    const [date, setDate] = useState(startOfDay(new Date()));

    // Fetch bookings
    useEffect(() => {
        if (!enabled) { setBookingsLoading(false); return; }
        // Calculate date range: N months before and after current date
        const now = new Date();
        const startRange = startOfMonth(subMonths(now, monthsRange));
        const endRange = endOfMonth(addMonths(now, monthsRange));

        const q = query(
            collection(db, "bookings"),
            where("startTime", ">=", Timestamp.fromDate(startRange)),
            where("startTime", "<=", Timestamp.fromDate(endRange))
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let loadedEvents: BookingEvent[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: `${data.title} (${data.roomName})`,
                    start: data.startTime.toDate(),
                    end: data.endTime.toDate(),
                    roomName: data.roomName,
                    requesterName: data.requesterName,
                    status: data.status,
                    needsPhotographer: data.needsPhotographer || false,
                    resource: data,
                    eventType: 'booking' as const
                };
            });

            // Filter approved only if option is set
            if (filterApprovedOnly) {
                loadedEvents = loadedEvents.filter(event => event.status === 'approved');
            }

            setBookingEvents(loadedEvents);
            setBookingsLoading(false);
        });

        return () => unsubscribe();
    }, [filterApprovedOnly, monthsRange, enabled]);

    // Fetch photography jobs (only if includePhotographyJobs is true)
    useEffect(() => {
        if (!enabled || !includePhotographyJobs) {
            setPhotographyEvents([]);
            setPhotographyLoading(false);
            return;
        }

        // Calculate date range: N months before and after current calendar date
        const startRange = startOfMonth(subMonths(date, monthsRange));
        const endRange = endOfMonth(addMonths(date, monthsRange));

        // Query photography jobs by date range only (filter showInAgenda client-side to avoid composite index)
        const q = query(
            collection(db, "photography_jobs"),
            where("startTime", ">=", Timestamp.fromDate(startRange)),
            where("startTime", "<=", Timestamp.fromDate(endRange))
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedEvents: BookingEvent[] = snapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    // Only show in agenda if:
                    // 1. showInAgenda is NOT explicitly false
                    // 2. AND (it's not linked to a booking ID OR it is a 'web-form-' direct queue job)
                    const shouldShowInAgenda = data.showInAgenda !== false;
                    const isWebForm = data.bookingId && data.bookingId.startsWith('web-form-');

                    return shouldShowInAgenda && (!data.bookingId || isWebForm);
                })
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: `photo_${doc.id}`, // Prefix to avoid ID collision
                        title: `📸 ${data.title}`,
                        start: data.startTime.toDate(),
                        end: data.endTime.toDate(),
                        roomName: data.location || '',
                        requesterName: data.assigneeNames?.join(', ') || '',
                        status: data.status,
                        resource: { ...data, isPhotographyJob: true },
                        eventType: 'photography' as const
                    };
                });

            setPhotographyEvents(loadedEvents);
            setPhotographyLoading(false);
        }, (error) => {
            console.error('[useBookings] Photography jobs query ERROR:', error);
            setPhotographyLoading(false);
        });

        return () => unsubscribe();
    }, [includePhotographyJobs, monthsRange, enabled]);

    // Merge booking and photography events
    const events = useMemo(() => {
        return [...bookingEvents, ...photographyEvents];
    }, [bookingEvents, photographyEvents]);

    const loading = bookingsLoading || photographyLoading;

    // Compute visible events based on current view and date
    const visibleEvents = useMemo(() => {
        if (view === Views.AGENDA) {
            return events.filter(event =>
                isSameDay(event.start, date)
            );
        }
        return events;
    }, [events, view, date]);

    return {
        events,
        loading,
        visibleEvents,
        view,
        setView,
        date,
        setDate
    };
}
