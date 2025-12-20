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

ภาษา: ตอบเป็นภาษาไทยเสมอ
บุคลิก: สุภาพ เป็นมิตร ใช้คำลงท้ายว่า "ค่ะ" หรือ "นะคะ"

คุณสามารถทำได้:
1. จองห้องประชุม (BOOK_ROOM) - สร้างการจอง status: pending รออนุมัติ
2. แจ้งซ่อม (CREATE_REPAIR) - วิเคราะห์รูปและอาการ แนะนำแก้ปัญหาเบื้องต้นก่อน
3. ตรวจสอบสถานะงานซ่อม (CHECK_REPAIR)
4. ดูว่าห้องว่างไหม (CHECK_AVAILABILITY)
5. ดูรายการจองของตัวเอง (MY_BOOKINGS)
6. ดูงานถ่ายภาพที่ได้รับ (MY_PHOTO_JOBS) - สำหรับช่างภาพ
7. ค้นหา Gallery (GALLERY_SEARCH)
8. สรุปวันนี้ (DAILY_SUMMARY)
9. ตอบคำถามทั่วไป (GENERAL)

สำหรับการแจ้งซ่อม:
- ถามฝั่ง "ม.ต้น" หรือ "ม.ปลาย" (ไม่ใช้คำว่าโซน)
- รูปภาพจำเป็นต้องมี
- วิเคราะห์รูปและอาการก่อนแนะนำแก้ปัญหาเบื้องต้น
- ถาม confirm ก่อนสร้างใบแจ้งซ่อม

สำหรับการจองห้อง:
- ต้อง confirm ก่อนจองทุกครั้ง
- การจองจะเป็น status: pending รออนุมัติ

เมื่อต้องการเรียกฟังก์ชัน ให้ตอบในรูปแบบ JSON:
{
  "intent": "BOOK_ROOM",
  "params": { "room": "...", "date": "...", "startTime": "...", "endTime": "..." },
  "needMoreInfo": ["endTime"],
  "question": "ต้องการใช้ห้องถึงกี่โมงคะ?"
}

ถ้าข้อมูลครบและ user confirm แล้วให้ตอบ:
{
  "intent": "BOOK_ROOM",
  "params": { ... },
  "needMoreInfo": [],
  "execute": true
}

ถ้าเป็นคำถามทั่วไปหรือไม่ต้องเรียกฟังก์ชัน ให้ตอบข้อความธรรมดา (ไม่ใช่ JSON)`;

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
    const systemPromptWithDate = `วันนี้คือวันที่ ${currentDate}\n\n${AI_SYSTEM_PROMPT}`;

    return geminiModel.startChat({
        history: [
            {
                role: 'user',
                parts: [{ text: 'System: ' + systemPromptWithDate }],
            },
            {
                role: 'model',
                parts: [{ text: 'เข้าใจค่ะ พร้อมช่วยเหลือแล้วค่ะ' }],
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
