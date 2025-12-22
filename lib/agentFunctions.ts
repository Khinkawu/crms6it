/**
 * AI Agent Functions (GOD-TIER VERSION)
 * - Search Engine V2: รองรับคำไวพจน์ (Synonyms) + แก้คำผิด (Fuzzy Search)
 * - Display V2: แสดงชื่อห้องภาษาไทยถูกต้อง
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
// 1. MAPPINGS & CONFIGURATION
// ============================================================================

// [SEARCH CONFIG] คลังคำศัพท์/คำไวพจน์ (เพิ่มได้ตามต้องการ)
const SYNONYMS: Record<string, string[]> = {
    'ติว': ['สอน', 'เรียน', 'วิชาการ', 'o-net', 'tgat', 'tpat', 'a-level', 'สอบ', 'camp'],
    'กีฬา': ['sport', 'ฟุตบอล', 'บาส', 'วอลเลย์', 'วิ่ง', 'futsal', 'แบดมินตัน', 'แข่งขัน'],
    'ดนตรี': ['music', 'concert', 'วงโย', 'โฟล์คซอง', 'การแสดง', 'ดุริยางค์'],
    'เข้าค่าย': ['camp', 'ลูกเสือ', 'เนตรนารี', 'ยุว', 'ทัศนศึกษา', 'field trip'],
    'ประชุม': ['meeting', 'อบรม', 'สัมมนา', 'conference', 'workshop'],
    'กิจกรรม': ['activity', 'งาน', 'event', 'พิธี'],
    'ไหว้ครู': ['พาน', 'ครู'],
};

// Room mapping (ชื่อไทย -> รหัส)
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

// Room Display Name (รหัส -> ชื่อไทย)
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

// ============================================================================
// 2. INTELLIGENT SEARCH HELPERS (GOD-TIER ALGORITHMS)
// ============================================================================

// Algorithm คำนวณความต่างของคำ (Levenshtein Distance) ใช้แก้คำผิด
function getLevenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

// ฟังก์ชันคำนวณคะแนนความเหมือน (Advanced Scoring)
function calculateSmartScore(text: string, searchTokens: string[]): number {
    if (!text) return 0;
    const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '');
    const normalizedText = normalize(text);
    let totalScore = 0;

    searchTokens.forEach(token => {
        const normToken = normalize(token);

        // 1. Exact Match (เจอคำเป๊ะๆ) -> 10 คะแนน
        if (normalizedText.includes(normToken)) {
            totalScore += 10;
        }
        // 2. Fuzzy Match (คำคล้าย/พิมพ์ผิด) -> 3 คะแนน
        // อนุญาตให้ผิดได้ 2 ตัวอักษร (เช่น 'gym' vs 'gmy')
        else if (token.length > 3) {
            // เช็คแบบง่าย: ถ้าคำใน text มีส่วนที่คล้าย token
            // (ในที่นี้ใช้ includes แบบง่ายไปก่อน เพื่อ performance)
        }
    });

    return totalScore;
}

function getRoomDisplayName(id: string): string {
    return ROOM_NAME_DISPLAY[id] || id;
}

function getThaiDateRange(dateStr: string): { start: Timestamp, end: Timestamp } {
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const thaiStart = new Date(utcMidnight.getTime() - (7 * 60 * 60 * 1000));
    const thaiEnd = new Date(thaiStart.getTime() + (24 * 60 * 60 * 1000) - 1);
    return { start: Timestamp.fromDate(thaiStart), end: Timestamp.fromDate(thaiEnd) };
}

// ============================================================================
// 3. MAIN FUNCTIONS
// ============================================================================

// --- GALLERY SEARCH (GOD-TIER) ---
export async function searchGallery(keyword?: string, date?: string): Promise<PhotographyJob[]> {
    try {
        console.log(`[Smart Search] Keyword: "${keyword}", Date: "${date}"`);

        const jobsRef = collection(db, 'photography_jobs');
        // ดึงข้อมูลมาก่อน (Fetch recent 150 items) แล้วค่อย Filter ในโค้ดเพื่อความฉลาดสูงสุด
        const q = query(jobsRef, orderBy('startTime', 'desc'), limit(150));
        const snapshot = await getDocs(q);

        let jobs: PhotographyJob[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'completed') {
                jobs.push({ id: doc.id, ...data } as PhotographyJob);
            }
        });

        // 1. Filter Date (ถ้ามี)
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

        // 2. Smart Keyword Search
        if (keyword) {
            // A. Clean Input: ตัดคำฟุ่มเฟือย
            let cleanKeyword = keyword.trim().replace(/^(การ|ความ|งาน)/, '');

            // B. Tokenize & Expand Synonyms
            // แยกคำค้นหา และหาคำเหมือนของแต่ละคำ
            let searchTokens = cleanKeyword.toLowerCase().split(/[\s,]+/).filter(t => t.length > 0);

            // เพิ่มคำไวพจน์เข้าไปใน Tokens (เช่น user พิมพ์ "ติว" -> เพิ่ม "สอน", "เรียน", "สอบ" เข้าไปหาด้วย)
            const expandedTokens = [...searchTokens];
            searchTokens.forEach(t => {
                // เช็คว่าคำนี้มีในพจนานุกรมไหม
                for (const [key, synonyms] of Object.entries(SYNONYMS)) {
                    // ถ้าคำค้นตรงกับ key หรืออยู่ใน list synonyms
                    if (key.includes(t) || synonyms.some(s => s.includes(t))) {
                        expandedTokens.push(key, ...synonyms);
                    }
                }
            });

            // ลบคำซ้ำ
            const uniqueTokens = Array.from(new Set(expandedTokens));
            console.log(`[Smart Search] Expanded Tokens: ${JSON.stringify(uniqueTokens)}`);

            // C. Scoring & Ranking
            jobs = jobs.map(job => {
                // ให้คะแนน Title มากกว่า Location (3 เท่า)
                const titleScore = calculateSmartScore(job.title || '', uniqueTokens) * 3;
                const locScore = calculateSmartScore(job.location || '', uniqueTokens);

                // Fuzzy Search (Check Levenshtein distance for typos)
                // เช็คเฉพาะ Title ถ้าคะแนนยังเป็น 0
                let fuzzyBonus = 0;
                if (titleScore === 0 && locScore === 0) {
                    const normalize = (str: string) => str.toLowerCase();
                    const titleWords = normalize(job.title || '').split(' ');

                    // เทียบทุกคำใน Title กับคำค้นหา
                    for (const w of titleWords) {
                        for (const t of searchTokens) { // ใช้คำค้นเดิม ไม่ใช้ตัว Expand
                            const dist = getLevenshteinDistance(w, t);
                            // ถ้าผิดแค่ 1-2 ตัวอักษร และคำยาวพอสมควร
                            if (dist <= 2 && t.length > 3) {
                                fuzzyBonus += 5; // ให้คะแนนปลอบใจ
                            }
                        }
                    }
                }

                return { job, score: titleScore + locScore + fuzzyBonus };
            })
                .filter(item => item.score > 0) // เอาเฉพาะที่มีคะแนน
                .sort((a, b) => b.score - a.score) // เรียงคะแนนมากไปน้อย
                .map(item => item.job);
        }

        console.log(`[Smart Search] Found ${jobs.length} jobs`);
        return jobs.slice(0, 10);
    } catch (error) {
        console.error('Error searching gallery:', error);
        return [];
    }
}

// --- REPAIR FUNCTIONS ---

export interface CreateRepairResult { success: boolean; ticketId?: string; error?: string; }

export async function createRepairFromAI(
    room: string, description: string, side: string, imageUrl: string, requesterName: string, requesterEmail: string
): Promise<CreateRepairResult> {
    try {
        if (!room || !description || !side) return { success: false, error: 'ข้อมูลไม่ครบค่ะ' };
        const normalizedSide = SIDE_MAPPING[side.toLowerCase()] || 'junior_high';
        const images: string[] = imageUrl && imageUrl !== 'pending_upload' && imageUrl !== '' ? [imageUrl] : [];
        const repairData = {
            room, description,
            zone: normalizedSide as 'junior_high' | 'senior_high' | 'common',
            images, requesterName: requesterName || 'ผู้แจ้งผ่าน LINE', requesterEmail: requesterEmail || '',
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
                    ticketId: docRef.id, requesterName: requesterName || 'ผู้แจ้งผ่าน LINE',
                    room, description, imageOneUrl: images[0] || '', zone: normalizedSide
                })
            });
        } catch (e) { console.error('Notify Error', e); }

        return { success: true, ticketId: docRef.id };
    } catch (error) { return { success: false, error: 'เกิดข้อผิดพลาด' }; }
}

export async function getRepairsByEmail(email: string): Promise<RepairTicket[]> {
    try {
        const q = query(collection(db, 'repair_tickets'), where('requesterEmail', '==', email), orderBy('createdAt', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        const repairs: RepairTicket[] = [];
        snapshot.forEach((doc) => repairs.push({ id: doc.id, ...doc.data() } as RepairTicket));
        return repairs;
    } catch (error) { return []; }
}

export async function getRepairsForTechnician(zone: string | 'all', date?: string): Promise<RepairTicket[]> {
    try {
        const repairsRef = collection(db, 'repair_tickets');
        let q = zone === 'all'
            ? query(repairsRef, where('status', 'in', ['pending', 'in_progress', 'waiting_parts']), orderBy('createdAt', 'desc'), limit(50))
            : query(repairsRef, where('zone', '==', zone), where('status', 'in', ['pending', 'in_progress', 'waiting_parts']), orderBy('createdAt', 'desc'), limit(50));
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
    } catch (error) { return []; }
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

export interface CheckAvailabilityResult { available: boolean; conflicts?: any[]; }

export async function checkRoomAvailability(room: string, date: string, startTime: string, endTime: string): Promise<CheckAvailabilityResult> {
    try {
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const { start, end } = getThaiDateRange(date);
        const q = query(collection(db, 'bookings'), where('roomId', '==', normalizedRoom), where('startTime', '>=', start), where('startTime', '<=', end), where('status', 'in', ['pending', 'approved', 'confirmed']));
        const snapshot = await getDocs(q);
        const conflicts: any[] = [];
        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);
        const reqStart = sH * 60 + sM;
        const reqEnd = eH * 60 + eM;

        snapshot.forEach((doc) => {
            const b = doc.data();
            const thStart = new Date((b.startTime instanceof Timestamp ? b.startTime.toDate() : new Date(b.startTime)).getTime() + (7 * 60 * 60 * 1000));
            const thEnd = new Date((b.endTime instanceof Timestamp ? b.endTime.toDate() : new Date(b.endTime)).getTime() + (7 * 60 * 60 * 1000));
            const bStartM = thStart.getUTCHours() * 60 + thStart.getUTCMinutes();
            const bEndM = thEnd.getUTCHours() * 60 + thEnd.getUTCMinutes();
            if (reqStart < bEndM && reqEnd > bStartM) conflicts.push({ title: b.title, startTime: thStart.toISOString().substring(11, 16), endTime: thEnd.toISOString().substring(11, 16), requesterName: b.requesterName });
        });
        return { available: conflicts.length === 0, conflicts: conflicts.length > 0 ? conflicts : undefined };
    } catch (error) { return { available: false }; }
}

export async function getRoomSchedule(room: string, date: string): Promise<Booking[]> {
    try {
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const { start, end } = getThaiDateRange(date);
        const q = query(collection(db, 'bookings'), where('roomId', '==', normalizedRoom), where('startTime', '>=', start), where('startTime', '<=', end), where('status', 'in', ['pending', 'approved', 'confirmed']));
        const snapshot = await getDocs(q);
        const bookings: Booking[] = [];
        snapshot.forEach((doc) => bookings.push({ id: doc.id, ...doc.data(), roomName: getRoomDisplayName(doc.data().room) } as Booking));
        return bookings.sort((a, b) => (a.startTime instanceof Timestamp ? a.startTime.toMillis() : 0) - (b.startTime instanceof Timestamp ? b.startTime.toMillis() : 0));
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
        return { success: true, bookingId: docRef.id };
    } catch (e) { return { success: false, error: 'เกิดข้อผิดพลาด' }; }
}

export async function getBookingsByEmail(email: string): Promise<Booking[]> {
    try {
        const q = query(collection(db, 'bookings'), where('requesterEmail', '==', email), orderBy('startTime', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        const bookings: Booking[] = [];
        snapshot.forEach((doc) => bookings.push({ id: doc.id, ...doc.data() } as Booking));
        return bookings;
    } catch (e) { return []; }
}

export async function getPendingBookings(date?: string): Promise<Booking[]> {
    try {
        const q = query(collection(db, 'bookings'), where('status', '==', 'pending'), orderBy('startTime', 'asc'), limit(50));
        const snapshot = await getDocs(q);
        let bookings: Booking[] = [];
        snapshot.forEach((doc) => bookings.push({ id: doc.id, ...doc.data() } as Booking));
        if (date) {
            const target = date.split('T')[0];
            bookings = bookings.filter(b => {
                const t = new Date((b.startTime instanceof Timestamp ? b.startTime.toDate() : new Date(b.startTime)).getTime() + (7 * 60 * 60 * 1000));
                return t.toISOString().split('T')[0] === target;
            });
        }
        return bookings;
    } catch (e) { return []; }
}

export async function getPhotoJobsByPhotographer(userId: string, date?: string): Promise<PhotographyJob[]> {
    try {
        const q = query(collection(db, 'photography_jobs'), where('assigneeIds', 'array-contains', userId), orderBy('startTime', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        let jobs: PhotographyJob[] = [];
        snapshot.forEach((doc) => jobs.push({ id: doc.id, ...doc.data() } as PhotographyJob));
        if (date) {
            const target = date.split('T')[0];
            jobs = jobs.filter(j => {
                const t = new Date((j.startTime instanceof Timestamp ? j.startTime.toDate() : new Date(j.startTime)).getTime() + (7 * 60 * 60 * 1000));
                return t.toISOString().split('T')[0] === target;
            });
        }
        return jobs;
    } catch (e) { return []; }
}

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
            repairs: { total: rS.size, pending: rP, inProgress: rIP },
            bookings: { total: bS.size, pending: bP, approved: bA },
            photoJobs: { total: jS.size, pending: 0 }
        };
    } catch (e) { return { repairs: { total: 0, pending: 0, inProgress: 0 }, bookings: { total: 0, pending: 0, approved: 0 }, photoJobs: { total: 0, pending: 0 } }; }
}

// --- DISPLAY HELPERS (UPDATED) ---

export function formatBookingForDisplay(b: Booking): string {
    const sMap: any = { pending: '🟡 รออนุมัติ', approved: '🟢 อนุมัติแล้ว', rejected: '🔴 ไม่อนุมัติ', cancelled: '⚫ ยกเลิก' };
    const sD = b.startTime instanceof Timestamp ? b.startTime.toDate() : new Date(b.startTime as any);
    const eD = b.endTime instanceof Timestamp ? b.endTime.toDate() : new Date(b.endTime as any);
    return `📅 ${sD.toLocaleDateString('th-TH')} | ${sD.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}-${eD.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}\n📍 ${getRoomDisplayName(b.room)}\n📝 ${b.title}\n${sMap[b.status] || b.status}\n👤 ${b.requesterName}\n`;
}

export function formatRepairForDisplay(r: RepairTicket): string {
    const sMap: any = { pending: '🟡 รอดำเนินการ', in_progress: '🔵 กำลังซ่อม', waiting_parts: '🟠 รออะไหล่', completed: '🟢 เสร็จแล้ว', cancelled: '⚫ ยกเลิก' };
    const d = r.createdAt instanceof Timestamp ? r.createdAt.toDate().toLocaleDateString('th-TH') : new Date(r.createdAt as any).toLocaleDateString('th-TH');
    return `🔧 ${r.id}\n📍 ${getRoomDisplayName(r.room)}\n📝 ${r.description?.substring(0, 50)}...\n📅 ${d}\nสถานะ: ${sMap[r.status] || r.status}`;
}

export function formatPhotoJobForDisplay(j: PhotographyJob): string {
    const d = j.startTime instanceof Timestamp ? j.startTime.toDate().toLocaleDateString('th-TH') : new Date(j.startTime as any).toLocaleDateString('th-TH');
    let l = '';
    if (j.driveLink) l += `\n📁 Drive: ${j.driveLink}`;
    if (j.facebookPermalink) l += `\n📘 Facebook: ${j.facebookPermalink}`;
    else if (j.facebookPostId) l += `\n📘 Facebook: https://www.facebook.com/${j.facebookPostId}`;
    return `📸 ${j.title}\n📅 ${d}\n📍 ${j.location || '-'}${l}`;
}