/**
 * AI Agent Functions (FIXED VERSION 3)
 * - Remove Synonym Expansion (Strict Search)
 * - Fix Room Names (ID -> Thai Name)
 * - Fix Timezone (UTC -> Thai Time string)
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
// 1. MAPPINGS & HELPERS
// ============================================================================

// Room mapping (User Input -> ID)
const ROOM_MAPPING: Record<string, string> = {
    // Junior High
    'ห้องพญาสัตบรรณ': 'jh_phaya', 'พญาสัตบรรณ': 'jh_phaya', 'พญา': 'jh_phaya', 'ห้องประชุมพญาสัตบรรณ': 'jh_phaya',
    'โรงยิม': 'jh_gym', 'ยิม': 'jh_gym', 'ห้องประชุมโรงยิม': 'jh_gym',
    'ห้องจามจุรี': 'jh_chamchuri', 'จามจุรี': 'jh_chamchuri', 'ห้องประชุมจามจุรี': 'jh_chamchuri',
    // Senior High
    'ห้องลีลาวดี': 'sh_leelawadee', 'ลีลาวดี': 'sh_leelawadee', 'ลีลา': 'sh_leelawadee', 'ห้องประชุมลีลาวดี': 'sh_leelawadee',
    'หอประชุม': 'sh_auditorium', 'อาคารพลศึกษา': 'sh_auditorium', 'ห้องประชุมหอประชุม': 'sh_auditorium',
    'ห้องศาสตร์พระราชา': 'sh_king_science', 'ศาสตร์พระราชา': 'sh_king_science', 'ห้องประชุมศาสตร์พระราชา': 'sh_king_science',
    'ห้องศูนย์ภาษา': 'sh_language_center', 'ศูนย์ภาษา': 'sh_language_center', 'ห้องประชุมศูนย์ภาษา': 'sh_language_center',
    'ชั้น 3 อาคารอำนวยการ': 'sh_admin_3', 'ห้องอำนวยการ': 'sh_admin_3', 'อาคาร 3': 'sh_admin_3', 'ห้องประชุมชั้น 3': 'sh_admin_3', 'ห้องประชุมอำนวยการ': 'sh_admin_3',
};

// [NEW] Reverse Room Mapping (ID -> Thai Name output for AI)
const ROOM_NAME_DISPLAY: Record<string, string> = {
    'jh_phaya': 'ห้องพญาสัตบรรณ (ม.ต้น)',
    'jh_gym': 'โรงยิม (ม.ต้น)',
    'jh_chamchuri': 'ห้องจามจุรี (ม.ต้น)',
    'sh_leelawadee': 'ห้องลีลาวดี (ม.ปลาย)',
    'sh_auditorium': 'หอประชุม (ม.ปลาย)',
    'sh_king_science': 'ห้องศาสตร์พระราชา (ม.ปลาย)',
    'sh_language_center': 'ห้องศูนย์ภาษา (ม.ปลาย)',
    'sh_admin_3': 'ห้องประชุมชั้น 3 อาคารอำนวยการ',
    'common': 'ส่วนกลาง',
    'junior_high': 'ม.ต้น',
    'senior_high': 'ม.ปลาย'
};

// Side mapping
const SIDE_MAPPING: Record<string, string> = {
    'ม.ต้น': 'junior_high', 'มต้น': 'junior_high', 'ม ต้น': 'junior_high', 'junior': 'junior_high', 'junior_high': 'junior_high',
    'ม.ปลาย': 'senior_high', 'มปลาย': 'senior_high', 'ม ปลาย': 'senior_high', 'senior': 'senior_high', 'senior_high': 'senior_high',
    'ส่วนกลาง': 'common', 'common': 'common'
};

// --- Helpers ---

// Helper: Convert ID to Thai Name
function getRoomDisplayName(id: string): string {
    return ROOM_NAME_DISPLAY[id] || id;
}

// Helper: Format Date to Thai String (Fixed Timezone Issue)
// AI จะได้รับ string นี้ไปตอบ ทำให้เวลาตรงแน่นอน
function formatToThaiTime(dateInput: any): string {
    if (!dateInput) return '-';
    const date = dateInput instanceof Timestamp ? dateInput.toDate() : new Date(dateInput);

    // บังคับ Timezone Asia/Bangkok
    return date.toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getThaiDateRange(dateStr: string): { start: Timestamp, end: Timestamp } {
    const [year, month, day] = dateStr.split('-').map(Number);
    // UTC Midnight
    const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    // Offset -7 hours for Thai start
    const thaiStart = new Date(utcMidnight.getTime() - (7 * 60 * 60 * 1000));
    const thaiEnd = new Date(thaiStart.getTime() + (24 * 60 * 60 * 1000) - 1);
    return { start: Timestamp.fromDate(thaiStart), end: Timestamp.fromDate(thaiEnd) };
}

// ============================================================================
// 2. MAIN FUNCTIONS
// ============================================================================

// --- GALLERY SEARCH (Strict Version: No Synonyms) ---
export async function searchGallery(keyword?: string, date?: string): Promise<any[]> {
    try {
        console.log(`[Gallery Search] Input: "${keyword}", Date: "${date}"`);

        const jobsRef = collection(db, 'photography_jobs');
        const q = query(jobsRef, orderBy('startTime', 'desc'), limit(100));
        const snapshot = await getDocs(q);

        let jobs: any[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'completed') {
                // แปลงข้อมูลให้ AI อ่านง่ายๆ
                jobs.push({
                    id: doc.id,
                    title: data.title,
                    location: data.location,
                    date: formatToThaiTime(data.startTime), // ส่งเวลาไทยกลับไป
                    driveLink: data.driveLink || null,
                    facebookLink: data.facebookPermalink || null, // [NEW] ลิงก์ Facebook
                    rawStartTime: data.startTime // เก็บไว้เผื่อ sort
                });
            }
        });

        // 1. Filter Date
        if (date) {
            const targetYMD = date.split('T')[0];
            jobs = jobs.filter(job => {
                const jDate = job.rawStartTime instanceof Timestamp ? job.rawStartTime.toDate() : new Date(job.rawStartTime);
                const thDate = new Date(jDate.getTime() + (7 * 60 * 60 * 1000)); // shift logic manually for check
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
        }

        // 2. Strict Keyword Search (ตัด Synonym ออก)
        if (keyword) {
            const cleanKeyword = keyword.trim().toLowerCase();
            const tokens = cleanKeyword.split(/[\s,]+/).filter(t => t.length > 0);

            jobs = jobs.filter(job => {
                const textToSearch = `${job.title} ${job.location}`.toLowerCase();
                // ต้องมีคำค้นหาปรากฏอยู่จริง (Simple Include)
                return tokens.some(token => textToSearch.includes(token));
            });
        }

        // Return แค่ข้อมูลที่จำเป็น (ตัด rawStartTime ออกก่อนส่ง)
        return jobs.slice(0, 10).map(({ rawStartTime, ...rest }) => rest);

    } catch (error) {
        console.error('Error searching gallery:', error);
        return [];
    }
}

// --- REPAIR FUNCTIONS ---

export interface CreateRepairResult { success: boolean; ticketId?: string; error?: string; data?: any }

export async function createRepairFromAI(
    room: string, description: string, side: string, imageUrl: string, requesterName: string, requesterEmail: string
): Promise<CreateRepairResult> {
    try {
        if (!room || !description || !side) return { success: false, error: 'ข้อมูลไม่ครบค่ะ' };

        // [NEW] Lookup user's displayName from Firestore using email
        let finalRequesterName = requesterName || 'ผู้แจ้งผ่าน LINE';
        if (requesterEmail) {
            try {
                const usersRef = collection(db, 'users');
                const userQuery = query(usersRef, where('email', '==', requesterEmail), limit(1));
                const userSnapshot = await getDocs(userQuery);

                if (!userSnapshot.empty) {
                    const userData = userSnapshot.docs[0].data();
                    if (userData.displayName) {
                        finalRequesterName = userData.displayName; // Use Google Name
                        console.log(`[createRepairFromAI] Found user displayName: ${finalRequesterName}`);
                    }
                }
            } catch (lookupError) {
                console.error('[createRepairFromAI] User lookup error:', lookupError);
                // Continue with provided name if lookup fails
            }
        }

        const normalizedSide = SIDE_MAPPING[side.toLowerCase()] || 'junior_high';
        const images: string[] = imageUrl && imageUrl !== 'pending_upload' && imageUrl !== '' ? [imageUrl] : [];

        const repairData = {
            room,
            description,
            zone: normalizedSide as 'junior_high' | 'senior_high' | 'common',
            images,
            requesterName: finalRequesterName, // Use looked-up name
            requesterEmail: requesterEmail || '',
            position: 'แจ้งผ่าน LINE', phone: '-', status: 'pending' as const,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(), source: 'line_ai',
        };

        const docRef = await addDoc(collection(db, 'repair_tickets'), repairData);

        // Notify
        try {
            const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
            await fetch(`${apiUrl}/api/notify-repair`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: docRef.id, requesterName: finalRequesterName,
                    room, description, imageOneUrl: images[0] || '', zone: normalizedSide
                })
            });
        } catch (e) { console.error('Notify Error', e); }

        return {
            success: true,
            ticketId: docRef.id,
            data: {
                ...repairData,
                requesterName: finalRequesterName, // [NEW] Explicit name for AI to use
                roomName: getRoomDisplayName(room), // ส่งชื่อไทยกลับไปให้ AI ตอบ
                createdAt: formatToThaiTime(new Date())
            }
        };
    } catch (error) { return { success: false, error: 'เกิดข้อผิดพลาด' }; }
}

export async function getRepairsByEmail(email: string): Promise<any[]> {
    try {
        const q = query(collection(db, 'repair_tickets'), where('requesterEmail', '==', email), orderBy('createdAt', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        const repairs: any[] = [];
        snapshot.forEach((doc) => {
            const d = doc.data();
            repairs.push({
                id: doc.id,
                room: getRoomDisplayName(d.room), // แปลงชื่อห้อง
                description: d.description,
                status: d.status,
                date: formatToThaiTime(d.createdAt) // แปลงเวลาไทย
            });
        });
        return repairs;
    } catch (error) { return []; }
}

// --- BOOKING FUNCTIONS ---

export interface CheckAvailabilityResult { available: boolean; conflicts?: any[]; }

export async function checkRoomAvailability(room: string, date: string, startTime: string, endTime: string): Promise<CheckAvailabilityResult> {
    try {
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const { start, end } = getThaiDateRange(date);
        const q = query(collection(db, 'bookings'), where('roomId', '==', normalizedRoom), where('startTime', '>=', start), where('startTime', '<=', end), where('status', 'in', ['pending', 'approved', 'confirmed']));
        const snapshot = await getDocs(q);

        const conflicts: any[] = [];
        const [reqStartH, reqStartM] = startTime.split(':').map(Number);
        const [reqEndH, reqEndM] = endTime.split(':').map(Number);
        const reqStart = reqStartH * 60 + reqStartM;
        const reqEnd = reqEndH * 60 + reqEndM;

        snapshot.forEach((doc) => {
            const b = doc.data();
            // Convert DB timestamp to Thai Date object for calculation
            const bStart = b.startTime instanceof Timestamp ? b.startTime.toDate() : new Date(b.startTime);
            const bEnd = b.endTime instanceof Timestamp ? b.endTime.toDate() : new Date(b.endTime);

            // Shift to Thai Time strictly for comparison logic
            const thStart = new Date(bStart.getTime() + (7 * 60 * 60 * 1000));
            const thEnd = new Date(bEnd.getTime() + (7 * 60 * 60 * 1000));

            const bStartM = thStart.getUTCHours() * 60 + thStart.getUTCMinutes();
            const bEndM = thEnd.getUTCHours() * 60 + thEnd.getUTCMinutes();

            if (reqStart < bEndM && reqEnd > bStartM) {
                conflicts.push({
                    title: b.title,
                    // Return human readable Thai time string
                    timeRange: `${thStart.getUTCHours().toString().padStart(2, '0')}:${thStart.getUTCMinutes().toString().padStart(2, '0')} - ${thEnd.getUTCHours().toString().padStart(2, '0')}:${thEnd.getUTCMinutes().toString().padStart(2, '0')}`,
                    requesterName: b.requesterName,
                });
            }
        });
        return { available: conflicts.length === 0, conflicts: conflicts.length > 0 ? conflicts : undefined };
    } catch (error) { return { available: false }; }
}

export async function getRoomSchedule(room: string, date: string): Promise<any[]> {
    try {
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const { start, end } = getThaiDateRange(date);
        const q = query(collection(db, 'bookings'), where('roomId', '==', normalizedRoom), where('startTime', '>=', start), where('startTime', '<=', end), where('status', 'in', ['pending', 'approved', 'confirmed']));
        const snapshot = await getDocs(q);

        const bookings: any[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            bookings.push({
                id: doc.id,
                title: data.title,
                room: getRoomDisplayName(data.room), // ชื่อห้องไทย
                status: data.status,
                requester: data.requesterName,
                startTime: formatToThaiTime(data.startTime), // เวลาไทย
                endTime: formatToThaiTime(data.endTime),     // เวลาไทย
                rawStart: data.startTime // internal sort
            });
        });

        // Sort by time
        bookings.sort((a, b) => (a.rawStart?.toMillis() || 0) - (b.rawStart?.toMillis() || 0));

        // Remove raw data before sending to AI
        return bookings.map(({ rawStart, ...rest }) => rest);

    } catch (error) { return []; }
}

export async function createBookingFromAI(room: string, date: string, startTime: string, endTime: string, title: string, requesterName: string, requesterEmail: string): Promise<any> {
    try {
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const avail = await checkRoomAvailability(room, date, startTime, endTime);
        if (!avail.available) return { success: false, error: 'ห้องไม่ว่างค่ะ' };

        const d = new Date(date);
        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);
        const sDT = new Date(d); sDT.setHours(sH, sM, 0, 0);
        const eDT = new Date(d); eDT.setHours(eH, eM, 0, 0);

        const docRef = await addDoc(collection(db, 'bookings'), {
            room: normalizedRoom, roomId: normalizedRoom, startTime: Timestamp.fromDate(sDT), endTime: Timestamp.fromDate(eDT),
            title, description: 'จองผ่าน LINE AI', requesterName, requesterEmail, department: 'บุคลากร', position: 'บุคลากร', phoneNumber: '-', status: 'pending', createdAt: serverTimestamp(), source: 'line_ai'
        });
        return {
            success: true,
            bookingId: docRef.id,
            details: {
                room: getRoomDisplayName(normalizedRoom),
                date: date,
                time: `${startTime} - ${endTime}`
            }
        };
    } catch (e) { return { success: false, error: 'เกิดข้อผิดพลาด' }; }
}

export async function getBookingsByEmail(email: string): Promise<any[]> {
    try {
        const q = query(collection(db, 'bookings'), where('requesterEmail', '==', email), orderBy('startTime', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        const bookings: any[] = [];
        snapshot.forEach((doc) => {
            const d = doc.data();
            bookings.push({
                id: doc.id,
                title: d.title,
                room: getRoomDisplayName(d.room),
                status: d.status,
                start: formatToThaiTime(d.startTime)
            });
        });
        return bookings;
    } catch (e) { return []; }
}

export async function getPendingBookings(date?: string): Promise<any[]> {
    try {
        const q = query(collection(db, 'bookings'), where('status', '==', 'pending'), orderBy('startTime', 'asc'), limit(50));
        const snapshot = await getDocs(q);
        let bookings: any[] = [];
        snapshot.forEach((doc) => {
            const d = doc.data();
            bookings.push({
                id: doc.id,
                title: d.title,
                room: getRoomDisplayName(d.room),
                startTime: formatToThaiTime(d.startTime),
                rawStart: d.startTime
            });
        });

        if (date) {
            const target = date.split('T')[0];
            bookings = bookings.filter(b => {
                const t = new Date((b.rawStart instanceof Timestamp ? b.rawStart.toDate() : new Date(b.rawStart)).getTime() + (7 * 60 * 60 * 1000));
                return t.toISOString().split('T')[0] === target;
            });
        }
        return bookings.map(({ rawStart, ...rest }) => rest);
    } catch (e) { return []; }
}

// --- PHOTO JOB FUNCTIONS ---

export async function getPhotoJobsByPhotographer(userId: string, date?: string): Promise<any[]> {
    try {
        const q = query(collection(db, 'photography_jobs'), where('assigneeIds', 'array-contains', userId), orderBy('startTime', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        let jobs: any[] = [];
        snapshot.forEach((doc) => {
            const d = doc.data();
            jobs.push({
                id: doc.id,
                title: d.title,
                location: d.location,
                status: d.status,
                startTime: formatToThaiTime(d.startTime),
                driveLink: d.driveLink || null,
                facebookLink: d.facebookPermalink || null, // [NEW] ลิงก์ Facebook
                rawStart: d.startTime
            });
        });

        if (date) {
            const target = date.split('T')[0];
            jobs = jobs.filter(j => {
                const t = new Date((j.rawStart instanceof Timestamp ? j.rawStart.toDate() : new Date(j.rawStart)).getTime() + (7 * 60 * 60 * 1000));
                return t.toISOString().split('T')[0] === target;
            });
        }
        return jobs.map(({ rawStart, ...rest }) => rest);
    } catch (e) { return []; }
}

// --- SUMMARY ---

export async function getDailySummary(date: Date = new Date()): Promise<any> {
    try {
        const s = new Date(date); s.setHours(0, 0, 0, 0);
        const e = new Date(date); e.setHours(23, 59, 59, 999);
        const sT = Timestamp.fromDate(s); const eT = Timestamp.fromDate(e);
        const rQ = query(collection(db, 'repair_tickets'), where('createdAt', '>=', sT), where('createdAt', '<=', eT));
        const bQ = query(collection(db, 'bookings'), where('startTime', '>=', sT), where('startTime', '<=', eT));
        const jQ = query(collection(db, 'photography_jobs'), where('startTime', '>=', sT), where('startTime', '<=', eT));
        const [rS, bS, jS] = await Promise.all([getDocs(rQ), getDocs(bQ), getDocs(jQ)]);
        let rP = 0, rIP = 0; rS.forEach(d => { if (d.data().status === 'pending') rP++; if (d.data().status === 'in_progress') rIP++; });
        let bP = 0, bA = 0; bS.forEach(d => { if (d.data().status === 'pending') bP++; if (d.data().status === 'approved') bA++; });
        return {
            date: formatToThaiTime(date),
            repairs: { total: rS.size, pending: rP, inProgress: rIP },
            bookings: { total: bS.size, pending: bP, approved: bA },
            photoJobs: { total: jS.size, pending: 0 }
        };
    } catch (e) { return { error: 'Failed to get summary' }; }
}