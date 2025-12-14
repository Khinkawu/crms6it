"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot, where, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { View, Views } from "react-big-calendar";
import moment from "moment";

export interface BookingEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource?: any;
    roomName: string;
    requesterName: string;
    status: string;
}

interface UseBookingsOptions {
    filterApprovedOnly?: boolean;
    monthsRange?: number; // How many months before and after to fetch
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
    const { filterApprovedOnly = true, monthsRange = 3 } = options;

    const [events, setEvents] = useState<BookingEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<View>(Views.MONTH);
    const [date, setDate] = useState(moment().startOf('day').toDate());

    useEffect(() => {
        // Calculate date range: 3 months before and after current date
        const startRange = moment().subtract(monthsRange, 'months').startOf('month').toDate();
        const endRange = moment().add(monthsRange, 'months').endOf('month').toDate();

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
                    resource: data
                };
            });

            // Filter approved only if option is set
            if (filterApprovedOnly) {
                loadedEvents = loadedEvents.filter(event => event.status === 'approved');
            }

            setEvents(loadedEvents);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [filterApprovedOnly, monthsRange]);

    // Compute visible events based on current view and date
    const visibleEvents = useMemo(() => {
        if (view === Views.AGENDA) {
            return events.filter(event =>
                moment(event.start).isSame(date, 'day')
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
