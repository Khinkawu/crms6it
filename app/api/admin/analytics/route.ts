/**
 * GET /api/admin/analytics?days=30
 * Admin-only: aggregates data from line_logs, missed_intents, usage_events, and system collections.
 */

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// ── Auth guard ──────────────────────────────────────────────────────────────

async function verifyAdmin(req: Request): Promise<NextResponse | null> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
        const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (userDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return null;
    } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(ts: Timestamp | Date): string {
    const d = ts instanceof Timestamp ? ts.toDate() : ts;
    return d.toISOString().split('T')[0];
}

function buildDateRange(days: number): { cutoff: Date; dateKeys: string[] } {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const dateKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dateKeys.push(d.toISOString().split('T')[0]);
    }
    return { cutoff, dateKeys };
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
    const authError = await verifyAdmin(req);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30'), 7), 90);

    const { cutoff, dateKeys } = buildDateRange(days);
    const cutoffTs = Timestamp.fromDate(cutoff);

    // ── Parallel fetches ────────────────────────────────────────────────────

    const [lineLogsSnap, missedIntentsSnap, usageEventsSnap, repairSnap, facilitySnap, bookingSnap] =
        await Promise.all([
            adminDb.collection('line_logs')
                .where('ts', '>=', cutoffTs)
                .orderBy('ts', 'desc')
                .limit(2000)
                .get(),

            adminDb.collection('missed_intents')
                .where('timestamp', '>=', cutoffTs)
                .orderBy('timestamp', 'desc')
                .limit(500)
                .get(),

            adminDb.collection('usage_events')
                .where('ts', '>=', cutoffTs)
                .orderBy('ts', 'desc')
                .limit(2000)
                .get(),

            adminDb.collection('repair_tickets').count().get(),
            adminDb.collection('facility_tickets').count().get(),
            adminDb.collection('bookings').count().get(),
        ]);

    // ── LINE Bot stats ──────────────────────────────────────────────────────

    const lineDailyMap: Record<string, { ok: number; error: number; totalMs: number; msCount: number }> = {};
    const lineTypeCount: Record<string, number> = {};
    let lineUniqueUsers = new Set<string>();
    let lineErrorCount = 0;
    let lineTotalMs = 0;
    let lineMsCount = 0;

    dateKeys.forEach(k => { lineDailyMap[k] = { ok: 0, error: 0, totalMs: 0, msCount: 0 }; });

    lineLogsSnap.forEach(doc => {
        const d = doc.data();
        const key = d.ts ? toDateKey(d.ts) : null;
        if (key && lineDailyMap[key]) {
            if (d.status === 'ok') lineDailyMap[key].ok++;
            else if (d.status === 'error') { lineDailyMap[key].error++; lineErrorCount++; }
        }
        if (d.type) lineTypeCount[d.type] = (lineTypeCount[d.type] || 0) + 1;
        if (d.lineUserId) lineUniqueUsers.add(d.lineUserId);
        if (d.durationMs && d.type === 'text') {
            lineTotalMs += d.durationMs;
            lineMsCount++;
        }
    });

    const lineDailyChart = dateKeys.map(date => ({
        date,
        ok: lineDailyMap[date]?.ok ?? 0,
        error: lineDailyMap[date]?.error ?? 0,
    }));

    const lineTypeChart = Object.entries(lineTypeCount).map(([type, count]) => ({ type, count }));
    const totalLineMessages = lineLogsSnap.size;

    // ── Missed intents ──────────────────────────────────────────────────────

    const missedDailyMap: Record<string, number> = {};
    dateKeys.forEach(k => { missedDailyMap[k] = 0; });

    const recentMissedIntents: { id: string; userMessage: string; timestamp: string; userId: string; aiReply?: string }[] = [];

    missedIntentsSnap.forEach(doc => {
        const d = doc.data();
        const key = d.timestamp ? toDateKey(d.timestamp) : null;
        if (key && missedDailyMap[key] !== undefined) missedDailyMap[key]++;
        if (recentMissedIntents.length < 50) {
            recentMissedIntents.push({
                id: doc.id,
                userMessage: d.userMessage || '',
                timestamp: d.timestamp ? d.timestamp.toDate().toISOString() : '',
                userId: d.userId || '',
                aiReply: d.aiReply,
            });
        }
    });

    // ── Web usage events ────────────────────────────────────────────────────

    const usageDailyMap: Record<string, number> = {};
    const usageByEvent: Record<string, number> = {};
    dateKeys.forEach(k => { usageDailyMap[k] = 0; });

    usageEventsSnap.forEach(doc => {
        const d = doc.data();
        const key = d.ts ? toDateKey(d.ts) : null;
        if (key && usageDailyMap[key] !== undefined) usageDailyMap[key]++;
        if (d.eventType) usageByEvent[d.eventType] = (usageByEvent[d.eventType] || 0) + 1;
    });

    const usageDailyChart = dateKeys.map(date => ({ date, events: usageDailyMap[date] ?? 0 }));
    const usageByEventChart = Object.entries(usageByEvent)
        .map(([event, count]) => ({ event, count }))
        .sort((a, b) => b.count - a.count);

    // ── System stats ────────────────────────────────────────────────────────

    const [pendingRepairSnap, pendingBookingSnap, pendingFacilitySnap] = await Promise.all([
        adminDb.collection('repair_tickets').where('status', '==', 'pending').count().get(),
        adminDb.collection('bookings').where('status', '==', 'pending').count().get(),
        adminDb.collection('facility_tickets').where('status', '==', 'pending').count().get(),
    ]);

    // ── Response ────────────────────────────────────────────────────────────

    return NextResponse.json({
        overview: {
            lineMessages: totalLineMessages,
            lineErrorRate: totalLineMessages > 0
                ? Math.round((lineErrorCount / totalLineMessages) * 1000) / 10
                : 0,
            avgResponseMs: lineMsCount > 0 ? Math.round(lineTotalMs / lineMsCount) : 0,
            missedIntents: missedIntentsSnap.size,
            lineUniqueUsers: lineUniqueUsers.size,
            webEvents: usageEventsSnap.size,
        },
        lineDailyChart,
        lineTypeChart,
        recentMissedIntents,
        missedDailyChart: dateKeys.map(date => ({ date, missed: missedDailyMap[date] ?? 0 })),
        usageDailyChart,
        usageByEventChart,
        systemStats: {
            totalRepairs: repairSnap.data().count,
            pendingRepairs: pendingRepairSnap.data().count,
            totalFacilityTickets: facilitySnap.data().count,
            pendingFacilityTickets: pendingFacilitySnap.data().count,
            totalBookings: bookingSnap.data().count,
            pendingBookings: pendingBookingSnap.data().count,
        },
        meta: { days, generatedAt: new Date().toISOString() },
    });
}
