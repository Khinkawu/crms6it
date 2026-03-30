"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Wrench, Calendar, Package, ClipboardList } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMyRequests } from "@/hooks/useMyRequests";
import { PageSkeleton } from "@/components/ui/Skeleton";
import RepairCard from "@/components/my-requests/RepairCard";
import BookingCard from "@/components/my-requests/BookingCard";
import BorrowCard from "@/components/my-requests/BorrowCard";
import EditBookingSheet from "@/components/my-requests/EditBookingSheet";
import { Booking } from "@/types";

type Tab = 'repairs' | 'bookings' | 'borrows';

export default function MyRequestsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<Tab>('repairs');
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

    const { repairs, facilityTickets, bookings, borrows, loading } = useMyRequests({
        uid: user?.uid ?? '',
        email: user?.email ?? '',
    });

    if (authLoading) return <PageSkeleton />;
    if (!user) { router.push('/login'); return null; }

    // Merge IT + Facility repairs, sort by createdAt desc
    const allRepairs = useMemo(() => {
        const it = repairs.map(r => ({ ticket: r, type: 'it' as const }));
        const facility = facilityTickets.map(f => ({ ticket: f, type: 'facility' as const }));
        return [...it, ...facility].sort((a, b) => {
            const aMs = (a.ticket.createdAt as any)?.toMillis?.() ?? 0;
            const bMs = (b.ticket.createdAt as any)?.toMillis?.() ?? 0;
            return bMs - aMs;
        });
    }, [repairs, facilityTickets]);

    const tabs: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
        { key: 'repairs', label: 'แจ้งซ่อม', icon: Wrench, count: allRepairs.length },
        { key: 'bookings', label: 'การจอง', icon: Calendar, count: bookings.length },
        { key: 'borrows', label: 'ยืมคืน', icon: Package, count: borrows.length },
    ];

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="p-2 rounded-xl bg-indigo-500/10">
                        <ClipboardList size={18} className="text-indigo-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">คำขอของฉัน</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">ติดตามสถานะคำขอทั้งหมด</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex px-4 gap-1 mb-4">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === tab.key
                            ? 'bg-indigo-500 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        <tab.icon size={13} />
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.key
                                ? 'bg-white/20 text-white'
                                : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                                }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="px-4 pb-24 space-y-3">
                {loading ? (
                    <PageSkeleton />
                ) : (
                    <>
                        {/* Repairs Tab */}
                        {activeTab === 'repairs' && (
                            allRepairs.length === 0
                                ? <EmptyState icon={Wrench} label="ยังไม่มีการแจ้งซ่อม" />
                                : allRepairs.map(({ ticket, type }) => (
                                    <RepairCard
                                        key={ticket.id}
                                        ticket={ticket}
                                        type={type}
                                    />
                                ))
                        )}

                        {/* Bookings Tab */}
                        {activeTab === 'bookings' && (
                            bookings.length === 0
                                ? <EmptyState icon={Calendar} label="ยังไม่มีการจอง" />
                                : bookings.map(booking => (
                                    <BookingCard
                                        key={booking.id}
                                        booking={booking}
                                        onEdit={setEditingBooking}
                                        onCancelled={() => {/* realtime — onSnapshot auto-updates */}}
                                    />
                                ))
                        )}

                        {/* Borrows Tab */}
                        {activeTab === 'borrows' && (
                            borrows.length === 0
                                ? <EmptyState icon={Package} label="ยังไม่มีประวัติยืม-คืน" />
                                : borrows.map(tx => (
                                    <BorrowCard
                                        key={tx.id}
                                        transaction={tx}
                                    />
                                ))
                        )}
                    </>
                )}
            </div>

            {/* Edit Booking Sheet */}
            {editingBooking && (
                <EditBookingSheet
                    booking={editingBooking}
                    onClose={() => setEditingBooking(null)}
                    onUpdated={() => {
                        setEditingBooking(null);
                        // realtime via onSnapshot — no manual refresh needed
                    }}
                />
            )}
        </div>
    );
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                <Icon size={24} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
    );
}
