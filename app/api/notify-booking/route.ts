import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { logWebEvent } from '@/lib/analytics';

// Per-UID rate limit: 10 requests per 60 seconds (prevents booking notification spam)
const uidRateLimit = new Map<string, { count: number; resetAt: number }>();
const UID_LIMIT = 10;
const UID_WINDOW_MS = 60 * 1000;

function checkUidRateLimit(uid: string): boolean {
    const now = Date.now();
    const entry = uidRateLimit.get(uid);
    if (!entry || now > entry.resetAt) {
        uidRateLimit.set(uid, { count: 1, resetAt: now + UID_WINDOW_MS });
        return true;
    }
    if (entry.count >= UID_LIMIT) return false;
    entry.count++;
    return true;
}

/**
 * POST /api/notify-booking
 * สร้าง in-app notification ให้ admin + moderator ทุกคน เมื่อมี booking ใหม่
 * Called client-side after addDoc("bookings") with Firebase ID token
 */
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        let callerUid: string;
        try {
            const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
            callerUid = decoded.uid;
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!checkUidRateLimit(callerUid)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { bookingId, title, roomName, requesterName, startTime } = await request.json();

        // Query all admin + moderator users
        const [adminSnap, modSnap] = await Promise.all([
            adminDb.collection('users').where('role', '==', 'admin').get(),
            adminDb.collection('users').where('role', '==', 'moderator').get(),
        ]);

        const recipientIds = new Set<string>();
        [...adminSnap.docs, ...modSnap.docs].forEach(d => recipientIds.add(d.id));

        console.log(`[notify-booking] admins=${adminSnap.size} mods=${modSnap.size} total=${recipientIds.size} bookingId=${bookingId}`);

        if (recipientIds.size === 0) {
            console.warn('[notify-booking] No admin/mod recipients found — check users collection roles');
            return NextResponse.json({ success: true, notified: 0 });
        }

        const batch = adminDb.batch();
        const notifRef = adminDb.collection('notifications');

        for (const uid of Array.from(recipientIds)) {
            batch.set(notifRef.doc(), {
                userId: uid,
                type: 'booking_pending',
                title: `คำขอจอง: ${title}`,
                body: `${roomName} — ${requesterName} · ${startTime}`,
                linkTo: '/admin/bookings',
                read: false,
                createdAt: FieldValue.serverTimestamp(),
                metadata: { bookingId: bookingId ?? '' },
            });
        }

        await batch.commit();

        // FCM push to all recipients who have registered tokens
        const fcmTokens: string[] = [];
        await Promise.all(Array.from(recipientIds).map(async (uid) => {
            const userDoc = await adminDb.collection('users').doc(uid).get();
            const tokens: string[] = userDoc.data()?.fcmTokens || [];
            fcmTokens.push(...tokens);
        }));
        if (fcmTokens.length > 0) {
            await admin.messaging().sendEachForMulticast({
                tokens: fcmTokens,
                notification: {
                    title: `คำขอจอง: ${title}`,
                    body: `${roomName} — ${requesterName} · ${startTime}`,
                },
                webpush: { fcmOptions: { link: '/admin/bookings' } },
            }).catch(() => {});
        }

        logWebEvent({ eventType: 'booking_create', metadata: { bookingId, title, roomName } });
        return NextResponse.json({ success: true, notified: recipientIds.size });
    } catch (error) {
        console.error('[notify-booking] Error:', error);
        logWebEvent({ eventType: 'api_error', error: 'notify-booking failed', metadata: { route: 'notify-booking' } });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
