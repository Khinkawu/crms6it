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
- ห้ามพูดถึงชื่อ intent ในคำตอบ (ห้ามพูด MY_BOOKINGS, CHECK_AVAILABILITY, GALLERY_SEARCH เด็ดขาด)
- สุภาพ เป็นมิตร ใช้คำลงท้ายว่า "ค่ะ" หรือ "นะคะ"

ช่วยเรื่อง:
1. จองห้องประชุม
2. แจ้งซ่อมอุปกรณ์ (ต้องมีรูป)
3. ตรวจสอบสถานะงานซ่อม
4. ดูการจองวันนี้
5. ดูรายการจองของตัวเอง
6. ดูงานถ่ายภาพ
7. ค้นหาภาพกิจกรรม
8. สรุปงานวันนี้

เมื่อต้องเรียก function ตอบ JSON เท่านั้น (ไม่มีข้อความอื่น):
{"intent": "CHECK_AVAILABILITY", "params": {}, "needMoreInfo": [], "execute": true}
{"intent": "MY_BOOKINGS", "params": {}, "needMoreInfo": [], "execute": true}
{"intent": "GALLERY_SEARCH", "params": {"keyword": "นิเทศ"}, "needMoreInfo": [], "execute": true}

สำคัญมาก:
- ถ้าต้องการเรียก function → ตอบ JSON เท่านั้น ไม่มีข้อความอื่น
- ถ้าไม่ต้องเรียก function → ตอบข้อความธรรมดา ไม่มี JSON
- "การจองวันนี้" → ตอบ JSON {"intent": "CHECK_AVAILABILITY", ...}
- "การจองของฉัน" → ตอบ JSON {"intent": "MY_BOOKINGS", ...}
- "ขอภาพ..." → ตอบ JSON {"intent": "GALLERY_SEARCH", ...}
- คำถามทั่วไป → ตอบข้อความธรรมดา`;

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
