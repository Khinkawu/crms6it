/**
 * AI Agent for LINE Bot
 * Main processor for natural language understanding and action execution
 */

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
        awaitingConfirmation?: boolean;
        awaitingImage?: boolean;
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
        // line_bindings uses lineUserId as document ID
        const bindingDoc = await getDoc(doc(db, 'line_bindings', lineUserId));

        if (!bindingDoc.exists()) return null;

        const binding = bindingDoc.data();
        const uid = binding.uid;

        if (!uid) return null;

        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) return null;

        const userData = userDoc.data();
        return {
            uid,
            displayName: userData.displayName || userData.name || 'ผู้ใช้',
            email: userData.email,
            role: userData.role || 'user',
            isPhotographer: userData.isPhotographer || false,
        };
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
    const { room, date } = params as { room?: string; date: string };

    // For simplicity, we'll show all bookings for that date
    // A more advanced implementation would calculate free slots
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        const bookingsRef = collection(db, 'bookings');
        let q = query(
            bookingsRef,
            where('date', '>=', Timestamp.fromDate(startOfDay)),
            where('date', '<=', Timestamp.fromDate(endOfDay)),
            where('status', 'in', ['pending', 'approved'])
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return room
                ? `${room} ว่างทั้งวันค่ะ วันที่ ${date}`
                : `ทุกห้องว่างค่ะ วันที่ ${date}`;
        }

        const bookings: string[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (!room || data.room === room) {
                bookings.push(`• ${data.room}: ${data.startTime}-${data.endTime} (${data.title})`);
            }
        });

        if (bookings.length === 0) {
            return `${room} ว่างทั้งวันค่ะ วันที่ ${date}`;
        }

        return `📅 การจองวันที่ ${date}\n\n${bookings.join('\n')}\n\nช่วงเวลาอื่นๆ ว่างค่ะ`;
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

async function handleMyPhotoJobs(userProfile: UserProfile): Promise<string> {
    if (!userProfile.isPhotographer) {
        return 'คุณไม่ใช่ช่างภาพในระบบค่ะ หากต้องการเป็นช่างภาพ กรุณาติดต่อผู้ดูแลระบบนะคะ';
    }

    const jobs = await getPhotoJobsByPhotographer(userProfile.uid);

    if (jobs.length === 0) {
        return 'ไม่พบงานถ่ายภาพที่ได้รับมอบหมายค่ะ';
    }

    const jobsList = jobs.map((j) => formatPhotoJobForDisplay(j)).join('\n\n');
    return `📸 งานถ่ายภาพของคุณ\n\n${jobsList}`;
}

async function handleGallerySearch(params: Record<string, unknown>): Promise<string> {
    const { keyword } = params as { keyword: string };

    const jobs = await searchGallery(keyword);

    if (jobs.length === 0) {
        return `ไม่พบรูปกิจกรรมที่ตรงกับ "${keyword}" ค่ะ ลองค้นหาคำอื่นนะคะ`;
    }

    const resultsList = jobs.map((j) => formatPhotoJobForDisplay(j)).join('\n\n');
    return `🔍 ผลการค้นหา "${keyword}"\n\n${resultsList}\n\nต้องการ Link ไหนคะ? (Drive หรือ Facebook)`;
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
        const myJobs = await getPhotoJobsByPhotographer(userProfile.email);
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
            response += `\n\n� *การจองห้องของคุณวันนี้*
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

        const prompt = `คุณเป็นช่างซ่อมคอมพิวเตอร์และอุปกรณ์ IT ที่มีประสบการณ์
        
ผู้ใช้ส่งรูปอุปกรณ์ที่มีปัญหามาพร้อมอาการ: "${symptomDescription}"

กรุณา:
1. วิเคราะห์รูปภาพและอาการ
2. แนะนำวิธีแก้ปัญหาเบื้องต้น 2-3 ข้อที่ผู้ใช้ทำได้เอง
3. บอกว่าถ้าทำแล้วยังไม่หาย จะส่งช่างไปดูให้

ตอบเป็นภาษาไทย สุภาพ เป็นกันเอง ใช้คำลงท้ายว่า "ค่ะ" หรือ "นะคะ"`;

        const result = await geminiVisionModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        return response.text();
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

    // Handle image message for repair
    if (imageBuffer && imageMimeType) {
        // If awaiting image for repair, analyze and continue flow
        if (context.pendingAction?.awaitingImage) {
            const symptom = (context.pendingAction.params?.description as string) || 'อุปกรณ์มีปัญหา';
            const analysis = await analyzeRepairImage(imageBuffer, imageMimeType, symptom);

            // Update pending action
            context.pendingAction = {
                ...context.pendingAction,
                awaitingImage: false,
                awaitingConfirmation: true,
                params: {
                    ...context.pendingAction.params,
                    imageAnalysis: analysis,
                },
            };

            await saveConversationContext(lineUserId, context);

            return `${analysis}\n\n---\nต้องการแจ้งซ่อมไหมคะ? (ตอบ "ใช่" หรือ "แจ้งซ่อม")`;
        }

        // Image sent without context - analyze what the image is
        try {
            const imagePart = imageToGenerativePart(imageBuffer, imageMimeType);

            const prompt = `วิเคราะห์รูปภาพนี้:

1. ถ้าเป็นรูปอุปกรณ์ IT/คอมพิวเตอร์/โปรเจคเตอร์/เครื่องเสียงที่มีปัญหา:
   - วิเคราะห์อาการ
   - แนะนำวิธีแก้เบื้องต้น
   - ถามว่าต้องการแจ้งซ่อมไหม

2. ถ้าเป็นรูปอื่นๆ ที่ไม่เกี่ยวกับงานซ่อม IT:
   - ตอบสั้นๆ ว่าน่าสนใจ
   - บอกว่าฉันช่วยเรื่องงานโสตทัศนูปกรณ์ได้ เช่น แจ้งซ่อม จองห้อง

ตอบเป็นภาษาไทย สุภาพ ใช้คำลงท้าย "ค่ะ" หรือ "นะคะ"`;

            const result = await geminiVisionModel.generateContent([prompt, imagePart]);
            const response = await result.response;
            const analysis = response.text();

            await saveConversationContext(lineUserId, context);

            return analysis;
        } catch (error) {
            console.error('Error analyzing image:', error);
            return 'ขออภัยค่ะ ไม่สามารถวิเคราะห์รูปภาพได้ในขณะนี้ กรุณาลองส่งใหม่อีกครั้งนะคะ 🙏';
        }
    }

    // Handle confirmation responses
    const confirmWords = ['ใช่', 'ยืนยัน', 'ตกลง', 'ok', 'yes', 'จอง', 'แจ้งซ่อม', 'แจ้ง'];
    const cancelWords = ['ไม่', 'ยกเลิก', 'cancel', 'no'];

    if (context.pendingAction?.awaitingConfirmation) {
        const lowerMessage = userMessage.toLowerCase();

        if (confirmWords.some((w) => lowerMessage.includes(w))) {
            // Execute the pending action
            const { intent, params } = context.pendingAction;
            await clearPendingAction(lineUserId);

            if (intent === 'BOOK_ROOM' && userProfile) {
                return handleBookRoom(params || {}, userProfile, true);
            }

            if (intent === 'CREATE_REPAIR' && userProfile) {
                const result = await createRepairFromAI(
                    params?.room as string,
                    params?.description as string,
                    params?.side as string,
                    params?.imageUrl as string || '',
                    userProfile.displayName,
                    userProfile.email
                );

                if (result.success) {
                    return `✅ แจ้งซ่อมสำเร็จค่ะ!\n\n🔧 Ticket: ${result.ticketId}\n📍 ${params?.room}\n📝 ${params?.description}\n\nช่างจะติดต่อกลับเร็วๆ นี้ค่ะ`;
                }
                return `❌ ${result.error}`;
            }
        }

        if (cancelWords.some((w) => lowerMessage.includes(w))) {
            await clearPendingAction(lineUserId);
            return 'ยกเลิกแล้วค่ะ มีอะไรให้ช่วยอีกไหมคะ?';
        }
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
    const noAuthIntents = ['DAILY_SUMMARY', 'CHECK_AVAILABILITY', 'GALLERY_SEARCH'];

    if (aiResponse.intent) {
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
                        await saveConversationContext(lineUserId, context);
                        return handleCheckAvailability(aiResponse.params || {});
                    case 'GALLERY_SEARCH':
                        await saveConversationContext(lineUserId, context);
                        return handleGallerySearch(aiResponse.params || {});
                    case 'DAILY_SUMMARY':
                        await saveConversationContext(lineUserId, context);
                        return handleDailySummary(userProfile);
                }
            }

            // Intents that require authentication
            if (userProfile) {
                switch (aiResponse.intent) {
                    case 'BOOK_ROOM':
                        await saveConversationContext(lineUserId, context);
                        return handleBookRoom(aiResponse.params || {}, userProfile, true);
                    case 'CHECK_REPAIR':
                        await saveConversationContext(lineUserId, context);
                        return handleCheckRepair(aiResponse.params || {}, userProfile);
                    case 'MY_BOOKINGS':
                        await saveConversationContext(lineUserId, context);
                        return handleMyBookings(userProfile);
                    case 'MY_PHOTO_JOBS':
                        await saveConversationContext(lineUserId, context);
                        return handleMyPhotoJobs(userProfile);
                }
            }
        }

        // Need confirmation for specific intents (requires auth)
        if (userProfile) {
            if (aiResponse.intent === 'BOOK_ROOM') {
                context.pendingAction = {
                    intent: 'BOOK_ROOM',
                    params: aiResponse.params || {},
                    awaitingConfirmation: true,
                };
                await saveConversationContext(lineUserId, context);
                return handleBookRoom(aiResponse.params || {}, userProfile, false);
            }

            if (aiResponse.intent === 'CREATE_REPAIR') {
                context.pendingAction = {
                    intent: 'CREATE_REPAIR',
                    params: aiResponse.params || {},
                    awaitingImage: true,
                };
                await saveConversationContext(lineUserId, context);
                return 'กรุณาส่งรูปภาพอุปกรณ์ที่มีปัญหาด้วยค่ะ เพื่อให้วิเคราะห์และแนะนำแก้ปัญหาเบื้องต้นได้นะคะ';
            }
        }
    }

    // Default: return AI response
    await saveConversationContext(lineUserId, context);
    return aiResponse.question || aiResponse.message || responseText;
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
