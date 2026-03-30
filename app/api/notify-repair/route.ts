import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { createRepairNewFlexMessage } from '@/utils/flexMessageTemplates';
import admin from 'firebase-admin';
import { logWebEvent } from '@/lib/analytics';
import { logError } from '@/lib/errorLogger';

export async function POST(req: Request) {
    try {
        // Security: require Firebase Bearer token (any authenticated user)
        const authHeader = req.headers.get('Authorization') || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        try {
            await adminAuth.verifyIdToken(idToken);
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';

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
            try {
                const lineRes = await fetch('https://api.line.me/v2/bot/message/multicast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ to: lineTargetIds, messages: [flexMessage] }),
                });
                if (!lineRes.ok) {
                    const errData = await lineRes.json().catch(() => ({}));
                    logError({ source: 'line', severity: 'critical', message: `LINE multicast failed: ${JSON.stringify(errData)}`, path: '/api/notify-repair', metadata: { ticketId, lineTargetIds } });
                }
            } catch (lineErr) {
                logError({ source: 'line', severity: 'critical', message: `LINE multicast exception: ${String(lineErr)}`, path: '/api/notify-repair', metadata: { ticketId } });
            }
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
            try {
                await batch.commit();
            } catch (batchErr) {
                logError({ source: 'batch', severity: 'critical', message: `In-app notification batch.commit failed: ${String(batchErr)}`, path: '/api/notify-repair', metadata: { ticketId, targetCount: uniqueUids.length } });
            }
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
                }).catch((err) => {
                    logError({ source: 'fcm', severity: 'critical', message: `FCM technician multicast failed: ${String(err)}`, path: '/api/notify-repair', metadata: { ticketId, tokenCount: techTokens.length } });
                });
            }
            if (modTokens.length > 0) {
                await admin.messaging().sendEachForMulticast({
                    tokens: modTokens,
                    notification: fcmNotification,
                    webpush: { fcmOptions: { link: `${appUrl}/admin/repairs` } },
                }).catch((err) => {
                    logError({ source: 'fcm', severity: 'critical', message: `FCM moderator multicast failed: ${String(err)}`, path: '/api/notify-repair', metadata: { ticketId, tokenCount: modTokens.length } });
                });
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
