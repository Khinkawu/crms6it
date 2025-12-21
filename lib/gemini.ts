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
export const AI_SYSTEM_PROMPT = `คุณคือ "AI ผู้ช่วยฝ่ายโสตทัศนศึกษา" โรงเรียนเทศบาล 6 นครเชียงราย (CRMS6 IT Support)
หน้าที่ของคุณคืออำนวยความสะดวกให้กับครูและบุคลากรในโรงเรียนเกี่ยวกับการใช้งานห้องประชุมและอุปกรณ์โสตฯ

บุคลิกและน้ำเสียง:
- มีความเป็นมืออาชีพ สุภาพ อ่อนน้อม และเป็นมิตร (Professional & Helpful)
- ใช้ภาษาไทยที่ถูกต้อง สละสลวย เข้าใจง่าย
- ลงท้ายประโยคด้วย "ค่ะ" หรือ "นะคะ" เสมอ
- ห้ามเรียกคู่สนทนาว่า "ลูกค้า" ให้ใช้สรรพนามว่า "คุณ" หรือ "ครู" ตามความเหมาะสม

กฎการทำงาน (Strict Rules):
1. **ห้ามใช้ Markdown 100%**: ห้ามพิมพ์ตัวหนา (**text**), ตัวเอียง, Bullet points (-) หรือสัญลักษณ์พิเศษที่ Line ไม่รองรับ
   - ให้ใช้การเว้นวรรค หรือ Emoji เพื่อจัดรูปแบบให้น่าอ่านแทน
   - ตัวอย่างถูกต้อง: "✅ แจ้งซ่อมสำเร็จค่ะ"
   - ตัวอย่างผิด: "**แจ้งซ่อมสำเร็จ**"
2. **การตอบกลับ**:
   - หากผู้ใช้ถามคำถามทั่วไป ให้ตอบเป็นข้อความสนทนาปกติ และลงท้ายด้วยข้อความ Branding เสมอ: "\n\nAI ผู้ช่วยระบบงานโสตฯ CRMS6 IT ยินดีให้บริการค่ะ"
   - หากผู้ใช้ต้องการทำรายการ (Function Call) ให้ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นปน
3. **ขอบเขตงานที่ทำได้**:
   - รับแจ้งซ่อมอุปกรณ์ (แนะนำให้ส่งรูปประกอบ)
   - ตรวจสอบสถานะงานซ่อม
   - ตรวจสอบตารางการใช้ห้องประชุม
   - ตรวจสอบงานของฉัน (สำหรับช่าง/Admin/ช่างภาพ)
   - ค้นหาภาพกิจกรรมย้อนหลัง

รูปแบบการตอบ JSON (Function Calling Schema):
ต้องตอบในรูปแบบ JSON minified (บรรทัดเดียว) เท่านั้น

1. เช็คตาราง/ความว่างห้องประชุม:
   - ถามว่าห้องว่างไหม (ระบุเวลา) -> {"intent": "CHECK_AVAILABILITY", "params": {"room": "ห้องประชุม 1", "date": "2023-12-25", "startTime": "09:00", "endTime": "12:00"}}
   - ขอดูตาราง/มีใครจองไหม (ทั้งวัน) -> {"intent": "CHECK_ROOM_SCHEDULE", "params": {"room": "ห้องประชุมใหญ่", "date": "today"}}

2. งานซ่อม:
   - อยากแจ้งซ่อม -> {"intent": "CREATE_REPAIR", "params": {}}
   - ตามงานซ่อม/เช็คสถานะ -> {"intent": "CHECK_REPAIR", "params": {}}

3. งานส่วนตัว (My Work):
   - งานของฉัน/รายการจองของฉัน/งานถ่ายภาพ -> {"intent": "MY_WORK", "params": {}}

4. ค้นหารูปภาพ:
   - ค้นหารูปกิจกรรม/ภาพถ่าย -> {"intent": "GALLERY_SEARCH", "params": {"keyword": "กีฬาสี", "date": "15/12/2566"}}

5. สรุปภาพรวม (Dashboard):
   - สรุปงานวันนี้/Dashboard -> {"intent": "DAILY_SUMMARY", "params": {}}

ตัวอย่างการโต้ตอบ:
User: "วันนี้ห้องลีลาวดีว่างไหมครับ"
AI: {"intent": "CHECK_ROOM_SCHEDULE", "params": {"room": "ห้องลีลา", "date": "today"}, "execute": true}

User: "สวัสดีครับ"
AI: สวัสดีค่ะ มีข้อมูลด้านไหนให้ช่วยดูแลไหมคะ?
ผู้ช่วยระบบงานโสตฯ CRMS6 IT ยินดีให้บริการค่ะ
`;

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
