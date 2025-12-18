import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebaseAdmin';
import { createRepairCompleteFlexMessage } from '@/utils/flexMessageTemplates';

export async function POST(request: Request) {
    try {
        const { email, ticketId, room, problem, technicianNote, completionImage } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // 1. Find User by Email
        const usersRef = adminDb.collection('users');
        const querySnapshot = await usersRef.where('email', '==', email).get();

        if (querySnapshot.empty) {
            return NextResponse.json({ message: 'User not found, notification skipped' });
        }

        const userDoc = querySnapshot.docs[0].data();
        const lineUserId = userDoc.lineUserId;

        if (!lineUserId) {
            return NextResponse.json({ message: 'User not linked to LINE, notification skipped' });
        }

        // 2. Send LINE Push Message
        const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!channelAccessToken) {
            console.error('LINE_CHANNEL_ACCESS_TOKEN is missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Use new professional Flex Message template
        const flexMessage = createRepairCompleteFlexMessage({
            problem,
            room,
            technicianNote,
            completionImage,
            historyLink: `https://liff.line.me/${process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR}?mode=history`
        });

        const message = {
            to: lineUserId,
            messages: [flexMessage]
        };

        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('LINE API Error:', errorData);
            return NextResponse.json({ error: 'Failed to send LINE message' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Notification Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
