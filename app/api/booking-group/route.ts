import { NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import admin from 'firebase-admin'
import { generateOccurrences, type DayOfWeek } from '@/lib/bookingGroupUtils'
import { prepareMultiDayFolders } from '@/lib/googleDrive'

/**
 * POST /api/booking-group
 * Create a recurring or multi-day booking group + all individual booking docs.
 *
 * Body:
 *   type: 'multi_day' | 'recurring'
 *   bookingType: 'room' | 'photo'
 *   formData: { title, roomId, roomName, startTime, endTime, ... }
 *   dates?: string[]          (multi_day — user provided YYYY-MM-DD array)
 *   recurrenceConfig?: {      (recurring)
 *     days: DayOfWeek[]
 *     startDate: string
 *     endDate?: string
 *   }
 *
 * Returns: { groupId, created: number, skipped: string[] }
 */
export async function POST(request: Request) {
    // 1. Auth
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    let uid: string
    let userEmail: string
    try {
        const decoded = await adminAuth.verifyIdToken(authHeader.substring(7))
        uid = decoded.uid
        userEmail = decoded.email ?? ''
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, bookingType, formData, dates: inputDates, recurrenceConfig } = body

    if (!['multi_day', 'recurring'].includes(type)) {
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    if (!['room', 'photo'].includes(bookingType)) {
        return NextResponse.json({ error: 'Invalid bookingType' }, { status: 400 })
    }

    // 2. Determine dates
    let allDates: string[] = []
    if (type === 'multi_day') {
        allDates = (inputDates as string[]) ?? []
    } else {
        allDates = generateOccurrences({
            days: recurrenceConfig.days as DayOfWeek[],
            startDate: recurrenceConfig.startDate,
            endDate: recurrenceConfig.endDate,
        })
    }

    if (allDates.length === 0) {
        return NextResponse.json({ error: 'No dates to create' }, { status: 400 })
    }

    // 3. Conflict check (room bookings only)
    const ok: string[] = []
    const skipped: string[] = []

    if (bookingType === 'room' && formData.roomId) {
        const existingSnap = await adminDb
            .collection('bookings')
            .where('roomId', '==', formData.roomId)
            .get()

        const activeBookings = existingSnap.docs
            .map(d => d.data())
            .filter(b => ['approved', 'pending'].includes(b.status) && !b.isCancelled)

        for (const date of allDates) {
            const start = new Date(`${date}T${formData.startTime}:00`)
            const end = new Date(`${date}T${formData.endTime}:00`)

            const hasConflict = activeBookings.some(b => {
                const bStart: Date = (b.startTime as admin.firestore.Timestamp).toDate()
                const bEnd: Date = (b.endTime as admin.firestore.Timestamp).toDate()
                return bStart < end && bEnd > start
            })

            if (hasConflict) skipped.push(date)
            else ok.push(date)
        }
    } else {
        ok.push(...allDates)
    }

    if (ok.length === 0) {
        return NextResponse.json({
            error: 'ทุกวันที่เลือกมีการจองแล้ว กรุณาเลือกวันหรือเวลาใหม่',
            skipped,
        }, { status: 409 })
    }

    // 4. Build bookingGroup document
    const groupDoc: Record<string, unknown> = {
        bookingType,
        type,
        title: formData.title,
        description: formData.description || '',
        requesterId: uid,
        requesterName: formData.requesterName,
        requesterEmail: userEmail,
        position: formData.position,
        department: formData.department,
        phoneNumber: formData.phoneNumber,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
    }

    if (bookingType === 'room') {
        Object.assign(groupDoc, {
            roomId: formData.roomId,
            roomName: formData.roomName,
            equipment: formData.equipment ?? [],
            ownEquipment: formData.ownEquipment || '',
            attendees: formData.attendees || '',
            roomLayout: formData.roomLayout || '',
            roomLayoutDetails: formData.roomLayoutDetails || '',
            micCount: formData.micCount || '',
            needsPhotographer: formData.needsPhotographer ?? false,
            attachments: formData.attachments ?? [],
        })
    } else {
        groupDoc.location = formData.location
    }

    if (type === 'multi_day') {
        groupDoc.multiDay = {
            dates: ok,
            startTime: formData.startTime,
            endTime: formData.endTime,
        }
    } else {
        groupDoc.recurrence = {
            pattern: 'weekly',
            days: recurrenceConfig.days,
            startDate: recurrenceConfig.startDate,
            endDate: recurrenceConfig.endDate || null,
            startTime: formData.startTime,
            endTime: formData.endTime,
            generatedUntil: ok[ok.length - 1],
        }
    }

    const groupRef = await adminDb.collection('bookingGroups').add(groupDoc)
    const groupId = groupRef.id

    // 5. Drive sub-folders (multi_day + photo only)
    const subFolderMap: Record<string, { folderId: string; folderLink: string }> = {}

    if (type === 'multi_day' && bookingType === 'photo') {
        const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID
        if (rootFolderId) {
            try {
                // Derive year/semester/month from first date
                const firstDate = new Date(`${ok[0]}T12:00:00Z`)
                const thYear = String(firstDate.getUTCFullYear() + 543)
                const month = firstDate.toLocaleDateString('th-TH', { month: 'long', timeZone: 'Asia/Bangkok' })
                // Simple semester guess: Jan–May = 2, Jun–Oct = 1 (Thai academic year)
                const rawMonth = firstDate.getUTCMonth() + 1
                const semester = rawMonth >= 5 && rawMonth <= 10 ? '1' : '2'

                const result = await prepareMultiDayFolders({
                    rootFolderId,
                    year: thYear,
                    semester,
                    month,
                    eventName: `${formData.title}_${groupId.slice(0, 6)}`,
                    dates: ok,
                })

                // Update group with main folder
                await groupRef.update({
                    driveFolderUrl: result.mainFolder.folderLink,
                    driveFolderId: result.mainFolder.folderId,
                })

                // Map date → sub-folder
                for (const sf of result.subFolders) {
                    subFolderMap[sf.date] = { folderId: sf.folderId, folderLink: sf.folderLink }
                }
            } catch (err) {
                console.error('[booking-group] Drive folder creation failed (non-fatal):', err)
            }
        }
    }

    // 6. Batch-create individual booking/photo_job docs
    // Firestore writeBatch limit = 500 operations
    const CHUNK_SIZE = 499
    const collectionName = bookingType === 'room' ? 'bookings' : 'photography_jobs'

    for (let chunkStart = 0; chunkStart < ok.length; chunkStart += CHUNK_SIZE) {
        const chunk = ok.slice(chunkStart, chunkStart + CHUNK_SIZE)
        const batch = adminDb.batch()

        for (const date of chunk) {
            const dayIndex = ok.indexOf(date)
            const startDateTime = new Date(`${date}T${formData.startTime}:00`)
            const endDateTime = new Date(`${date}T${formData.endTime}:00`)

            const docRef = adminDb.collection(collectionName).doc()

            const docData: Record<string, unknown> = {
                groupId,
                dayIndex: type === 'multi_day' ? dayIndex : null,
                isException: false,
                isCancelled: false,
                title: formData.title,
                description: formData.description || '',
                requesterId: uid,
                requesterName: formData.requesterName,
                requesterEmail: userEmail,
                position: formData.position,
                department: formData.department,
                phoneNumber: formData.phoneNumber,
                startTime: Timestamp.fromDate(startDateTime),
                endTime: Timestamp.fromDate(endDateTime),
                status: 'pending',
                createdAt: FieldValue.serverTimestamp(),
            }

            if (bookingType === 'room') {
                Object.assign(docData, {
                    roomId: formData.roomId,
                    roomName: formData.roomName,
                    equipment: formData.equipment ?? [],
                    ownEquipment: formData.ownEquipment || '',
                    attendees: formData.attendees || '',
                    roomLayout: formData.roomLayout || '',
                    roomLayoutDetails: formData.roomLayoutDetails || '',
                    micCount: formData.micCount || '',
                    needsPhotographer: formData.needsPhotographer ?? false,
                    attachments: formData.attachments ?? [],
                })
            } else {
                Object.assign(docData, {
                    location: formData.location,
                    assigneeIds: [],
                    bookingId: `group-${groupId}-day${dayIndex}`,
                })
                if (subFolderMap[date]) {
                    docData.driveSubFolderUrl = subFolderMap[date].folderLink
                    docData.driveSubFolderId = subFolderMap[date].folderId
                }
            }

            batch.set(docRef, docData)
        }

        await batch.commit()
    }

    // 7. Notify admin/moderator (single notification for the group)
    const summary = type === 'recurring'
        ? `${ok.length} ครั้ง (ทุกสัปดาห์) เริ่ม ${ok[0]}`
        : `${ok.length} วัน เริ่ม ${ok[0]}`

    try {
        const [adminSnap, modSnap] = await Promise.all([
            adminDb.collection('users').where('role', '==', 'admin').get(),
            adminDb.collection('users').where('role', '==', 'moderator').get(),
        ])
        const recipientIds = new Set<string>()
        ;[...adminSnap.docs, ...modSnap.docs].forEach(d => recipientIds.add(d.id))

        if (recipientIds.size > 0) {
            const notifBatch = adminDb.batch()
            const roomOrLocation = formData.roomName || formData.location || ''
            for (const recipientId of Array.from(recipientIds)) {
                const ref = adminDb.collection('notifications').doc()
                notifBatch.set(ref, {
                    userId: recipientId,
                    type: 'booking_group_pending',
                    title: `คำขอจองกลุ่ม: ${formData.title}`,
                    body: `${roomOrLocation} — ${formData.requesterName} · ${summary}`,
                    linkTo: '/admin/bookings',
                    read: false,
                    createdAt: FieldValue.serverTimestamp(),
                    metadata: { groupId },
                })
            }
            await notifBatch.commit()

            // FCM push
            const fcmTokens: string[] = []
            await Promise.all(Array.from(recipientIds).map(async (recipientId) => {
                const userDoc = await adminDb.collection('users').doc(recipientId).get()
                const tokens: string[] = userDoc.data()?.fcmTokens ?? []
                fcmTokens.push(...tokens)
            }))
            if (fcmTokens.length > 0) {
                await admin.messaging().sendEachForMulticast({
                    tokens: fcmTokens,
                    notification: {
                        title: `คำขอจองกลุ่ม: ${formData.title}`,
                        body: `${roomOrLocation} — ${formData.requesterName} · ${summary}`,
                    },
                    webpush: { fcmOptions: { link: '/admin/bookings' } },
                }).catch(() => {})
            }
        }
    } catch (err) {
        console.error('[booking-group] Notification failed (non-fatal):', err)
    }

    return NextResponse.json({
        success: true,
        groupId,
        created: ok.length,
        skipped,
    })
}

/**
 * PATCH /api/booking-group
 * Admin actions on individual occurrences or entire group.
 *
 * Body:
 *   action: 'cancel_occurrence' | 'edit_occurrence' | 'pause_group' | 'cancel_group'
 *   bookingType: 'room' | 'photo'
 *   bookingId?: string   (for occurrence-level actions)
 *   groupId?: string     (for group-level actions)
 *   updates?: Record<string, unknown>  (for edit_occurrence)
 */
export async function PATCH(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
        const decoded = await adminAuth.verifyIdToken(authHeader.substring(7))
        // Only admin/moderator can patch group bookings
        const userDoc = await adminDb.collection('users').doc(decoded.uid).get()
        const role = userDoc.data()?.role
        if (!['admin', 'moderator'].includes(role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, bookingType, bookingId, groupId, updates } = await request.json()
    const collectionName = bookingType === 'room' ? 'bookings' : 'photography_jobs'

    switch (action) {
        case 'cancel_occurrence':
            await adminDb.collection(collectionName).doc(bookingId).update({
                isCancelled: true,
                cancelledAt: FieldValue.serverTimestamp(),
            })
            break

        case 'edit_occurrence':
            // Preserve existing fields, mark as exception
            await adminDb.collection(collectionName).doc(bookingId).update({
                isException: true,
                ...updates,
            })
            break

        case 'pause_group':
            await adminDb.collection('bookingGroups').doc(groupId).update({
                status: 'paused',
            })
            break

        case 'cancel_group': {
            // Cancel all pending occurrences, then mark group cancelled
            const pendingSnap = await adminDb
                .collection(collectionName)
                .where('groupId', '==', groupId)
                .where('status', '==', 'pending')
                .get()

            const cancelBatch = adminDb.batch()
            pendingSnap.docs.forEach(d => {
                cancelBatch.update(d.ref, {
                    isCancelled: true,
                    cancelledAt: FieldValue.serverTimestamp(),
                })
            })
            cancelBatch.update(adminDb.collection('bookingGroups').doc(groupId), {
                status: 'cancelled',
            })
            await cancelBatch.commit()
            break
        }

        default:
            return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
}
