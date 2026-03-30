/**
 * GET  /api/admin/error-logs?limit=50&resolved=false
 * PATCH /api/admin/error-logs  { id, resolved: true }
 * Admin-only.
 */

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

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

export async function GET(req: Request) {
    const authErr = await verifyAdmin(req);
    if (authErr) return authErr;

    const url = new URL(req.url);
    const limitParam = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);
    const resolvedParam = url.searchParams.get('resolved');

    try {
        let q = adminDb.collection('errorLogs').orderBy('ts', 'desc').limit(limitParam);
        if (resolvedParam === 'false') {
            q = adminDb.collection('errorLogs')
                .where('resolved', '==', false)
                .orderBy('ts', 'desc')
                .limit(limitParam);
        } else if (resolvedParam === 'true') {
            q = adminDb.collection('errorLogs')
                .where('resolved', '==', true)
                .orderBy('ts', 'desc')
                .limit(limitParam);
        }

        const snap = await q.get();
        const logs = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            ts: doc.data().ts?.toDate?.()?.toISOString() ?? null,
        }));

        const unresolvedCount = resolvedParam !== 'true'
            ? (await adminDb.collection('errorLogs').where('resolved', '==', false).count().get()).data().count
            : undefined;

        return NextResponse.json({ logs, unresolvedCount });
    } catch (err) {
        console.error('[error-logs GET]', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Firestore document IDs are 20-char alphanumeric strings
const FIRESTORE_ID_RE = /^[A-Za-z0-9]{1,128}$/;

export async function PATCH(req: Request) {
    const authErr = await verifyAdmin(req);
    if (authErr) return authErr;

    try {
        const { id, resolved } = await req.json();

        // Validate id: must be a safe Firestore doc ID string
        if (!id || typeof id !== 'string' || !FIRESTORE_ID_RE.test(id)) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        }
        if (typeof resolved !== 'boolean') {
            return NextResponse.json({ error: 'resolved must be boolean' }, { status: 400 });
        }

        // Verify doc exists before updating (prevents creating phantom docs)
        const docRef = adminDb.collection('errorLogs').doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        await docRef.update({ resolved });
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[error-logs PATCH]', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
