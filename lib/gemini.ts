/**
 * Gemini AI Client Configuration
 * Used for AI Agent in LINE Bot
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// Safety settings - allow general content but block harmful
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
];

// Text-only model for general chat
export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
    },
    safetySettings,
});

// Vision model for image analysis (repair reports)
export const geminiVisionModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1024,
    },
    safetySettings,
});

// System prompt for the AI Agent
export const AI_SYSTEM_PROMPT = `คุณเป็นผู้ช่วย AI ของระบบบริหารจัดการงานโสตทัศนูปกรณ์ CRMS6 IT โรงเรียนเทศบาล 6 นครเชียงราย

กฎสำคัญ:
- ตอบเป็นภาษาไทยเสมอ
- ห้ามใช้ markdown (ห้ามใช้ ** หรือ __ หรือ # เด็ดขาด)
- ห้ามเรียกคู่สนทนาว่า "ลูกค้า" หรือ "เรียนผู้ใช้" ให้ใช้คำว่า "คุณ" เท่านั้น
- สุภาพ เป็นมิตร ใช้คำลงท้ายว่า "ค่ะ" หรือ "นะคะ"

ช่วยเรื่อง:
1. จองห้องประชุม (BOOK_ROOM)
2. แจ้งซ่อมอุปกรณ์ - ต้องมีรูป (CREATE_REPAIR)
3. ตรวจสอบสถานะงานซ่อม (CHECK_REPAIR)
4. ดูการจองวันนี้ (CHECK_AVAILABILITY) - ทุกคนดูได้
5. ดูรายการจองของตัวเอง (MY_BOOKINGS) - ต้อง login
6. ดูงานถ่ายภาพ (MY_PHOTO_JOBS)
7. ค้นหาภาพกิจกรรม (GALLERY_SEARCH)
8. สรุปงานวันนี้ (DAILY_SUMMARY)

เมื่อต้องเรียก function ตอบ JSON:

ถ้าจะถามข้อมูลเพิ่ม:
{"intent": "BOOK_ROOM", "params": {"room": "ลีลาวดี"}, "needMoreInfo": ["date"], "question": "คุณต้องการจองวันไหนคะ?"}

ถ้าพร้อมดำเนินการ:
{"intent": "CHECK_AVAILABILITY", "params": {"date": "today"}, "needMoreInfo": [], "execute": true}
{"intent": "MY_BOOKINGS", "params": {}, "needMoreInfo": [], "execute": true}
{"intent": "GALLERY_SEARCH", "params": {"keyword": "นิเทศ"}, "needMoreInfo": [], "execute": true}

สำคัญ:
- "การจองวันนี้" / "มีประชุมอะไรบ้าง" → CHECK_AVAILABILITY
- "การจองของฉัน" → MY_BOOKINGS
- "ขอภาพ..." → GALLERY_SEARCH
- คำถามทั่วไป ตอบข้อความธรรมดา (ไม่ใช่ JSON)`;

// Helper function to get current date in Thai format
function getCurrentDateThai(): string {
    const now = new Date();
    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const day = now.getDate();
    const month = thaiMonths[now.getMonth()];
    const buddhistYear = now.getFullYear() + 543;
    return `${day} ${month} ${buddhistYear}`;
}

// Helper function to start a chat with system prompt
export function startAIChat(history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []) {
    const currentDate = getCurrentDateThai();
    const dateContext = `[ข้อมูลวันนี้: ${currentDate}]`;
    const systemPromptWithDate = `${AI_SYSTEM_PROMPT}\n\n${dateContext}`;

    return geminiModel.startChat({
        history: [
            {
                role: 'user',
                parts: [{ text: systemPromptWithDate }],
            },
            {
                role: 'model',
                parts: [{ text: 'พร้อมช่วยเหลือค่ะ' }],
            },
            ...history,
        ],
    });
}

// Helper to convert image buffer to Gemini format
export function imageToGenerativePart(imageBuffer: Buffer, mimeType: string) {
    return {
        inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType,
        },
    };
}
