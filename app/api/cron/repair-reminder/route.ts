import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { createRepairReminderFlexMessage } from '@/utils/flexMessageTemplates';

/**
 * Vercel Cron Job: Repair Reminder
 * ส่งแจ้งเตือนช่างเมื่อมีงานซ่อมค้าง > 2 วัน
 * Schedule: 0 1 * * * (08:00 Thai Time = 01:00 UTC)
 */
export async function GET(request: NextRequest) {
    try {
        // Security: Verify cron secret (Vercel sends this automatically)
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.log('[Cron] Unauthorized access attempt');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron] Starting repair reminder job...');

        // Calculate 2 days ago
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoTimestamp = Timestamp.fromDate(twoDaysAgo);

        // Query stale repair tickets
        const snapshot = await adminDb.collection('repair_tickets')
            .where('status', 'in', ['pending', 'in_progress'])
            .where('updatedAt', '<', twoDaysAgoTimestamp)
            .orderBy('updatedAt', 'asc')
            .limit(50)
            .get();

        if (snapshot.empty) {
            console.log('[Cron] No stale repairs found');
            return NextResponse.json({ success: true, message: 'No stale repairs', count: 0 });
        }

        console.log(`[Cron] Found ${snapshot.size} stale repairs`);

        // Group tickets by zone (only junior_high and senior_high)
        const ticketsByZone: Record<string, any[]> = {
            junior_high: [],
            senior_high: []
        };

        const now = new Date();
        snapshot.forEach(doc => {
            const data = doc.data();
            const zone = data.zone || 'junior_high'; // Default to junior_high
            const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            const daysStale = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

            ticketsByZone[zone]?.push({
                id: doc.id,
                room: data.room,
                description: data.description,
                status: data.status,
                createdAt: createdAt.toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }),
                daysStale
            });
        });

        // Get technicians grouped by responsibility
        const techsSnapshot = await adminDb.collection('users')
            .where('role', '==', 'technician')
            .get();

        const techniciansByZone: Record<string, string[]> = {
            junior_high: [],
            senior_high: [],
            all: []
        };

        techsSnapshot.forEach(doc => {
            const data = doc.data();
            const lineId = data.lineUserId;
            const responsibility = data.responsibility || 'all';

            if (lineId) {
                if (responsibility === 'all') {
                    techniciansByZone.all.push(lineId);
                } else if (techniciansByZone[responsibility]) {
                    techniciansByZone[responsibility].push(lineId);
                }
            }
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
        let totalNotified = 0;

        // Send notifications for each zone
        for (const zone of ['junior_high', 'senior_high'] as const) {
            const tickets = ticketsByZone[zone];
            if (tickets.length === 0) continue;

            // Get technicians for this zone (zone-specific + "all")
            const targetLineIds = [
                ...techniciansByZone[zone],
                ...techniciansByZone.all
            ];

            // Deduplicate
            const uniqueLineIds = Array.from(new Set(targetLineIds));

            if (uniqueLineIds.length === 0) {
                console.log(`[Cron] No technicians for zone: ${zone}`);
                continue;
            }

            const zoneLabel = zone === 'junior_high' ? 'ม.ต้น' : 'ม.ปลาย';
            const deepLink = `${appUrl}/admin/repairs?zone=${zone}`;

            const flexMessage = createRepairReminderFlexMessage({
                tickets,
                zone: zoneLabel,
                deepLink
            });

            // Send via LINE Multicast
            const response = await fetch('https://api.line.me/v2/bot/message/multicast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
                },
                body: JSON.stringify({
                    to: uniqueLineIds,
                    messages: [flexMessage]
                })
            });

            if (response.ok) {
                console.log(`[Cron] Sent reminder to ${uniqueLineIds.length} technicians for ${zone}`);
                totalNotified += uniqueLineIds.length;
            } else {
                const error = await response.text();
                console.error(`[Cron] LINE API error for ${zone}:`, error);
            }
        }



        console.log(`[Cron] Repair reminder job completed. Total notified: ${totalNotified}`);

        return NextResponse.json({
            success: true,
            staleRepairs: snapshot.size,
            notificationsSent: totalNotified
        });

    } catch (error) {
        console.error('[Cron] Error in repair reminder:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
