import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/update-username
 * Batch-updates denormalized name fields across all collections
 * when a user changes their display name.
 */
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let uid: string;
        try {
            const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
            uid = decoded.uid;
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { oldName, newName } = await request.json();
        if (!oldName || !newName || oldName === newName) {
            return NextResponse.json({ updated: 0 });
        }

        const ops: { ref: FirebaseFirestore.DocumentReference; data: Record<string, any> }[] = [];

        // 1. repair_tickets — requesterName (by requesterId)
        const rtRequesterSnap = await adminDb.collection('repair_tickets')
            .where('requesterId', '==', uid).get();
        rtRequesterSnap.forEach(d => ops.push({ ref: d.ref, data: { requesterName: newName } }));

        // 2. repair_tickets — technicianName (by technicianId)
        const rtTechSnap = await adminDb.collection('repair_tickets')
            .where('technicianId', '==', uid).get();
        rtTechSnap.forEach(d => ops.push({ ref: d.ref, data: { technicianName: newName } }));

        // 3. facility_tickets — requesterName (by requesterId)
        const ftRequesterSnap = await adminDb.collection('facility_tickets')
            .where('requesterId', '==', uid).get();
        ftRequesterSnap.forEach(d => ops.push({ ref: d.ref, data: { requesterName: newName } }));

        // 4. facility_tickets — technicianName (by technicianId)
        const ftTechSnap = await adminDb.collection('facility_tickets')
            .where('technicianId', '==', uid).get();
        ftTechSnap.forEach(d => ops.push({ ref: d.ref, data: { technicianName: newName } }));

        // 5. bookings — requesterName (by requesterId)
        const bookingSnap = await adminDb.collection('bookings')
            .where('requesterId', '==', uid).get();
        bookingSnap.forEach(d => ops.push({ ref: d.ref, data: { requesterName: newName } }));

        // 6. photography_jobs — assigneeNames array (by assigneeIds)
        const photoSnap = await adminDb.collection('photography_jobs')
            .where('assigneeIds', 'array-contains', uid).get();
        photoSnap.forEach(d => {
            const names: string[] = d.data().assigneeNames || [];
            const updated = names.map(n => n === oldName ? newName : n);
            ops.push({ ref: d.ref, data: { assigneeNames: updated } });
        });

        // 7. activities — userName (no userId field, match by name)
        const actSnap = await adminDb.collection('activities')
            .where('userName', '==', oldName).limit(500).get();
        actSnap.forEach(d => ops.push({ ref: d.ref, data: { userName: newName } }));

        if (ops.length === 0) {
            return NextResponse.json({ updated: 0 });
        }

        // Commit in chunks of 500 (Firestore batch limit)
        const CHUNK = 500;
        for (let i = 0; i < ops.length; i += CHUNK) {
            const batch = adminDb.batch();
            ops.slice(i, i + CHUNK).forEach(({ ref, data }) => batch.update(ref, data));
            await batch.commit();
        }

        console.log(`[update-username] uid=${uid} "${oldName}" → "${newName}" updated=${ops.length} docs`);
        return NextResponse.json({ updated: ops.length });

    } catch (error) {
        console.error('[update-username] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
