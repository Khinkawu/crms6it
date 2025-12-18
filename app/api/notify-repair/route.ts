import { NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { createRepairNewFlexMessage } from '@/utils/flexMessageTemplates';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { requesterName, room, description, imageOneUrl, zone, ticketId } = body;
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

        if (!token) {
            console.warn('Missing LINE_CHANNEL_ACCESS_TOKEN');
            return NextResponse.json({ status: 'skipped', reason: 'Missing config' });
        }

        // 1. Find relevant technicians
        const techsQuery = query(collection(db, "users"), where("role", "==", "technician"));
        const techsSnap = await getDocs(techsQuery);

        let targetUserIds: string[] = [];

        techsSnap.forEach(doc => {
            const data = doc.data();
            const responsibility = data.responsibility || 'all'; // Default to all if not set
            const lineId = data.lineUserId;

            if (!lineId) return;

            // Logic:
            // Common -> Notify everyone
            // Junior High -> Notify Junior + All
            // Senior High -> Notify Senior + All
            if (zone === 'junior_high' && (responsibility === 'junior_high' || responsibility === 'all')) {
                targetUserIds.push(lineId);
            } else if (zone === 'senior_high' && (responsibility === 'senior_high' || responsibility === 'all')) {
                targetUserIds.push(lineId);
            }
        });

        // Deduplicate
        targetUserIds = Array.from(new Set(targetUserIds));

        // Fallback to default technician if no one found (optional, but good for safety)
        if (targetUserIds.length === 0 && process.env.LINE_TECHNICIAN_ID) {
            targetUserIds.push(process.env.LINE_TECHNICIAN_ID);
        }

        if (targetUserIds.length === 0) {
            return NextResponse.json({ status: 'skipped', reason: 'No technicians found' });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
        const deepLink = `${appUrl}/admin/repairs?ticketId=${ticketId}`;

        // Use new professional Flex Message template
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
