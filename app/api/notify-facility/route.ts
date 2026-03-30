import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { createFacilityNewFlexMessage } from '@/utils/flexMessageTemplates';
import admin from 'firebase-admin';
import { logWebEvent } from '@/lib/analytics';

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
        const { requesterName, room, issueCategory, description, imageOneUrl, zone, ticketId } = body;
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

        if (!token) {
            console.warn('Missing LINE_CHANNEL_ACCESS_TOKEN');
            return NextResponse.json({ status: 'skipped', reason: 'Missing config' });
        }

        // 1. Find relevant *facility* technicians using Admin SDK
        const techsSnap = await adminDb.collection('users')
            .where('role', '==', 'facility_technician')
            .get();

        let targetUserIds: string[] = [];

        techsSnap.forEach(doc => {
            const data = doc.data();
            const responsibility = data.responsibility || 'all';
            const lineId = data.lineUserId;

            if (!lineId) return;

            if (zone === 'junior_high' && (responsibility === 'junior_high' || responsibility === 'all')) {
                targetUserIds.push(lineId);
            } else if (zone === 'senior_high' && (responsibility === 'senior_high' || responsibility === 'all')) {
                targetUserIds.push(lineId);
            } else if (!zone || zone === 'all') { // Fallback if no zone specified
                targetUserIds.push(lineId);
            }
        });

        // Deduplicate
        targetUserIds = Array.from(new Set(targetUserIds));

        // Fallback to default technician if no facility techs exist with Line IDs
        if (targetUserIds.length === 0 && process.env.LINE_TECHNICIAN_ID) {
            targetUserIds.push(process.env.LINE_TECHNICIAN_ID);
        }

        if (targetUserIds.length === 0) {
            console.warn('[notify-facility] No target user IDs found. Skipping notification.');
            return NextResponse.json({ status: 'skipped', reason: 'No facility technicians found' });
        }

        const deepLink = `${appUrl}/admin/facility?ticketId=${ticketId}`;

        const flexMessage = createFacilityNewFlexMessage({
            description,
            room,
            requesterName,
            imageUrl: imageOneUrl,
            ticketId,
            deepLink,
            zone
        });

        // Use Multicast API
        const lineResponse = await fetch('https://api.line.me/v2/bot/message/multicast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                to: targetUserIds,
                messages: [flexMessage],
            }),
        });

        if (!lineResponse.ok) {
            const errorData = await lineResponse.text();
            console.error('[notify-facility] LINE API Error:', lineResponse.status, errorData);
            return NextResponse.json({ status: 'error', reason: 'LINE API error', details: errorData }, { status: 500 });
        }

        // Write in-app notifications for relevant facility technicians
        const facilityBatch = adminDb.batch();
        const notifRef = adminDb.collection('notifications');
        techsSnap.forEach(doc => {
            const data = doc.data();
            const responsibility = data.responsibility || 'all';
            const isRelevant =
                (zone === 'junior_high' && (responsibility === 'junior_high' || responsibility === 'all')) ||
                (zone === 'senior_high' && (responsibility === 'senior_high' || responsibility === 'all')) ||
                (!zone || zone === 'all');
            if (!isRelevant) return;
            facilityBatch.set(notifRef.doc(), {
                userId: doc.id,
                type: 'facility_new',
                title: `ซ่อมอาคารใหม่: ${room}`,
                body: `${requesterName} — ${description.slice(0, 80)}`,
                linkTo: `/admin/facility?ticketId=${ticketId}`,
                read: false,
                createdAt: FieldValue.serverTimestamp(),
                metadata: { ticketId: ticketId ?? '' },
            });
        });
        facilityBatch.commit().catch(() => {});

        // FCM push to relevant facility technicians
        const fcmTokens: string[] = [];
        techsSnap.forEach(doc => {
            const data = doc.data();
            const responsibility = data.responsibility || 'all';
            const isRelevant =
                (zone === 'junior_high' && (responsibility === 'junior_high' || responsibility === 'all')) ||
                (zone === 'senior_high' && (responsibility === 'senior_high' || responsibility === 'all')) ||
                (!zone || zone === 'all');
            if (!isRelevant) return;
            const tokens: string[] = data.fcmTokens || [];
            fcmTokens.push(...tokens);
        });
        if (fcmTokens.length > 0) {
            admin.messaging().sendEachForMulticast({
                tokens: fcmTokens,
                notification: {
                    title: `ซ่อมอาคารใหม่: ${room}`,
                    body: `${requesterName} — ${description.slice(0, 80)}`,
                },
                webpush: { fcmOptions: { link: `${appUrl}/my-work` } },
            }).catch(() => {});
        }

        console.log(`[notify-facility] Successfully notified ${targetUserIds.length} users.`);
        logWebEvent({ eventType: 'repair_submit', metadata: { ticketId, room, zone, type: 'facility', issueCategory } });
        return NextResponse.json({ status: 'ok', notifiedCount: targetUserIds.length });

    } catch (error) {
        console.error('Error sending LINE notification:', error);
        logWebEvent({ eventType: 'api_error', error: 'notify-facility failed', metadata: { route: 'notify-facility' } });
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
