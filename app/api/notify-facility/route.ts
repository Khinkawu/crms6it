import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { createFacilityNewFlexMessage } from '@/utils/flexMessageTemplates';
import admin from 'firebase-admin';

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

        console.log(`[notify-facility] Found ${targetUserIds.length} facility technicians from DB.`);

        // Deduplicate
        targetUserIds = Array.from(new Set(targetUserIds));

        // Fallback to default technician if no facility techs exist with Line IDs
        if (targetUserIds.length === 0 && process.env.LINE_TECHNICIAN_ID) {
            console.log(`[notify-facility] Using fallback LINE_TECHNICIAN_ID`);
            targetUserIds.push(process.env.LINE_TECHNICIAN_ID);
        }

        if (targetUserIds.length === 0) {
            console.warn('[notify-facility] No target user IDs found. Skipping notification.');
            return NextResponse.json({ status: 'skipped', reason: 'No facility technicians found' });
        }

        console.log(`[notify-facility] Final target users: ${targetUserIds.join(', ')}`);

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
        return NextResponse.json({ status: 'ok', notifiedCount: targetUserIds.length });

    } catch (error) {
        console.error('Error sending LINE notification:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
