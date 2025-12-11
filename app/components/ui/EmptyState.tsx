"use client";

import React from "react";
import { FileX, Package, Calendar, Wrench, Search, Users } from "lucide-react";

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

/**
 * Empty state component for when no data is available
 */
export default function EmptyState({
    icon,
    title,
    description,
    action
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6 text-gray-400 dark:text-gray-500">
                {icon || <FileX size={40} strokeWidth={1.5} />}
            </div>
            <h3 className="text-lg font-bold text-text mb-2">{title}</h3>
            {description && (
                <p className="text-text-secondary max-w-sm mb-6">{description}</p>
            )}
            {action && (
                <button
                    onClick={action.onClick}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-cyan-500/20 transition-all"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}

// Pre-configured empty states for common scenarios
export function EmptyInventory({ onAdd }: { onAdd?: () => void }) {
    return (
        <EmptyState
            icon={<Package size={40} strokeWidth={1.5} />}
            title="ยังไม่มีรายการพัสดุ"
            description="เริ่มต้นเพิ่มอุปกรณ์เข้าคลังพัสดุของคุณ"
            action={onAdd ? { label: "เพิ่มรายการใหม่", onClick: onAdd } : undefined}
        />
    );
}

export function EmptyBookings({ onBook }: { onBook?: () => void }) {
    return (
        <EmptyState
            icon={<Calendar size={40} strokeWidth={1.5} />}
            title="ไม่มีการจองห้องประชุม"
            description="ยังไม่มีการจองห้องประชุมในขณะนี้"
            action={onBook ? { label: "จองห้องประชุม", onClick: onBook } : undefined}
        />
    );
}

export function EmptyRepairs() {
    return (
        <EmptyState
            icon={<Wrench size={40} strokeWidth={1.5} />}
            title="ไม่มีใบแจ้งซ่อม"
            description="ยังไม่มีรายการแจ้งซ่อมในขณะนี้"
        />
    );
}

export function EmptySearchResults({ query }: { query?: string }) {
    return (
        <EmptyState
            icon={<Search size={40} strokeWidth={1.5} />}
            title="ไม่พบผลลัพธ์"
            description={query
                ? `ไม่พบรายการที่ตรงกับ "${query}"`
                : "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
            }
        />
    );
}

export function EmptyUsers() {
    return (
        <EmptyState
            icon={<Users size={40} strokeWidth={1.5} />}
            title="ไม่พบผู้ใช้งาน"
            description="ยังไม่มีผู้ใช้งานในระบบ"
        />
    );
}
