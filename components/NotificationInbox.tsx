"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    Wrench,
    CalendarDays,
    Camera,
    Building2,
    CheckCheck,
    Trash2,
    X,
    InboxIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { setupPushNotifications } from '@/lib/fcm';
import { AppNotification, NotificationType } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

// ─── Icon & color per notification type ────────────────────────────────────────
const TYPE_META: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
    repair_new:      { icon: Wrench,       color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-900/30' },
    repair_status:   { icon: Wrench,       color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-900/30' },
    facility_new:    { icon: Building2,    color: 'text-purple-600 dark:text-purple-400',  bg: 'bg-purple-50 dark:bg-purple-900/30' },
    facility_status: { icon: Building2,    color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
    booking_pending: { icon: CalendarDays, color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-900/30' },
    booking_result:  { icon: CalendarDays, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    photo_assigned:  { icon: Camera,       color: 'text-pink-600 dark:text-pink-400',      bg: 'bg-pink-50 dark:bg-pink-900/30' },
    photo_submitted: { icon: Camera,       color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    photo_late:      { icon: Camera,       color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/30' },
};

function timeAgo(ts: any): string {
    try {
        const date = ts?.toDate ? ts.toDate() : new Date(ts);
        return formatDistanceToNow(date, { addSuffix: true, locale: th });
    } catch {
        return '';
    }
}

// ─── Single notification row ────────────────────────────────────────────────────
function NotificationRow({
    notif,
    onRead,
    onDelete,
    onNavigate,
}: {
    notif: AppNotification;
    onRead: (id: string) => void;
    onDelete: (id: string) => void;
    onNavigate: (notif: AppNotification) => void;
}) {
    const meta = TYPE_META[notif.type] ?? TYPE_META.repair_status;
    const Icon = meta.icon;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => onNavigate(notif)}
            className={`
                group relative flex items-start gap-3 px-4 py-3 cursor-pointer
                transition-colors duration-150
                ${notif.read
                    ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    : 'bg-blue-50/60 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'}
            `}
        >
            {/* Type icon */}
            <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.bg}`}>
                <Icon size={16} className={meta.color} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${notif.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white font-medium'}`}>
                    {notif.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.body}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    {timeAgo(notif.createdAt)}
                </p>
            </div>

            {/* Unread dot */}
            {!notif.read && (
                <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-blue-500" />
            )}

            {/* Hover actions */}
            <div className="absolute right-3 top-3 hidden group-hover:flex items-center gap-1">
                {!notif.read && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRead(notif.id!); }}
                        title="ทำเครื่องหมายว่าอ่านแล้ว"
                        className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                    >
                        <CheckCheck size={13} />
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(notif.id!); }}
                    title="ลบ"
                    className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                    <X size={13} />
                </button>
            </div>
        </motion.div>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function NotificationInbox() {
    const { user } = useAuth();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const { notifications, unreadCount, markAsRead, markAllRead, remove, removeAll } =
        useNotifications(user?.uid);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleBellClick = async () => {
        // iOS requires permission request from user gesture — trigger on first bell tap
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile && user && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            await setupPushNotifications(user.uid).catch(() => {});
        }
        setOpen(prev => !prev);
    };

    const handleNavigate = async (notif: AppNotification) => {
        if (!notif.read) await markAsRead(notif.id!);
        setOpen(false);
        router.push(notif.linkTo);
    };

    const handleMarkAllRead = async () => {
        await markAllRead();
    };

    const handleDeleteAll = async () => {
        await removeAll();
    };

    return (
        <div className="relative">
            {/* Bell button */}
            <button
                ref={buttonRef}
                onClick={handleBellClick}
                className={`relative p-2.5 rounded-xl transition-colors ${
                    open
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'bg-gray-100/80 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-gray-700/50'
                }`}
            >
                <Bell size={18} />
                <AnimatePresence>
                    {unreadCount > 0 && (
                        <motion.span
                            key="badge"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.span>
                    )}
                </AnimatePresence>
            </button>

            {/* Dropdown panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        ref={panelRef}
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-1rem)] max-h-[70vh] flex flex-col rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-700/70 shadow-2xl z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                                    การแจ้งเตือน
                                </h3>
                                {unreadCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                                        {unreadCount} ใหม่
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                    >
                                        <CheckCheck size={12} />
                                        อ่านทั้งหมด
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button
                                        onClick={handleDeleteAll}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                        ลบทั้งหมด
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-14 gap-3 text-gray-400 dark:text-gray-600">
                                    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                        <InboxIcon size={24} />
                                    </div>
                                    <p className="text-sm">ไม่มีการแจ้งเตือน</p>
                                </div>
                            ) : (
                                <AnimatePresence initial={false}>
                                    {notifications.map((notif, index) => (
                                        <div key={notif.id}>
                                            <NotificationRow
                                                notif={notif}
                                                onRead={markAsRead}
                                                onDelete={remove}
                                                onNavigate={handleNavigate}
                                            />
                                            {index < notifications.length - 1 && (
                                                <div className="mx-4 border-b border-gray-100 dark:border-gray-800/60" />
                                            )}
                                        </div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
