import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { logWebEvent } from '@/lib/analytics';

export async function POST(req: Request) {
    try {
        // ─── Auth: Firebase Bearer + admin/moderator role ─────────────────────
        const authHeader = req.headers.get('Authorization') || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        let callerUid: string;
        try {
            const decoded = await adminAuth.verifyIdToken(idToken);
            callerUid = decoded.uid;
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const callerDoc = await adminDb.collection('users').doc(callerUid).get();
        const callerRole = callerDoc.data()?.role;
        if (callerRole !== 'admin' && callerRole !== 'moderator') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';

        // ─── Parse body ───────────────────────────────────────────────────────
        const body = await req.json();
        const { requesterId, status, title, roomName } = body as {
            requesterId: string;
            status: string;
            title: string;
            roomName: string;
        };

        if (!requesterId || !status || !title) {
            return NextResponse.json({ error: 'Missing required fields: requesterId, status, title' }, { status: 400 });
        }

        // Only push for approved / rejected — skip pending revert
        if (status !== 'approved' && status !== 'rejected') {
            return NextResponse.json({ status: 'skipped', reason: 'Status not notifiable' });
        }

        // ─── Get requester FCM tokens ─────────────────────────────────────────
        const userDoc = await adminDb.collection('users').doc(requesterId).get();
        if (!userDoc.exists) {
            console.warn('[notify-booking-result] User not found:', requesterId);
            return NextResponse.json({ status: 'skipped', reason: 'User not found' });
        }

        const tokens: string[] = userDoc.data()?.fcmTokens || [];
        if (tokens.length === 0) {
            return NextResponse.json({ status: 'skipped', reason: 'No FCM tokens registered' });
        }

        // ─── Build notification ───────────────────────────────────────────────
        const isApproved = status === 'approved';
        const notifTitle = isApproved ? '✅ การจองได้รับการอนุมัติ' : '❌ การจองถูกปฏิเสธ';
        const notifBody = roomName ? `${title} — ${roomName}` : title;

        // ─── Send FCM multicast ───────────────────────────────────────────────
        const result = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title: notifTitle,
                body: notifBody,
            },
            webpush: {
                notification: {
                    icon: '/icon.png',
                    badge: '/icon.png',
                    requireInteraction: true,
                },
                fcmOptions: {
                    link: `${appUrl}/booking`,
                },
            },
        });

        // ─── Clean up invalid tokens ──────────────────────────────────────────
        const invalidTokens: string[] = [];
        result.responses.forEach((resp, idx) => {
            if (
                !resp.success &&
                (resp.error?.code === 'messaging/invalid-registration-token' ||
                    resp.error?.code === 'messaging/registration-token-not-registered')
            ) {
                invalidTokens.push(tokens[idx]);
            }
        });

        if (invalidTokens.length > 0) {
            await adminDb.collection('users').doc(requesterId).update({
                fcmTokens: FieldValue.arrayRemove(...invalidTokens),
            });
        }


        logWebEvent({
            eventType: status === 'approved' ? 'booking_approve' : 'booking_reject',
            metadata: { requesterId, title, roomName, status },
        });
        return NextResponse.json({
            status: 'ok',
            successCount: result.successCount,
            failureCount: result.failureCount,
        });

    } catch (error) {
        console.error('[notify-booking-result] Error:', error);
        logWebEvent({ eventType: 'api_error', error: 'notify-booking-result failed', metadata: { route: 'notify-booking-result' } });
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
