import {
    addDoc,
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { NotificationType } from '../types';

interface CreateNotificationData {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    linkTo: string;
    metadata?: Record<string, string>;
}

export async function createNotification(data: CreateNotificationData): Promise<void> {
    const ticketId = data.metadata?.ticketId;
    if (ticketId) {
        // Deterministic ID: upsert so same ticket never creates duplicate notifications
        const docId = `${data.userId}_${data.type}_${ticketId}`;
        await setDoc(doc(db, 'notifications', docId), {
            ...data,
            read: false,
            createdAt: serverTimestamp(),
        });
    } else {
        await addDoc(collection(db, 'notifications'), {
            ...data,
            read: false,
            createdAt: serverTimestamp(),
        });
    }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
    const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
}

export async function deleteNotification(notificationId: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'notifications', notificationId));
    await batch.commit();
}

export async function deleteAllNotifications(userId: string): Promise<void> {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
}
