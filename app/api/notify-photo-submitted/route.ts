import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { logWebEvent } from '@/lib/analytics';

/**
 * POST /api/notify-photo-submitted
 * สร้าง in-app notification + FCM push ให้ admin + moderator เมื่อช่างภาพส่งงานเสร็จ
 * และส่ง FCM confirmation กลับหาช่างภาพด้วย
 * Called client-side after updateDoc photography_jobs status = 'completed'
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

        const { jobId, title, photographerName, photographerUid } = await request.json();

        const [adminSnap, modSnap] = await Promise.all([
            adminDb.collection('users').where('role', '==', 'admin').get(),
            adminDb.collection('users').where('role', '==', 'moderator').get(),
        ]);

        const recipientIds = new Set<string>();
        [...adminSnap.docs, ...modSnap.docs].forEach(d => recipientIds.add(d.id));

        const batch = adminDb.batch();
        const notifRef = adminDb.collection('notifications');

        // In-app notifications for admin + moderator
        for (const uid of Array.from(recipientIds)) {
            batch.set(notifRef.doc(), {
                userId: uid,
                type: 'photo_submitted',
                title: `ช่างภาพส่งงานแล้ว`,
                body: `${title} — ส่งโดย ${photographerName}`,
                linkTo: '/admin/photography',
                read: false,
                createdAt: FieldValue.serverTimestamp(),
                metadata: { jobId: jobId ?? '' },
            });
        }

        await batch.commit();

        // FCM push to admin + moderator
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
        const adminModTokens: string[] = [];
        await Promise.all(Array.from(recipientIds).map(async (uid) => {
            const userDoc = await adminDb.collection('users').doc(uid).get();
            const tokens: string[] = userDoc.data()?.fcmTokens || [];
            adminModTokens.push(...tokens);
        }));
        if (adminModTokens.length > 0) {
            await admin.messaging().sendEachForMulticast({
                tokens: adminModTokens,
                notification: {
                    title: `ช่างภาพส่งงานแล้ว`,
                    body: `${title} — ส่งโดย ${photographerName}`,
                },
                webpush: { fcmOptions: { link: `${appUrl}/admin/photography` } },
            }).catch(() => {});
        }

        logWebEvent({ eventType: 'photo_upload', metadata: { jobId, title, photographerName } });
        return NextResponse.json({ success: true, notified: recipientIds.size });
    } catch (error) {
        console.error('[notify-photo-submitted] Error:', error);
        logWebEvent({ eventType: 'api_error', error: 'notify-photo-submitted failed', metadata: { route: 'notify-photo-submitted' } });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
