import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { createPhotographyFlexMessage } from '@/utils/flexMessageTemplates';

/**
 * POST /api/notify-photo-assigned
 * ส่ง in-app + FCM push + LINE flex ให้ช่างภาพที่ได้รับมอบหมายงาน
 * Called client-side after assigning photography job
 */
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        try {
            await adminAuth.verifyIdToken(authHeader.substring(7));
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { assigneeIds, title, location, formattedDate, date, startTime, endTime, description, assigneeNames } = await request.json();

        if (!assigneeIds || assigneeIds.length === 0) {
            return NextResponse.json({ success: true, notified: 0 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const notifTitle = `งานถ่ายภาพใหม่`;
        const notifBody = `${title} — ${location} (${formattedDate})`;

        const batch = adminDb.batch();
        const notifRef = adminDb.collection('notifications');
        const allTokens: string[] = [];
        const lineUserIds: string[] = [];

        await Promise.all(assigneeIds.map(async (uid: string) => {
            // In-app notification
            batch.set(notifRef.doc(), {
                userId: uid,
                type: 'photo_assigned',
                title: notifTitle,
                body: notifBody,
                linkTo: '/my-work',
                read: false,
                createdAt: FieldValue.serverTimestamp(),
                metadata: {},
            });

            // Collect FCM tokens + LINE user IDs
            const userDoc = await adminDb.collection('users').doc(uid).get();
            const data = userDoc.data();
            const tokens: string[] = data?.fcmTokens || [];
            allTokens.push(...tokens);

            let lineUserId: string | undefined = data?.lineUserId;
            // Fallback: check line_bindings if lineUserId not in user doc
            if (!lineUserId) {
                const bindingSnap = await adminDb.collection('line_bindings')
                    .where('uid', '==', uid)
                    .limit(1)
                    .get();
                if (!bindingSnap.empty) {
                    lineUserId = bindingSnap.docs[0].id;
                    adminDb.collection('users').doc(uid).update({ lineUserId }).catch(() => {});
                }
            }
            if (lineUserId) lineUserIds.push(lineUserId);
        }));

        await batch.commit();

        // FCM push
        if (allTokens.length > 0) {
            await admin.messaging().sendEachForMulticast({
                tokens: allTokens,
                notification: { title: notifTitle, body: notifBody },
                webpush: { fcmOptions: { link: `${appUrl}/my-work` } },
            }).catch(() => {});
        }

        // LINE flex push to each photographer individually
        let lineStatus = 'skipped';
        if (!lineToken) {
            lineStatus = 'no_token';
        } else if (lineUserIds.length === 0) {
            lineStatus = 'no_line_ids';
        } else if (date && startTime && endTime) {
            const flexMessage = createPhotographyFlexMessage({
                title,
                location,
                date,
                startTime,
                endTime,
                teamMembers: assigneeNames || [],
                description,
                appUrl,
            });
            const results = await Promise.all(lineUserIds.map(async (lineUserId) => {
                const res = await fetch('https://api.line.me/v2/bot/message/push', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${lineToken}`,
                    },
                    body: JSON.stringify({ to: lineUserId, messages: [flexMessage] }),
                });
                if (!res.ok) {
                    const err = await res.text();
                    console.error(`[notify-photo-assigned] LINE push failed for ${lineUserId}:`, err);
                    return { lineUserId, ok: false, error: err };
                }
                return { lineUserId, ok: true };
            }));
            lineStatus = results.every(r => r.ok) ? 'sent' : 'partial_fail';
            console.log('[notify-photo-assigned] LINE results:', results);
        } else {
            lineStatus = 'missing_datetime';
        }

        return NextResponse.json({ success: true, notified: assigneeIds.length, lineUserIds, lineStatus });
    } catch (error) {
        console.error('[notify-photo-assigned] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
