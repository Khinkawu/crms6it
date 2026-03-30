"use client";

import React, { useState } from "react";
import { Calendar, MapPin, Clock, CheckCircle2, XCircle, AlertCircle, Edit2, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";
import { Booking } from "@/types";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

interface BookingCardProps {
    booking: Booking;
    onEdit: (booking: Booking) => void;
    onCancelled: () => void;
}

function toDate(val: unknown): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof (val as Timestamp).toDate === 'function') return (val as Timestamp).toDate();
    return null;
}

function getBookingStatusColor(status: Booking['status']) {
    switch (status) {
        case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
        case 'approved': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        case 'rejected': return 'bg-red-500/10 text-red-600 border-red-500/20';
        case 'cancelled': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
}

function getBookingStatusLabel(status: Booking['status']) {
    switch (status) {
        case 'pending': return 'รออนุมัติ';
        case 'approved': return 'อนุมัติแล้ว';
        case 'rejected': return 'ถูกปฏิเสธ';
        case 'cancelled': return 'ยกเลิกแล้ว';
        default: return status;
    }
}

export default function BookingCard({ booking, onEdit, onCancelled }: BookingCardProps) {
    const { user } = useAuth();
    const [cancelling, setCancelling] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const startDate = toDate(booking.startTime);
    const endDate = toDate(booking.endTime);
    const canEdit = booking.status === 'pending' || booking.status === 'approved';
    const canCancel = booking.status === 'pending' || booking.status === 'approved';

    const StatusIcon = booking.status === 'approved'
        ? CheckCircle2
        : booking.status === 'rejected' || booking.status === 'cancelled'
            ? XCircle
            : Clock;

    const handleCancel = async () => {
        if (!user) return;
        setCancelling(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/cancel-booking', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ bookingId: booking.id }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'ยกเลิกไม่สำเร็จ');
                return;
            }
            toast.success('ยกเลิกการจองแล้ว');
            setShowConfirm(false);
            onCancelled();
        } catch {
            toast.error('เกิดข้อผิดพลาด');
        } finally {
            setCancelling(false);
        }
    };

    return (
        <>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5 p-1.5 rounded-lg bg-blue-500/10 flex-shrink-0">
                            <Calendar size={14} className="text-blue-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">การจองห้อง</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {booking.title}
                            </p>
                        </div>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${getBookingStatusColor(booking.status)}`}>
                        <StatusIcon size={10} />
                        {getBookingStatusLabel(booking.status)}
                    </span>
                </div>

                {/* Room & Time */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                        <span>{booking.roomName || booking.room}</span>
                    </div>
                    {startDate && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <Clock size={11} className="text-gray-400 flex-shrink-0" />
                            <span>
                                {format(startDate, 'EEE d MMM yyyy', { locale: th })}
                                {' · '}
                                {format(startDate, 'HH:mm')}
                                {endDate && ` – ${format(endDate, 'HH:mm')}`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                {canEdit && (
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={() => onEdit(booking)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <Edit2 size={12} />
                            แก้ไข
                        </button>
                        {canCancel && (
                            <button
                                onClick={() => setShowConfirm(true)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-red-200 dark:border-red-800 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <Trash2 size={12} />
                                ยกเลิก
                            </button>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-400">{booking.department}</span>
                    <span className="text-xs text-gray-400">#{booking.id?.slice(-6).toUpperCase()}</span>
                </div>
            </div>

            {/* Cancel Confirm Dialog */}
            {showConfirm && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowConfirm(false)} />
                    <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30">
                                <AlertCircle size={20} className="text-red-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">ยืนยันการยกเลิก</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    ยกเลิกการจอง <span className="font-medium text-gray-700 dark:text-gray-300">{booking.title}</span>?
                                </p>
                                <p className="text-xs text-gray-400 mt-1">ผู้ดูแลระบบจะได้รับแจ้งเตือน</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400"
                            >
                                ไม่ยกเลิก
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={cancelling}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                            >
                                {cancelling ? <Loader2 size={14} className="animate-spin" /> : null}
                                {cancelling ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
