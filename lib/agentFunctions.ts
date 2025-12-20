/**
 * AI Agent Functions
 * Functions that the AI Agent can call to interact with the system
 */

import { db } from '@/lib/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    Timestamp,
    orderBy,
    limit,
} from 'firebase/firestore';
import { Booking, RepairTicket, PhotographyJob } from '@/types';

// Room mapping for natural language
const ROOM_MAPPING: Record<string, string> = {
    'ห้องประชุมใหญ่': 'large_meeting',
    'ห้องประชุมเล็ก': 'small_meeting',
    'ห้องประชุม 1': 'meeting_1',
    'ห้องประชุม 2': 'meeting_2',
    'ห้อง lab': 'lab',
    'ห้องปฏิบัติการ': 'lab',
    'ห้อง it': 'it_room',
    'ห้องคอมพิวเตอร์': 'computer_room',
    'large_meeting': 'large_meeting',
    'small_meeting': 'small_meeting',
};

// Side mapping (ม.ต้น / ม.ปลาย)
const SIDE_MAPPING: Record<string, string> = {
    'ม.ต้น': 'junior_high',
    'มต้น': 'junior_high',
    'ม ต้น': 'junior_high',
    'junior': 'junior_high',
    'junior_high': 'junior_high',
    'ม.ปลาย': 'senior_high',
    'มปลาย': 'senior_high',
    'ม ปลาย': 'senior_high',
    'senior': 'senior_high',
    'senior_high': 'senior_high',
};

// ============================================
// BOOK_ROOM Functions
// ============================================

export interface CheckAvailabilityResult {
    available: boolean;
    conflicts?: {
        title: string;
        startTime: string;
        endTime: string;
        requesterName: string;
    }[];
}

export async function checkRoomAvailability(
    room: string,
    date: string,
    startTime: string,
    endTime: string
): Promise<CheckAvailabilityResult> {
    try {
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;

        // Parse date and create timestamp range for that day
        const bookingDate = new Date(date);
        const startOfDay = new Date(bookingDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(bookingDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Query bookings for that room and date range (using startTime field)
        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('room', '==', normalizedRoom),
            where('startTime', '>=', Timestamp.fromDate(startOfDay)),
            where('startTime', '<=', Timestamp.fromDate(endOfDay)),
            where('status', 'in', ['pending', 'approved'])
        );

        const snapshot = await getDocs(q);
        const conflicts: CheckAvailabilityResult['conflicts'] = [];

        // Parse input times (HH:MM format) 
        const [inputStartHour, inputStartMin] = startTime.split(':').map(Number);
        const [inputEndHour, inputEndMin] = endTime.split(':').map(Number);
        const requestStart = inputStartHour * 60 + inputStartMin;
        const requestEnd = inputEndHour * 60 + inputEndMin;

        snapshot.forEach((doc) => {
            const booking = doc.data();
            // startTime and endTime are Timestamps in the database
            const bookingStartDate = booking.startTime instanceof Timestamp
                ? booking.startTime.toDate()
                : new Date(booking.startTime);
            const bookingEndDate = booking.endTime instanceof Timestamp
                ? booking.endTime.toDate()
                : new Date(booking.endTime);

            const bookingStart = bookingStartDate.getHours() * 60 + bookingStartDate.getMinutes();
            const bookingEnd = bookingEndDate.getHours() * 60 + bookingEndDate.getMinutes();

            // Check for overlap
            if (requestStart < bookingEnd && requestEnd > bookingStart) {
                conflicts.push({
                    title: booking.title,
                    startTime: bookingStartDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                    endTime: bookingEndDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                    requesterName: booking.requesterName,
                });
            }
        });

        return {
            available: conflicts.length === 0,
            conflicts: conflicts.length > 0 ? conflicts : undefined,
        };
    } catch (error) {
        console.error('Error checking room availability:', error);
        return { available: false };
    }
}

export interface CreateBookingResult {
    success: boolean;
    bookingId?: string;
    error?: string;
}

export async function createBookingFromAI(
    room: string,
    date: string,
    startTime: string,
    endTime: string,
    title: string,
    requesterName: string,
    requesterEmail: string
): Promise<CreateBookingResult> {
    try {
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const bookingDate = new Date(date);

        // Double check availability
        const availability = await checkRoomAvailability(room, date, startTime, endTime);
        if (!availability.available) {
            return {
                success: false,
                error: 'ห้องไม่ว่างในช่วงเวลาที่ต้องการค่ะ',
            };
        }

        // Create start and end timestamps from date + time
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const startDateTime = new Date(bookingDate);
        startDateTime.setHours(startHour, startMin, 0, 0);

        const endDateTime = new Date(bookingDate);
        endDateTime.setHours(endHour, endMin, 0, 0);

        const bookingData = {
            room: normalizedRoom,
            startTime: Timestamp.fromDate(startDateTime),
            endTime: Timestamp.fromDate(endDateTime),
            title,
            requesterName,
            requesterEmail,
            department: '', // Required field
            status: 'pending', // รออนุมัติ
            createdAt: Timestamp.now(),
            source: 'line_ai', // Indicate this was created via LINE AI
        };

        const docRef = await addDoc(collection(db, 'bookings'), bookingData);

        return {
            success: true,
            bookingId: docRef.id,
        };
    } catch (error) {
        console.error('Error creating booking:', error);
        return {
            success: false,
            error: 'เกิดข้อผิดพลาดในการจองค่ะ',
        };
    }
}

// ============================================
// CHECK_REPAIR Functions
// ============================================

export async function getRepairsByEmail(email: string): Promise<RepairTicket[]> {
    try {
        const repairsRef = collection(db, 'repairs');
        const q = query(
            repairsRef,
            where('email', '==', email),
            orderBy('createdAt', 'desc'),
            limit(5)
        );

        const snapshot = await getDocs(q);
        const repairs: RepairTicket[] = [];

        snapshot.forEach((doc) => {
            repairs.push({ id: doc.id, ...doc.data() } as RepairTicket);
        });

        return repairs;
    } catch (error) {
        console.error('Error getting repairs:', error);
        return [];
    }
}

export async function getRepairByTicketId(ticketId: string): Promise<RepairTicket | null> {
    try {
        const repairsRef = collection(db, 'repairs');
        const q = query(repairsRef, where('ticketId', '==', ticketId), limit(1));

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as RepairTicket;
    } catch (error) {
        console.error('Error getting repair by ticket ID:', error);
        return null;
    }
}

// ============================================
// CREATE_REPAIR Functions
// ============================================

export interface CreateRepairResult {
    success: boolean;
    ticketId?: string;
    error?: string;
}

export async function createRepairFromAI(
    room: string,
    description: string,
    side: string,
    imageUrl: string,
    requesterName: string,
    requesterEmail: string
): Promise<CreateRepairResult> {
    try {
        // Validate required fields
        if (!room || !description || !side) {
            return {
                success: false,
                error: 'ข้อมูลไม่ครบค่ะ กรุณาระบุ ห้อง, อาการ, และฝั่ง (ม.ต้น/ม.ปลาย)',
            };
        }

        const normalizedSide = SIDE_MAPPING[side.toLowerCase()] || side;

        // Generate ticket ID
        const ticketId = `REP-${Date.now().toString(36).toUpperCase()}`;

        const repairData = {
            ticketId,
            room,
            description,
            zone: normalizedSide,
            imageUrl,
            requesterName,
            requesterEmail,
            status: 'pending',
            createdAt: Timestamp.now(),
            source: 'line_ai', // Indicate this was created via LINE AI
        };

        await addDoc(collection(db, 'repairs'), repairData);

        return {
            success: true,
            ticketId,
        };
    } catch (error) {
        console.error('Error creating repair:', error);
        return {
            success: false,
            error: 'เกิดข้อผิดพลาดในการแจ้งซ่อมค่ะ',
        };
    }
}

// ============================================
// MY_BOOKINGS Functions
// ============================================

export async function getBookingsByEmail(email: string): Promise<Booking[]> {
    try {
        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('requesterEmail', '==', email),
            orderBy('startTime', 'desc'),
            limit(10)
        );

        const snapshot = await getDocs(q);
        const bookings: Booking[] = [];

        snapshot.forEach((doc) => {
            bookings.push({ id: doc.id, ...doc.data() } as Booking);
        });

        return bookings;
    } catch (error) {
        console.error('Error getting bookings:', error);
        return [];
    }
}

// ============================================
// MY_PHOTO_JOBS Functions
// ============================================

export async function getPhotoJobsByPhotographer(userId: string): Promise<PhotographyJob[]> {
    try {
        const jobsRef = collection(db, 'photography_jobs');
        const q = query(
            jobsRef,
            where('assigneeIds', 'array-contains', userId),
            orderBy('startTime', 'desc'),
            limit(10)
        );

        const snapshot = await getDocs(q);
        const jobs: PhotographyJob[] = [];

        snapshot.forEach((doc) => {
            jobs.push({ id: doc.id, ...doc.data() } as PhotographyJob);
        });

        return jobs;
    } catch (error) {
        console.error('Error getting photo jobs:', error);
        return [];
    }
}

// ============================================
// GALLERY_SEARCH Functions
// ============================================

export async function searchGallery(keyword?: string, date?: string): Promise<PhotographyJob[]> {
    try {
        console.log(`[Gallery Search] keyword: ${keyword}, date: ${date}`);
        const jobsRef = collection(db, 'photography_jobs');

        // Simple query - just get completed jobs, filter in code
        const q = query(
            jobsRef,
            where('status', '==', 'completed'),
            limit(50)
        );

        const snapshot = await getDocs(q);
        console.log(`[Gallery Search] Found ${snapshot.size} completed jobs`);

        let jobs: PhotographyJob[] = [];
        snapshot.forEach((doc) => {
            jobs.push({ id: doc.id, ...doc.data() } as PhotographyJob);
        });

        // Sort by date descending
        jobs.sort((a, b) => {
            const dateA = a.startTime instanceof Timestamp ? a.startTime.toMillis() : 0;
            const dateB = b.startTime instanceof Timestamp ? b.startTime.toMillis() : 0;
            return dateB - dateA;
        });

        // Filter by date if provided
        if (date) {
            const searchDate = new Date(date);
            const startOfDay = new Date(searchDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(searchDate);
            endOfDay.setHours(23, 59, 59, 999);

            jobs = jobs.filter(job => {
                const jobDate = job.startTime instanceof Timestamp ? job.startTime.toDate() : new Date(job.startTime as unknown as string);
                return jobDate >= startOfDay && jobDate <= endOfDay;
            });
        }

        // Filter by keyword if provided
        if (keyword) {
            const lowerKeyword = keyword.toLowerCase();
            jobs = jobs.filter(job =>
                job.title?.toLowerCase().includes(lowerKeyword) ||
                job.location?.toLowerCase().includes(lowerKeyword) ||
                job.description?.toLowerCase().includes(lowerKeyword)
            );
        }

        console.log(`[Gallery Search] After filtering: ${jobs.length} jobs`);
        return jobs.slice(0, 10);
    } catch (error) {
        console.error('Error searching gallery:', error);
        return [];
    }
}

// ============================================
// DAILY_SUMMARY Functions
// ============================================

export interface DailySummary {
    repairs: {
        total: number;
        pending: number;
        inProgress: number;
    };
    bookings: {
        total: number;
        pending: number;
        approved: number;
    };
    photoJobs: {
        total: number;
    };
}

export async function getDailySummary(date: Date = new Date()): Promise<DailySummary> {
    try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Get repairs for today
        const repairsRef = collection(db, 'repairs');
        const repairsQ = query(
            repairsRef,
            where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
            where('createdAt', '<=', Timestamp.fromDate(endOfDay))
        );
        const repairsSnapshot = await getDocs(repairsQ);

        let repairsPending = 0;
        let repairsInProgress = 0;
        repairsSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'pending') repairsPending++;
            if (data.status === 'in_progress') repairsInProgress++;
        });

        // Get bookings for today
        const bookingsRef = collection(db, 'bookings');
        const bookingsQ = query(
            bookingsRef,
            where('startTime', '>=', Timestamp.fromDate(startOfDay)),
            where('startTime', '<=', Timestamp.fromDate(endOfDay))
        );
        const bookingsSnapshot = await getDocs(bookingsQ);

        let bookingsPending = 0;
        let bookingsApproved = 0;
        bookingsSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'pending') bookingsPending++;
            if (data.status === 'approved') bookingsApproved++;
        });

        // Get photo jobs for today
        const jobsRef = collection(db, 'photography_jobs');
        const jobsQ = query(
            jobsRef,
            where('startTime', '>=', Timestamp.fromDate(startOfDay)),
            where('startTime', '<=', Timestamp.fromDate(endOfDay))
        );
        const jobsSnapshot = await getDocs(jobsQ);

        return {
            repairs: {
                total: repairsSnapshot.size,
                pending: repairsPending,
                inProgress: repairsInProgress,
            },
            bookings: {
                total: bookingsSnapshot.size,
                pending: bookingsPending,
                approved: bookingsApproved,
            },
            photoJobs: {
                total: jobsSnapshot.size,
            },
        };
    } catch (error) {
        console.error('Error getting daily summary:', error);
        return {
            repairs: { total: 0, pending: 0, inProgress: 0 },
            bookings: { total: 0, pending: 0, approved: 0 },
            photoJobs: { total: 0 },
        };
    }
}

// ============================================
// Helper Functions
// ============================================

export function formatBookingForDisplay(booking: Booking): string {
    const statusMap: Record<string, string> = {
        pending: '🟡 รออนุมัติ',
        approved: '🟢 อนุมัติแล้ว',
        rejected: '🔴 ไม่อนุมัติ',
        cancelled: '⚫ ยกเลิก',
    };

    const startDate = booking.startTime instanceof Timestamp
        ? booking.startTime.toDate()
        : new Date(booking.startTime as unknown as string);
    const endDate = booking.endTime instanceof Timestamp
        ? booking.endTime.toDate()
        : new Date(booking.endTime as unknown as string);

    const dateStr = startDate.toLocaleDateString('th-TH');
    const startTimeStr = startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = endDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    return `📅 ${dateStr} | ${startTimeStr}-${endTimeStr}
📍 ${booking.room}
📝 ${booking.title}
${statusMap[booking.status] || booking.status}`;
}

export function formatRepairForDisplay(repair: RepairTicket): string {
    const statusMap: Record<string, string> = {
        pending: '🟡 รอดำเนินการ',
        in_progress: '🔵 กำลังซ่อม',
        completed: '🟢 เสร็จแล้ว',
        cancelled: '⚫ ยกเลิก',
    };

    const date = repair.createdAt instanceof Timestamp
        ? repair.createdAt.toDate().toLocaleDateString('th-TH')
        : new Date(repair.createdAt as unknown as string).toLocaleDateString('th-TH');

    // Use id since RepairTicket doesn't have ticketId
    return `🔧 ${repair.id}
📍 ${repair.room}
📝 ${repair.description?.substring(0, 50)}...
📅 ${date}
${statusMap[repair.status] || repair.status}`;
}

export function formatPhotoJobForDisplay(job: PhotographyJob): string {
    const date = job.startTime instanceof Timestamp
        ? job.startTime.toDate().toLocaleDateString('th-TH')
        : new Date(job.startTime as unknown as string).toLocaleDateString('th-TH');

    let links = '';
    if (job.driveLink) links += `\n📁 Drive: ${job.driveLink}`;
    if (job.facebookPostId) links += `\n📘 Facebook: https://facebook.com/${job.facebookPostId}`;

    return `📸 ${job.title}
📅 ${date}
📍 ${job.location || '-'}${links}`;
}
