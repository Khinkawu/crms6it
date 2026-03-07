import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * Vercel Cron Job: Photography Job Late Submission Reminder
 * แจ้งเตือนช่างภาพที่ยังไม่ส่งงาน หลังจากงานสิ้นสุดแล้ว
 * Schedule: 0 2 * * * (09:00 Thai Time = 02:00 UTC)
 */
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron] Starting photo-reminder job...');

        const now = Timestamp.now();

        // Find photography jobs that are still 'assigned' but endTime has passed
        const snapshot = await adminDb.collection('photography_jobs')
            .where('status', '==', 'assigned')
            .where('endTime', '<', now)
            .limit(50)
            .get();

        if (snapshot.empty) {
            console.log('[Cron] No overdue photography jobs found');
            return NextResponse.json({ success: true, message: 'No overdue jobs', count: 0 });
        }

        console.log(`[Cron] Found ${snapshot.size} overdue photography jobs`);

        const batch = adminDb.batch();
        const notifRef = adminDb.collection('notifications');
        let notiCount = 0;

        for (const jobDoc of snapshot.docs) {
            const data = jobDoc.data();
            const assignees: string[] = data.assignees || [];
            if (assignees.length === 0) continue;

            const jobTitle: string = data.title || 'งานถ่ายภาพ';
            const endTime = data.endTime?.toDate?.() as Date | undefined;
            const endLabel = endTime
                ? endTime.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
                : '';

            for (const uid of assignees) {
                batch.set(notifRef.doc(), {
                    userId: uid,
                    type: 'photo_late',
                    title: `งานถ่ายภาพยังไม่ส่ง`,
                    body: `${jobTitle}${endLabel ? ` (สิ้นสุด ${endLabel})` : ''} — กรุณาส่งงานด่วน`,
                    linkTo: '/my-work',
                    read: false,
                    createdAt: FieldValue.serverTimestamp(),
                    metadata: { jobId: jobDoc.id },
                });
                notiCount++;
            }
        }

        await batch.commit();

        console.log(`[Cron] Photo reminder sent to ${notiCount} photographer(s)`);
        return NextResponse.json({ success: true, overdueJobs: snapshot.size, notified: notiCount });

    } catch (error) {
        console.error('[Cron] Error in photo-reminder:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
