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
    serverTimestamp,
    orderBy,
    limit,
    Timestamp,
    doc,
    getDoc
} from 'firebase/firestore';
import { Booking, RepairTicket, PhotographyJob } from '@/types';

// Room mapping for natural language
// Based on BookingForm.tsx constants
const ROOM_MAPPING: Record<string, string> = {
    // Junior High
    'ห้องพญาสัตบรรณ': 'jh_phaya',
    'พญาสัตบรรณ': 'jh_phaya',
    'พญา': 'jh_phaya',
    'โรงยิม': 'jh_gym',
    'ยิม': 'jh_gym',
    'ห้องจามจุรี': 'jh_chamchuri',
    'จามจุรี': 'jh_chamchuri',

    // Senior High
    'ห้องลีลาวดี': 'sh_leelawadee',
    'ลีลาวดี': 'sh_leelawadee',
    'ลีลา': 'sh_leelawadee',
    'หอประชุม': 'sh_auditorium',
    'อาคารพลศึกษา': 'sh_auditorium', // Alias if commonly used
    'ห้องศาสตร์พระราชา': 'sh_king_science',
    'ศาสตร์พระราชา': 'sh_king_science',
    'ห้องศูนย์ภาษา': 'sh_language_center',
    'ศูนย์ภาษา': 'sh_language_center',
    'ชั้น 3 อาคารอำนวยการ': 'sh_admin_3',
    'ห้องอำนวยการ': 'sh_admin_3',
    'อาคาร 3': 'sh_admin_3',
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


export async function getRoomSchedule(
    room: string,
    date: string
): Promise<Booking[]> {
    try {
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const scheduleDate = new Date(date);
        const startOfDay = new Date(scheduleDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(scheduleDate);
        endOfDay.setHours(23, 59, 59, 999);

        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('room', '==', normalizedRoom),
            where('startTime', '>=', Timestamp.fromDate(startOfDay)),
            where('startTime', '<=', Timestamp.fromDate(endOfDay)),
            where('status', 'in', ['pending', 'approved'])
        );

        const snapshot = await getDocs(q);
        const bookings: Booking[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            bookings.push({
                id: doc.id,
                ...data,
                roomName: data.roomName || data.room // Ensure roomName is available
            } as Booking);
        });

        // Sort by start time
        bookings.sort((a, b) => {
            const startA = a.startTime instanceof Timestamp ? a.startTime.toMillis() : 0;
            const startB = b.startTime instanceof Timestamp ? b.startTime.toMillis() : 0;
            return startA - startB;
        });

        return bookings;
    } catch (error) {
        console.error('Error getting room schedule:', error);
        return [];
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
        // Validate required fields
        if (!room || !date || !startTime || !endTime || !title) {
            return {
                success: false,
                error: 'ข้อมูลไม่ครบค่ะ กรุณาระบุ ห้อง, วันที่, เวลาเริ่ม-สิ้นสุด, และหัวข้อการจอง',
            };
        }

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
            roomId: normalizedRoom, // Explicitly set roomId as well (BookingForm uses it as primary key)
            startTime: Timestamp.fromDate(startDateTime),
            endTime: Timestamp.fromDate(endDateTime),
            title,
            description: 'จองผ่าน LINE AI',
            requesterName,
            requesterEmail,
            // Required fields by Schema/Frontend - using safe defaults for AI
            department: 'บุคลากร', // Default department
            position: 'บุคลากร',   // Default position
            phoneNumber: '-',      // Default phone
            status: 'pending', // รออนุมัติ
            createdAt: serverTimestamp(),
            source: 'line_ai',
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
        const repairsRef = collection(db, 'repair_tickets');
        const q = query(
            repairsRef,
            where('requesterEmail', '==', email),
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

/**
 * NEW: Get repairs for a specific zone (for technicians)
 * Retrieves active repairs (pending/in_progress) for the technician's zone
 */
export async function getRepairsForTechnician(zone: string | 'all'): Promise<RepairTicket[]> {
    try {
        const repairsRef = collection(db, 'repair_tickets');
        let q;

        if (zone === 'all') {
            q = query(
                repairsRef,
                where('status', 'in', ['pending', 'in_progress', 'waiting_parts']),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
        } else {
            q = query(
                repairsRef,
                where('zone', '==', zone),
                where('status', 'in', ['pending', 'in_progress', 'waiting_parts']),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
        }

        const snapshot = await getDocs(q);
        const repairs: RepairTicket[] = [];

        snapshot.forEach((doc) => {
            repairs.push({ id: doc.id, ...doc.data() } as RepairTicket);
        });

        return repairs;
    } catch (error) {
        console.error('Error getting technician repairs:', error);
        return [];
    }
}

export async function getRepairByTicketId(ticketId: string): Promise<RepairTicket | null> {
    try {
        const docRef = doc(db, 'repair_tickets', ticketId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return { id: docSnap.id, ...docSnap.data() } as RepairTicket;
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

        const normalizedSide = SIDE_MAPPING[side.toLowerCase()] || 'junior_high';

        // Build images array (can be empty if no image provided)
        const images: string[] = imageUrl && imageUrl !== 'pending_upload' && imageUrl !== ''
            ? [imageUrl]
            : [];

        const repairData = {
            // Note: ticketId will be the document ID
            room,
            description,
            zone: normalizedSide as 'junior_high' | 'senior_high' | 'common',
            images,  // Array of image URLs
            requesterName: requesterName || 'ผู้แจ้งผ่าน LINE',
            requesterEmail: requesterEmail || '',
            position: 'แจ้งผ่าน LINE',  // Required field
            phone: '-',  // Required field
            status: 'pending' as const,
            createdAt: serverTimestamp(), // Use serverTimestamp for correct sorting
            updatedAt: serverTimestamp(),
            source: 'line_ai',
        };

        const docRef = await addDoc(collection(db, 'repair_tickets'), repairData);

        // Log Activity aligned with RepairForm.tsx
        // Lazy load logActivity
        const { logActivity } = await import('@/utils/logger');
        await logActivity({
            action: 'repair',
            productName: room,
            userName: requesterName || 'ผู้แจ้งผ่าน LINE',
            details: description,
            imageUrl: images.length > 0 ? images[0] : undefined,
            zone: normalizedSide as 'junior_high' | 'senior_high' | 'common'
        });

        // Trigger Notification API (Restored to ensure Flex Message is sent)
        try {
            // Use absolute URL for server-side calls if needed, or relative for consistency
            // In AI context (Node environment), we might need full URL, but client-side fetch handles relative.
            // Since this runs in AI agent (server context usually), let's use full URL if possible, or fallback.
            const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';

            await fetch(`${apiUrl}/api/notify-repair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: docRef.id,
                    requesterName: requesterName || 'ผู้แจ้งผ่าน LINE',
                    room,
                    description,
                    imageOneUrl: images.length > 0 ? images[0] : '',
                    zone: normalizedSide // 'junior_high' | 'senior_high' | 'common'
                })
            });
        } catch (notifyError) {
            console.error('Failed to trigger notification:', notifyError);
            // Don't fail the whole operation if notification fails
        }

        return {
            success: true,
            ticketId: docRef.id,
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

/**
 * NEW: Get pending bookings (for Moderators/Admins)
 */
export async function getPendingBookings(): Promise<Booking[]> {
    try {
        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('status', '==', 'pending'),
            orderBy('startTime', 'asc'),
            limit(10)
        );

        const snapshot = await getDocs(q);
        const bookings: Booking[] = [];

        snapshot.forEach((doc) => {
            bookings.push({ id: doc.id, ...doc.data() } as Booking);
        });

        return bookings;
    } catch (error) {
        console.error('Error getting pending bookings:', error);
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

// Fuzzy search helper
function calculateScore(text: string, tokens: string[]): number {
    const lowerText = text.toLowerCase();
    let score = 0;
    tokens.forEach(token => {
        if (lowerText.includes(token)) score += 1;
    });
    return score;
}

export async function searchGallery(keyword?: string, date?: string): Promise<PhotographyJob[]> {
    try {
        console.log(`[Gallery Search] keyword: ${keyword}, date: ${date}`);
        const jobsRef = collection(db, 'photography_jobs');

        // Fetch larger batch for fuzzy matching (last 3 months approx limit or just 100 recent)
        const q = query(
            jobsRef,
            where('status', '==', 'completed'),
            orderBy('startTime', 'desc'),
            limit(100)
        );

        const snapshot = await getDocs(q);
        let jobs: PhotographyJob[] = [];
        snapshot.forEach((doc) => {
            jobs.push({ id: doc.id, ...doc.data() } as PhotographyJob);
        });

        // Filter by date first if provided (strict filter)
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

        // Fuzzy match by keyword
        if (keyword) {
            const tokens = keyword.toLowerCase().split(/\s+/).filter(t => t.length > 0);

            jobs = jobs.map(job => {
                const titleScore = calculateScore(job.title || '', tokens) * 2; // Title weight x2
                const locScore = calculateScore(job.location || '', tokens);
                const descScore = calculateScore(job.description || '', tokens);
                return { job, score: titleScore + locScore + descScore };
            })
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(item => item.job);
        }

        console.log(`[Gallery Search] Found ${jobs.length} jobs`);
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
        pending: number; // Added pending count for completeness
    };
}

export async function getDailySummary(date: Date = new Date()): Promise<DailySummary> {
    try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Get repairs for today
        const repairsRef = collection(db, 'repair_tickets');
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
                pending: 0, // Placeholder
            },
        };
    } catch (error) {
        console.error('Error getting daily summary:', error);
        return {
            repairs: { total: 0, pending: 0, inProgress: 0 },
            bookings: { total: 0, pending: 0, approved: 0 },
            photoJobs: { total: 0, pending: 0 },
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
${statusMap[booking.status] || booking.status}
👤 ${booking.requesterName}
`;
}

export function formatRepairForDisplay(repair: RepairTicket): string {
    const statusMap: Record<string, string> = {
        pending: '🟡 รอดำเนินการ',
        in_progress: '🔵 กำลังซ่อม',
        waiting_parts: '🟠 รออะไหล่', // Added waiting_parts
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
สถานะ: ${statusMap[repair.status] || repair.status}`;
}

export function formatPhotoJobForDisplay(job: PhotographyJob): string {
    const date = job.startTime instanceof Timestamp
        ? job.startTime.toDate().toLocaleDateString('th-TH')
        : new Date(job.startTime as unknown as string).toLocaleDateString('th-TH');

    let links = '';
    if (job.driveLink) links += `\n📁 Drive: ${job.driveLink}`;

    // Use facebookPermalink if available, otherwise construct from postId
    if (job.facebookPermalink) {
        links += `\n📘 Facebook: ${job.facebookPermalink}`;
    } else if (job.facebookPostId) {
        // Format: pageId_postId -> https://www.facebook.com/permalink.php?story_fbid=postId&id=pageId
        const parts = job.facebookPostId.split('_');
        if (parts.length === 2) {
            links += `\n📘 Facebook: https://www.facebook.com/permalink.php?story_fbid=${parts[1]}&id=${parts[0]}`;
        } else {
            links += `\n📘 Facebook: https://www.facebook.com/${job.facebookPostId}`;
        }
    }

    return `📸 ${job.title}\n📅 ${date}\n📍 ${job.location || '-'}${links}`;
}
