import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/notify-photo-submitted
 * สร้าง in-app notification ให้ admin + moderator เมื่อช่างภาพส่งงานเสร็จ
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

        const { jobId, title, photographerName } = await request.json();

        const [adminSnap, modSnap] = await Promise.all([
            adminDb.collection('users').where('role', '==', 'admin').get(),
            adminDb.collection('users').where('role', '==', 'moderator').get(),
        ]);

        const recipientIds = new Set<string>();
        [...adminSnap.docs, ...modSnap.docs].forEach(d => recipientIds.add(d.id));

        if (recipientIds.size === 0) {
            return NextResponse.json({ success: true, notified: 0 });
        }

        const batch = adminDb.batch();
        const notifRef = adminDb.collection('notifications');

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

        return NextResponse.json({ success: true, notified: recipientIds.size });
    } catch (error) {
        console.error('[notify-photo-submitted] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
