"use client";

import React from "react";
import { Package, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { format, isPast } from "date-fns";
import { th } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";
import { Transaction } from "@/types";

interface BorrowCardProps {
    transaction: Transaction;
}

function toDate(val: unknown): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof (val as Timestamp).toDate === 'function') return (val as Timestamp).toDate();
    return null;
}

export default function BorrowCard({ transaction: tx }: BorrowCardProps) {
    const borrowDate = toDate(tx.transactionDate);
    const returnDate = toDate(tx.returnDate ?? null);
    const actualReturnDate = toDate(tx.actualReturnDate ?? null);

    const isCompleted = tx.status === 'completed';
    const isOverdue = !isCompleted && returnDate && isPast(returnDate);

    const statusColor = isCompleted
        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
        : isOverdue
            ? 'bg-red-500/10 text-red-600 border-red-500/20'
            : 'bg-amber-500/10 text-amber-600 border-amber-500/20';

    const statusLabel = isCompleted ? 'คืนแล้ว' : isOverdue ? 'เกินกำหนด' : 'กำลังยืม';
    const StatusIcon = isCompleted ? CheckCircle2 : isOverdue ? AlertTriangle : Clock;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-purple-500/10 flex-shrink-0">
                        <Package size={14} className="text-purple-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {tx.type === 'borrow' ? 'ยืมอุปกรณ์' : 'เบิกอุปกรณ์'}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {tx.userRoom || '—'}
                        </p>
                    </div>
                </div>
                <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${statusColor}`}>
                    <StatusIcon size={10} />
                    {statusLabel}
                </span>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-2">
                    <p className="text-xs text-gray-400 mb-0.5">วันที่ยืม</p>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {borrowDate ? format(borrowDate, 'd MMM yyyy', { locale: th }) : '—'}
                    </p>
                </div>
                <div className={`rounded-lg px-2.5 py-2 ${isOverdue ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <p className="text-xs text-gray-400 mb-0.5">
                        {isCompleted ? 'วันที่คืน' : 'กำหนดคืน'}
                    </p>
                    <p className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                        {isCompleted
                            ? (actualReturnDate ? format(actualReturnDate, 'd MMM yyyy', { locale: th }) : '—')
                            : (returnDate ? format(returnDate, 'd MMM yyyy', { locale: th }) : '—')
                        }
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-400">{tx.userPhone || '—'}</span>
                <span className="text-xs text-gray-400">#{tx.id?.slice(-6).toUpperCase()}</span>
            </div>
        </div>
    );
}
