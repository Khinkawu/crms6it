import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '../../../lib/firebaseAdmin';
import { createRepairCompleteFlexMessage, createStatusBubble } from '@/utils/flexMessageTemplates';
import { getThaiStatus, getStatusHexColor } from '@/utils/repairHelpers';

export async function POST(request: Request) {
    try {
        // Require a valid Firebase ID token — any authenticated user (technician/admin)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        try {
            await adminAuth.verifyIdToken(authHeader.substring(7));
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { email, ticketId, room, problem, technicianNote, completionImage, status } = await request.json();

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

        // Choose message template based on status
        const historyLink = `https://liff.line.me/${process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR}?mode=history`;
        let flexMessage;

        if (status === 'completed') {
            flexMessage = createRepairCompleteFlexMessage({
                problem,
                room,
                technicianNote,
                completionImage,
                historyLink
            });
        } else {
            // in_progress, waiting_parts, etc.
            flexMessage = {
                type: 'flex',
                altText: `แจ้งซ่อม: ${getThaiStatus(status)} — ห้อง ${room}`,
                contents: createStatusBubble({
                    id: ticketId,
                    description: problem,
                    room,
                    status,
                    statusColor: getStatusHexColor(status),
                    statusText: getThaiStatus(status),
                    createdAt: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    technicianNote: technicianNote || undefined,
                    historyLink
                })
            };
        }

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
