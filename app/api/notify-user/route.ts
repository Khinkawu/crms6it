import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '../../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { createRepairCompleteFlexMessage, createStatusBubble } from '@/utils/flexMessageTemplates';
import { getThaiStatus, getStatusHexColor } from '@/utils/repairHelpers';
import admin from 'firebase-admin';
import { logLineEvent } from '@/lib/lineMonitor';
import { logWebEvent } from '@/lib/analytics';
import { logError } from '@/lib/errorLogger';

export async function POST(request: Request) {
    try {
        // Require a valid Firebase ID token from staff (admin/moderator/technician)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        let senderUid: string;
        try {
            const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
            senderUid = decoded.uid;
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Only staff roles may trigger notifications — block regular users from spamming
        const senderDoc = await adminDb.collection('users').doc(senderUid).get();
        const senderRole = senderDoc.data()?.role as string | undefined;
        const allowedRoles = ['admin', 'moderator', 'technician', 'facility_technician'];
        if (!senderRole || !allowedRoles.includes(senderRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
        const userUID = querySnapshot.docs[0].id;
        let lineUserId = userDoc.lineUserId;

        // Fallback: check line_bindings collection (users who linked via LiffGuard)
        if (!lineUserId) {
            const bindingSnap = await adminDb.collection('line_bindings')
                .where('uid', '==', userUID)
                .limit(1)
                .get();
            if (!bindingSnap.empty) {
                lineUserId = bindingSnap.docs[0].id;
                adminDb.collection('users').doc(userUID).update({ lineUserId }).catch(() => {});
            }
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
        const thaiStatus = getThaiStatus(status);
        const notifTitle = status === 'completed' ? `งานซ่อมเสร็จแล้ว` : `อัปเดตงานซ่อม: ${thaiStatus}`;
        const notifBody = `ห้อง ${room} — ${problem?.slice(0, 80)}`;

        // 2. In-app notification for requester
        await adminDb.collection('notifications').add({
            userId: userUID,
            type: 'repair_status',
            title: notifTitle,
            body: notifBody,
            linkTo: '/repair-history',
            read: false,
            createdAt: FieldValue.serverTimestamp(),
            metadata: { ticketId: ticketId ?? '' },
        });

        // 3. FCM push to requester
        const fcmTokens: string[] = userDoc.fcmTokens || [];
        if (fcmTokens.length > 0) {
            await admin.messaging().sendEachForMulticast({
                tokens: fcmTokens,
                notification: { title: notifTitle, body: notifBody },
                webpush: { fcmOptions: { link: `${appUrl}/repair-history` } },
            }).catch((err) => {
                logError({ source: 'fcm', severity: 'high', message: `FCM user push failed: ${String(err)}`, path: '/api/notify-user', metadata: { ticketId, userId: userUID } });
            });
        }

        // 4. LINE push (only if linked)
        if (!lineUserId) {
            logLineEvent({ direction: 'outbound', type: 'push_notify', status: 'skipped', lineUserId: userUID });
            return NextResponse.json({ success: true, line: 'skipped' });
        }

        const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!channelAccessToken) {
            console.error('LINE_CHANNEL_ACCESS_TOKEN is missing');
            return NextResponse.json({ success: true, line: 'skipped' });
        }

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
            flexMessage = {
                type: 'flex',
                altText: `แจ้งซ่อม: ${thaiStatus} — ห้อง ${room}`,
                contents: createStatusBubble({
                    id: ticketId,
                    description: problem,
                    room,
                    status,
                    statusColor: getStatusHexColor(status),
                    statusText: thaiStatus,
                    createdAt: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    technicianNote: technicianNote || undefined,
                    historyLink
                })
            };
        }

        const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify({ to: lineUserId, messages: [flexMessage] })
        });

        if (!lineResponse.ok) {
            const errorData = await lineResponse.json();
            console.error('LINE API Error:', errorData);
            logLineEvent({ direction: 'outbound', type: 'push_notify', status: 'error', lineUserId, error: JSON.stringify(errorData) });
            return NextResponse.json({ success: true, line: 'failed' });
        }

        logLineEvent({ direction: 'outbound', type: 'push_notify', status: 'ok', lineUserId });
        logWebEvent({ eventType: 'repair_status_update', metadata: { ticketId, status, room } });
        return NextResponse.json({ success: true, line: 'sent' });

    } catch (error) {
        console.error('Notification Error:', error);
        logWebEvent({ eventType: 'api_error', error: 'notify-user failed', metadata: { route: 'notify-user' } });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
