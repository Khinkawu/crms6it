"use client";

import { useEffect, useState, useCallback } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppNotification } from '../types';
import {
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    deleteAllNotifications,
} from '../lib/notifications';

interface UseNotificationsReturn {
    notifications: AppNotification[];
    unreadCount: number;
    loading: boolean;
    markAsRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    remove: (id: string) => Promise<void>;
    removeAll: () => Promise<void>;
}

export function useNotifications(userId: string | undefined): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsub = onSnapshot(q, (snap) => {
            const items: AppNotification[] = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
            } as AppNotification));
            setNotifications(items);
            setLoading(false);
        }, () => {
            setLoading(false);
        });

        return () => unsub();
    }, [userId]);

    const markAsRead = useCallback(async (id: string) => {
        await markNotificationRead(id);
    }, []);

    const markAllRead = useCallback(async () => {
        if (!userId) return;
        await markAllNotificationsRead(userId);
    }, [userId]);

    const remove = useCallback(async (id: string) => {
        await deleteNotification(id);
    }, []);

    const removeAll = useCallback(async () => {
        if (!userId) return;
        await deleteAllNotifications(userId);
    }, [userId]);

    const unreadCount = notifications.filter(n => !n.read).length;

    return { notifications, unreadCount, loading, markAsRead, markAllRead, remove, removeAll };
}
