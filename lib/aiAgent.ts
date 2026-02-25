/**
 * AI Agent for LINE Bot
 * ประมวลผลข้อความภาษาธรรมชาติจาก LINE และเรียกใช้ฟังก์ชันต่างๆ
 */

import { UserProfile, RepairTicket } from '@/types';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { startAIChat, geminiVisionModel, imageToGenerativePart, rankVideosWithAI, rankPhotosWithAI, findAnswerWithAI, checkConfirmationWithAI } from './gemini';
import {
    checkRoomAvailability,
    createBookingFromAI,
    getRepairsByEmail,
    getRepairByTicketId,
    createRepairFromAI,
    getBookingsByEmail,
    getPhotoJobsByPhotographer,
    searchGallery,
    searchVideoGallery,
    getDailySummary,
    getRoomSchedule,
    getRepairsForTechnician,
    getPendingBookings,
    searchKnowledgeBase,
    getRoomDisplayName
} from './agentFunctions';
import { formatThaiDate } from './dateUtils';



// ============================================
// Types & Interfaces
// ============================================

interface ConversationContext {
    messages: { role: 'user' | 'model'; content: string; timestamp: Date }[];
    pendingAction?: {
        intent: string;
        params: Record<string, any>;
        repairStep?:
        | 'awaiting_symptom'
        | 'awaiting_image'
        | 'awaiting_intent_confirm'
        | 'awaiting_room'
        | 'awaiting_side'
        | 'awaiting_final_confirm'
        | 'awaiting_link_email'
        | 'awaiting_otp'
        | 'awaiting_description';
        galleryResults?: any[];
    };
    lastActivity: any;
}

interface AIResponse {
    intent?: string;
    params?: Record<string, unknown>;
    execute?: boolean;
    message?: string;
}

const CONTEXT_EXPIRY_MINUTES = 30;
const MAX_CONTEXT_MESSAGES = 10;

// ============================================
// Helper Functions (Local Formatters)
// ============================================

// ฟังก์ชันจัดรูปแบบข้อมูลดิบ (สำหรับ RepairTicket ที่ได้จาก Firestore โดยตรง - ใช้ในเมนูช่าง)
function formatRawRepair(repair: RepairTicket): string {
    const statusMap: Record<string, string> = {
        pending: '🟡 รอดำเนินการ',
        in_progress: '🔵 กำลังซ่อม',
        waiting_parts: '🟠 รออะไหล่',
        completed: '🟢 เสร็จแล้ว',
        cancelled: '⚫ ยกเลิก',
    };

    let dateStr = '-';
    if (repair.createdAt) {
        const date = repair.createdAt instanceof Timestamp ? repair.createdAt.toDate() : new Date(repair.createdAt as any);
        dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    }

    return `🔧 ${repair.room} (${repair.zone})\n📝 ${repair.description}\n📅 ${dateStr}\nสถานะ: ${statusMap[repair.status] || repair.status}`;
}

// ============================================
// Context Management
// ============================================

async function getConversationContext(lineUserId: string): Promise<ConversationContext | null> {
    try {
        const contextDoc = await adminDb.collection('ai_conversations').doc(lineUserId).get();

        if (!contextDoc.exists) return null;

        const data = contextDoc.data();
        if (!data) return null;

        const lastActivity = data.lastActivity?.toDate() ? data.lastActivity.toDate() : new Date();

        const minutesSinceActivity = (Date.now() - lastActivity.getTime()) / 1000 / 60;
        if (minutesSinceActivity > CONTEXT_EXPIRY_MINUTES) {
            return null;
        }

        return {
            messages: data.messages || [],
            pendingAction: data.pendingAction,
            lastActivity,
        };
    } catch (error) {
        console.error('Error getting conversation context:', error);
        return null;
    }
}

async function saveConversationContext(lineUserId: string, context: ConversationContext): Promise<void> {
    try {
        const trimmedMessages = context.messages.slice(-MAX_CONTEXT_MESSAGES);

        await adminDb.collection('ai_conversations').doc(lineUserId).set({
            messages: trimmedMessages,
            pendingAction: context.pendingAction || null,
            lastActivity: FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error('Error saving conversation context:', error);
    }
}

async function clearPendingAction(lineUserId: string): Promise<void> {
    try {
        await adminDb.collection('ai_conversations').doc(lineUserId).update({ pendingAction: null });
    } catch (error) {
        console.error('Error clearing pending action:', error);
    }
}

// ============================================
// User Profile
// ============================================

async function getUserProfileFromLineBinding(lineUserId: string): Promise<UserProfile | null> {
    try {
        // Only check line_bindings collection - the official source of truth
        const bindingDoc = await adminDb.collection('line_bindings').doc(lineUserId).get();
        if (bindingDoc.exists) {
            const bindingData = bindingDoc.data();
            const uid = bindingData?.uid;
            if (uid) {
                const userDoc = await adminDb.collection('users').doc(uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData) {
                        return {
                            uid,
                            displayName: userData.displayName || userData.name || 'ผู้ใช้',
                            email: userData.email,
                            role: userData.role || 'user',
                            isPhotographer: userData.isPhotographer || false,
                            responsibility: userData.responsibility,
                        };
                    }
                }
            }
        }

        // No binding found - user needs to link account
        return null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

import { AIResponseSchema, AIResponseParsed } from './aiSchemas';

function parseAIResponse(responseText: string): AIResponseParsed {
    try {
        // 1. Try to find JSON block
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            // 2. Validate with Zod
            const validation = AIResponseSchema.safeParse(parsed);

            if (validation.success) {
                return validation.data;
            } else {
                console.warn('AI Response Validation Failed:', validation.error);
                // Fallback: use parsed object but treat as mixed content if possible, or just log error
            }
        }
    } catch (e) {
        console.error('Error parsing AI response:', e);
    }

    // 3. Fallback: Treat entire text as message
    return { message: responseText };
}

function parseThaiDate(dateStr: string): string | undefined {
    const now = new Date();
    const bkkNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const str = dateStr.toLowerCase().trim();

    if (str === 'today' || str === 'วันนี้') return bkkNow.toISOString().split('T')[0];

    if (str === 'tomorrow' || str === 'พรุ่งนี้') {
        const tmr = new Date(bkkNow); tmr.setDate(tmr.getDate() + 1);
        return tmr.toISOString().split('T')[0];
    }

    if (str === 'yesterday' || str === 'เมื่อวาน' || str === 'เมื่อวานนี้') {
        const yest = new Date(bkkNow); yest.setDate(yest.getDate() - 1);
        return yest.toISOString().split('T')[0];
    }

    const m = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
        let yr = parseInt(m[3]); if (yr > 2500) yr -= 543;
        const dt = new Date(yr, parseInt(m[2]) - 1, parseInt(m[1]));
        if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return undefined;
}

// ============================================
// Intent Handlers
// ============================================

// [RESERVED] ฟังก์ชันนี้สำรองไว้สำหรับอนาคต เมื่อต้องการเปิดให้จองห้องผ่าน AI ได้
// ปัจจุบันการจองถูก intercept ไปที่เว็บแทน (ดู processAIMessage บรรทัด ~494)
async function handleBookRoom(params: Record<string, unknown>, userProfile: UserProfile, execute: boolean): Promise<string> {
    const { room, date, startTime, endTime, title } = params as { room: string; date: string; startTime: string; endTime: string; title: string; };

    if (!execute) {
        const availability = await checkRoomAvailability(room, date, startTime, endTime);
        if (!availability.available) {
            return `ขออภัยค่ะ ${room} ไม่ว่างในช่วงเวลาที่ต้องการ มีการจองดังนี้:\n${availability.conflicts?.map(c => `• ${c.timeRange || `${c.startTime}-${c.endTime}`}: ${c.title || 'ไม่ระบุหัวข้อ'} (${c.requesterName || 'ไม่ระบุชื่อ'})`).join('\n')}\n\nต้องการเลือกเวลาอื่นไหมคะ?`;
        }
        return `ห้องว่างค่ะ ต้องการจอง ${room} วันที่ ${date} เวลา ${startTime}-${endTime} หัวข้อ "${title}" ใช่ไหมคะ? (ตอบ "ใช่" หรือ "ยืนยัน" เพื่อจอง)`;
    }

    const result = await createBookingFromAI(room, date, startTime, endTime, title, userProfile.displayName || userProfile.email, userProfile.email);
    if (result.success) {
        return `✅ จองสำเร็จค่ะ!\n\n📅 ${date}\n🕐 ${startTime} - ${endTime}\n📍 ${result.details?.room || room}\n📝 ${title}\n\n⏳ สถานะ: รออนุมัติ`;
    }
    return `❌ ${result.error}`;
}

async function handleCheckRepair(params: Record<string, unknown>, userProfile: UserProfile): Promise<string> {
    const { ticketId } = params as { ticketId?: string };
    if (ticketId) {
        const repair = await getRepairByTicketId(ticketId);
        // ใช้ formatRawRepair สำหรับข้อมูลดิบจาก Firestore
        if (!repair) return `ไม่พบงานซ่อม Ticket ID: ${ticketId} ค่ะ`;
        return `📋 สถานะงานซ่อม\n\n${formatRawRepair(repair)}`;
    }

    // getRepairsByEmail ส่งข้อมูลที่ format มาแล้ว (มี field: room, description, date, status)
    const repairs = await getRepairsByEmail(userProfile.email);
    if (repairs.length === 0) return 'ไม่พบรายการแจ้งซ่อมของคุณค่ะ';

    return `📋 รายการแจ้งซ่อมล่าสุดของคุณ\n\n${repairs.map(r =>
        `🔧 ${r.room}\n📝 ${r.description}\n📅 ${r.date}\nสถานะ: ${r.status}`
    ).join('\n\n')}`;
}

async function handleCheckAvailability(params: Record<string, unknown>): Promise<string> {
    const { room, date, startTime, endTime } = params as { room?: string; date?: string; startTime?: string; endTime?: string };
    if (room && date && startTime && endTime) {
        const normalizedDate = parseThaiDate(date) || parseThaiDate('today')!;
        const availability = await checkRoomAvailability(room, normalizedDate, startTime, endTime);
        const displayDate = date.toLowerCase() === 'today' || date === 'วันนี้' ? 'วันนี้' : formatThaiDate(new Date(normalizedDate));

        return availability.available
            ? `${getRoomDisplayName(room)} ว่างในช่วงเวลา ${startTime}-${endTime} ${displayDate} ค่ะ ✅`
            : `${getRoomDisplayName(room)} ไม่ว่างในช่วงเวลาดังกล่าวค่ะ ❌\nที่มีการจอง:\n${availability.conflicts?.map(c => `• ${c.timeRange}: ${c.title || 'ไม่ระบุหัวข้อ'} (${c.requesterName || 'ไม่ระบุชื่อ'})`).join('\n')}`;
    }
    return handleRoomSchedule(params);
}

async function handleRoomSchedule(params: Record<string, unknown>): Promise<string> {
    const { room, date } = params as { room?: string; date?: string };
    const rawDate = date || 'today';
    const targetDate = parseThaiDate(rawDate) || parseThaiDate('today')!;
    const displayDate = rawDate.toLowerCase() === 'today' || rawDate === 'วันนี้' ? 'วันนี้' : formatThaiDate(new Date(targetDate));

    if (!room) return `กรุณาระบุห้องที่ต้องการดูตารางด้วยนะคะ (เช่น ขอตารางห้องลีลาวดี วันนี้)`;

    const schedule = await getRoomSchedule(room, targetDate);
    if (schedule.length === 0) return `📅 ตาราง ${getRoomDisplayName(room)} (${displayDate})\n\n✅ ว่างทั้งวันค่ะ`;

    const scheduleList = schedule.map(booking => {
        return `(${displayDate}) ${booking.startTime} - ${booking.endTime}\n${booking.title || 'ไม่ระบุหัวข้อ'}\nผู้จอง ${booking.requester || 'ไม่ระบุชื่อ'}`;
    }).join('\n\n');

    return `📅 ตาราง ${getRoomDisplayName(schedule[0]?.room || room)} (${displayDate})\n\n${scheduleList}`;
}

async function handleMyWork(userProfile: UserProfile, params?: Record<string, unknown>): Promise<string> {
    const rawDate = params?.date as string | undefined;
    const date = rawDate && rawDate !== 'undefined' ? rawDate : undefined;
    let filterDate: string | undefined;
    let displayDate = '';

    if (date) {
        filterDate = parseThaiDate(date);
        if (filterDate) {
            const d = new Date(filterDate);
            displayDate = isNaN(d.getTime()) ? ` (${date})` : ` (${d.toLocaleDateString('th-TH')})`;
            if (filterDate === new Date().toISOString().split('T')[0]) displayDate = ' (วันนี้)';
        }
    }

    let response = `👤 งานของคุณ (${userProfile.displayName || userProfile.email})${displayDate}\n\n`;
    let hasWork = false;

    // 1. Technician Logic
    if (userProfile.role === 'technician') {
        const zone = userProfile.responsibility || 'all';
        const myRepairs = await getRepairsForTechnician(zone, filterDate); // Returns Raw RepairTicket[]
        if (myRepairs.length > 0) {
            hasWork = true;
            response += `🔧 **งานซ่อม (${zone === 'all' ? 'ทั้งหมด' : zone})**\n`;
            response += myRepairs.map(r => formatRawRepair(r)).join('\n\n');
            response += '\n\n';
        } else {
            response += filterDate ? `🔧 งานซ่อม: ไม่มีรายการวันที่ระบุค่ะ\n\n` : `🔧 งานซ่อม: ไม่มีงานค้างค่ะ 👍\n\n`;
        }
    }

    // 2. Photographer Logic
    if (userProfile.isPhotographer) {
        const myPhotoJobs = await getPhotoJobsByPhotographer(userProfile.uid, filterDate); // Returns Formatted Objects
        if (myPhotoJobs.length > 0) {
            hasWork = true;
            response += `📸 **งานถ่ายภาพ**\n`;
            response += myPhotoJobs.map(j => {
                let txt = `📸 ${j.title}\n📅 ${j.startTime}\n📍 ${j.location}`;
                if (j.facebookLink) txt += `\n📘 Facebook: ${j.facebookLink}`;
                return txt;
            }).join('\n\n');
            response += '\n\n';
        } else {
            response += filterDate ? `📸 งานถ่ายภาพ: ไม่มีงานวันที่ระบุค่ะ\n\n` : `📸 งานถ่ายภาพ: ไม่มีงานค่ะ\n\n`;
        }
    }

    // 3. Moderator/Admin Logic
    if (userProfile.role === 'moderator' || userProfile.role === 'admin') {
        const pendingBookings = await getPendingBookings(filterDate); // Returns Formatted Objects
        if (pendingBookings.length > 0) {
            hasWork = true;
            response += `📅 **การจองรออนุมัติ**\n`;
            response += pendingBookings.map(b =>
                `📅 ${b.startTime}\n📍 ${b.room}\n📝 ${b.title}`
            ).join('\n\n');
            response += '\n\n';
        } else {
            response += filterDate ? `📅 การจอง: ไม่มีรายการรออนุมัติวันที่ระบุค่ะ\n\n` : `📅 การจอง: ไม่มีรายการรออนุมัติค่ะ\n\n`;
        }
    }

    // 4. Regular User Logic
    if (!userProfile.role || userProfile.role === 'user') {
        const myBookings = await getBookingsByEmail(userProfile.email); // Returns Formatted Objects
        const filteredBookings = myBookings; // Simple pass-through for now

        if (filteredBookings.length > 0) {
            hasWork = true;
            response += `📅 **การจองของคุณ**\n`;
            response += filteredBookings.slice(0, 3).map(b =>
                `📅 ${b.start}\n📍 ${b.room}\n📝 ${b.title}\nสถานะ: ${b.status}`
            ).join('\n\n');
            if (filteredBookings.length > 3) response += `\n...และอีก ${filteredBookings.length - 3} รายการ`;
            response += '\n\n';
        }
    }

    if (response.length < 60) {
        return `👤 ${userProfile.displayName}${displayDate}\nไม่พบงานหรือรายการที่ต้องดำเนินการค่ะ 😊`;
    }
    return response;
}

interface GallerySearchResult {
    message: string;
    jobs?: any[];
}

async function handleGallerySearchWithResults(params: Record<string, unknown>): Promise<GallerySearchResult> {
    const rawKeyword = params.keyword as string | undefined;
    const rawDate = params.date as string | undefined;
    const keyword = rawKeyword && rawKeyword !== 'undefined' ? rawKeyword : undefined;
    const date = rawDate && rawDate !== 'undefined' ? rawDate : undefined;

    let searchDate: string | undefined;
    if (date) searchDate = parseThaiDate(date);

    // 1. Fetch ALL completed jobs (no keyword/date filter at data layer)
    //    Let Firestore return everything, the AI ranker will do semantic matching
    let jobs = await searchGallery(undefined, undefined, 200);
    console.log(`[AI Handler] Broad fetch for Photos: ${jobs.length} jobs`);

    // 2. Rank with AI (RAG-lite)
    if (jobs.length > 0 && (keyword || date)) {
        let queryForAI = keyword || '';
        if (date) queryForAI += ` (Date/Time context: ${date})`;

        const rankedJobs = await rankPhotosWithAI(queryForAI, jobs);

        if (rankedJobs.length > 0) {
            console.log(`[AI Handler] AI Ranking: selected ${rankedJobs.length} photos`);
            jobs = rankedJobs;
        } else {
            console.log(`[AI Handler] AI Ranking: found no matches in broad pool`);
            jobs = [];
        }
    } else if (!keyword && !date) {
        console.log(`[AI Handler] No keyword/date, showing latest photos`);
    }

    if (jobs.length === 0) {
        const dateDesc = searchDate ? (isNaN(new Date(searchDate).getTime()) ? date : new Date(searchDate).toLocaleDateString('th-TH')) : '';
        const kwDesc = keyword ? `"${keyword}"` : '';
        return { message: `ไม่พบภาพกิจกรรม${kwDesc} ${dateDesc} ค่ะ ลองค้นหาใหม่นะคะ` };
    }

    const listItems = jobs.slice(0, 10).map((job, index) => {
        return `${index + 1}. ${job.title} (${job.date})`;
    }).join('\n');
    let response = `📸 พบ ${jobs.length} กิจกรรม\n\n${listItems}`;
    if (jobs.length > 10) response += `\n... ${jobs.length - 10} รายการ`;
    response += '\n\nพิมพ์หมายเลข (เช่น 1) เพื่อดูรูปและลิงก์ค่ะ';

    return { message: response, jobs: jobs.slice(0, 10) };
}

// --- Video Gallery Search Handler ---
interface VideoGallerySearchResult {
    message: string;
    videos?: any[];
}

async function handleVideoGallerySearchWithResults(params: Record<string, unknown>): Promise<VideoGallerySearchResult> {
    const rawKeyword = params.keyword as string | undefined;
    const rawDate = params.date as string | undefined;
    const keyword = rawKeyword && rawKeyword !== 'undefined' ? rawKeyword : undefined;
    const date = rawDate && rawDate !== 'undefined' ? rawDate : undefined;

    console.log(`[AI Handler] Video Search - Params: keyword="${keyword}", date="${date}"`);

    let searchDate: string | undefined;
    if (date) searchDate = parseThaiDate(date);

    // 1. Fetch ALL published videos (no keyword/date filter at data layer)
    //    Let Firestore return everything, the AI ranker will do semantic matching
    let videos = await searchVideoGallery(undefined, undefined, 200);
    console.log(`[AI Handler] Broad fetch for Videos: ${videos.length} videos`);

    // 2. Rank with AI (RAG-lite)
    if (videos.length > 0 && (keyword || date)) {
        let queryForAI = keyword || '';
        if (date) queryForAI += ` (Date/Time context: ${date})`;

        // Pass to Gemini for semantic ranking
        const rankedVideos = await rankVideosWithAI(queryForAI, videos);

        if (rankedVideos.length > 0) {
            console.log(`[AI Handler] AI Ranking: selected ${rankedVideos.length} videos`);
            videos = rankedVideos;
        } else {
            console.log(`[AI Handler] AI Ranking: found no matches in broad pool`);
            // If AI found nothing relevant, we trust it and return empty
            videos = [];
        }
    } else if (!keyword && !date) {
        // If no keyword/date, just show latest (already in videos)
        console.log(`[AI Handler] No keyword/date, showing latest`);
    }

    if (videos.length === 0) {
        const dateDesc = searchDate ? (isNaN(new Date(searchDate).getTime()) ? date : new Date(searchDate).toLocaleDateString('th-TH')) : '';
        const kwDesc = keyword ? `"${keyword}"` : '';
        console.log(`[AI Handler] Final result: 0 videos found`);
        return { message: `ไม่พบวิดีโอ${kwDesc} ${dateDesc} ค่ะ ลองค้นหาใหม่นะคะ` };
    }

    console.log(`[AI Handler] Final result: ${videos.length} videos found`);
    const listItems = videos.slice(0, 10).map((video, index) => {
        return `${index + 1}. 🎬 ${video.title} (${video.category || 'ไม่ระบุหมวด'})`;
    }).join('\n');
    let response = `🎬 พบ ${videos.length} วิดีโอ\n\n${listItems}`;
    if (videos.length > 10) response += `\n... และอีก ${videos.length - 10} รายการ`;
    response += '\n\nพิมพ์หมายเลข (เช่น 1) เพื่อดูลิงก์วิดีโอค่ะ';

    return { message: response, videos: videos.slice(0, 10) };
}

async function handleDailySummary(userProfile: UserProfile | null): Promise<string> {
    const summary = await getDailySummary();
    if (summary.error) return 'ไม่สามารถเรียกดูสรุปงานได้ค่ะ';

    if (!userProfile) {
        return `📊 สรุปวันนี้ (${summary.date})\n\n🔧 งานซ่อม: ${summary.repairs.total}\n📅 จองห้อง: ${summary.bookings.total}\n📸 งานถ่าย: ${summary.photoJobs.total}\n\n💡 ผูกบัญชีเพื่อดูรายละเอียดเพิ่มเติมค่ะ`;
    }
    let response = `📊 สรุปงานวันนี้ (${summary.date})`;
    if (userProfile.role === 'technician' || userProfile.role === 'admin') {
        response += `\n\n🔧 *งานซ่อม*\n• รอ: ${summary.repairs.pending}\n• กำลังทำ: ${summary.repairs.inProgress}`;
    }
    if (userProfile.role === 'moderator' || userProfile.role === 'admin') {
        response += `\n\n📅 *จองห้อง*\n• รออนุมัติ: ${summary.bookings.pending}`;
    }
    return response + `\n\nค่ะ 😊`;
}

interface VisionAnalysisResult {
    device: string;
    symptom: string;
    suggestion: string;
    is_equipment: boolean;
    question: string;
}

export async function analyzeRepairImage(imageBuffer: Buffer, mimeType: string): Promise<VisionAnalysisResult> {
    try {
        const imagePart = imageToGenerativePart(imageBuffer, mimeType);
        const prompt = `
# Role
Technical Support AI Specialist (Thai Language)

# Task
Analyze this image to assist in creating a repair ticket.
Focus on identifying the IT/AV equipment and any visible defects.

# Constraints
- Response must be a Valid JSON Object only.
- Use Thai language for values.
- Keep "symptom" concise (under 10 words).

# Output Format (JSON)
{
  "device": "Equipment Name (e.g., โปรเจคเตอร์, มิกเซอร์เสียง)",
  "symptom": "Observed issue (e.g., ภาพไม่ติด, ปุ่มหลุด, จอแตก)",
  "suggestion": "1 short troubleshooting tip (optional, empty if none)",
  "is_equipment": boolean (true if IT/AV related, false if irrelevant photo),
  "question": "Polite closing question (e.g., ต้องการเปิดใบแจ้งซ่อมไหมคะ?)"
}`;

        const result = await geminiVisionModel.generateContent([prompt, imagePart]);
        const responseText = result.response.text();

        // Safe Parse JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as VisionAnalysisResult;
        }
        throw new Error("Invalid JSON format");

    } catch (e) {
        console.error("Vision Analysis Error:", e);
        // Fallback result
        return {
            device: "ไม่ระบุอุปกรณ์",
            symptom: "ตรวจสอบภาพถ่าย",
            suggestion: "",
            is_equipment: true,
            question: "ต้องการแจ้งซ่อมไหมคะ?"
        };
    }
}

// ============================================
// Main Process Function
// ============================================

export async function processAIMessage(lineUserId: string, userMessage: string, imageBuffer?: Buffer, imageMimeType?: string): Promise<string> {
    const userProfile = await getUserProfileFromLineBinding(lineUserId);
    let context = await getConversationContext(lineUserId);
    if (!context) { context = { messages: [], lastActivity: new Date() }; }

    // 1. Account Binding Check - OTP Flow
    if (['ผูกบัญชี', 'เชื่อมบัญชี', 'link account'].some(k => userMessage.toLowerCase().includes(k))) {
        if (userProfile) {
            return `✅ ผูกบัญชีแล้วค่ะ: ${userProfile.displayName} (${userProfile.email})`;
        }
        // Start OTP binding flow
        context.pendingAction = { intent: 'LINK_ACCOUNT', params: {}, repairStep: 'awaiting_link_email' };
        await saveConversationContext(lineUserId, context);

        return `🔗 ผูกบัญชี LINE กับระบบ\n\nกรุณาพิมพ์ email @tesaban6.ac.th ของคุณค่ะ\nตัวอย่าง: kawin@tesaban6.ac.th`;
    }

    // 2. Booking Intercept
    const bookingKw = ['จองห้อง', 'จองประชุม', 'booking'];
    const isChecking = userMessage.includes('ตาราง') || userMessage.includes('ว่างไหม');
    if (bookingKw.some(k => userMessage.toLowerCase().includes(k)) && !isChecking) {
        await clearPendingAction(lineUserId);
        return `📅 จองห้องประชุม\n\nกรุณาจองผ่านเว็บ: https://crms6it.vercel.app/booking\nหรือกด Rich Menu "จองห้องประชุม" ด้านล่างค่ะ 😊`;
    }

    // 3. Image Handling
    if (imageBuffer && imageMimeType) {
        if (!userProfile) {
            context.pendingAction = { intent: 'LINK_ACCOUNT', params: {}, repairStep: 'awaiting_link_email' };
            await saveConversationContext(lineUserId, context);
            return `⚠️ ไม่พบข้อมูลบัญชีของท่าน\n\nกรุณาผูกบัญชีก่อนแจ้งซ่อมค่ะ\nพิมพ์ email @tesaban6.ac.th ของท่านเพื่อเริ่มต้นผูกบัญชี\nตัวอย่าง: kawin@tesaban6.ac.th`;
        }

        // Run analysis first
        const analysis = await analyzeRepairImage(imageBuffer, imageMimeType);

        let base64 = imageBuffer.toString('base64');
        if (base64.length > 500 * 1024) base64 = base64.substring(0, 500 * 1024);
        const imageUrl = `data:${imageMimeType};base64,${base64}`;

        // Construct concise description for ticket: "Device - Symptom"
        const ticketDescription = analysis.is_equipment ? `${analysis.device} - ${analysis.symptom}` : "แจ้งซ่อมจากรูปภาพ";
        const fullAnalysisText = `📸 ผลการวิเคราะห์:\nอุปกรณ์: ${analysis.device}\nอาการ: ${analysis.symptom}\n${analysis.suggestion ? `💡 คำแนะนำ: ${analysis.suggestion}\n` : ''}`;

        // If currently in a flow (e.g. asked for image)
        if (context.pendingAction?.intent === 'CREATE_REPAIR' && context.pendingAction.repairStep === 'awaiting_image') {
            context.pendingAction.repairStep = 'awaiting_intent_confirm';
            context.pendingAction.params = {
                ...context.pendingAction.params,
                imageBuffer: base64,
                imageMimeType,
                description: context.pendingAction.params.description || '', // Keep existing description if user already told us
                aiDiagnosis: ticketDescription, // Store AI analysis here
                imageAnalysis: fullAnalysisText,
                imageUrl
            };
            await saveConversationContext(lineUserId, context);
            return `${fullAnalysisText}\n---\n${analysis.question || 'ยืนยันการแจ้งซ่อมไหมคะ?'}`;
        }

        // Start new repair flow
        context.pendingAction = {
            intent: 'CREATE_REPAIR',
            params: {
                description: '', // Clear description
                aiDiagnosis: ticketDescription, // Store AI analysis
                imageBuffer: base64,
                imageMimeType,
                imageAnalysis: fullAnalysisText,
                imageUrl
            },
            repairStep: 'awaiting_intent_confirm'
        };
        await saveConversationContext(lineUserId, context);
        return `${fullAnalysisText}\n---\n${analysis.question || 'ต้องการแจ้งซ่อมไหมคะ?'}`;
    }

    // 4. Pending Actions
    if (context.pendingAction) {
        const { intent, repairStep, params, galleryResults } = context.pendingAction;
        const msg = userMessage.trim();

        if (['ยกเลิก', 'cancel'].includes(msg.toLowerCase())) {
            await clearPendingAction(lineUserId);
            return 'ยกเลิกเรียบร้อยค่ะ';
        }
        // Handle LINK_ACCOUNT flow (OTP-based account binding)
        if (intent === 'LINK_ACCOUNT') {
            if (repairStep === 'awaiting_link_email') {
                const email = msg.toLowerCase().trim();

                // Validate email format
                if (!email.endsWith('@tesaban6.ac.th')) {
                    return `❌ กรุณาใช้ email @tesaban6.ac.th เท่านั้นค่ะ\nตัวอย่าง: kawin@tesaban6.ac.th`;
                }

                // Call send-otp API
                try {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
                    const response = await fetch(`${appUrl}/api/send-otp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, lineUserId })
                    });
                    const result = await response.json();

                    if (!result.success) {
                        await clearPendingAction(lineUserId);
                        return `❌ ${result.error}`;
                    }

                    context.pendingAction.params.email = email;
                    context.pendingAction.repairStep = 'awaiting_otp';
                    await saveConversationContext(lineUserId, context);

                    return `✉️ ส่งรหัส OTP 6 หลักไปที่ ${email} แล้วค่ะ\n\n📩 กรุณาเช็คอีเมล (รวมถึง Spam) แล้วพิมพ์รหัส OTP ที่ได้รับ\n⏰ รหัสจะหมดอายุใน 5 นาที`;
                } catch (error) {
                    console.error('[LINK_ACCOUNT] Send OTP Error:', error);
                    await clearPendingAction(lineUserId);
                    return '❌ เกิดข้อผิดพลาดในการส่ง OTP กรุณาลองใหม่ค่ะ';
                }
            }

            if (repairStep === 'awaiting_otp') {
                const otp = msg.replace(/\s/g, ''); // Remove spaces

                // Validate OTP format (6 digits)
                if (!/^\d{6}$/.test(otp)) {
                    return '❌ รหัส OTP ต้องเป็นตัวเลข 6 หลักค่ะ กรุณาพิมพ์ใหม่';
                }

                // Call verify-otp API
                try {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
                    const response = await fetch(`${appUrl}/api/verify-otp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ otp, lineUserId })
                    });
                    const result = await response.json();

                    if (!result.success) {
                        return `❌ ${result.error}`;
                    }

                    await clearPendingAction(lineUserId);
                    return `✅ ผูกบัญชีสำเร็จค่ะ!\n\n👤 ชื่อ: ${result.displayName}\n📧 Email: ${result.email}\n\nตอนนี้สามารถแจ้งซ่อม จองห้อง และใช้งานระบบได้เลยค่ะ 🎉`;
                } catch (error) {
                    console.error('[LINK_ACCOUNT] Verify OTP Error:', error);
                    return '❌ เกิดข้อผิดพลาดในการตรวจสอบ OTP กรุณาลองใหม่ค่ะ';
                }
            }
        }

        if (intent === 'CREATE_REPAIR') {
            if (!userProfile) {
                context.pendingAction = { intent: 'LINK_ACCOUNT', params: {}, repairStep: 'awaiting_link_email' };
                await saveConversationContext(lineUserId, context);
                return `⚠️ ไม่พบข้อมูลบัญชีของท่าน\n\nกรุณาผูกบัญชีก่อนทำรายการค่ะ\nพิมพ์ email @tesaban6.ac.th ของท่านเพื่อเริ่มต้นผูกบัญชี\nตัวอย่าง: kawin@tesaban6.ac.th`;
            }

            if (repairStep === 'awaiting_symptom') {
                context.pendingAction.params.description = msg;
                context.pendingAction.repairStep = 'awaiting_image';
                await saveConversationContext(lineUserId, context);
                return `รับทราบอาการค่ะ "${msg}"\n\n📸 สะดวกถ่ายรูปอาการให้ดูไหมคะ? (ส่งรูปมาได้เลย)`;
            }
            if (repairStep === 'awaiting_image') {
                if (msg.includes('ไม่')) {
                    context.pendingAction.repairStep = 'awaiting_intent_confirm';
                    context.pendingAction.params.imageUrl = '';
                    await saveConversationContext(lineUserId, context);
                    return `โอเคค่ะ ข้อมูลการแจ้งซ่อม:\nอาการ: ${params.description}\n\nยืนยันแจ้งซ่อมไหมคะ? (ตอบ "ยืนยัน")`;
                }
                return `กรุณาส่งรูปภาพเพื่อให้ช่างประเมินอาการค่ะ`;
            }
            if (repairStep === 'awaiting_intent_confirm') {
                // Hybrid Approach:
                // 1. Fast Path: Check exact keywords (Zero latency)
                const fastConfirmKeywords = ['ใช่', 'ยืนยัน', 'ok', 'ครับ', 'ค่ะ', 'แจ้งซ่อม', 'ซ่อม', 'เปิดใบงาน', 'ticket', 'confirm', 'จัดไป'];
                const fastCancelKeywords = ['ยกเลิก', 'ไม่', 'no', 'cancel', 'พอ', 'หยุด'];

                let intent: 'CONFIRM' | 'CANCEL' | 'OTHER' = 'OTHER';

                if (fastConfirmKeywords.some(k => msg.toLowerCase().includes(k))) intent = 'CONFIRM';
                else if (fastCancelKeywords.some(k => msg.toLowerCase().includes(k))) intent = 'CANCEL';
                else {
                    // 2. AI Path: Ask Gemini to understand context (Smarter but slower)
                    // Only use if fast path fails
                    intent = await checkConfirmationWithAI(msg, params.description || 'Repair Ticket');
                }

                if (intent === 'CONFIRM') {
                    // Check for description first
                    if (!params.description) {
                        context.pendingAction.repairStep = 'awaiting_description';
                        await saveConversationContext(lineUserId, context);
                        return 'ขอทราบอาการเสียเพิ่มเติมด้วยค่ะ? (เช่น เปิดไม่ติด, เสียงไม่ออก)';
                    }
                    if (!params.room) {
                        context.pendingAction.repairStep = 'awaiting_room';
                        await saveConversationContext(lineUserId, context);
                        return 'ขอทราบสถานที่/ห้อง ที่อุปกรณ์มีปัญหาด้วยค่ะ?';
                    }
                    context.pendingAction.repairStep = 'awaiting_side';
                    await saveConversationContext(lineUserId, context);
                    return `อุปกรณ์อยู่ที่ห้อง ${params.room} ใช่มั้ยคะ? อยู่ฝั่ง ม.ต้น หรือ ม.ปลาย คะ?`;
                } else if (intent === 'CANCEL') {
                    await clearPendingAction(lineUserId);
                    return 'ยกเลิกการแจ้งซ่อมแล้วค่ะ';
                } else {
                    // OTHER -> Maybe user is asking something else? Or providing description?
                    // For now, assume if not confirm/cancel, treat as potential description update or ask clarification
                    // But to be safe, let's just ask again gently
                    return `ขออภัยค่ะ ไม่แน่ใจว่าต้องการ "ยืนยัน" หรือ "ยกเลิก" การแจ้งซ่อมคะ? (หรือพิมพ์ "แจ้งซ่อม" เพื่อยืนยัน)`;
                }
            }
            if (repairStep === 'awaiting_description') {
                context.pendingAction.params.description = msg;
                if (!context.pendingAction.params.room) {
                    context.pendingAction.repairStep = 'awaiting_room';
                    await saveConversationContext(lineUserId, context);
                    return 'ขอทราบสถานที่/ห้อง ที่อุปกรณ์มีปัญหาด้วยค่ะ?';
                }
                context.pendingAction.repairStep = 'awaiting_side';
                await saveConversationContext(lineUserId, context);
                return `อุปกรณ์อยู่ที่ห้อง ${context.pendingAction.params.room} ใช่มั้ยคะ? อยู่ฝั่ง ม.ต้น หรือ ม.ปลาย คะ?`;
            }
            if (repairStep === 'awaiting_room') {
                context.pendingAction.params.room = msg;
                context.pendingAction.repairStep = 'awaiting_side';
                await saveConversationContext(lineUserId, context);
                return 'อยู่ฝั่ง ม.ต้น หรือ ม.ปลาย คะ?';
            }
            if (repairStep === 'awaiting_side') {
                context.pendingAction.params.side = msg;

                // Pass aiDiagnosis to helper
                const res = await createRepairFromAI(
                    params.room,
                    params.description,
                    msg,
                    params.imageUrl || '',
                    userProfile.displayName || 'ผู้ใช้ LINE',
                    userProfile.email,
                    params.aiDiagnosis // New field
                );

                if (res.success) {
                    // Bug 1 Fix: Clear entire context to prevent stale data in consecutive repairs
                    context.messages = [];
                    context.pendingAction = undefined;
                    await saveConversationContext(lineUserId, context);

                    const zoneLabel = res.data?.zone === 'senior_high' ? 'ม.ปลาย' : 'ม.ต้น';
                    return `✅ รับแจ้งซ่อมเรียบร้อยค่ะ\nคุณ ${res.data?.requesterName || 'ผู้แจ้ง'}\n📍 สถานที่: ${res.data?.roomName} (${zoneLabel})\n📅 วันที่แจ้ง: ${res.data?.createdAt}\n\nช่างจะเข้าไปตรวจสอบโดยเร็วที่สุดค่ะ`;
                }
                await clearPendingAction(lineUserId);
                return `❌ เกิดข้อผิดพลาด: ${res.error}`;
            }
        }

        if (intent === 'GALLERY_SELECT' && galleryResults) {
            const selectedIndex = parseInt(msg) - 1;
            if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < galleryResults.length) {
                const job = galleryResults[selectedIndex];
                await clearPendingAction(lineUserId);
                let reply = `📸 **${job.title}**\n📅 ${job.date}\n📍 ${job.location || '-'}\n\n🔗 Drive: ${job.driveLink}`;
                if (job.facebookLink) { reply += `\n📘 Facebook: ${job.facebookLink}`; }
                return reply;
            }
        }

        // Handle VIDEO_GALLERY_SELECT - user picks a video by number
        if (intent === 'VIDEO_GALLERY_SELECT' && galleryResults) {
            const selectedIndex = parseInt(msg) - 1;
            if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < galleryResults.length) {
                const video = galleryResults[selectedIndex];
                await clearPendingAction(lineUserId);

                // Build video links response
                let reply = `🎬 ${video.title}\n📁 หมวด: ${video.category || 'ไม่ระบุ'}\n📅 ${video.date}\n`;

                // Primary link
                if (video.videoUrl) {
                    reply += `\n🔗 ลิงก์หลัก: ${video.videoUrl}`;
                }

                // Additional links
                if (video.videoLinks && video.videoLinks.length > 0) {
                    video.videoLinks.forEach((link: any, idx: number) => {
                        if (link.url) {
                            reply += `\n🔗 ${link.platform || 'Link'}: ${link.url}`;
                        }
                    });
                }

                return reply;
            }
        }
    }

    // 5. NLP (Gemini) with System Prompt Injection
    try {
        const history: { role: 'user' | 'model'; parts: { text: string }[] }[] =
            context.messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }));

        const chat = startAIChat(history);
        const result = await chat.sendMessage(userMessage);
        const responseText = result.response.text();

        // Log raw response for debugging
        // console.log("Raw AI Response:", responseText);

        context.messages.push({ role: 'user', content: userMessage, timestamp: new Date() });

        // NEW: Parse with Zod Schema
        const aiRes = parseAIResponse(responseText);

        if (aiRes.intent && aiRes.intent !== 'UNKNOWN') {
            let reply = '';

            // Log reasoning (Thought Process) - Optional: Save to DB
            if (aiRes.thought) {
                console.log(`[AI Thought]: ${aiRes.thought}`);
            }

            switch (aiRes.intent) {
                case 'CHECK_REPAIR':
                    if (!userProfile) { reply = 'กรุณาผูกบัญชีก่อนตรวจสอบสถานะค่ะ'; break; }
                    reply = await handleCheckRepair(aiRes.params || {}, userProfile); break;

                case 'CHECK_ROOM_SCHEDULE':
                    reply = await handleRoomSchedule(aiRes.params || {}); break;

                case 'CHECK_AVAILABILITY':
                    reply = await handleCheckAvailability(aiRes.params || {}); break;

                case 'MY_WORK':
                    if (!userProfile) { reply = 'กรุณาผูกบัญชีก่อนดูงานของคุณค่ะ'; break; }
                    reply = await handleMyWork(userProfile, aiRes.params); break; // aiRes.params is now Record<string, unknown> from Zod

                case 'GALLERY_SEARCH':
                    const searchRes = await handleGallerySearchWithResults(aiRes.params || {});
                    reply = searchRes.message;
                    if (searchRes.jobs && searchRes.jobs.length > 0) {
                        context.pendingAction = { intent: 'GALLERY_SELECT', params: {}, galleryResults: searchRes.jobs };
                    }
                    break;

                case 'VIDEO_GALLERY_SEARCH':
                    const videoSearchRes = await handleVideoGallerySearchWithResults(aiRes.params || {});
                    reply = videoSearchRes.message;
                    if (videoSearchRes.videos && videoSearchRes.videos.length > 0) {
                        context.pendingAction = { intent: 'VIDEO_GALLERY_SELECT', params: {}, galleryResults: videoSearchRes.videos };
                    }
                    break;


                case 'IT_KNOWLEDGE_SEARCH':
                    const kbParams = aiRes.params || {};
                    console.log(`[Intent] IT_KNOWLEDGE_SEARCH:`, kbParams);
                    if (!kbParams.query) {
                        return 'ขอโทษค่ะ รบกวนระบุคำถามให้ชัดเจนอีกนิดได้ไหมคะ? 😅';
                    }
                    // 1. Fetch Knowledge from DB
                    const kbItems = await searchKnowledgeBase(kbParams.query as string);

                    // 2. Ask AI to find answer from fetched items
                    const answer = await findAnswerWithAI(kbParams.query as string, kbItems);

                    if (answer) {
                        return answer;
                    } else {
                        return 'ขอโทษค่ะ ไม่พบข้อมูลในระบบคลังความรู้ IT ค่ะ 😓\nหากเป็นปัญหาเร่งด่วน แนะนำให้แจ้งซ่อมเข้ามาให้เจ้าหน้าที่ตรวจสอบได้เลยนะคะ';
                    }

                case 'DAILY_SUMMARY':
                    reply = await handleDailySummary(userProfile); break;

                case 'CREATE_REPAIR':
                    if (!userProfile) {
                        context.pendingAction = { intent: 'LINK_ACCOUNT', params: {}, repairStep: 'awaiting_link_email' };
                        reply = `⚠️ ไม่พบข้อมูลบัญชีของท่าน\n\nกรุณาผูกบัญชีก่อนแจ้งซ่อมค่ะ\nพิมพ์ email @tesaban6.ac.th ของท่านเพื่อเริ่มต้นผูกบัญชี\nตัวอย่าง: kawin@tesaban6.ac.th`;
                        break;
                    }

                    const params = aiRes.params as any; // Cast for now, logic below checks fields
                    context.pendingAction = { intent: 'CREATE_REPAIR', repairStep: 'awaiting_symptom', params: params || {} };

                    if (params?.description) {
                        context.pendingAction.params.description = params.description;
                        context.pendingAction.repairStep = 'awaiting_image';
                        reply = `รับแจ้งซ่อม "${params.description}" ค่ะ\n\n📸 มีรูปถ่ายอาการไหมคะ? (ส่งรูปมาได้เลย หรือตอบ "ไม่มี")`;
                    } else {
                        reply = 'ขอทราบอาการเสีย หรืออุปกรณ์ที่มีปัญหาด้วยค่ะ?';
                    }
                    await saveConversationContext(lineUserId, context);
                    break;

                default:
                    reply = aiRes.message || 'ขออภัยค่ะ ไม่เข้าใจคำสั่ง';
            }

            // Fallback if handler returns empty string (shouldn't happen but safe)
            if (!reply) reply = aiRes.message || 'ดำเนินการเรียบร้อยค่ะ';

            context.messages.push({ role: 'model', content: reply, timestamp: new Date() });
            await saveConversationContext(lineUserId, context);
            return reply;

        } else {
            // No Intent -> Chat Message
            const reply = aiRes.message || responseText;
            context.messages.push({ role: 'model', content: reply, timestamp: new Date() });
            await saveConversationContext(lineUserId, context);
            return reply;
        }
    } catch (error) {
        console.error('AI Error:', error);
        return 'ขออภัยค่ะ ระบบขัดข้องชั่วคราว กรุณาลองใหม่ภายหลังนะคะ';
    }
}