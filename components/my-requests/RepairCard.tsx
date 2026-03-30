"use client";

import React from "react";
import { Wrench, Building2, Clock, CheckCircle2, AlertCircle, XCircle, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";
import { RepairTicket, FacilityTicket } from "@/types";
import { getThaiStatus, getStatusColor } from "@/hooks/useRepairAdmin";

type RepairType = 'it' | 'facility';

interface RepairCardProps {
    ticket: RepairTicket | FacilityTicket;
    type: RepairType;
}

function toDate(val: unknown): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof (val as Timestamp).toDate === 'function') return (val as Timestamp).toDate();
    return null;
}

export default function RepairCard({ ticket, type }: RepairCardProps) {
    const createdAt = toDate(ticket.createdAt);

    const statusColor = getStatusColor(ticket.status as any);
    const statusLabel = getThaiStatus(ticket.status as any);

    const isActive = ticket.status === 'pending' || ticket.status === 'in_progress' || ticket.status === 'waiting_parts';

    const StatusIcon = ticket.status === 'completed'
        ? CheckCircle2
        : ticket.status === 'cancelled'
            ? XCircle
            : ticket.status === 'in_progress' || ticket.status === 'waiting_parts'
                ? Loader2
                : Clock;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${type === 'it' ? 'bg-orange-500/10' : 'bg-teal-500/10'}`}>
                        {type === 'it'
                            ? <Wrench size={14} className="text-orange-500" />
                            : <Building2 size={14} className="text-teal-500" />
                        }
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {type === 'it' ? 'แจ้งซ่อม IT' : 'แจ้งซ่อมอาคาร'}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {ticket.room}
                        </p>
                    </div>
                </div>
                <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${statusColor}`}>
                    <StatusIcon size={10} className={ticket.status === 'in_progress' ? 'animate-spin' : ''} />
                    {statusLabel}
                </span>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {ticket.description}
            </p>

            {/* Technician (if assigned) */}
            {'technicianName' in ticket && ticket.technicianName && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <User size={11} />
                    <span>ช่าง: {ticket.technicianName}</span>
                </div>
            )}

            {/* Technician note (if completed) */}
            {'technicianNote' in ticket && ticket.technicianNote && ticket.status === 'completed' && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                    {ticket.technicianNote}
                </div>
            )}
            {'solutionNote' in ticket && ticket.solutionNote && ticket.status === 'completed' && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                    {ticket.solutionNote}
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-400">
                    {createdAt ? format(createdAt, 'd MMM yyyy', { locale: th }) : '—'}
                </span>
                <span className="text-xs text-gray-400">
                    #{ticket.id?.slice(-6).toUpperCase()}
                </span>
            </div>
        </div>
    );
}
