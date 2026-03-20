import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { createRepairNewFlexMessage } from '@/utils/flexMessageTemplates';
import admin from 'firebase-admin';
import { logWebEvent } from '@/lib/analytics';

export async function POST(req: Request) {
    try {
        // Security: ตรวจสอบว่า request มาจากแหล่งที่เชื่อถือได้
        const apiKey = req.headers.get('x-api-key');
        const internalKey = req.headers.get('x-internal-request');
        const origin = req.headers.get('origin') || req.headers.get('referer') || '';

        const validApiKey = process.env.CRMS_API_SECRET_KEY;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';

        const isValidApiKey = validApiKey && apiKey === validApiKey;
        const isSameOrigin = origin.startsWith(appUrl) || origin.startsWith('http://localhost');
        const isInternalRequest = internalKey === 'true';

        if (!isValidApiKey && !isSameOrigin && !isInternalRequest) {
            console.warn('Unauthorized API access attempt from:', origin);
            return NextResponse.json(
                { error: 'Unauthorized: Invalid credentials' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { requesterName, room, description, imageOneUrl, zone, ticketId } = body;
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

        if (!token) {
            console.warn('Missing LINE_CHANNEL_ACCESS_TOKEN');
            return NextResponse.json({ status: 'skipped', reason: 'Missing config' });
        }

        // 1. Find relevant staff: technicians + moderators using Admin SDK
        const [techsSnap, modsSnap] = await Promise.all([
            adminDb.collection('users').where('role', '==', 'technician').get(),
            adminDb.collection('users').where('role', '==', 'moderator').get(),
        ]);

        const isRelevantByZone = (responsibility: string) =>
            !zone ||
            responsibility === 'all' ||
            responsibility === zone;

        let lineTargetIds: string[] = [];
        const inAppTargetUids: string[] = [];

        techsSnap.forEach(doc => {
            const data = doc.data();
            if (!isRelevantByZone(data.responsibility || 'all')) return;
            inAppTargetUids.push(doc.id);
            if (data.lineUserId) lineTargetIds.push(data.lineUserId);
        });

        // Moderators always get in-app noti (they oversee all zones)
        modsSnap.forEach(doc => {
            const data = doc.data();
            inAppTargetUids.push(doc.id);
            if (data.lineUserId) lineTargetIds.push(data.lineUserId);
        });

        lineTargetIds = Array.from(new Set(lineTargetIds));

        // Fallback to default technician LINE ID
        if (lineTargetIds.length === 0 && process.env.LINE_TECHNICIAN_ID) {
            lineTargetIds.push(process.env.LINE_TECHNICIAN_ID);
        }

        const deepLink = `${appUrl}/admin/repairs?ticketId=${ticketId}`;

        // LINE multicast (best-effort)
        if (lineTargetIds.length > 0) {
            const flexMessage = createRepairNewFlexMessage({
                description,
                room,
                requesterName,
                imageUrl: imageOneUrl,
                ticketId,
                deepLink
            });
            await fetch('https://api.line.me/v2/bot/message/multicast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ to: lineTargetIds, messages: [flexMessage] }),
            });
        }

        // In-app notifications for all relevant staff
        if (inAppTargetUids.length > 0) {
            const notifRef = adminDb.collection('notifications');
            const batch = adminDb.batch();
            const uniqueUids = Array.from(new Set(inAppTargetUids));
            uniqueUids.forEach(uid => {
                batch.set(notifRef.doc(), {
                    userId: uid,
                    type: 'repair_new',
                    title: `งานซ่อมใหม่: ห้อง ${room}`,
                    body: `${requesterName} — ${description.slice(0, 80)}`,
                    linkTo: `/admin/repairs?ticketId=${ticketId}`,
                    read: false,
                    createdAt: FieldValue.serverTimestamp(),
                    metadata: { ticketId: ticketId ?? '' },
                });
            });
            await batch.commit();
        }

        // FCM push — technician → /my-work, moderator → /admin/repairs
        if (inAppTargetUids.length > 0) {
            const techTokens: string[] = [];
            const modTokens: string[] = [];
            await Promise.all(Array.from(new Set(inAppTargetUids)).map(async (uid) => {
                const userDoc = await adminDb.collection('users').doc(uid).get();
                const data = userDoc.data();
                const tokens: string[] = data?.fcmTokens || [];
                if (data?.role === 'moderator') {
                    modTokens.push(...tokens);
                } else {
                    techTokens.push(...tokens);
                }
            }));
            const fcmNotification = {
                title: `งานซ่อมใหม่: ห้อง ${room}`,
                body: `${requesterName} — ${description.slice(0, 80)}`,
            };
            if (techTokens.length > 0) {
                await admin.messaging().sendEachForMulticast({
                    tokens: techTokens,
                    notification: fcmNotification,
                    webpush: { fcmOptions: { link: `${appUrl}/my-work` } },
                }).catch(() => {});
            }
            if (modTokens.length > 0) {
                await admin.messaging().sendEachForMulticast({
                    tokens: modTokens,
                    notification: fcmNotification,
                    webpush: { fcmOptions: { link: `${appUrl}/admin/repairs` } },
                }).catch(() => {});
            }
        }

        logWebEvent({ eventType: 'repair_submit', metadata: { ticketId, room, zone } });
        return NextResponse.json({ status: 'ok', notifiedCount: lineTargetIds.length });

    } catch (error) {
        console.error('Error sending LINE notification:', error);
        logWebEvent({ eventType: 'api_error', error: 'notify-repair failed', metadata: { route: 'notify-repair' } });
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
