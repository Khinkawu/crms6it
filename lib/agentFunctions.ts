/**
 * AI Agent Functions (FIXED VERSION)
 * แก้ปัญหา SIDE_MAPPING และ Search Gallery ไม่ต้องรอ Index
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

// ============================================================================
// 1. MAPPING CONSTANTS (ประกาศไว้บนสุด เพื่อกัน Error: Cannot find name)
// ============================================================================

// Room mapping
const ROOM_MAPPING: Record<string, string> = {
    // Junior High
    'ห้องพญาสัตบรรณ': 'jh_phaya', 'พญาสัตบรรณ': 'jh_phaya', 'พญา': 'jh_phaya', 'ห้องประชุมพญาสัตบรรณ': 'jh_phaya',
    'โรงยิม': 'jh_gym', 'ยิม': 'jh_gym', 'ห้องประชุมโรงยิม': 'jh_gym',
    'ห้องจามจุรี': 'jh_chamchuri', 'จามจุรี': 'jh_chamchuri', 'ห้องประชุมจามจุรี': 'jh_chamchuri',
    // Senior High
    'ห้องลีลาวดี': 'sh_leelawadee', 'ลีลาวดี': 'sh_leelawadee', 'ลีลา': 'sh_leelawadee', 'ห้องประชุมลีลาวดี': 'sh_leelawadee',
    'หอประชุม': 'sh_auditorium',
    'ห้องศาสตร์พระราชา': 'sh_king_science', 'ศาสตร์พระราชา': 'sh_king_science', 'ห้องประชุมศาสตร์พระราชา': 'sh_king_science',
    'ห้องศูนย์ภาษา': 'sh_language_center', 'ศูนย์ภาษา': 'sh_language_center', 'ห้องประชุมศูนย์ภาษา': 'sh_language_center',
    'ชั้น 3 อาคารอำนวยการ': 'sh_admin_3', 'ห้องอำนวยการ': 'sh_admin_3', 'อาคาร 3': 'sh_admin_3', 'ห้องประชุมชั้น 3': 'sh_admin_3', 'ห้องประชุมอำนวยการ': 'sh_admin_3',
};

// Side mapping (ม.ต้น / ม.ปลาย / ส่วนกลาง)
const SIDE_MAPPING: Record<string, string> = {
    'ม.ต้น': 'junior_high', 'มต้น': 'junior_high', 'ม ต้น': 'junior_high', 'junior': 'junior_high', 'junior_high': 'junior_high',
    'ม.ปลาย': 'senior_high', 'มปลาย': 'senior_high', 'ม ปลาย': 'senior_high', 'senior': 'senior_high', 'senior_high': 'senior_high',
    'ส่วนกลาง': 'common', 'common': 'common'
};

// ============================================================================
// 2. HELPERS
// ============================================================================

function getThaiDateRange(dateStr: string): { start: Timestamp, end: Timestamp } {
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const thaiStart = new Date(utcMidnight.getTime() - (7 * 60 * 60 * 1000));
    const thaiEnd = new Date(thaiStart.getTime() + (24 * 60 * 60 * 1000) - 1);
    return { start: Timestamp.fromDate(thaiStart), end: Timestamp.fromDate(thaiEnd) };
}

function calculateScore(text: string, tokens: string[]): number {
    const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '');
    const normalizedText = normalize(text);
    let score = 0;
    tokens.forEach(token => {
        if (normalizedText.includes(normalize(token))) score += 1;
    });
    return score;
}

// ============================================================================
// 3. MAIN FUNCTIONS
// ============================================================================

// --- GALLERY SEARCH (FIXED: ใช้ In-memory filtering เพื่อเลี่ยงปัญหา Index) ---
export async function searchGallery(keyword?: string, date?: string): Promise<PhotographyJob[]> {
    try {
        console.log(`[Gallery Search] Starting search... keyword: "${keyword}", date: "${date}"`);

        const jobsRef = collection(db, 'photography_jobs');

        // Step 1: ดึงข้อมูลล่าสุดมาก่อน (ใช้แค่ orderBy startTime ซึ่ง Index ปกติมีให้อยู่แล้ว)
        // ดึงมา 100 รายการล่าสุด
        const q = query(
            jobsRef,
            orderBy('startTime', 'desc'),
            limit(100)
        );

        const snapshot = await getDocs(q);
        let jobs: PhotographyJob[] = [];

        // Step 2: Filter ในโค้ด (Safe & Sure)
        snapshot.forEach((doc) => {
            const data = doc.data();
            // เช็คว่าเป็นงานที่เสร็จแล้ว (completed) เท่านั้น
            if (data.status === 'completed') {
                jobs.push({ id: doc.id, ...data } as PhotographyJob);
            }
        });

        console.log(`[Gallery Search] Fetched ${jobs.length} completed jobs from DB.`);

        // Step 3: Filter ตามวันที่ (ถ้ามี)
        if (date) {
            const targetYMD = date.split('T')[0];
            jobs = jobs.filter(job => {
                if (!job.startTime) return false;
                const jobDate = job.startTime instanceof Timestamp
                    ? job.startTime.toDate()
                    : new Date(job.startTime as unknown as string);

                // แปลงเป็นเวลาไทย
                const thDate = new Date(jobDate.getTime() + (7 * 60 * 60 * 1000));
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
        }

        // Step 4: Filter ตาม Keyword (ถ้ามี)
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

        console.log(`[Gallery Search] Returning ${jobs.slice(0, 10).length} jobs.`);
        return jobs.slice(0, 10);
    } catch (error) {
        console.error('Error searching gallery:', error);
        return [];
    }
}

// --- REPAIR FUNCTIONS ---

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

        // ใช้ SIDE_MAPPING ที่ประกาศไว้ด้านบนสุด
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

        // Logging
        try {
            const { logActivity } = await import('@/utils/logger');
            await logActivity({
                action: 'repair',
                productName: room,
                userName: requesterName || 'ผู้แจ้งผ่าน LINE',
                details: description,
                imageUrl: images.length > 0 ? images[0] : undefined,
                zone: normalizedSide as 'junior_high' | 'senior_high' | 'common'
            });
        } catch (e) { console.error("Logger error", e); }

        // Notification
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

        return { success: true, ticketId: docRef.id };
    } catch (error) {
        console.error('Error creating repair:', error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการแจ้งซ่อมค่ะ' };
    }
}

export async function getRepairsByEmail(email: string): Promise<RepairTicket[]> {
    try {
        const repairsRef = collection(db, 'repair_tickets');
        const q = query(repairsRef, where('requesterEmail', '==', email), orderBy('createdAt', 'desc'), limit(5));
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
        if (zone === 'all') {
            q = query(repairsRef, where('status', 'in', ['pending', 'in_progress', 'waiting_parts']), orderBy('createdAt', 'desc'), limit(50));
        } else {
            q = query(repairsRef, where('zone', '==', zone), where('status', 'in', ['pending', 'in_progress', 'waiting_parts']), orderBy('createdAt', 'desc'), limit(50));
        }
        const snapshot = await getDocs(q);
        let repairs: RepairTicket[] = [];
        snapshot.forEach((doc) => repairs.push({ id: doc.id, ...doc.data() } as RepairTicket));
        if (date) {
            const targetYMD = date.split('T')[0];
            repairs = repairs.filter(r => {
                const rDate = r.createdAt instanceof Timestamp ? r.createdAt.toDate() : new Date(r.createdAt as any);
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
    } catch (error) { return null; }
}

// --- BOOKING FUNCTIONS ---

export interface CheckAvailabilityResult {
    available: boolean;
    conflicts?: { title: string; startTime: string; endTime: string; requesterName: string; }[];
}

export async function checkRoomAvailability(room: string, date: string, startTime: string, endTime: string): Promise<CheckAvailabilityResult> {
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
        const [reqStartH, reqStartM] = startTime.split(':').map(Number);
        const [reqEndH, reqEndM] = endTime.split(':').map(Number);
        const reqStart = reqStartH * 60 + reqStartM;
        const reqEnd = reqEndH * 60 + reqEndM;

        snapshot.forEach((doc) => {
            const b = doc.data();
            const bStart = b.startTime instanceof Timestamp ? b.startTime.toDate() : new Date(b.startTime);
            const bEnd = b.endTime instanceof Timestamp ? b.endTime.toDate() : new Date(b.endTime);
            const thStart = new Date(bStart.getTime() + (7 * 60 * 60 * 1000));
            const thEnd = new Date(bEnd.getTime() + (7 * 60 * 60 * 1000));
            const bStartM = thStart.getUTCHours() * 60 + thStart.getUTCMinutes();
            const bEndM = thEnd.getUTCHours() * 60 + thEnd.getUTCMinutes();

            if (reqStart < bEndM && reqEnd > bStartM) {
                conflicts.push({
                    title: b.title,
                    startTime: thStart.toISOString().substring(11, 16),
                    endTime: thEnd.toISOString().substring(11, 16),
                    requesterName: b.requesterName,
                });
            }
        });
        return { available: conflicts.length === 0, conflicts: conflicts.length > 0 ? conflicts : undefined };
    } catch (error) { return { available: false }; }
}

export async function getRoomSchedule(room: string, date: string): Promise<Booking[]> {
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
        snapshot.forEach((doc) => bookings.push({ id: doc.id, ...doc.data() } as Booking));
        bookings.sort((a, b) => (a.startTime instanceof Timestamp ? a.startTime.toMillis() : 0) - (b.startTime instanceof Timestamp ? b.startTime.toMillis() : 0));
        return bookings;
    } catch (error) { return []; }
}

export interface CreateBookingResult { success: boolean; bookingId?: string; error?: string; }

export async function createBookingFromAI(
    room: string, date: string, startTime: string, endTime: string,
    title: string, requesterName: string, requesterEmail: string
): Promise<CreateBookingResult> {
    try {
        if (!room || !date || !startTime || !endTime || !title) return { success: false, error: 'ข้อมูลไม่ครบค่ะ' };
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const bookingDate = new Date(date);
        const avail = await checkRoomAvailability(room, date, startTime, endTime);
        if (!avail.available) return { success: false, error: 'ห้องไม่ว่างค่ะ' };

        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);
        const sDT = new Date(bookingDate); sDT.setHours(sH, sM, 0, 0);
        const eDT = new Date(bookingDate); eDT.setHours(eH, eM, 0, 0);

        const bookingData = {
            room: normalizedRoom, roomId: normalizedRoom,
            startTime: Timestamp.fromDate(sDT), endTime: Timestamp.fromDate(eDT),
            title, description: 'จองผ่าน LINE AI',
            requesterName, requesterEmail,
            department: 'บุคลากร', position: 'บุคลากร', phoneNumber: '-',
            status: 'pending', createdAt: serverTimestamp(), source: 'line_ai',
        };
        const docRef = await addDoc(collection(db, 'bookings'), bookingData);
        return { success: true, bookingId: docRef.id };
    } catch (error) { return { success: false, error: 'เกิดข้อผิดพลาดในการจองค่ะ' }; }
}

export async function getBookingsByEmail(email: string): Promise<Booking[]> {
    try {
        const q = query(collection(db, 'bookings'), where('requesterEmail', '==', email), orderBy('startTime', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        const bookings: Booking[] = [];
        snapshot.forEach((doc) => bookings.push({ id: doc.id, ...doc.data() } as Booking));
        return bookings;
    } catch (error) { return []; }
}

export async function getPendingBookings(date?: string): Promise<Booking[]> {
    try {
        const q = query(collection(db, 'bookings'), where('status', '==', 'pending'), orderBy('startTime', 'asc'), limit(50));
        const snapshot = await getDocs(q);
        let bookings: Booking[] = [];
        snapshot.forEach((doc) => bookings.push({ id: doc.id, ...doc.data() } as Booking));
        if (date) {
            const targetYMD = date.split('T')[0];
            bookings = bookings.filter(b => {
                const bDate = b.startTime instanceof Timestamp ? b.startTime.toDate() : new Date(b.startTime as any);
                const thDate = new Date(bDate.getTime() + (7 * 60 * 60 * 1000));
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
        }
        return bookings;
    } catch (error) { return []; }
}

// --- PHOTO JOB FUNCTIONS ---

export async function getPhotoJobsByPhotographer(userId: string, date?: string): Promise<PhotographyJob[]> {
    try {
        const q = query(collection(db, 'photography_jobs'), where('assigneeIds', 'array-contains', userId), orderBy('startTime', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        let jobs: PhotographyJob[] = [];
        snapshot.forEach((doc) => jobs.push({ id: doc.id, ...doc.data() } as PhotographyJob));
        if (date) {
            const targetYMD = date.split('T')[0];
            jobs = jobs.filter(job => {
                const jDate = job.startTime instanceof Timestamp ? job.startTime.toDate() : new Date(job.startTime as any);
                const thDate = new Date(jDate.getTime() + (7 * 60 * 60 * 1000));
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
        }
        return jobs;
    } catch (error) { return []; }
}

// --- SUMMARY & DISPLAY HELPERS ---

export interface DailySummary {
    repairs: { total: number; pending: number; inProgress: number; };
    bookings: { total: number; pending: number; approved: number; };
    photoJobs: { total: number; pending: number; };
}

export async function getDailySummary(date: Date = new Date()): Promise<DailySummary> {
    try {
        const s = new Date(date); s.setHours(0, 0, 0, 0);
        const e = new Date(date); e.setHours(23, 59, 59, 999);
        const sT = Timestamp.fromDate(s);
        const eT = Timestamp.fromDate(e);

        const rQ = query(collection(db, 'repair_tickets'), where('createdAt', '>=', sT), where('createdAt', '<=', eT));
        const rSnap = await getDocs(rQ);
        let rP = 0, rIP = 0;
        rSnap.forEach(d => { const s = d.data().status; if (s === 'pending') rP++; if (s === 'in_progress') rIP++; });

        const bQ = query(collection(db, 'bookings'), where('startTime', '>=', sT), where('startTime', '<=', eT));
        const bSnap = await getDocs(bQ);
        let bP = 0, bA = 0;
        bSnap.forEach(d => { const s = d.data().status; if (s === 'pending') bP++; if (s === 'approved') bA++; });

        const jQ = query(collection(db, 'photography_jobs'), where('startTime', '>=', sT), where('startTime', '<=', eT));
        const jSnap = await getDocs(jQ);

        return {
            repairs: { total: rSnap.size, pending: rP, inProgress: rIP },
            bookings: { total: bSnap.size, pending: bP, approved: bA },
            photoJobs: { total: jSnap.size, pending: 0 },
        };
    } catch (error) {
        return { repairs: { total: 0, pending: 0, inProgress: 0 }, bookings: { total: 0, pending: 0, approved: 0 }, photoJobs: { total: 0, pending: 0 } };
    }
}

export function formatBookingForDisplay(b: Booking): string {
    const sMap: any = { pending: '🟡 รออนุมัติ', approved: '🟢 อนุมัติแล้ว', rejected: '🔴 ไม่อนุมัติ', cancelled: '⚫ ยกเลิก' };
    const sD = b.startTime instanceof Timestamp ? b.startTime.toDate() : new Date(b.startTime as any);
    const eD = b.endTime instanceof Timestamp ? b.endTime.toDate() : new Date(b.endTime as any);
    return `📅 ${sD.toLocaleDateString('th-TH')} | ${sD.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}-${eD.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}\n📍 ${b.room}\n📝 ${b.title}\n${sMap[b.status] || b.status}\n👤 ${b.requesterName}\n`;
}

export function formatRepairForDisplay(r: RepairTicket): string {
    const sMap: any = { pending: '🟡 รอดำเนินการ', in_progress: '🔵 กำลังซ่อม', waiting_parts: '🟠 รออะไหล่', completed: '🟢 เสร็จแล้ว', cancelled: '⚫ ยกเลิก' };
    const d = r.createdAt instanceof Timestamp ? r.createdAt.toDate().toLocaleDateString('th-TH') : new Date(r.createdAt as any).toLocaleDateString('th-TH');
    return `🔧 ${r.id}\n📍 ${r.room}\n📝 ${r.description?.substring(0, 50)}...\n📅 ${d}\nสถานะ: ${sMap[r.status] || r.status}`;
}

export function formatPhotoJobForDisplay(j: PhotographyJob): string {
    const d = j.startTime instanceof Timestamp ? j.startTime.toDate().toLocaleDateString('th-TH') : new Date(j.startTime as any).toLocaleDateString('th-TH');
    let l = '';
    if (j.driveLink) l += `\n📁 Drive: ${j.driveLink}`;
    if (j.facebookPermalink) l += `\n📘 Facebook: ${j.facebookPermalink}`;
    else if (j.facebookPostId) l += `\n📘 Facebook: https://www.facebook.com/${j.facebookPostId}`;
    return `📸 ${j.title}\n📅 ${d}\n📍 ${j.location || '-'}${l}`;
}