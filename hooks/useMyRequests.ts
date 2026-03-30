"use client";

import { useState, useEffect } from "react";
import {
    collection, query, where, onSnapshot,
    orderBy, Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RepairTicket, FacilityTicket, Booking, Transaction } from "@/types";

export interface MyRequestsData {
    repairs: RepairTicket[];
    facilityTickets: FacilityTicket[];
    bookings: Booking[];
    borrows: Transaction[];
    loading: boolean;
    repairsLoading: boolean;
    bookingsLoading: boolean;
    borrowsLoading: boolean;
}

interface UseMyRequestsOptions {
    uid: string;
    email: string;
}

export function useMyRequests({ uid, email }: UseMyRequestsOptions): MyRequestsData {
    const [repairs, setRepairs] = useState<RepairTicket[]>([]);
    const [facilityTickets, setFacilityTickets] = useState<FacilityTicket[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [borrows, setBorrows] = useState<Transaction[]>([]);

    const [repairsLoading, setRepairsLoading] = useState(true);
    const [bookingsLoading, setBookingsLoading] = useState(true);
    const [borrowsLoading, setBorrowsLoading] = useState(true);

    // ── IT Repairs ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!uid) { setRepairsLoading(false); return; }

        const q = query(
            collection(db, "repair_tickets"),
            where("requesterId", "==", uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as RepairTicket));
            data.sort((a, b) => {
                const aMs = (a.createdAt as Timestamp)?.toMillis?.() ?? 0;
                const bMs = (b.createdAt as Timestamp)?.toMillis?.() ?? 0;
                return bMs - aMs;
            });
            setRepairs(data);
            setRepairsLoading(false);
        }, (err) => {
            console.error("[useMyRequests] repairs error:", err);
            setRepairsLoading(false);
        });

        return () => unsub();
    }, [uid]);

    // ── Facility Tickets ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!uid) return;

        const q = query(
            collection(db, "facility_tickets"),
            where("requesterId", "==", uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as FacilityTicket));
            data.sort((a, b) => {
                const aMs = (a.createdAt as Timestamp)?.toMillis?.() ?? 0;
                const bMs = (b.createdAt as Timestamp)?.toMillis?.() ?? 0;
                return bMs - aMs;
            });
            setFacilityTickets(data);
        }, (err) => {
            console.error("[useMyRequests] facility_tickets error:", err);
        });

        return () => unsub();
    }, [uid]);

    // ── Bookings ───────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!uid) { setBookingsLoading(false); return; }

        const q = query(
            collection(db, "bookings"),
            where("requesterId", "==", uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
            data.sort((a, b) => {
                const aMs = (a.startTime as Timestamp)?.toMillis?.() ?? 0;
                const bMs = (b.startTime as Timestamp)?.toMillis?.() ?? 0;
                return bMs - aMs;
            });
            setBookings(data);
            setBookingsLoading(false);
        }, (err) => {
            console.error("[useMyRequests] bookings error:", err);
            setBookingsLoading(false);
        });

        return () => unsub();
    }, [uid]);

    // ── Borrow Transactions (IT only — query by email) ─────────────────────────
    useEffect(() => {
        if (!email) { setBorrowsLoading(false); return; }

        const q = query(
            collection(db, "transactions"),
            where("borrowerEmail", "==", email)
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
            data.sort((a, b) => {
                const aMs = (a.transactionDate as Timestamp)?.toMillis?.() ?? 0;
                const bMs = (b.transactionDate as Timestamp)?.toMillis?.() ?? 0;
                return bMs - aMs;
            });
            setBorrows(data);
            setBorrowsLoading(false);
        }, (err) => {
            console.error("[useMyRequests] transactions error:", err);
            setBorrowsLoading(false);
        });

        return () => unsub();
    }, [email]);

    const loading = repairsLoading || bookingsLoading || borrowsLoading;

    return {
        repairs,
        facilityTickets,
        bookings,
        borrows,
        loading,
        repairsLoading,
        bookingsLoading,
        borrowsLoading,
    };
}
