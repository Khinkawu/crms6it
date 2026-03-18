import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

export async function POST(req: Request) {
    try {
        // ─── Auth (same pattern as notify-repair) ────────────────────────────
        const apiKey = req.headers.get('x-api-key');
        const internalKey = req.headers.get('x-internal-request');
        const origin = req.headers.get('origin') || req.headers.get('referer') || '';

        const validApiKey = process.env.CRMS_API_SECRET_KEY;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';

        const isValidApiKey = validApiKey && apiKey === validApiKey;
        const isSameOrigin = origin.startsWith(appUrl) || origin.startsWith('http://localhost');
        const isInternalRequest = internalKey === 'true';

        if (!isValidApiKey && !isSameOrigin && !isInternalRequest) {
            console.warn('[notify-booking-result] Unauthorized access from:', origin);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
            console.log(`[notify-booking-result] Removed ${invalidTokens.length} invalid token(s) for user ${requesterId}`);
        }

        console.log(`[notify-booking-result] status=${status} requesterId=${requesterId} success=${result.successCount} fail=${result.failureCount}`);

        return NextResponse.json({
            status: 'ok',
            successCount: result.successCount,
            failureCount: result.failureCount,
        });

    } catch (error) {
        console.error('[notify-booking-result] Error:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
