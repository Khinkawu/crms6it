import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

/**
 * POST /api/notify-photo-assigned
 * ส่ง in-app + FCM push ให้ช่างภาพที่ได้รับมอบหมายงาน
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

        const { assigneeIds, title, location, formattedDate } = await request.json();

        if (!assigneeIds || assigneeIds.length === 0) {
            return NextResponse.json({ success: true, notified: 0 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
        const notifTitle = `งานถ่ายภาพใหม่`;
        const notifBody = `${title} — ${location} (${formattedDate})`;

        const batch = adminDb.batch();
        const notifRef = adminDb.collection('notifications');
        const allTokens: string[] = [];

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

            // Collect FCM tokens
            const userDoc = await adminDb.collection('users').doc(uid).get();
            const tokens: string[] = userDoc.data()?.fcmTokens || [];
            allTokens.push(...tokens);
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

        return NextResponse.json({ success: true, notified: assigneeIds.length });
    } catch (error) {
        console.error('[notify-photo-assigned] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
