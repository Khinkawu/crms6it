/**
 * AI Agent Functions
 * ฟังก์ชันสำหรับเรียกข้อมูลจาก Firestore และดำเนินการต่างๆ ให้ AI Agent
 * ใช้ Firebase Admin SDK สำหรับ server-side operations
 */

import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { RepairTicket } from '@/types';
import { createRepairNewFlexMessage } from '@/utils/flexMessageTemplates';

// ============================================================================
// 1. MAPPINGS & HELPERS
// ============================================================================

// [MAPPING 1] ชื่อไทย -> รหัส (สำหรับรับค่าตอน User สั่งงาน AI)
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

// [MAPPING 2] รหัส -> ชื่อไทยสวยๆ (สำหรับส่งกลับให้ AI ตอบ User)
const ROOM_NAME_DISPLAY: Record<string, string> = {
    'jh_phaya': 'ห้องพญาสัตบรรณ (ม.ต้น)',
    'jh_gym': 'โรงยิม (ม.ต้น)',
    'jh_chamchuri': 'ห้องจามจุรี (ม.ต้น)',
    'sh_leelawadee': 'ห้องลีลาวดี (ม.ปลาย)',
    'sh_auditorium': 'หอประชุม (ม.ปลาย)',
    'sh_king_science': 'ห้องศาสตร์พระราชา (ม.ปลาย)',
    'sh_language_center': 'ห้องศูนย์ภาษา (ม.ปลาย)',
    'sh_admin_3': 'ห้องประชุมชั้น 3 อาคารอำนวยการ',
    'junior_high': 'ม.ต้น',
    'senior_high': 'ม.ปลาย'
};

const SIDE_MAPPING: Record<string, string> = {
    // ม.ต้น variations
    'ม.ต้น': 'junior_high', 'มต้น': 'junior_high', 'ม ต้น': 'junior_high',
    'ม.ตน': 'junior_high', 'มตน': 'junior_high',
    'ต้น': 'junior_high', 'ตน': 'junior_high',
    'junior': 'junior_high', 'junior_high': 'junior_high',
    'ฝั่งม.ต้น': 'junior_high', 'ฝั่งมต้น': 'junior_high',
    // ม.ปลาย variations
    'ม.ปลาย': 'senior_high', 'มปลาย': 'senior_high', 'ม ปลาย': 'senior_high',
    'ม.ปราย': 'senior_high', 'มปราย': 'senior_high',
    'ปลาย': 'senior_high', 'ปราย': 'senior_high',
    'senior': 'senior_high', 'senior_high': 'senior_high',
    'ฝั่งม.ปลาย': 'senior_high', 'ฝั่งมปลาย': 'senior_high'
};

// --- Helpers ---

// ฟังก์ชันแปลงรหัสห้องเป็นชื่อไทย
function getRoomDisplayName(id: string): string {
    return ROOM_NAME_DISPLAY[id] || id;
}

// ฟังก์ชันแปลงเวลาเป็นภาษาไทย
function formatToThaiTime(dateInput: any): string {
    if (!dateInput) return '-';
    try {
        const date = dateInput instanceof Timestamp ? dateInput.toDate() :
            (dateInput.toDate ? dateInput.toDate() : new Date(dateInput));
        return date.toLocaleString('th-TH', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }) + " น.";
    } catch (e) {
        return '-';
    }
}

function getThaiDateRange(dateStr: string): { start: Timestamp, end: Timestamp } {
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const thaiStart = new Date(utcMidnight.getTime() - (7 * 60 * 60 * 1000));
    const thaiEnd = new Date(thaiStart.getTime() + (24 * 60 * 60 * 1000) - 1);
    return { start: Timestamp.fromDate(thaiStart), end: Timestamp.fromDate(thaiEnd) };
}

/**
 * Notify technicians directly via LINE
 */
async function notifyTechniciansDirectly(data: {
    ticketId: string;
    requesterName: string;
    room: string;
    description: string;
    imageOneUrl: string;
    zone: 'junior_high' | 'senior_high';
}): Promise<void> {
    try {
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!token) {
            console.warn('[Notify Repair] Missing LINE_CHANNEL_ACCESS_TOKEN');
            return;
        }

        const techsSnapshot = await adminDb.collection('users').where('role', '==', 'technician').get();

        let targetUserIds: string[] = [];
        techsSnapshot.forEach(doc => {
            const techData = doc.data();
            const responsibility = techData.responsibility || 'all';
            const lineId = techData.lineUserId;

            if (!lineId) return;

            if (data.zone === 'junior_high' && (responsibility === 'junior_high' || responsibility === 'all')) {
                targetUserIds.push(lineId);
            } else if (data.zone === 'senior_high' && (responsibility === 'senior_high' || responsibility === 'all')) {
                targetUserIds.push(lineId);
            }
        });

        targetUserIds = Array.from(new Set(targetUserIds));

        if (targetUserIds.length === 0) {
            console.warn('[Notify Repair] No technicians found for zone:', data.zone);
            return;
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
        const deepLink = `${appUrl}/admin/repairs?ticketId=${data.ticketId}`;
        const validImageUrl = data.imageOneUrl && data.imageOneUrl.startsWith('https://') ? data.imageOneUrl : undefined;

        const flexMessage = createRepairNewFlexMessage({
            description: data.description,
            room: data.room,
            requesterName: data.requesterName,
            imageUrl: validImageUrl,
            ticketId: data.ticketId,
            deepLink,
            zone: data.zone
        });

        const response = await fetch('https://api.line.me/v2/bot/message/multicast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                to: targetUserIds,
                messages: [flexMessage],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Notify Repair] LINE API Error:', errorText);
        } else {
            console.log(`[Notify Repair] Sent to ${targetUserIds.length} technicians`);
        }
    } catch (error) {
        console.error('[Notify Repair] Error:', error);
    }
}

// ============================================================================
// 2. MAIN FUNCTIONS
// ============================================================================

// --- GALLERY SEARCH (ค้นหารูปภาพ) ---
export async function searchGallery(keyword?: string, date?: string): Promise<any[]> {
    try {
        console.log(`[Gallery Search] Input: "${keyword}", Date: "${date}"`);
        const snapshot = await adminDb.collection('photography_jobs')
            .orderBy('startTime', 'desc')
            .limit(100)
            .get();

        let jobs: any[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'completed') {
                jobs.push({
                    id: doc.id,
                    title: data.title,
                    location: getRoomDisplayName(data.location),
                    date: formatToThaiTime(data.startTime),
                    driveLink: data.driveLink || 'ไม่มีลิงก์ Drive',
                    facebookLink: data.facebookPermalink || data.facebookPostLink || '',
                    rawStartTime: data.startTime
                });
            }
        });

        // Filter Date
        if (date) {
            const targetYMD = date.split('T')[0];
            jobs = jobs.filter(job => {
                const jDate = job.rawStartTime?.toDate ? job.rawStartTime.toDate() : new Date(job.rawStartTime);
                const thDate = new Date(jDate.getTime() + (7 * 60 * 60 * 1000));
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
        }

        // Keyword Search
        if (keyword) {
            const cleanKeyword = keyword.trim().toLowerCase();
            const tokens = cleanKeyword.split(/[\s,]+/).filter(t => t.length > 0);
            jobs = jobs.filter(job => {
                const textToSearch = `${job.title} ${job.location}`.toLowerCase();
                return tokens.some(token => textToSearch.includes(token));
            });
        }

        return jobs.slice(0, 10).map(({ rawStartTime, ...rest }) => rest);

    } catch (error) {
        console.error('Error searching gallery:', error);
        return [];
    }
}

// --- VIDEO GALLERY SEARCH (ค้นหาวิดีโอ) ---
export async function searchVideoGallery(keyword?: string, date?: string): Promise<any[]> {
    try {
        console.log(`[Video Gallery Search] === START ===`);
        console.log(`[Video Gallery Search] Input keyword: "${keyword}", Date: "${date}"`);

        let snapshot;

        // Try with isPublished filter first, fallback to all if index issue
        try {
            snapshot = await adminDb.collection('video_gallery')
                .where('isPublished', '==', true)
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
            console.log(`[Video Gallery Search] Query with isPublished filter: ${snapshot.size} docs`);
        } catch (indexError: any) {
            // Fallback: Query without composite index (may happen if index not created)
            console.warn(`[Video Gallery Search] Index error, trying fallback query:`, indexError?.message || indexError);
            snapshot = await adminDb.collection('video_gallery')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
            console.log(`[Video Gallery Search] Fallback query: ${snapshot.size} docs`);
        }

        let videos: any[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            // Filter isPublished in memory if we used fallback query
            if (data.isPublished !== false) { // Include both true and undefined (legacy data)
                videos.push({
                    id: doc.id,
                    title: data.title || '',
                    description: data.description || '',
                    category: data.category || '',
                    thumbnailUrl: data.thumbnailUrl || '',
                    videoUrl: data.videoUrl || '',
                    videoLinks: data.videoLinks || [],
                    platform: data.platform || 'other',
                    date: formatToThaiTime(data.eventDate || data.createdAt),
                    rawDate: data.eventDate || data.createdAt
                });
            }
        });

        console.log(`[Video Gallery Search] Total videos after isPublished filter: ${videos.length}`);
        if (videos.length > 0) {
            console.log(`[Video Gallery Search] Sample titles:`, videos.slice(0, 3).map(v => v.title));
        }

        // Filter by Date
        if (date) {
            const targetYMD = date.split('T')[0];
            videos = videos.filter(video => {
                if (!video.rawDate) return false;
                const vDate = video.rawDate?.toDate ? video.rawDate.toDate() : new Date(video.rawDate);
                const thDate = new Date(vDate.getTime() + (7 * 60 * 60 * 1000));
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
            console.log(`[Video Gallery Search] After date filter: ${videos.length}`);
        }

        // Keyword Search (title, description, category)
        if (keyword) {
            const cleanKeyword = keyword.trim().toLowerCase();
            // Split by spaces, commas, or keep as single token if no separators
            const tokens = cleanKeyword.split(/[\s,]+/).filter(t => t.length > 0);
            console.log(`[Video Gallery Search] Search tokens:`, tokens);

            const beforeFilter = videos.length;
            videos = videos.filter(video => {
                const textToSearch = `${video.title} ${video.description} ${video.category}`.toLowerCase();
                const matched = tokens.some(token => textToSearch.includes(token));
                if (matched) {
                    console.log(`[Video Gallery Search] Match: "${video.title}" matched token`);
                }
                return matched;
            });
            console.log(`[Video Gallery Search] After keyword filter: ${beforeFilter} -> ${videos.length}`);
        }

        console.log(`[Video Gallery Search] === END === Found ${videos.length} videos`);
        return videos.slice(0, 10).map(({ rawDate, ...rest }) => rest);

    } catch (error) {
        console.error('[Video Gallery Search] Fatal error:', error);
        return [];
    }
}

// --- PHOTO JOBS (งานของฉัน) ---
export async function getPhotoJobsByPhotographer(userId: string, date?: string): Promise<any[]> {
    try {
        const snapshot = await adminDb.collection('photography_jobs')
            .where('assigneeIds', 'array-contains', userId)
            .orderBy('startTime', 'desc')
            .limit(50)
            .get();

        let jobs: any[] = [];

        snapshot.forEach((doc) => {
            const d = doc.data();
            jobs.push({
                id: doc.id,
                title: d.title,
                location: getRoomDisplayName(d.location),
                status: d.status,
                startTime: formatToThaiTime(d.startTime),
                facebookLink: d.facebookPermalink || '',
                rawStart: d.startTime
            });
        });

        if (date) {
            const target = date.split('T')[0];
            jobs = jobs.filter(j => {
                const t = new Date((j.rawStart?.toDate ? j.rawStart.toDate() : new Date(j.rawStart)).getTime() + (7 * 60 * 60 * 1000));
                return t.toISOString().split('T')[0] === target;
            });
        }
        return jobs.map(({ rawStart, ...rest }) => rest);
    } catch (e) {
        console.error('Error getting photo jobs:', e);
        return [];
    }
}

// --- REPAIR (แจ้งซ่อม) ---

export interface CreateRepairResult { success: boolean; ticketId?: string; error?: string; data?: any }

export async function createRepairFromAI(
    room: string, description: string, side: string, imageUrl: string, requesterName: string, requesterEmail: string, aiDiagnosis?: string
): Promise<CreateRepairResult> {
    try {
        let finalRequesterName = requesterName || 'ผู้แจ้งผ่าน LINE';

        if (requesterEmail) {
            const userSnap = await adminDb.collection('users')
                .where('email', '==', requesterEmail)
                .limit(1)
                .get();

            if (!userSnap.empty) {
                const userData = userSnap.docs[0].data();
                if (userData.displayName) {
                    finalRequesterName = userData.displayName;
                }
            }
        }

        if (!room || !description || !side) return { success: false, error: 'ข้อมูลไม่ครบค่ะ' };

        const trimmedSide = side.trim().toLowerCase();
        const normalizedSide = SIDE_MAPPING[trimmedSide] || SIDE_MAPPING[side.toLowerCase()] || 'junior_high';
        console.log(`[createRepairFromAI] side input: "${side}" -> normalized: "${normalizedSide}"`);

        const images: string[] = imageUrl && imageUrl !== 'pending_upload' && imageUrl !== '' ? [imageUrl] : [];

        const repairData = {
            room, description,
            zone: normalizedSide as 'junior_high' | 'senior_high',
            images,
            aiDiagnosis: aiDiagnosis || '',
            requesterName: finalRequesterName,
            requesterEmail: requesterEmail || '',
            position: 'แจ้งผ่าน LINE', phone: '-', status: 'pending' as const,
            createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), source: 'line_ai',
        };

        const docRef = await adminDb.collection('repair_tickets').add(repairData);

        await notifyTechniciansDirectly({
            ticketId: docRef.id,
            requesterName: finalRequesterName,
            room,
            description,
            imageOneUrl: images[0] || '',
            zone: normalizedSide as 'junior_high' | 'senior_high'
        });

        return {
            success: true,
            ticketId: docRef.id,
            data: {
                ...repairData,
                roomName: getRoomDisplayName(room),
                createdAt: formatToThaiTime(new Date())
            }
        };
    } catch (error) {
        console.error('Error creating repair:', error);
        return { success: false, error: 'เกิดข้อผิดพลาด' };
    }
}

export async function getRepairsByEmail(email: string): Promise<any[]> {
    try {
        const snapshot = await adminDb.collection('repair_tickets')
            .where('requesterEmail', '==', email)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        const repairs: any[] = [];
        snapshot.forEach((doc) => {
            const d = doc.data();
            repairs.push({
                id: doc.id,
                room: getRoomDisplayName(d.room),
                description: d.description,
                status: d.status,
                date: formatToThaiTime(d.createdAt)
            });
        });
        return repairs;
    } catch (error) {
        console.error('Error getting repairs:', error);
        return [];
    }
}

export async function getRepairsForTechnician(zone: string | 'all', date?: string): Promise<RepairTicket[]> {
    try {
        let queryRef = adminDb.collection('repair_tickets')
            .where('status', 'in', ['pending', 'in_progress', 'waiting_parts'])
            .orderBy('createdAt', 'desc')
            .limit(50);

        if (zone !== 'all') {
            queryRef = adminDb.collection('repair_tickets')
                .where('zone', '==', zone)
                .where('status', 'in', ['pending', 'in_progress', 'waiting_parts'])
                .orderBy('createdAt', 'desc')
                .limit(50);
        }

        const snapshot = await queryRef.get();
        let repairs: RepairTicket[] = [];
        snapshot.forEach((doc) => repairs.push({ id: doc.id, ...doc.data() } as RepairTicket));

        if (date) {
            const targetYMD = date.split('T')[0];
            repairs = repairs.filter(r => {
                const rDate = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt as any);
                const thDate = new Date(rDate.getTime() + (7 * 60 * 60 * 1000));
                return thDate.toISOString().split('T')[0] === targetYMD;
            });
        }
        return repairs;
    } catch (error) {
        console.error('Error getting repairs for technician:', error);
        return [];
    }
}

export async function getRepairByTicketId(ticketId: string): Promise<RepairTicket | null> {
    try {
        const docSnap = await adminDb.collection('repair_tickets').doc(ticketId).get();
        if (!docSnap.exists) return null;
        return { id: docSnap.id, ...docSnap.data() } as RepairTicket;
    } catch (error) {
        console.error('Error getting repair:', error);
        return null;
    }
}

// --- BOOKING FUNCTIONS ---

export interface CheckAvailabilityResult { available: boolean; conflicts?: any[]; }

export async function checkRoomAvailability(room: string, date: string, startTime: string, endTime: string): Promise<CheckAvailabilityResult> {
    try {
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const { start, end } = getThaiDateRange(date);

        const snapshot = await adminDb.collection('bookings')
            .where('roomId', '==', normalizedRoom)
            .where('startTime', '>=', start)
            .where('startTime', '<=', end)
            .where('status', 'in', ['pending', 'approved', 'confirmed'])
            .get();

        const conflicts: any[] = [];
        const [reqStartH, reqStartM] = startTime.split(':').map(Number);
        const [reqEndH, reqEndM] = endTime.split(':').map(Number);
        const reqStart = reqStartH * 60 + reqStartM;
        const reqEnd = reqEndH * 60 + reqEndM;

        snapshot.forEach((doc) => {
            const b = doc.data();
            const bStart = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
            const bEnd = b.endTime?.toDate ? b.endTime.toDate() : new Date(b.endTime);
            const thStart = new Date(bStart.getTime() + (7 * 60 * 60 * 1000));
            const thEnd = new Date(bEnd.getTime() + (7 * 60 * 60 * 1000));
            const bStartM = thStart.getUTCHours() * 60 + thStart.getUTCMinutes();
            const bEndM = thEnd.getUTCHours() * 60 + thEnd.getUTCMinutes();

            if (reqStart < bEndM && reqEnd > bStartM) {
                conflicts.push({
                    title: b.title,
                    timeRange: `${thStart.getUTCHours().toString().padStart(2, '0')}:${thStart.getUTCMinutes().toString().padStart(2, '0')} - ${thEnd.getUTCHours().toString().padStart(2, '0')}:${thEnd.getUTCMinutes().toString().padStart(2, '0')}`,
                    requesterName: b.requesterName,
                });
            }
        });
        return { available: conflicts.length === 0, conflicts: conflicts.length > 0 ? conflicts : undefined };
    } catch (error) {
        console.error('Error checking availability:', error);
        return { available: false };
    }
}

export async function getRoomSchedule(room: string, date: string): Promise<any[]> {
    try {
        const normalizedRoom = ROOM_MAPPING[room.toLowerCase()] || room;
        const { start, end } = getThaiDateRange(date);

        const snapshot = await adminDb.collection('bookings')
            .where('roomId', '==', normalizedRoom)
            .where('startTime', '>=', start)
            .where('startTime', '<=', end)
            .where('status', 'in', ['pending', 'approved', 'confirmed'])
            .get();

        const bookings: any[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            const startDT = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
            const endDT = data.endTime?.toDate ? data.endTime.toDate() : new Date(data.endTime);
            const thStartDT = new Date(startDT.getTime() + (7 * 60 * 60 * 1000));
            const thEndDT = new Date(endDT.getTime() + (7 * 60 * 60 * 1000));

            bookings.push({
                id: doc.id,
                title: data.title,
                room: getRoomDisplayName(data.room || data.roomId),
                status: data.status,
                requester: data.requesterName,
                startTime: `${thStartDT.getUTCHours().toString().padStart(2, '0')}:${thStartDT.getUTCMinutes().toString().padStart(2, '0')}`,
                endTime: `${thEndDT.getUTCHours().toString().padStart(2, '0')}:${thEndDT.getUTCMinutes().toString().padStart(2, '0')}`,
                rawStart: data.startTime
            });
        });

        bookings.sort((a, b) => (a.rawStart?.toMillis?.() || 0) - (b.rawStart?.toMillis?.() || 0));
        return bookings.map(({ rawStart, ...rest }) => rest);
    } catch (error) {
        console.error('Error getting room schedule:', error);
        return [];
    }
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

        const docRef = await adminDb.collection('bookings').add({
            room: normalizedRoom, roomId: normalizedRoom,
            startTime: Timestamp.fromDate(sDT), endTime: Timestamp.fromDate(eDT),
            title, description: 'จองผ่าน LINE AI', requesterName, requesterEmail,
            department: 'บุคลากร', position: 'บุคลากร', phoneNumber: '-',
            status: 'pending', createdAt: FieldValue.serverTimestamp(), source: 'line_ai'
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
    } catch (e) {
        console.error('Error creating booking:', e);
        return { success: false, error: 'เกิดข้อผิดพลาด' };
    }
}

export async function getBookingsByEmail(email: string): Promise<any[]> {
    try {
        const snapshot = await adminDb.collection('bookings')
            .where('requesterEmail', '==', email)
            .orderBy('startTime', 'desc')
            .limit(10)
            .get();

        const bookings: any[] = [];
        snapshot.forEach((doc) => {
            const d = doc.data();
            bookings.push({
                id: doc.id,
                title: d.title,
                room: getRoomDisplayName(d.room || d.roomId),
                status: d.status,
                start: formatToThaiTime(d.startTime)
            });
        });
        return bookings;
    } catch (e) {
        console.error('Error getting bookings:', e);
        return [];
    }
}

export async function getPendingBookings(date?: string): Promise<any[]> {
    try {
        const snapshot = await adminDb.collection('bookings')
            .where('status', '==', 'pending')
            .orderBy('startTime', 'asc')
            .limit(50)
            .get();

        let bookings: any[] = [];
        snapshot.forEach((doc) => {
            const d = doc.data();
            bookings.push({
                id: doc.id,
                title: d.title,
                room: getRoomDisplayName(d.room || d.roomId),
                startTime: formatToThaiTime(d.startTime),
                rawStart: d.startTime
            });
        });

        if (date) {
            const target = date.split('T')[0];
            bookings = bookings.filter(b => {
                const t = new Date((b.rawStart?.toDate ? b.rawStart.toDate() : new Date(b.rawStart)).getTime() + (7 * 60 * 60 * 1000));
                return t.toISOString().split('T')[0] === target;
            });
        }
        return bookings.map(({ rawStart, ...rest }) => rest);
    } catch (e) {
        console.error('Error getting pending bookings:', e);
        return [];
    }
}

export async function getDailySummary(date: Date = new Date()): Promise<any> {
    try {
        const s = new Date(date); s.setHours(0, 0, 0, 0);
        const e = new Date(date); e.setHours(23, 59, 59, 999);
        const sT = Timestamp.fromDate(s);
        const eT = Timestamp.fromDate(e);

        const [rS, bS, jS] = await Promise.all([
            adminDb.collection('repair_tickets').where('createdAt', '>=', sT).where('createdAt', '<=', eT).get(),
            adminDb.collection('bookings').where('startTime', '>=', sT).where('startTime', '<=', eT).get(),
            adminDb.collection('photography_jobs').where('startTime', '>=', sT).where('startTime', '<=', eT).get()
        ]);

        let rP = 0, rIP = 0;
        rS.forEach(d => {
            if (d.data().status === 'pending') rP++;
            if (d.data().status === 'in_progress') rIP++;
        });

        let bP = 0, bA = 0;
        bS.forEach(d => {
            if (d.data().status === 'pending') bP++;
            if (d.data().status === 'approved') bA++;
        });

        return {
            date: formatToThaiTime(date),
            repairs: { total: rS.size, pending: rP, inProgress: rIP },
            bookings: { total: bS.size, pending: bP, approved: bA },
            photoJobs: { total: jS.size, pending: 0 }
        };
    } catch (e) {
        console.error('Error getting daily summary:', e);
        return { error: 'Failed to get summary' };
    }
}