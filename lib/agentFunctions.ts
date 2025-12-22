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
    'ห้องประชุมพญาสัตบรรณ': 'jh_phaya',
    'โรงยิม': 'jh_gym',
    'ยิม': 'jh_gym',
    'ห้องประชุมโรงยิม': 'jh_gym',
    'ห้องจามจุรี': 'jh_chamchuri',
    'จามจุรี': 'jh_chamchuri',
    'ห้องประชุมจามจุรี': 'jh_chamchuri',

    // Senior High
    'ห้องลีลาวดี': 'sh_leelawadee',
    'ลีลาวดี': 'sh_leelawadee',
    'ลีลา': 'sh_leelawadee',
    'ห้องประชุมลีลาวดี': 'sh_leelawadee',
    'หอประชุม': 'sh_auditorium',
    'ห้องประชุมหอประชุม': 'sh_auditorium',
    'ห้องศาสตร์พระราชา': 'sh_king_science',
    'ศาสตร์พระราชา': 'sh_king_science',
    'ห้องประชุมศาสตร์พระราชา': 'sh_king_science',
    'ห้องศูนย์ภาษา': 'sh_language_center',
    'ศูนย์ภาษา': 'sh_language_center',
    'ห้องประชุมศูนย์ภาษา': 'sh_language_center',
    'ชั้น 3 อาคารอำนวยการ': 'sh_admin_3',
    'ห้องอำนวยการ': 'sh_admin_3',
    'อาคาร 3': 'sh_admin_3',
    'ห้องประชุมชั้น 3': 'sh_admin_3',
    'ห้องประชุมอำนวยการ': 'sh_admin_3',
};

// Side mapping (ม.ต้น / ม.ปลาย / ส่วนกลาง)
// [Modified] เพิ่ม 'ส่วนกลาง' และ 'common' เพื่อให้ครอบคลุมทุกเคส
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
// HELPERS
// ============================================

/**
 * Get UTC Timestamp range for a specific Thai Date
 * Input: "YYYY-MM-DD" (Thai Date)
 * Output: { start: Timestamp, end: Timestamp }
 */
function getThaiDateRange(dateStr: string): { start: Timestamp, end: Timestamp } {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Create UTC date for YYYY-MM-DD 00:00:00Z
    const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    // Shift back 7 hours to get Thai Midnight in UTC
    const thaiStart = new Date(utcMidnight.getTime() - (7 * 60 * 60 * 1000));
    // End Time is Start + 24 hours - 1ms
    const thaiEnd = new Date(thaiStart.getTime() + (24 * 60 * 60 * 1000) - 1);

    return {
        start: Timestamp.fromDate(thaiStart),
        end: Timestamp.fromDate(thaiEnd)
    };
}

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
        const { start, end } = getThaiDateRange(date);

        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('roomId', '==', normalizedRoom),
            where('startTime', '>=', start),
            where('startTime', '<=', end),
            where('status', 'in', ['pending', 'approved', 'confirmed'])
        );

        const snapshot = await getDocs(q);
        const conflicts: CheckAvailabilityResult['conflicts'] = [];

        const [inputStartHour, inputStartMin] = startTime.split(':').map(Number);
        const [inputEndHour, inputEndMin] = endTime.split(':').map(Number);
        const requestStart = inputStartHour * 60 + inputStartMin;
        const requestEnd = inputEndHour * 60 + inputEndMin;

        snapshot.forEach((doc) => {
            const booking = doc.data();
            const bookingStartDate = booking.startTime instanceof Timestamp
                ? booking.startTime.toDate()
                : new Date(booking.startTime);
            const bookingEndDate = booking.endTime instanceof Timestamp
                ? booking.endTime.toDate()
                : new Date(booking.endTime);

            // Convert to Thai Time
            const thStart = new Date(bookingStartDate.getTime() + (7 * 60 * 60 * 1000));
            const thEnd = new Date(bookingEndDate.getTime() + (7 * 60 * 60 * 1000));

            const bookingStartMinutes = thStart.getUTCHours() * 60 + thStart.getUTCMinutes();
            const bookingEndMinutes = thEnd.getUTCHours() * 60 + thEnd.getUTCMinutes();

            if (requestStart < bookingEndMinutes && requestEnd > bookingStartMinutes) {
                conflicts.push({
                    title: booking.title,
                    startTime: thStart.toISOString().substring(11, 16),
                    endTime: thEnd.toISOString().substring(11, 16),
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
        const { start, end } = getThaiDateRange(date);

        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('roomId', '==', normalizedRoom),
            where('startTime', '>=', start),
            where('startTime', '<=', end),
            where('status', 'in', ['pending', 'approved', 'confirmed'])
        );

        const snapshot = await getDocs(q);
        const bookings: Booking[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            bookings.push({
                id: doc.id,
                ...data,
                roomName: data.roomName || data.room
            } as Booking);
        });

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
        if (!room || !date || !startTime || !endTime || !title) {
            return {
                success: false,
                error: 'ข้อมูลไม่ครบค่ะ กรุณาระบุ ห้อง, วันที่, เวลาเริ่ม-สิ้นสุด, และหัวข้อการจอง',
            };
        }

        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const bookingDate = new Date(date);

        const availability = await checkRoomAvailability(room, date, startTime, endTime);
        if (!availability.available) {
            return {
                success: false,
                error: 'ห้องไม่ว่างในช่วงเวลาที่ต้องการค่ะ',
            };
        }

        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const startDateTime = new Date(bookingDate);
        startDateTime.setHours(startHour, startMin, 0, 0);

        const endDateTime = new Date(bookingDate);
        endDateTime.setHours(endHour, endMin, 0, 0);

        const bookingData = {
            room: normalizedRoom,
            roomId: normalizedRoom,
            startTime: Timestamp.fromDate(startDateTime),
            endTime: Timestamp.fromDate(endDateTime),
            title,
            description: 'จองผ่าน LINE AI',
            requesterName,
            requesterEmail,
            department: 'บุคลากร',
            position: 'บุคลากร',
            phoneNumber: '-',
            status: 'pending',
            createdAt: serverTimestamp(),
            source: 'line_ai',
        };

        const docRef = await addDoc(collection(db, 'bookings'), bookingData);
        return { success: true, bookingId: docRef.id };
    } catch (error) {
        console.error('Error creating booking:', error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการจองค่ะ' };
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
        snapshot.forEach((doc) => repairs.push({ id: doc.id, ...doc.data() } as RepairTicket));
        return repairs;
    } catch (error) {
        console.error('Error getting repairs:', error);
        return [];
    }
}

export async function getRepairsForTechnician(zone: string | 'all', date?: string): Promise<RepairTicket[]> {
    try {
        const repairsRef = collection(db, 'repair_tickets');
        let q;
        const limitCount = date ? 50 : 10;

        if (zone === 'all') {
            q = query(
                repairsRef,
                where('status', 'in', ['pending', 'in_progress', 'waiting_parts']),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );
        } else {
            q = query(
                repairsRef,
                where('zone', '==', zone),
                where('status', 'in', ['pending', 'in_progress', 'waiting_parts']),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );
        }

        const snapshot = await getDocs(q);
        let repairs: RepairTicket[] = [];
        snapshot.forEach((doc) => repairs.push({ id: doc.id, ...doc.data() } as RepairTicket));

        if (date) {
            const targetYMD = date.split('T')[0];
            repairs = repairs.filter(r => {
                const rDate = r.createdAt instanceof Timestamp
                    ? r.createdAt.toDate()
                    : new Date(r.createdAt as unknown as string);
                const thDate = new Date(rDate.getTime() + (7 * 60 * 60 * 1000));
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
        }
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
        if (!room || !description || !side) {
            return {
                success: false,
                error: 'ข้อมูลไม่ครบค่ะ กรุณาระบุ ห้อง, อาการ, และฝั่ง (ม.ต้น/ม.ปลาย)',
            };
        }

        // [Fix] ใช้ SIDE_MAPPING ที่ประกาศไว้ด้านบน
        const normalizedSide = SIDE_MAPPING[side.toLowerCase()] || 'junior_high';

        const images: string[] = imageUrl && imageUrl !== 'pending_upload' && imageUrl !== ''
            ? [imageUrl]
            : [];

        const repairData = {
            room,
            description,
            zone: normalizedSide as 'junior_high' | 'senior_high' | 'common',
            images,
            requesterName: requesterName || 'ผู้แจ้งผ่าน LINE',
            requesterEmail: requesterEmail || '',
            position: 'แจ้งผ่าน LINE',
            phone: '-',
            status: 'pending' as const,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            source: 'line_ai',
        };

        const docRef = await addDoc(collection(db, 'repair_tickets'), repairData);

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

        try {
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
                    zone: normalizedSide
                })
            });
        } catch (notifyError) {
            console.error('Failed to trigger notification:', notifyError);
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
        snapshot.forEach((doc) => bookings.push({ id: doc.id, ...doc.data() } as Booking));
        return bookings;
    } catch (error) {
        console.error('Error getting bookings:', error);
        return [];
    }
}

export async function getPendingBookings(date?: string): Promise<Booking[]> {
    try {
        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('status', '==', 'pending'),
            orderBy('startTime', 'asc'),
            limit(date ? 50 : 10)
        );
        const snapshot = await getDocs(q);
        let bookings: Booking[] = [];
        snapshot.forEach((doc) => bookings.push({ id: doc.id, ...doc.data() } as Booking));

        if (date) {
            const targetYMD = date.split('T')[0];
            bookings = bookings.filter(b => {
                const bDate = b.startTime instanceof Timestamp
                    ? b.startTime.toDate()
                    : new Date(b.startTime as unknown as string);
                const thDate = new Date(bDate.getTime() + (7 * 60 * 60 * 1000));
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
        }
        return bookings;
    } catch (error) {
        console.error('Error getting pending bookings:', error);
        return [];
    }
}

// ============================================
// MY_PHOTO_JOBS Functions
// ============================================

export async function getPhotoJobsByPhotographer(userId: string, date?: string): Promise<PhotographyJob[]> {
    try {
        const jobsRef = collection(db, 'photography_jobs');
        const q = query(
            jobsRef,
            where('assigneeIds', 'array-contains', userId),
            orderBy('startTime', 'desc'),
            limit(date ? 50 : 10)
        );
        const snapshot = await getDocs(q);
        let jobs: PhotographyJob[] = [];
        snapshot.forEach((doc) => jobs.push({ id: doc.id, ...doc.data() } as PhotographyJob));

        if (date) {
            const targetYMD = date.split('T')[0];
            jobs = jobs.filter(job => {
                if (!job.startTime) return false;
                const jobDate = job.startTime instanceof Timestamp
                    ? job.startTime.toDate()
                    : new Date(job.startTime as unknown as string);
                const thDate = new Date(jobDate.getTime() + (7 * 60 * 60 * 1000));
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
        }
        return jobs;
    } catch (error) {
        console.error('Error getting photo jobs:', error);
        return [];
    }
}

// ============================================
// GALLERY_SEARCH Functions
// ============================================

function calculateScore(text: string, tokens: string[]): number {
    const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '');
    const normalizedText = normalize(text);
    let score = 0;
    tokens.forEach(token => {
        if (normalizedText.includes(normalize(token))) score += 1;
    });
    return score;
}

export async function searchGallery(keyword?: string, date?: string): Promise<PhotographyJob[]> {
    try {
        const jobsRef = collection(db, 'photography_jobs');
        const q = query(
            jobsRef,
            where('status', '==', 'completed'),
            orderBy('startTime', 'desc'),
            limit(300)
        );
        const snapshot = await getDocs(q);
        let jobs: PhotographyJob[] = [];
        snapshot.forEach((doc) => jobs.push({ id: doc.id, ...doc.data() } as PhotographyJob));

        if (date) {
            const targetYMD = date.split('T')[0];
            jobs = jobs.filter(job => {
                if (!job.startTime) return false;
                const jobDate = job.startTime instanceof Timestamp
                    ? job.startTime.toDate()
                    : new Date(job.startTime as unknown as string);
                const thDate = new Date(jobDate.getTime() + (7 * 60 * 60 * 1000));
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
        }

        if (keyword) {
            const tokens = keyword.toLowerCase().split(/[\s,]+/).filter(t => t.length > 0);
            jobs = jobs.map(job => {
                const titleScore = calculateScore(job.title || '', tokens) * 3;
                const locScore = calculateScore(job.location || '', tokens);
                return { job, score: titleScore + locScore };
            })
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(item => item.job);
        }
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
    repairs: { total: number; pending: number; inProgress: number; };
    bookings: { total: number; pending: number; approved: number; };
    photoJobs: { total: number; pending: number; };
}

export async function getDailySummary(date: Date = new Date()): Promise<DailySummary> {
    try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

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

        const jobsRef = collection(db, 'photography_jobs');
        const jobsQ = query(
            jobsRef,
            where('startTime', '>=', Timestamp.fromDate(startOfDay)),
            where('startTime', '<=', Timestamp.fromDate(endOfDay))
        );
        const jobsSnapshot = await getDocs(jobsQ);

        return {
            repairs: { total: repairsSnapshot.size, pending: repairsPending, inProgress: repairsInProgress },
            bookings: { total: bookingsSnapshot.size, pending: bookingsPending, approved: bookingsApproved },
            photoJobs: { total: jobsSnapshot.size, pending: 0 },
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
    const startDate = booking.startTime instanceof Timestamp ? booking.startTime.toDate() : new Date(booking.startTime as any);
    const endDate = booking.endTime instanceof Timestamp ? booking.endTime.toDate() : new Date(booking.endTime as any);
    return `📅 ${startDate.toLocaleDateString('th-TH')} | ${startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}-${endDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}\n📍 ${booking.room}\n📝 ${booking.title}\n${statusMap[booking.status] || booking.status}\n👤 ${booking.requesterName}\n`;
}

export function formatRepairForDisplay(repair: RepairTicket): string {
    const statusMap: Record<string, string> = {
        pending: '🟡 รอดำเนินการ',
        in_progress: '🔵 กำลังซ่อม',
        waiting_parts: '🟠 รออะไหล่',
        completed: '🟢 เสร็จแล้ว',
        cancelled: '⚫ ยกเลิก',
    };
    const date = repair.createdAt instanceof Timestamp ? repair.createdAt.toDate().toLocaleDateString('th-TH') : new Date(repair.createdAt as any).toLocaleDateString('th-TH');
    return `🔧 ${repair.id}\n📍 ${repair.room}\n📝 ${repair.description?.substring(0, 50)}...\n📅 ${date}\nสถานะ: ${statusMap[repair.status] || repair.status}`;
}

export function formatPhotoJobForDisplay(job: PhotographyJob): string {
    const date = job.startTime instanceof Timestamp ? job.startTime.toDate().toLocaleDateString('th-TH') : new Date(job.startTime as any).toLocaleDateString('th-TH');
    let links = '';
    if (job.driveLink) links += `\n📁 Drive: ${job.driveLink}`;
    if (job.facebookPermalink) links += `\n📘 Facebook: ${job.facebookPermalink}`;
    else if (job.facebookPostId) links += `\n📘 Facebook: https://www.facebook.com/${job.facebookPostId}`;
    return `📸 ${job.title}\n📅 ${date}\n📍 ${job.location || '-'}${links}`;
}