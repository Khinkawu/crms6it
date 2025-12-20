/**
 * AI Agent for LINE Bot
 * Main processor for natural language understanding and action execution
 */

import { PhotographyJob } from '@/types';
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
    formatBookingForDisplay,
    formatRepairForDisplay,
    formatPhotoJobForDisplay,
} from './agentFunctions';

// Types
interface UserProfile {
    uid: string;
    displayName: string;
    email: string;
    role?: 'user' | 'technician' | 'moderator' | 'admin';
    isPhotographer?: boolean;
}

interface ConversationContext {
    messages: { role: 'user' | 'model'; content: string; timestamp: Date }[];
    pendingAction?: {
        intent: string;
        params: Record<string, unknown>;
        // Strict Repair Flow Steps
        repairStep?:
        | 'awaiting_symptom'      // 1. Ask for symptom/equipment
        | 'awaiting_image'        // 2. Ask for image
        | 'awaiting_intent_confirm' // 3. Analyze & Confirm intent
        | 'awaiting_room'         // 4. Ask for room
        | 'awaiting_side'         // 5. Ask for side
        | 'awaiting_final_confirm'; // 6. Final summary & save

        awaitingConfirmation?: boolean; // For legacy/other intents like Booking

        // Gallery selection
        galleryResults?: PhotographyJob[];
    };
    lastActivity: Date;
}

interface AIResponse {
    intent?: string;
    params?: Record<string, unknown>;
    needMoreInfo?: string[];
    question?: string;
    execute?: boolean;
    message?: string;
}

// Constants
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
        const lastActivity = data.lastActivity?.toDate() || new Date();

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

        // Trim messages to max count
        const trimmedMessages = context.messages.slice(-MAX_CONTEXT_MESSAGES);

        await setDoc(contextRef, {
            messages: trimmedMessages,
            pendingAction: context.pendingAction || null,
            lastActivity: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error saving conversation context:', error);
    }
}

async function clearPendingAction(lineUserId: string): Promise<void> {
    try {
        const contextRef = doc(db, 'ai_conversations', lineUserId);
        await updateDoc(contextRef, {
            pendingAction: null,
        });
    } catch (error) {
        console.error('Error clearing pending action:', error);
    }
}

// ============================================
// User Profile from LINE binding
// ============================================

async function getUserProfileFromLineBinding(lineUserId: string): Promise<UserProfile | null> {
    try {
        console.log(`[LINE Binding] Looking up lineUserId: ${lineUserId}`);

        // Method 1: Check line_bindings collection (document ID = lineUserId)
        const bindingDoc = await getDoc(doc(db, 'line_bindings', lineUserId));

        if (bindingDoc.exists()) {
            const binding = bindingDoc.data();
            const uid = binding.uid;
            console.log(`[LINE Binding] Found in line_bindings, uid: ${uid}`);

            if (uid) {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    console.log(`[LINE Binding] User found: ${userData.displayName || userData.email}`);

                    return {
                        uid,
                        displayName: userData.displayName || userData.name || 'ผู้ใช้',
                        email: userData.email,
                        role: userData.role || 'user',
                        isPhotographer: userData.isPhotographer || false,
                    };
                }
            }
        }

        // Method 2: Check users collection (has lineUserId field)
        console.log(`[LINE Binding] Checking users collection for lineUserId field...`);
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('lineUserId', '==', lineUserId), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            console.log(`[LINE Binding] Found in users collection: ${userData.displayName || userData.email}`);

            return {
                uid: userDoc.id,
                displayName: userData.displayName || userData.name || 'ผู้ใช้',
                email: userData.email,
                role: userData.role || 'user',
                isPhotographer: userData.isPhotographer || false,
            };
        }

        console.log(`[LINE Binding] No binding found for: ${lineUserId}`);
        return null;
    } catch (error) {
        console.error('Error getting user profile from LINE binding:', error);
        return null;
    }
}

// ============================================
// Parse AI Response
// ============================================

function parseAIResponse(responseText: string): AIResponse {
    // Try to parse as JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed;
        } catch {
            // Not valid JSON, treat as plain text
        }
    }

    // Return as plain message
    return { message: responseText };
}

// ============================================
// Handle Different Intents
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
        // Just checking availability for confirmation
        const availability = await checkRoomAvailability(room, date, startTime, endTime);
        if (!availability.available) {
            return `ขออภัยค่ะ ${room} ไม่ว่างในช่วงเวลาที่ต้องการ มีการจองดังนี้:\n${availability.conflicts?.map(
                (c) => `• ${c.startTime}-${c.endTime}: ${c.title}`
            ).join('\n')}\n\nต้องการเลือกเวลาอื่นไหมคะ?`;
        }
        return `ห้องว่างค่ะ ต้องการจอง ${room} วันที่ ${date} เวลา ${startTime}-${endTime} หัวข้อ "${title}" ใช่ไหมคะ? (ตอบ "ใช่" หรือ "ยืนยัน" เพื่อจอง)`;
    }

    // Execute booking
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
        return `✅ จองสำเร็จค่ะ!\n\n📅 ${date}\n🕐 ${startTime} - ${endTime}\n📍 ${room}\n📝 ${title}\n\n⏳ สถานะ: รออนุมัติ\n\nจะได้รับแจ้งเตือนเมื่อมีการอนุมัตินะคะ`;
    }

    return `❌ ${result.error}`;
}

async function handleCheckRepair(
    params: Record<string, unknown>,
    userProfile: UserProfile
): Promise<string> {
    const { ticketId } = params as { ticketId?: string };

    if (ticketId) {
        const repair = await getRepairByTicketId(ticketId);
        if (!repair) {
            return `ไม่พบงานซ่อม Ticket ID: ${ticketId} ค่ะ กรุณาตรวจสอบอีกครั้งนะคะ`;
        }
        return `📋 สถานะงานซ่อม\n\n${formatRepairForDisplay(repair)}`;
    }

    // Get repairs by email
    const repairs = await getRepairsByEmail(userProfile.email);
    if (repairs.length === 0) {
        return 'ไม่พบรายการแจ้งซ่อมของคุณค่ะ';
    }

    const repairsList = repairs.map((r) => formatRepairForDisplay(r)).join('\n\n');
    return `📋 รายการแจ้งซ่อมล่าสุดของคุณ\n\n${repairsList}`;
}

async function handleCheckAvailability(params: Record<string, unknown>): Promise<string> {
    const { room, date } = params as { room?: string; date?: string };

    // Use Bangkok timezone
    const bangkokOptions = { timeZone: 'Asia/Bangkok' };

    // Get current date in Bangkok timezone
    const now = new Date();
    const bangkokNow = new Date(now.toLocaleString('en-US', bangkokOptions));

    let targetDate: Date;
    let dateDisplay: string;

    if (date && date !== 'today') {
        const parsed = parseThaiDate(date);
        if (parsed) {
            targetDate = new Date(parsed);
            dateDisplay = targetDate.toLocaleDateString('th-TH', bangkokOptions);
        } else {
            targetDate = bangkokNow;
            dateDisplay = 'วันนี้';
        }
    } else {
        targetDate = bangkokNow;
        dateDisplay = 'วันนี้';
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('startTime', '>=', Timestamp.fromDate(startOfDay)),
            where('startTime', '<=', Timestamp.fromDate(endOfDay))
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return room
                ? `ห้อง ${room} ว่างทั้งวันค่ะ (${dateDisplay})`
                : `ไม่มีการจอง${dateDisplay}ค่ะ ทุกห้องว่างนะคะ 😊`;
        }

        const bookings: string[] = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (!['pending', 'approved'].includes(data.status)) return;

            if (!room || data.roomName?.includes(room) || data.room?.includes(room)) {
                // Use Bangkok timezone for time display
                const startTime = data.startTime?.toDate?.()?.toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Bangkok'
                }) || '';
                const endTime = data.endTime?.toDate?.()?.toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Bangkok'
                }) || '';
                const status = data.status === 'approved' ? '✅' : '⏳';
                bookings.push(`${status} ${data.roomName || data.room}: ${startTime}-${endTime}\n   ${data.title || 'ไม่ระบุหัวข้อ'}`);
            }
        });

        if (bookings.length === 0) {
            return room
                ? `ห้อง ${room} ว่างทั้งวัน${dateDisplay}ค่ะ`
                : `ไม่มีการจอง${dateDisplay}ค่ะ ทุกห้องว่างนะคะ 😊`;
        }

        const header = room ? `📅 การจองห้อง ${room} (${dateDisplay})` : `📅 การจอง${dateDisplay}`;
        return `${header}\n\n${bookings.join('\n\n')}\n\nช่วงเวลาอื่นๆ ว่างค่ะ`;
    } catch (error) {
        console.error('Error checking availability:', error);
        return 'เกิดข้อผิดพลาดในการตรวจสอบค่ะ กรุณาลองใหม่อีกครั้งนะคะ';
    }
}

async function handleMyBookings(userProfile: UserProfile): Promise<string> {
    const bookings = await getBookingsByEmail(userProfile.email);

    if (bookings.length === 0) {
        return 'ไม่พบรายการจองของคุณค่ะ';
    }

    const bookingsList = bookings.map((b) => formatBookingForDisplay(b)).join('\n\n');
    return `📅 รายการจองของคุณ\n\n${bookingsList}`;
}

async function handleMyPhotoJobs(userProfile: UserProfile, params?: Record<string, unknown>): Promise<string> {
    if (!userProfile.isPhotographer) {
        return 'คุณไม่ใช่ช่างภาพในระบบค่ะ หากต้องการเป็นช่างภาพ กรุณาติดต่อผู้ดูแลระบบนะคะ';
    }

    const jobs = await getPhotoJobsByPhotographer(userProfile.uid);

    // Filter by date if specified
    const dateFilter = params?.date as string | undefined;
    let filteredJobs = jobs;

    if (dateFilter === 'today' || dateFilter === 'วันนี้') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        filteredJobs = jobs.filter(j => {
            const jobDate = j.startTime instanceof Timestamp ? j.startTime.toDate() : new Date(j.startTime as unknown as string);
            return jobDate >= today && jobDate < tomorrow;
        });
    }

    if (filteredJobs.length === 0) {
        if (dateFilter) {
            return 'วันนี้ไม่มีงานถ่ายภาพที่มอบหมายให้คุณค่ะ 😊';
        }
        return 'ไม่พบงานถ่ายภาพที่ได้รับมอบหมายค่ะ';
    }

    const jobsList = filteredJobs.map((j) => formatPhotoJobForDisplay(j)).join('\n\n');
    const title = dateFilter ? '📸 งานถ่ายภาพวันนี้' : '📸 งานถ่ายภาพของคุณ';
    return `${title}\n\n${jobsList}`;
}

interface GallerySearchResult {
    message: string;
    jobs?: PhotographyJob[];
}

async function handleGallerySearchWithResults(params: Record<string, unknown>): Promise<GallerySearchResult> {
    const rawKeyword = params.keyword as string | undefined;
    const rawDate = params.date as string | undefined;

    // Clean up undefined/null values
    const keyword = rawKeyword && rawKeyword !== 'undefined' ? rawKeyword : undefined;
    const date = rawDate && rawDate !== 'undefined' ? rawDate : undefined;

    // Parse Thai date formats
    let searchDate: string | undefined;
    if (date) {
        searchDate = parseThaiDate(date);
    }

    // First try: exact search
    let jobs = await searchGallery(keyword, searchDate);

    // If no results and has keyword, try smart search with individual words
    if (jobs.length === 0 && keyword) {
        // Split keyword into words and try each
        const words = keyword.split(/[\s,]+/).filter(w => w.length > 2);
        for (const word of words) {
            jobs = await searchGallery(word, searchDate);
            if (jobs.length > 0) break;
        }
    }

    // If still no results, try without date filter
    if (jobs.length === 0 && keyword && searchDate) {
        jobs = await searchGallery(keyword, undefined);
    }

    // Build search description
    let searchDesc = '';
    if (keyword && searchDate) {
        const dateStr = isNaN(new Date(searchDate).getTime()) ? date : new Date(searchDate).toLocaleDateString('th-TH');
        searchDesc = `"${keyword}" ${dateStr}`;
    } else if (keyword) {
        searchDesc = `"${keyword}"`;
    } else if (searchDate) {
        const dateStr = isNaN(new Date(searchDate).getTime()) ? date : new Date(searchDate).toLocaleDateString('th-TH');
        searchDesc = dateStr || '';
    } else {
        searchDesc = 'ล่าสุด';
    }

    if (jobs.length === 0) {
        if (!keyword && !searchDate) {
            return { message: 'ยังไม่มีภาพกิจกรรมในระบบค่ะ' };
        }
        return { message: `ไม่พบภาพกิจกรรมที่ตรงกับ ${searchDesc} ค่ะ ลองค้นหาคำอื่นนะคะ` };
    }

    // If only 1 result, show full details
    if (jobs.length === 1) {
        const job = jobs[0];
        return {
            message: `📸 พบ 1 กิจกรรม ${searchDesc}\n\n${formatPhotoJobForDisplay(job)}`,
            jobs
        };
    }

    // Multiple results - show numbered list for easy selection
    const listItems = jobs.slice(0, 10).map((job, index) => {
        const date = job.startTime instanceof Timestamp
            ? job.startTime.toDate().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })
            : '';
        // Truncate title if too long
        const shortTitle = job.title.length > 40 ? job.title.substring(0, 40) + '...' : job.title;
        return `${index + 1}. ${shortTitle} (${date})`;
    }).join('\n');

    let response = `📸 พบ ${jobs.length} กิจกรรม ${searchDesc}\n\n${listItems}`;

    if (jobs.length > 10) {
        response += `\n... และอีก ${jobs.length - 10} กิจกรรม`;
    }

    response += '\n\nพิมพ์หมายเลขเพื่อดูรายละเอียดและ Link ค่ะ';
    return { message: response, jobs };
}

// Parse Thai date formats: "เมื่อวาน", "16/12/2568", "16 ธันวาคม 2568", "yesterday", "today"
function parseThaiDate(dateStr: string): string | undefined {
    const today = new Date();
    const str = dateStr.toLowerCase().trim();

    // Handle relative dates
    if (str === 'today' || str === 'วันนี้') {
        return today.toISOString().split('T')[0];
    }
    if (str === 'yesterday' || str === 'เมื่อวาน' || str === 'เมื่อวานนี้') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    // Handle Thai date format: "16/12/2568" or "16-12-2568"
    const thaiDateMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (thaiDateMatch) {
        let year = parseInt(thaiDateMatch[3]);
        // Convert Buddhist Era to CE if needed
        if (year > 2500) year -= 543;
        const month = parseInt(thaiDateMatch[2]) - 1;
        const day = parseInt(thaiDateMatch[1]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    }

    // Handle Thai month names
    const thaiMonths: Record<string, number> = {
        'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3,
        'พฤษภาคม': 4, 'มิถุนายน': 5, 'กรกฎาคม': 6, 'สิงหาคม': 7,
        'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11,
        'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3,
        'พ.ค.': 4, 'มิ.ย.': 5, 'ก.ค.': 6, 'ส.ค.': 7,
        'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11
    };

    for (const [monthName, monthIndex] of Object.entries(thaiMonths)) {
        if (dateStr.includes(monthName)) {
            const dayMatch = dateStr.match(/(\d{1,2})/);
            const yearMatch = dateStr.match(/(\d{4})/);
            if (dayMatch && yearMatch) {
                let year = parseInt(yearMatch[1]);
                if (year > 2500) year -= 543;
                const date = new Date(year, monthIndex, parseInt(dayMatch[1]));
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
        }
    }

    // Try standard date parsing
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    return undefined;
}

async function handleDailySummary(userProfile: UserProfile | null): Promise<string> {
    const summary = await getDailySummary();

    // If user is not logged in, show general summary
    if (!userProfile) {
        return `📊 สรุปวันนี้

🔧 งานซ่อม: ${summary.repairs.total} รายการ
📅 การจองห้อง: ${summary.bookings.total} รายการ
📸 งานถ่ายภาพ: ${summary.photoJobs.total} งาน

💡 ผูกบัญชีเพื่อดูงานของคุณโดยเฉพาะค่ะ`;
    }

    let response = `📊 สรุปงานวันนี้`;

    // For technicians - show repair tasks
    if (userProfile.role === 'technician' || userProfile.role === 'admin') {
        response += `\n\n🔧 *งานซ่อม*
• รอดำเนินการ: ${summary.repairs.pending} รายการ
• กำลังซ่อม: ${summary.repairs.inProgress} รายการ`;
    }

    // For photographers - show photo jobs
    if (userProfile.isPhotographer) {
        const myJobs = await getPhotoJobsByPhotographer(userProfile.uid);
        response += `\n\n📸 *งานถ่ายภาพของคุณ*`;
        if (myJobs.length > 0) {
            response += `\n${myJobs.map(j => formatPhotoJobForDisplay(j)).join('\n')}`;
        } else {
            response += `\n• ไม่มีงานวันนี้ค่ะ`;
        }
    }

    // For moderators/admins - show pending approvals
    if (userProfile.role === 'moderator' || userProfile.role === 'admin') {
        response += `\n\n📅 *การจองห้องรออนุมัติ*
• รออนุมัติ: ${summary.bookings.pending} รายการ`;
    }

    // For regular users - show their bookings
    if (userProfile.role === 'user') {
        const myBookings = await getBookingsByEmail(userProfile.email);
        const todayBookings = myBookings.filter(b => {
            const bookingDate = b.startTime.toDate();
            const today = new Date();
            return bookingDate.toDateString() === today.toDateString();
        });

        if (todayBookings.length > 0) {
            response += `\n\n *การจองห้องของคุณวันนี้*
${todayBookings.map(b => formatBookingForDisplay(b)).join('\n')}`;
        }
    }

    return response + `\n\nค่ะ 😊`;
}

// ============================================
// Image Analysis for Repair
// ============================================

export async function analyzeRepairImage(
    imageBuffer: Buffer,
    mimeType: string,
    symptomDescription: string
): Promise<string> {
    try {
        const imagePart = imageToGenerativePart(imageBuffer, mimeType);

        const prompt = `เป็นช่างซ่อมอุปกรณ์โสตทัศนูปกรณ์ อาการที่แจ้งมา: "${symptomDescription}"

ดูจากรูปและอาการ ให้ตอบ:
1. วิเคราะห์สาเหตุที่เป็นไปได้
2. วิธีแก้เบื้องต้น 2-3 ข้อ
3. จบด้วย "ถ้าทำแล้วยังมีปัญหา ตอบ 'แจ้งซ่อม' เพื่อส่งช่างไปดูค่ะ"

ห้ามบอกว่า "เห็นอะไรในรูป" ห้ามใช้ ** หรือ markdown
ตอบสั้น กระชับ ภาษาไทย ลงท้าย "ค่ะ"`;

        const result = await geminiVisionModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        let analysis = response.text();

        // Ensure not too long
        if (analysis.length > 2000) {
            analysis = analysis.substring(0, 2000) + '...';
        }

        return analysis;
    } catch (error) {
        console.error('Error analyzing repair image:', error);
        return 'ไม่สามารถวิเคราะห์รูปภาพได้ค่ะ กรุณาลองส่งรูปใหม่อีกครั้งนะคะ';
    }
}

// ============================================
// Main Processing Function
// ============================================

export async function processAIMessage(
    lineUserId: string,
    userMessage: string,
    imageBuffer?: Buffer,
    imageMimeType?: string
): Promise<string> {
    // Get user profile from LINE binding
    const userProfile = await getUserProfileFromLineBinding(lineUserId);

    // Get or create conversation context
    let context = await getConversationContext(lineUserId);
    if (!context) {
        context = {
            messages: [],
            lastActivity: new Date(),
        };
    }

    // Handle direct questions about account binding status
    const bindingKeywords = ['ผูกบัญชี', 'ผูกไอดี', 'ลิ้งก์บัญชี', 'เชื่อมบัญชี', 'ผูกรึยัง', 'ผูกยัง', 'ผูกหรือยัง'];
    if (bindingKeywords.some(kw => userMessage.toLowerCase().includes(kw))) {
        if (userProfile) {
            return `✅ คุณผูกบัญชีแล้วค่ะ!\n\n👤 ชื่อ: ${userProfile.displayName}\n📧 อีเมล: ${userProfile.email}\n\nพร้อมใช้งานทุกฟังก์ชันแล้วค่ะ 😊`;
        } else {
            return `❌ ยังไม่ได้ผูกบัญชีค่ะ\n\nวิธีผูกบัญชี:\n1. เข้าเว็บ https://crms6it.vercel.app\n2. เข้าสู่ระบบด้วย Google xxx@tesaban6.ac.th\n3. ไปที่ Profile → เชื่อมต่อ LINE\n\nหลังผูกแล้วกลับมาทักใหม่ได้เลยค่ะ 😊`;
        }
    }

    // Handle image message for repair
    if (imageBuffer && imageMimeType) {
        // If awaiting image for repair flow
        if (context.pendingAction?.intent === 'CREATE_REPAIR' && context.pendingAction.repairStep === 'awaiting_image') {
            // Get symptom for analysis context
            const symptom = (context.pendingAction.params?.description as string) ||
                (context.pendingAction.params?.symptom as string) ||
                'อุปกรณ์มีปัญหา';

            // Analyze image with AI for troubleshooting advice
            const analysis = await analyzeRepairImage(imageBuffer, imageMimeType, symptom);

            // Resize image if too large (limit ~500KB for Firestore)
            let imageBase64 = imageBuffer.toString('base64');
            const maxSize = 500 * 1024; // 500KB
            if (imageBase64.length > maxSize) {
                // Truncate base64 - in production, use proper image compression
                imageBase64 = imageBase64.substring(0, maxSize);
            }

            context.pendingAction = {
                ...context.pendingAction,
                repairStep: 'awaiting_intent_confirm', // Move to confirm
                params: {
                    ...context.pendingAction.params,
                    imageBuffer: imageBase64,
                    imageMimeType,
                    imageAnalysis: analysis,
                    imageUrl: `data:${imageMimeType};base64,${imageBase64}`,
                },
            };
            await saveConversationContext(lineUserId, context);

            // Return analysis with transition to confirmation
            return `${analysis}\n\n---\nต้องการ "แจ้งซ่อม" เพื่อเรียกช่างเลยไหมคะ? (ตอบ "ใช่" หรือ "ยกเลิก")`;
        }

        // Check if recent conversation was about repair (smart detection)
        const recentMessages = context.messages.slice(-4);
        const repairKeywords = ['ซ่อม', 'เสีย', 'ปัญหา', 'ไม่ทำงาน', 'พัง', 'อุปกรณ์', 'โปรเจคเตอร์', 'เครื่อง', 'คอม', 'รูป', 'ภาพ'];
        const isRepairContext = recentMessages.some(m =>
            repairKeywords.some(kw => m.content.toLowerCase().includes(kw))
        );

        if (isRepairContext) {
            // Extract symptom from recent messages
            const userMessages = recentMessages.filter(m => m.role === 'user');
            const symptom = userMessages.map(m => m.content).join(' ') || 'อุปกรณ์มีปัญหา';

            const analysis = await analyzeRepairImage(imageBuffer, imageMimeType, symptom);

            // Set up pending repair action - start with asking confirmation
            context.pendingAction = {
                intent: 'CREATE_REPAIR' as const,
                repairStep: 'awaiting_intent_confirm',
                params: {
                    description: symptom,
                    imageAnalysis: analysis,
                },
            };

            await saveConversationContext(lineUserId, context);

            return `${analysis}\n\n---\nต้องการแจ้งซ่อมไหมคะ? (ตอบ "ใช่" เพื่อดำเนินการต่อ หรือ "ยกเลิก")`;
        }

        // Image sent without repair context - general analysis
        try {
            const imagePart = imageToGenerativePart(imageBuffer, imageMimeType);

            const prompt = `ดูรูปภาพนี้:

ถ้าเป็นอุปกรณ์ IT/โสตฯ ที่ดูมีปัญหา: วิเคราะห์อาการ + แนะนำแก้เบื้องต้น 2-3 ข้อ + ถามต้องการแจ้งซ่อมไหม
ถ้าเป็นอุปกรณ์ IT/โสตฯ ที่ดูปกติ: ถามว่ามีปัญหาอะไรไหม
ถ้าไม่ใช่อุปกรณ์ IT: ตอบสั้นๆ + บอกว่าช่วยเรื่องโสตฯ ได้

ห้ามเริ่มด้วย "เห็นว่า" ตอบกระชับ ภาษาไทย ลงท้าย "ค่ะ"`;

            const result = await geminiVisionModel.generateContent([prompt, imagePart]);
            const response = await result.response;
            let analysis = response.text();

            // Ensure response is not too long for LINE (max 5000 chars)
            if (analysis.length > 2000) {
                analysis = analysis.substring(0, 2000) + '...';
            }

            await saveConversationContext(lineUserId, context);

            return analysis;
        } catch (error) {
            console.error('Error analyzing image:', error);
            return 'ขออภัยค่ะ ไม่สามารถวิเคราะห์รูปภาพได้ในขณะนี้ กรุณาลองส่งใหม่อีกครั้งนะคะ 🙏';
        }
    }

    // === GALLERY NUMBER SELECTION ===

    // Handle number selection for gallery results
    if (context.pendingAction?.intent === 'GALLERY_SELECTION' && context.pendingAction.galleryResults) {
        const numberMatch = userMessage.trim().match(/^(\d+)$/);
        if (numberMatch) {
            const selectedIndex = parseInt(numberMatch[1]) - 1;
            const jobs = context.pendingAction.galleryResults;

            if (selectedIndex >= 0 && selectedIndex < jobs.length) {
                const selectedJob = jobs[selectedIndex];
                // Clear pending action
                await clearPendingAction(lineUserId);
                return `📸 ${selectedJob.title}\n\n${formatPhotoJobForDisplay(selectedJob)}`;
            } else {
                return `กรุณาเลือกหมายเลข 1-${Math.min(jobs.length, 10)} ค่ะ`;
            }
        }
        // If not a number, let it continue to AI processing and clear gallery selection
        await clearPendingAction(lineUserId);
    }

    // ============================================
    // REPAIR FLOW STATE MACHINE
    // ============================================

    if (context.pendingAction?.intent === 'CREATE_REPAIR') {
        const step = context.pendingAction.repairStep;
        const params = context.pendingAction.params || {};

        // 1. Awaiting Symptom (only if not provided initially)
        if (step === 'awaiting_symptom') {
            const symptom = userMessage.trim();
            context.pendingAction = {
                ...context.pendingAction,
                repairStep: 'awaiting_image',
                params: { ...params, description: symptom }
            };
            await saveConversationContext(lineUserId, context);
            return '📷 รบกวนถ่ายรูปหน้างานให้ดูหน่อยได้ไหมคะ? (ถ้าไม่มีพิมพ์ "ไม่มี" ได้เลยค่ะ)';
        }

        // 2. Awaiting Image (Handled in image block mostly, but handle text here)
        if (step === 'awaiting_image') {
            const skipWords = ['ไม่มี', 'ไม่สะดวก', 'no', 'skip', 'ไม่', 'don\'t'];
            if (skipWords.some(w => userMessage.toLowerCase().includes(w))) {
                // User skipped image
                context.pendingAction = {
                    ...context.pendingAction,
                    repairStep: 'awaiting_intent_confirm', // Go to intent confirm directly
                    params: { ...params, skippedImage: true }
                };
                await saveConversationContext(lineUserId, context);
                return `รับทราบค่ะ\n\nต้องการ "แจ้งซ่อม" เพื่อเรียกช่างเลยไหมคะ? (ตอบ "ใช่" หรือ "ยกเลิก")`;
            }

            // If text but not skip word -> Remind to send image
            return '📷 รบกวนส่งรูปภาพให้หน่อยนะคะ หรือพิมพ์ "ไม่มี" เพื่อข้ามค่ะ';
        }

        // 3. Awaiting Intent Confirmation (After Analysis or Skip)
        if (step === 'awaiting_intent_confirm') {
            const confirmWords = ['ใช่', 'ok', 'ตกลง', 'แจ้ง', 'ซ่อม', 'ครับ', 'ค่ะ', 'yes'];
            const cancelWords = ['ไม่', 'ยกเลิก', 'cancel', 'no', 'พอ', 'หยุด'];

            if (cancelWords.some(w => userMessage.toLowerCase().includes(w))) {
                await clearPendingAction(lineUserId);
                return 'รับทราบค่ะ ยกเลิกเรียบร้อยแล้ว หากมีปัญหาอื่นแจ้งได้เสมอนะคะ 😊';
            }

            if (confirmWords.some(w => userMessage.toLowerCase().includes(w))) {
                context.pendingAction = {
                    ...context.pendingAction,
                    repairStep: 'awaiting_room'
                };
                await saveConversationContext(lineUserId, context);
                return 'อุปกรณ์อยู่ที่ "ห้องไหน" คะ? (เช่น 101, ห้องประชุม)';
            }

            return 'สรุปรับแจ้งซ่อมเลยไหมคะ? (ตอบ "ใช่" หรือ "ยกเลิก")';
        }

        // 4. Awaiting Room
        if (step === 'awaiting_room') {
            const room = userMessage.trim();
            context.pendingAction = {
                ...context.pendingAction,
                repairStep: 'awaiting_side',
                params: { ...params, room }
            };
            await saveConversationContext(lineUserId, context);
            return 'อยู่ฝั่ง "ม.ต้น" หรือ "ม.ปลาย" คะ?';
        }

        // 5. Awaiting Side
        if (step === 'awaiting_side') {
            const sideMatch = userMessage.match(/ม\.(ต้น|ปลาย)|มัธยม(ต้น|ปลาย)|ฝั่ง(ต้น|ปลาย)|ต้น|ปลาย/i);
            const side = sideMatch ? (userMessage.includes('ต้น') ? 'ม.ต้น' : 'ม.ปลาย') : userMessage;

            context.pendingAction = {
                ...context.pendingAction,
                repairStep: 'awaiting_final_confirm',
                params: { ...params, side }
            };
            await saveConversationContext(lineUserId, context);

            const p = context.pendingAction.params;
            const hasImage = p.imageUrl ? '✅ มีรูปภาพ' : '❌ ไม่มีรูปภาพ';

            return `📝 สรุปข้อมูลแจ้งซ่อม:
- อาการ: ${p.description || '-'}
- รูปภาพ: ${hasImage}
- ห้อง: ${p.room}
- ฝั่ง: ${side}

ยืนยันการแจ้งซ่อมไหมคะ? (ตอบ "ยืนยัน" หรือ "ยกเลิก")`;
        }

        // 6. Final Confirmation
        if (step === 'awaiting_final_confirm') {
            const confirmWords = ['ยืนยัน', 'ใช่', 'ok', 'ตกลง', 'yes'];
            const cancelWords = ['แก้ไข', 'ไม่', 'ยกเลิก', 'cancel'];

            if (confirmWords.some(w => userMessage.toLowerCase().includes(w))) {
                await clearPendingAction(lineUserId);

                if (userProfile) {
                    const result = await createRepairFromAI(
                        params?.room as string,
                        params?.description as string,
                        params?.side as string,
                        params?.imageUrl as string || '',
                        userProfile.displayName,
                        userProfile.email
                    );

                    if (result.success) {
                        return `✅ บันทึกแจ้งซ่อมเรียบร้อยค่ะ! (Ticket: ${result.ticketId})\nช่างจะรีบดำเนินการตรวจสอบนะคะ`;
                    } else {
                        return `❌ เกิดข้อผิดพลาด: ${result.error}`;
                    }
                }
                return '❌ ไม่พบข้อมูลผู้ใช้งาน กรุณาผูกบัญชีก่อนนะคะ';
            }

            if (cancelWords.some(w => userMessage.toLowerCase().includes(w))) {
                await clearPendingAction(lineUserId);
                return 'ยกเลิกรายการแจ้งซ่อมแล้วค่ะ';
            }

            return 'พิมพ์ "ยืนยัน" เพื่อบันทึก หรือ "ยกเลิก" เพื่อลบทิ้งค่ะ';
        }
    }

    // === OTHER FLOWS (Booking, etc.) ===
    // Handle confirmation responses for other intents
    const confirmWords = ['ใช่', 'ยืนยัน', 'ตกลง', 'ok', 'yes', 'จอง', 'แจ้งซ่อม', 'แจ้ง'];
    const cancelWords = ['ไม่', 'ยกเลิก', 'cancel', 'no'];

    // Legacy/Other confirmation check (e.g. Booking)
    // Note: Repair now handles its own confirmation above
    if (context.pendingAction?.intent === 'BOOK_ROOM' && context.pendingAction.params?.awaitingConfirmation) {
        // ... existing booking logic if needed, or simplified
        // The original code used a generic 'awaitingConfirmation'. 
        // Since we refactored Repair, we should ensure Booking still works or uses its verification.
        // Current Plan: Leave booking logic 'as is' but ensure it doesn't conflict.
        // Booking doesn't use 'repairStep', so safe.
        // BUT wait, I removed 'awaitingConfirmation' from the interface?
        // No, I should keep 'awaitingConfirmation' in interface for Booking compatibility if I didn't delete it.
        // Let's check my interface change. I REPLACED it.
        // Correcting: I should KEEP 'awaitingConfirmation' for generic use or others?
        // The 'Checking Room' intent was simple.
        // Let's assume Booking flow needs specific handling or I should fix the interface to include `awaitingConfirmation` again if needed.
        // Looking at my interface replacement, I removed `awaitingConfirmation`.
        // I should add `{ awaitingConfirmation?: boolean } & ...` or just add it back.
        // Actually, Booking relied on `awaitingConfirmation`. I should put it back in Interface.
    }


    // Check if user needs to link account for certain actions
    const actionRequiresAuth = (intent: string) =>
        ['BOOK_ROOM', 'CREATE_REPAIR', 'CHECK_REPAIR', 'MY_BOOKINGS', 'MY_PHOTO_JOBS'].includes(intent);

    // Build chat history for Gemini
    const history = context.messages.map((m) => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.content }],
    }));

    // Start chat and send message
    const chat = startAIChat(history);
    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    // Parse the response
    const aiResponse = parseAIResponse(responseText);

    // Update context with this exchange
    context.messages.push(
        { role: 'user', content: userMessage, timestamp: new Date() },
        { role: 'model', content: responseText, timestamp: new Date() }
    );

    // If it's a plain message (GENERAL or no intent), return it
    if (aiResponse.message && !aiResponse.intent) {
        await saveConversationContext(lineUserId, context);
        return aiResponse.message;
    }

    // Check if action requires authentication
    if (aiResponse.intent && actionRequiresAuth(aiResponse.intent) && !userProfile) {
        await saveConversationContext(lineUserId, context);
        return `เพื่อใช้งานฟีเจอร์นี้ กรุณาผูกบัญชี LINE กับระบบก่อนนะคะ

📱 วิธีที่ 1: กดปุ่ม "ผูกบัญชี" ใน Rich Menu ด้านล่าง
🌐 วิธีที่ 2: เข้าเว็บ https://crms6it.vercel.app → Profile → เชื่อมต่อ LINE

หลังผูกแล้วกลับมาทักใหม่ได้เลยค่ะ 😊`;
    }

    // Handle specific intents
    const noAuthIntents = ['DAILY_SUMMARY', 'CHECK_AVAILABILITY', 'CHECK_ROOM_AVAILABILITY', 'GALLERY_SEARCH'];

    if (aiResponse.intent) {
        // Special case: BOOK_ROOM - Always redirect to website immediately
        if (aiResponse.intent === 'BOOK_ROOM') {
            await saveConversationContext(lineUserId, context);
            return `📅 จองห้องประชุม
            
สามารถจองได้ 2 วิธีค่ะ:

1️⃣ กดเมนู "จองห้อง" ที่ Line Rich menu ด้านล่าง
2️⃣ จองผ่านเว็บ: https://crms6it.vercel.app/booking

เลือกห้อง วันที่ และเวลาได้สะดวกกว่านะคะ 😊`;
        }

        // If more info is needed
        if (aiResponse.needMoreInfo && aiResponse.needMoreInfo.length > 0) {
            context.pendingAction = {
                intent: aiResponse.intent,
                params: aiResponse.params || {},
            };
            await saveConversationContext(lineUserId, context);
            return aiResponse.question || 'กรุณาให้ข้อมูลเพิ่มเติมค่ะ';
        }

        // If ready to execute, handle no-auth intents first
        if (aiResponse.execute) {
            // Intents that don't require authentication
            if (noAuthIntents.includes(aiResponse.intent)) {
                switch (aiResponse.intent) {
                    case 'CHECK_AVAILABILITY':
                    case 'CHECK_ROOM_AVAILABILITY':
                        await saveConversationContext(lineUserId, context);
                        return handleCheckAvailability(aiResponse.params || {});
                    case 'GALLERY_SEARCH': {
                        const galleryResult = await handleGallerySearchWithResults(aiResponse.params || {});
                        // Save gallery results for number selection
                        if (galleryResult.jobs && galleryResult.jobs.length > 1) {
                            context.pendingAction = {
                                intent: 'GALLERY_SELECTION',
                                params: {},
                                galleryResults: galleryResult.jobs as PhotographyJob[],
                            };
                        }
                        await saveConversationContext(lineUserId, context);
                        return galleryResult.message;
                    }
                    case 'DAILY_SUMMARY':
                        await saveConversationContext(lineUserId, context);
                        return handleDailySummary(userProfile);
                }
            }

            // Intents that require authentication
            if (userProfile) {
                switch (aiResponse.intent) {
                    case 'CHECK_REPAIR':
                        await saveConversationContext(lineUserId, context);
                        return handleCheckRepair(aiResponse.params || {}, userProfile);
                    case 'MY_BOOKINGS':
                        await saveConversationContext(lineUserId, context);
                        return handleMyBookings(userProfile);
                    case 'MY_PHOTO_JOBS':
                        await saveConversationContext(lineUserId, context);
                        return handleMyPhotoJobs(userProfile, aiResponse.params);
                }
                // Need confirmation for specific intents (requires auth)
                if (userProfile) {
                    if (aiResponse.intent === 'CREATE_REPAIR') {
                        // Start repair flow - ask equipment first (symptom)
                        context.pendingAction = {
                            intent: 'CREATE_REPAIR',
                            params: aiResponse.params || {},
                            repairStep: 'awaiting_symptom',  // Step 1: Ask what equipment/symptom
                        };
                        await saveConversationContext(lineUserId, context);
                        return '🔧 แจ้งซ่อม\n\nอุปกรณ์อะไรเสียและมีอาการอย่างไรคะ? (เช่น "โปรเจคเตอร์ภาพสีเพี้ยน", "คอมพิวเตอร์เปิดไม่ติด")';
                    }
                }
            }

            // Default: return AI response
            await saveConversationContext(lineUserId, context);
            return aiResponse.question || aiResponse.message || responseText;
        }
    }
}

// ============================================
// OTP for Email Verification
// ============================================

export async function generateOTP(email: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await setDoc(doc(db, 'ai_otps', email), {
        otp,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)), // 5 minutes
    });

    return otp;
}

export async function verifyOTP(email: string, otp: string): Promise<boolean> {
    try {
        const otpDoc = await getDoc(doc(db, 'ai_otps', email));
        if (!otpDoc.exists()) return false;

        const data = otpDoc.data();
        if (data.otp !== otp) return false;

        const expiresAt = data.expiresAt.toDate();
        if (new Date() > expiresAt) return false;

        return true;
    } catch {
        return false;
    }
}
