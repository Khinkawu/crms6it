import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { createRepairNewFlexMessage } from '@/utils/flexMessageTemplates';

export async function POST(req: Request) {
    try {
        // Security: ตรวจสอบว่า request มาจากแหล่งที่เชื่อถือได้
        const apiKey = req.headers.get('x-api-key');
        const internalKey = req.headers.get('x-internal-request');
        const origin = req.headers.get('origin') || req.headers.get('referer') || '';

        const validApiKey = process.env.CRMS_API_SECRET_KEY;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';

        const isValidApiKey = validApiKey && apiKey === validApiKey;
        const isSameOrigin = origin.includes('crms6it') || origin.includes('localhost');
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

        // 1. Find relevant technicians using Admin SDK
        const techsSnap = await adminDb.collection('users')
            .where('role', '==', 'technician')
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
            }
        });

        // Deduplicate
        targetUserIds = Array.from(new Set(targetUserIds));

        // Fallback to default technician
        if (targetUserIds.length === 0 && process.env.LINE_TECHNICIAN_ID) {
            targetUserIds.push(process.env.LINE_TECHNICIAN_ID);
        }

        if (targetUserIds.length === 0) {
            return NextResponse.json({ status: 'skipped', reason: 'No technicians found' });
        }

        const deepLink = `${appUrl}/admin/repairs?ticketId=${ticketId}`;

        const flexMessage = createRepairNewFlexMessage({
            description,
            room,
            requesterName,
            imageUrl: imageOneUrl,
            ticketId,
            deepLink
        });

        // Use Multicast API
        await fetch('https://api.line.me/v2/bot/message/multicast', {
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

        return NextResponse.json({ status: 'ok', notifiedCount: targetUserIds.length });

    } catch (error) {
        console.error('Error sending LINE notification:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
