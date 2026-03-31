import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { logWebEvent } from '@/lib/analytics';

/**
 * PATCH /api/cancel-booking
 * User ยกเลิกการจองของตัวเอง (pending หรือ approved)
 * - verify caller == booking.requesterId
 * - update status = 'cancelled'
 * - FCM + in-app notification → admin + moderator ทุกคน
 */
export async function PATCH(req: Request) {
    try {
        // ── Auth ──────────────────────────────────────────────────────────────
        const authHeader = req.headers.get('Authorization') || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let callerUid: string;
        try {
            const decoded = await adminAuth.verifyIdToken(idToken);
            callerUid = decoded.uid;
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── Parse body ────────────────────────────────────────────────────────
        const { bookingId } = await req.json() as { bookingId: string };
        if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 });

        // ── Verify ownership ──────────────────────────────────────────────────
        const bookingRef = adminDb.collection('bookings').doc(bookingId);
        const bookingSnap = await bookingRef.get();
        if (!bookingSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const booking = bookingSnap.data()!;
        if (booking.requesterId !== callerUid) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ── Only cancel pending or approved ───────────────────────────────────
        if (booking.status !== 'pending' && booking.status !== 'approved') {
            return NextResponse.json({ error: 'Cannot cancel a booking with status: ' + booking.status }, { status: 400 });
        }

        // ── Update status ─────────────────────────────────────────────────────
        await bookingRef.update({
            status: 'cancelled',
            cancelledAt: FieldValue.serverTimestamp(),
            cancelledBy: callerUid,
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
        const title = booking.title || 'ไม่ระบุชื่อ';
        const roomName = booking.roomName || booking.room || '';
        const requesterName = booking.requesterName || '';

        // ── Notify admin + moderator ──────────────────────────────────────────
        const [adminSnap, modSnap] = await Promise.all([
            adminDb.collection('users').where('role', '==', 'admin').get(),
            adminDb.collection('users').where('role', '==', 'moderator').get(),
        ]);

        const recipientIds = new Set<string>();
        [...adminSnap.docs, ...modSnap.docs].forEach(d => recipientIds.add(d.id));

        if (recipientIds.size > 0) {
            const batch = adminDb.batch();
            const notifRef = adminDb.collection('notifications');
            for (const uid of Array.from(recipientIds)) {
                batch.set(notifRef.doc(), {
                    userId: uid,
                    type: 'booking_cancelled',
                    title: `❌ ยกเลิกการจอง: ${title}`,
                    body: roomName ? `${roomName} — ${requesterName}` : requesterName,
                    linkTo: '/manage/bookings',
                    read: false,
                    createdAt: FieldValue.serverTimestamp(),
                    metadata: { bookingId },
                });
            }
            await batch.commit();

            // FCM push
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
                        title: `❌ ยกเลิกการจอง: ${title}`,
                        body: roomName ? `${roomName} — ${requesterName}` : requesterName,
                    },
                    webpush: { fcmOptions: { link: `${appUrl}/manage/bookings` } },
                }).catch((err) => {
                    console.error('[cancel-booking] FCM error (non-fatal):', err);
                });
            }
        }

        logWebEvent({ eventType: 'booking_cancel', metadata: { bookingId, title } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[cancel-booking] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
