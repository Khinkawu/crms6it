import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logWebEvent } from '@/lib/analytics';

/**
 * PATCH /api/edit-booking
 * User แก้ไขการจองของตัวเอง
 *
 * pending → แก้ได้ทุก field (core + safe) + conflict check
 * approved → แก้ได้เฉพาะ safe fields (description, equipment, phoneNumber, ownEquipment)
 */
export async function PATCH(req: Request) {
    try {
        // ── Auth ──────────────────────────────────────────────────────────────
        const authHeader = req.headers.get('Authorization') || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let callerUid: string;
        try {
            const decoded = await adminAuth.verifyIdToken(idToken);
            callerUid = decoded.uid;
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── Parse body ────────────────────────────────────────────────────────
        const body = await req.json() as {
            bookingId: string;
            // safe fields (always editable)
            description?: string;
            equipment?: string[];
            ownEquipment?: string;
            phoneNumber?: string;
            position?: string;
            // core fields (pending only)
            title?: string;
            roomId?: string;
            roomName?: string;
            startTime?: string; // ISO string
            endTime?: string;   // ISO string
            date?: string;      // YYYY-MM-DD
            attendees?: number;
            roomLayout?: string;
            roomLayoutDetails?: string;
            micCount?: string;
            needsPhotographer?: boolean;
        };

        const { bookingId, ...fields } = body;
        if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 });

        // ── Verify ownership ──────────────────────────────────────────────────
        const bookingRef = adminDb.collection('bookings').doc(bookingId);
        const bookingSnap = await bookingRef.get();
        if (!bookingSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const booking = bookingSnap.data()!;
        if (booking.requesterId !== callerUid) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (booking.status === 'cancelled' || booking.status === 'rejected') {
            return NextResponse.json({ error: 'Cannot edit a booking with status: ' + booking.status }, { status: 400 });
        }

        const isPending = booking.status === 'pending';

        // ── Build update payload ──────────────────────────────────────────────
        const update: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Safe fields — always editable
        if (fields.description !== undefined) update.description = fields.description;
        if (fields.equipment !== undefined) update.equipment = fields.equipment;
        if (fields.ownEquipment !== undefined) update.ownEquipment = fields.ownEquipment;
        if (fields.phoneNumber !== undefined) update.phoneNumber = fields.phoneNumber;
        if (fields.position !== undefined) update.position = fields.position;

        // Core fields — pending only
        if (isPending) {
            let newStartTime: Date | undefined;
            let newEndTime: Date | undefined;

            if (fields.date && fields.startTime) {
                newStartTime = new Date(`${fields.date}T${fields.startTime}:00`);
                update.startTime = Timestamp.fromDate(newStartTime);
            }
            if (fields.date && fields.endTime) {
                newEndTime = new Date(`${fields.date}T${fields.endTime}:00`);
                update.endTime = Timestamp.fromDate(newEndTime);
            }
            if (fields.title) update.title = fields.title;
            if (fields.roomId) update.roomId = fields.roomId;
            if (fields.roomName) update.roomName = fields.roomName;
            if (fields.attendees !== undefined) update.attendees = fields.attendees;
            if (fields.roomLayout !== undefined) update.roomLayout = fields.roomLayout;
            if (fields.roomLayoutDetails !== undefined) update.roomLayoutDetails = fields.roomLayoutDetails;
            if (fields.micCount !== undefined) update.micCount = fields.micCount;
            if (fields.needsPhotographer !== undefined) update.needsPhotographer = fields.needsPhotographer;

            // ── Conflict check when room or time changes ──────────────────────
            const checkRoomId = fields.roomId || booking.roomId;
            const startToCheck = newStartTime || (booking.startTime as Timestamp).toDate();
            const endToCheck = newEndTime || (booking.endTime as Timestamp).toDate();

            if (checkRoomId && (fields.roomId || fields.startTime || fields.endTime)) {
                const conflictSnap = await adminDb.collection('bookings')
                    .where('roomId', '==', checkRoomId)
                    .where('status', 'in', ['pending', 'approved'])
                    .get();

                const conflict = conflictSnap.docs.some(d => {
                    if (d.id === bookingId) return false; // skip self
                    const bStart = (d.data().startTime as Timestamp).toDate();
                    const bEnd = (d.data().endTime as Timestamp).toDate();
                    return startToCheck < bEnd && endToCheck > bStart;
                });

                if (conflict) {
                    return NextResponse.json({
                        error: 'ห้องนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว'
                    }, { status: 409 });
                }
            }
        }

        // ── Apply update ──────────────────────────────────────────────────────
        await bookingRef.update(update);

        logWebEvent({ eventType: 'booking_edit', metadata: { bookingId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[edit-booking] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
