/**
 * AI Agent for LINE Bot
 * Main processor for natural language understanding and action execution
 */

import { PhotographyJob, UserProfile, RepairTicket, Booking } from '@/types';
import { db } from '@/lib/firebase';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    Timestamp,
    query,
    where,
    getDocs,
    limit,
    serverTimestamp
} from 'firebase/firestore';
import { startAIChat, geminiVisionModel, imageToGenerativePart } from './gemini';
import {
    checkRoomAvailability,
    createBookingFromAI,
    getRepairsByEmail,
    getRepairByTicketId,
    createRepairFromAI,
    getBookingsByEmail,
    getPhotoJobsByPhotographer,
    searchGallery,
    getDailySummary,
    getRoomSchedule,
    formatBookingForDisplay,
    formatRepairForDisplay,
    formatPhotoJobForDisplay,
    getRepairsForTechnician,
    getPendingBookings
} from './agentFunctions';

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
        | 'awaiting_final_confirm';
        awaitingConfirmation?: boolean;
        galleryResults?: PhotographyJob[];
    };
    lastActivity: any; // Timestamp or Date
}

interface AIResponse {
    intent?: string;
    params?: Record<string, unknown>;
    needMoreInfo?: string[];
    question?: string;
    execute?: boolean;
    message?: string;
}

const CONTEXT_EXPIRY_MINUTES = 30;
const MAX_CONTEXT_MESSAGES = 10;

// ============================================
// Context Management
// ============================================

async function getConversationContext(lineUserId: string): Promise<ConversationContext | null> {
    try {
        const contextRef = doc(db, 'ai_conversations', lineUserId);
        const contextDoc = await getDoc(contextRef);

        if (!contextDoc.exists()) return null;

        const data = contextDoc.data();
        const lastActivity = data.lastActivity?.toDate() ? data.lastActivity.toDate() : new Date();

        // Check if context is expired
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

async function saveConversationContext(
    lineUserId: string,
    context: ConversationContext
): Promise<void> {
    try {
        const contextRef = doc(db, 'ai_conversations', lineUserId);
        const trimmedMessages = context.messages.slice(-MAX_CONTEXT_MESSAGES);

        await setDoc(contextRef, {
            messages: trimmedMessages,
            pendingAction: context.pendingAction || null,
            lastActivity: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error saving conversation context:', error);
    }
}

async function clearPendingAction(lineUserId: string): Promise<void> {
    try {
        const contextRef = doc(db, 'ai_conversations', lineUserId);
        await updateDoc(contextRef, { pendingAction: null });
    } catch (error) {
        console.error('Error clearing pending action:', error);
    }
}

// ============================================
// User Profile
// ============================================

async function getUserProfileFromLineBinding(lineUserId: string): Promise<UserProfile | null> {
    try {
        // Method 1: Check line_bindings
        const bindingDoc = await getDoc(doc(db, 'line_bindings', lineUserId));
        if (bindingDoc.exists()) {
            const uid = bindingDoc.data().uid;
            if (uid) {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
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

        // Method 2: Check users collection
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('lineUserId', '==', lineUserId), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            return {
                uid: userDoc.id,
                displayName: userData.displayName || userData.name || 'ผู้ใช้',
                email: userData.email,
                role: userData.role || 'user',
                isPhotographer: userData.isPhotographer || false,
                responsibility: userData.responsibility,
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

function parseAIResponse(responseText: string): AIResponse {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch { }
    }
    return { message: responseText };
}

// ============================================
// Intent Handlers
// ============================================

async function handleBookRoom(
    params: Record<string, unknown>,
    userProfile: UserProfile,
    execute: boolean
): Promise<string> {
    const { room, date, startTime, endTime, title } = params as {
        room: string;
        date: string;
        startTime: string;
        endTime: string;
        title: string;
    };

    if (!execute) {
        const availability = await checkRoomAvailability(room, date, startTime, endTime);
        if (!availability.available) {
            return `ขออภัยค่ะ ${room} ไม่ว่างในช่วงเวลาที่ต้องการ มีการจองดังนี้:\n${availability.conflicts?.map(
                (c) => `• ${c.startTime}-${c.endTime}: ${c.title}`
            ).join('\n')}\n\nต้องการเลือกเวลาอื่นไหมคะ?`;
        }
        return `ห้องว่างค่ะ ต้องการจอง ${room} วันที่ ${date} เวลา ${startTime}-${endTime} หัวข้อ "${title}" ใช่ไหมคะ? (ตอบ "ใช่" หรือ "ยืนยัน" เพื่อจอง)`;
    }

    const result = await createBookingFromAI(
        room,
        date,
        startTime,
        endTime,
        title,
        userProfile.displayName,
        userProfile.email
    );

    if (result.success) {
        return `✅ จองสำเร็จค่ะ!\n\n📅 ${date}\n🕐 ${startTime} - ${endTime}\n📍 ${room}\n📝 ${title}\n\n⏳ สถานะ: รออนุมัติ`;
    }
    return `❌ ${result.error}`;
}

async function handleCheckRepair(params: Record<string, unknown>, userProfile: UserProfile): Promise<string> {
    const { ticketId } = params as { ticketId?: string };
    if (ticketId) {
        const repair = await getRepairByTicketId(ticketId);
        if (!repair) return `ไม่พบงานซ่อม Ticket ID: ${ticketId} ค่ะ`;
        return `📋 สถานะงานซ่อม\n\n${formatRepairForDisplay(repair)}`;
    }
    const repairs = await getRepairsByEmail(userProfile.email);
    if (repairs.length === 0) return 'ไม่พบรายการแจ้งซ่อมของคุณค่ะ';
    return `📋 รายการแจ้งซ่อมล่าสุดของคุณ\n\n${repairs.map(r => formatRepairForDisplay(r)).join('\n\n')}`;
}

async function handleCheckAvailability(params: Record<string, unknown>): Promise<string> {
    const { room, date, startTime, endTime } = params as { room?: string; date?: string; startTime?: string; endTime?: string };
    if (room && date && startTime && endTime) {
        const availability = await checkRoomAvailability(room, date, startTime, endTime);
        return availability.available
            ? `${room} ว่างในช่วงเวลา ${startTime}-${endTime} วันที่ ${date} ค่ะ ✅`
            : `${room} ไม่ว่างในช่วงเวลาดังกล่าวค่ะ ❌\nที่มีการจอง:\n${availability.conflicts?.map(c => `• ${c.startTime}-${c.endTime}: ${c.title}`).join('\n')}`;
    }
    return handleRoomSchedule(params);
}

async function handleRoomSchedule(params: Record<string, unknown>): Promise<string> {
    const { room, date } = params as { room?: string; date?: string };
    const targetDate = date && date !== 'today' ? date : new Date().toISOString().split('T')[0];
    const displayDate = parseThaiDate(targetDate) === new Date().toISOString().split('T')[0] ? 'วันนี้' : targetDate;

    if (!room) return `กรุณาระบุห้องที่ต้องการดูตารางด้วยนะคะ (เช่น ขอตารางห้องประชุม 1 วันนี้)`;

    const schedule = await getRoomSchedule(room, targetDate);
    if (schedule.length === 0) return `📅 ตาราง ${room} (${displayDate})\n\n✅ ว่างทั้งวันค่ะ`;

    const scheduleList = schedule.map(booking => {
        const start = booking.startTime instanceof Timestamp
            ? booking.startTime.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
            : '';
        const end = booking.endTime instanceof Timestamp
            ? booking.endTime.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
            : '';
        return `• ${start}-${end}: ${booking.title} (${booking.requesterName})`;
    }).join('\n');

    return `📅 ตาราง ${room} (${displayDate})\n\n${scheduleList}`;
}

async function handleMyWork(userProfile: UserProfile, params?: Record<string, unknown>): Promise<string> {
    let response = `👤 งานของคุณ (${userProfile.displayName})\n\n`;
    let hasWork = false;

    // Technician
    if (userProfile.role === 'technician') {
        const zone = userProfile.responsibility || 'all';
        const myRepairs = await getRepairsForTechnician(zone);
        if (myRepairs.length > 0) {
            hasWork = true;
            response += `🔧 **งานซ่อมที่ต้องดูแล (${zone === 'all' ? 'ทั้งหมด' : zone})**\n`;
            response += myRepairs.map(r => formatRepairForDisplay(r)).join('\n\n');
            response += '\n\n';
        } else {
            hasWork = false; // Technician but no repairs is possible, but let's see if they have other roles
            response += `🔧 งานซ่อม: ไม่มีงานค้างค่ะ เยี่ยมมาก! 👍\n\n`;
        }
    }

    // Photographer
    if (userProfile.isPhotographer) {
        const myPhotoJobs = await getPhotoJobsByPhotographer(userProfile.uid);
        if (myPhotoJobs.length > 0) {
            hasWork = true;
            response += `📸 **งานถ่ายภาพ**\n`;
            response += myPhotoJobs.map(j => formatPhotoJobForDisplay(j)).join('\n\n');
            response += '\n\n';
        } else if (userProfile.role !== 'technician') {
            response += `📸 งานถ่ายภาพ: ไม่มีงานค่ะ\n\n`;
        }
    }

    // Moderator/Admin
    if (userProfile.role === 'moderator' || userProfile.role === 'admin') {
        const pendingBookings = await getPendingBookings();
        if (pendingBookings.length > 0) {
            hasWork = true;
            response += `📅 **การจองรออนุมัติ**\n`;
            response += pendingBookings.map(b => formatBookingForDisplay(b)).join('\n\n');
            response += '\n\n';
        } else {
            response += `📅 การจอง: ไม่มีรายการรออนุมัติค่ะ\n\n`;
        }
    }

    // User Bookings - Only show if they actually have them
    const myBookings = await getBookingsByEmail(userProfile.email);
    if (myBookings.length > 0) {
        hasWork = true;
        response += `📅 **การจองของคุณ**\n`;
        response += myBookings.slice(0, 3).map(b => formatBookingForDisplay(b)).join('\n\n');
        if (myBookings.length > 3) response += `\n...และอีก ${myBookings.length - 3} รายการ`;
    }

    // Force hasWork true if we showed ANY section even if empty (like "No repairs")
    // Actually simplicity: if response length grew significantly > header

    if (response.length < 50) { // Just header
        return `ไม่พบงานหรืองานค้างในระบบสำหรับคุณค่ะ 😊`;
    }
    return response;
}

interface GallerySearchResult {
    message: string;
    jobs?: PhotographyJob[];
}

async function handleGallerySearchWithResults(params: Record<string, unknown>): Promise<GallerySearchResult> {
    const rawKeyword = params.keyword as string | undefined;
    const rawDate = params.date as string | undefined;
    const keyword = rawKeyword && rawKeyword !== 'undefined' ? rawKeyword : undefined;
    const date = rawDate && rawDate !== 'undefined' ? rawDate : undefined;

    let searchDate: string | undefined;
    if (date) searchDate = parseThaiDate(date);

    let jobs = await searchGallery(keyword, searchDate);

    if (jobs.length === 0 && keyword) {
        const words = keyword.split(/[\s,]+/).filter(w => w.length > 2);
        for (const word of words) {
            jobs = await searchGallery(word, searchDate);
            if (jobs.length > 0) break;
        }
    }
    if (jobs.length === 0 && keyword && searchDate) {
        jobs = await searchGallery(keyword, undefined);
    }

    if (jobs.length === 0) {
        const dateDesc = searchDate ? (isNaN(new Date(searchDate).getTime()) ? date : new Date(searchDate).toLocaleDateString('th-TH')) : '';
        const kwDesc = keyword ? `"${keyword}"` : '';
        return { message: `ไม่พบภาพกิจกรรม${kwDesc} ${dateDesc} ค่ะ ลองค้นหาใหม่นะคะ` };
    }

    const listItems = jobs.slice(0, 10).map((job, index) => {
        const d = job.startTime instanceof Timestamp
            ? job.startTime.toDate().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })
            : '';
        const t = job.title.length > 40 ? job.title.substring(0, 40) + '...' : job.title;
        return `${index + 1}. ${t} (${d})`;
    }).join('\n');
    let response = `📸 พบ ${jobs.length} กิจกรรม\n\n${listItems}`;
    if (jobs.length > 10) response += `\n... ${jobs.length - 10} รายการ`;
    response += '\n\nพิมพ์หมายเลขเพื่อดูรายละเอียดค่ะ';

    return { message: response, jobs };
}

function parseThaiDate(dateStr: string): string | undefined {
    const today = new Date();
    const str = dateStr.toLowerCase().trim();
    if (str === 'today' || str === 'วันนี้') return today.toISOString().split('T')[0];
    if (str === 'yesterday' || str === 'เมื่อวาน' || str === 'เมื่อวานนี้') {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        return y.toISOString().split('T')[0];
    }
    // Simple 16/12/2568 parser
    const m = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
        let yr = parseInt(m[3]);
        if (yr > 2500) yr -= 543;
        const dt = new Date(yr, parseInt(m[2]) - 1, parseInt(m[1]));
        if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return undefined;
}

async function handleDailySummary(userProfile: UserProfile | null): Promise<string> {
    const summary = await getDailySummary();
    if (!userProfile) {
        return `📊 สรุปวันนี้\n\n🔧 งานซ่อม: ${summary.repairs.total}\n📅 จองห้อง: ${summary.bookings.total}\n📸 งานถ่าย: ${summary.photoJobs.total}\n\n💡 ผูกบัญชีเพื่อดูรายละเอียดเพิ่มเติมค่ะ`;
    }
    let response = `📊 สรุปงานวันนี้`;
    if (userProfile.role === 'technician' || userProfile.role === 'admin') {
        response += `\n\n🔧 *งานซ่อม*\n• รอ: ${summary.repairs.pending}\n• กำลังทำ: ${summary.repairs.inProgress}`;
    }
    if (userProfile.role === 'moderator' || userProfile.role === 'admin') {
        response += `\n\n📅 *จองห้อง*\n• รออนุมัติ: ${summary.bookings.pending}`;
    }
    return response + `\n\nค่ะ 😊`;
}

export async function analyzeRepairImage(
    imageBuffer: Buffer,
    mimeType: string,
    symptomDescription: string
): Promise<string> {
    try {
        const imagePart = imageToGenerativePart(imageBuffer, mimeType);
        const prompt = `บทบาท: คุณคือผู้เชี่ยวชาญด้าน IT และโสตทัศนูปกรณ์ (AV Specialist)
งานของคุณ: วิเคราะห์รูปภาพอุปกรณ์ที่ผู้ใช้ส่งมา

กรณีรูปเป็นอุปกรณ์ IT/โสตฯ:
1. วิเคราะห์อาการหรือความผิดปกติที่เห็น
2. แนะนำวิธีแก้ไขเบื้องต้น 2-3 ข้อ (แบบเข้าใจง่าย ทำตามได้จริง)
3. ถามปิดท้ายอย่างสุภาพว่า "ต้องการเปิดใบแจ้งซ่อมเพื่อให้ช่างเข้าไปตรวจสอบไหมคะ?"

กรณีรูปเป็นสิ่งอื่น (ไม่ใช่อุปกรณ์):
- แจ้งอย่างสุภาพว่าระบบรองรับเฉพาะงานแจ้งซ่อมอุปกรณ์โสตฯ/IT เท่านั้น

ข้อกำหนด:
- ห้ามใช้ Markdown (ห้ามใช้ **Bold** หรือ - Bullet)
- ใช้ภาษาไทยกึ่งทางการ สุภาพ นุ่มนวล
- กระชับ ไม่เยิ่นเย้อ
- ลงท้ายประโยคด้วย "ค่ะ"`;
        const result = await geminiVisionModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        return response.text();
    } catch (e) {
        console.error(e);
        return 'ไม่สามารถวิเคราะห์รูปภาพได้ค่ะ';
    }
}

// ============================================
// Main Process Function
// ============================================

export async function processAIMessage(
    lineUserId: string,
    userMessage: string,
    imageBuffer?: Buffer,
    imageMimeType?: string
): Promise<string> {
    const userProfile = await getUserProfileFromLineBinding(lineUserId);
    let context = await getConversationContext(lineUserId);
    if (!context) {
        context = { messages: [], lastActivity: new Date() };
    }

    // 1. Account Binding Check
    if (['ผูกบัญชี', 'เชื่อมบัญชี'].some(k => userMessage.includes(k))) {
        return userProfile ? `✅ ผูกบัญชีแล้ว: ${userProfile.displayName}` : `❌ ยังไม่ผูกบัญชีค่ะ\nไปที่เว็บ crms6it.vercel.app เพื่อเชื่อมต่อนะคะ`;
    }

    // 2. Booking Intercept
    const bookingKw = ['จองห้อง', 'จองประชุม', 'booking'];
    const isChecking = userMessage.includes('ตาราง') || userMessage.includes('ว่างไหม');
    if (bookingKw.some(k => userMessage.toLowerCase().includes(k)) && !isChecking) {
        await clearPendingAction(lineUserId);
        return `📅 จองห้องประชุม\n\nกรุณาจองผ่านเว็บ: https://crms6it.vercel.app/booking\nหรือกดเมนู "จองห้อง" ด้านล่างค่ะ 😊`;
    }

    // 3. Image Handling
    if (imageBuffer && imageMimeType) {
        // Repair Flow Image
        if (context.pendingAction?.intent === 'CREATE_REPAIR' && context.pendingAction.repairStep === 'awaiting_image') {
            const analysis = await analyzeRepairImage(imageBuffer, imageMimeType, 'ตรวจสอบอุปกรณ์');
            let base64 = imageBuffer.toString('base64');
            if (base64.length > 500 * 1024) base64 = base64.substring(0, 500 * 1024);

            context.pendingAction.repairStep = 'awaiting_intent_confirm';
            context.pendingAction.params = {
                ...context.pendingAction.params,
                imageBuffer: base64,
                imageMimeType,
                imageAnalysis: analysis,
                imageUrl: `data:${imageMimeType};base64,${base64}`
            };
            await saveConversationContext(lineUserId, context);
            return `${analysis}\n\n---\nต้องการแจ้งซ่อมไหมคะ? (ตอบ "ใช่" หรือ "ยกเลิก")`;
        }

        // General Image
        const analysis = await analyzeRepairImage(imageBuffer, imageMimeType, 'วิเคราะห์ทั่วไป');
        return analysis;
    }

    // 4. Pending Actions (State Machine)
    if (context.pendingAction) {
        const { intent, repairStep, params } = context.pendingAction;
        const msg = userMessage.trim();

        if (['ยกเลิก', 'cancel'].includes(msg.toLowerCase())) {
            await clearPendingAction(lineUserId);
            return 'ยกเลิกเรียบร้อยค่ะ';
        }

        // --- REPAIR FLOW ---
        if (intent === 'CREATE_REPAIR') {
            if (repairStep === 'awaiting_symptom') {
                context.pendingAction.params.description = msg;
                context.pendingAction.repairStep = 'awaiting_image';
                await saveConversationContext(lineUserId, context);
                return `รับทราบอาการค่ะ "${msg}"\n\n📸 สะดวกถ่ายรูปอาการให้ดูไหมคะ? (ส่งรูปมาได้เลย หรือตอบ "ไม่มี")`;
            }
            if (repairStep === 'awaiting_image') {
                if (msg.includes('ไม่')) {
                    context.pendingAction.repairStep = 'awaiting_intent_confirm';
                    context.pendingAction.params.imageUrl = '';
                    await saveConversationContext(lineUserId, context);
                    return `โอเคค่ะ ข้อมูลการแจ้งซ่อม:\nอาการ: ${params.description}\n\nยืนยันแจ้งซ่อมไหมคะ? (ตอบ "ยืนยัน")`;
                }
                return `กรุณาส่งรูป หรือตอบ "ไม่มี" เพื่อข้ามค่ะ`;
            }
            if (repairStep === 'awaiting_intent_confirm') {
                if (['ใช่', 'ยืนยัน', 'ok', 'ครับ', 'ค่ะ'].some(k => msg.toLowerCase().includes(k))) {
                    // Check if room is missing
                    if (!params.room) {
                        context.pendingAction.repairStep = 'awaiting_room';
                        await saveConversationContext(lineUserId, context);
                        return 'ขอทราบสถานที่/ห้อง ที่อุปกรณ์มีปัญหาด้วยค่ะ?';
                    }
                } else {
                    await clearPendingAction(lineUserId);
                    return 'ยกเลิกการแจ้งซ่อมแล้วค่ะ';
                }
            }
            if (repairStep === 'awaiting_room') {
                context.pendingAction.params.room = msg;
                // Check if side is missing (default junior high often valid, but better ask if unknown)
                context.pendingAction.repairStep = 'awaiting_side';
                await saveConversationContext(lineUserId, context);
                return 'อยู่ฝั่ง ม.ต้น หรือ ม.ปลาย คะ?';
            }
            if (repairStep === 'awaiting_side') {
                context.pendingAction.params.side = msg;
                // Final save
                if (!userProfile) return 'คุณยังไม่ได้ผูกบัญชี กรุณาผ่านบัญชีก่อนแจ้งซ่อมค่ะ';

                const res = await createRepairFromAI(
                    params.room,
                    params.description,
                    msg,
                    params.imageUrl || '',
                    userProfile.displayName,
                    userProfile.email
                );
                await clearPendingAction(lineUserId);
                return res.success ? `✅ รับแจ้งซ่อมเรียบร้อยค่ะ\nLine ID: ${res.ticketId}\nช่างจะเข้าไปตรวจสอบโดยเร็วที่สุดค่ะ` : `❌ เกิดข้อผิดพลาด: ${res.error}`;
            }
        }
    }

    // 5. Natural Language Processing (Gemini)
    try {
        // Add pending gallery results to history for context
        let history = context.messages.map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
        }));

        const chat = startAIChat(history);
        const result = await chat.sendMessage(userMessage);
        const responseText = result.response.text();

        // Save User Message
        context.messages.push({ role: 'user', content: userMessage, timestamp: new Date() });

        // Parse JSON response
        const aiRes = parseAIResponse(responseText);

        if (aiRes.intent) {
            let reply = '';

            // Dispatch Intents
            switch (aiRes.intent) {
                case 'CHECK_REPAIR':
                    if (!userProfile) { reply = 'กรุณาผูกบัญชีก่อนตรวจสอบสถานะค่ะ'; break; }
                    reply = await handleCheckRepair(aiRes.params || {}, userProfile);
                    break;
                case 'CHECK_ROOM_SCHEDULE':
                    reply = await handleRoomSchedule(aiRes.params || {});
                    break;
                case 'CHECK_AVAILABILITY':
                    reply = await handleCheckAvailability(aiRes.params || {});
                    break;
                case 'MY_WORK': // Unified Intent
                case 'MY_BOOKINGS':
                case 'MY_PHOTO_JOBS':
                    if (!userProfile) { reply = 'กรุณาผูกบัญชีก่อนดูงานของคุณค่ะ'; break; }
                    reply = await handleMyWork(userProfile, aiRes.params);
                    break;
                case 'GALLERY_SEARCH':
                    const searchRes = await handleGallerySearchWithResults(aiRes.params || {});
                    reply = searchRes.message;
                    break;
                case 'DAILY_SUMMARY':
                    reply = await handleDailySummary(userProfile);
                    break;
                case 'CREATE_REPAIR':
                    // Start Repair Flow
                    context.pendingAction = {
                        intent: 'CREATE_REPAIR',
                        repairStep: 'awaiting_symptom',
                        params: aiRes.params || {}
                    };
                    // If AI extracted description, go next
                    if (aiRes.params?.description || aiRes.params?.symptom) {
                        context.pendingAction.params.description = aiRes.params.description || aiRes.params.symptom;
                        context.pendingAction.repairStep = 'awaiting_image';
                        reply = `รับแจ้งซ่อม "${context.pendingAction.params.description}" ค่ะ\n\n📸 มีรูปถ่ายอาการไหมคะ? (ส่งรูปมาได้เลย หรือตอบ "ไม่มี")`;
                    } else {
                        reply = 'ขอทราบอาการเสีย หรืออุปกรณ์ที่มีปัญหาด้วยค่ะ?';
                    }
                    await saveConversationContext(lineUserId, context);
                    break;
                default:
                    reply = aiRes.message || 'ขออภัยค่ะ ไม่เข้าใจคำสั่ง';
            }

            // Save Model Response
            context.messages.push({ role: 'model', content: reply, timestamp: new Date() });
            await saveConversationContext(lineUserId, context);
            return reply;

        } else {
            // General Chat
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
