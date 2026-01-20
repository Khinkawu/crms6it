// lib/gemini.ts

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
        temperature: 0.4, // ลด Temperature เพื่อความแม่นยำและลดการเดา
        maxOutputTokens: 2048,
    },
    safetySettings,
});

// Vision model for image analysis
export const geminiVisionModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1024,
    },
    safetySettings,
});

// ==========================================
// STRICT SYSTEM PROMPT (UPDATED)
// ==========================================
// ==========================================
// STRICT SYSTEM PROMPT (PTCF FRAMEWORK)
// ==========================================
export const AI_SYSTEM_PROMPT = `
# PERSONA
Role: "AI ผู้ช่วยฝ่ายโสตทัศนศึกษา" (CRMS6 IT Support AI)
Identity: มืออาชีพ สุภาพ อ่อนน้อม เป็นมิตร (ลงท้าย "ค่ะ/นะคะ")
Skills: เชี่ยวชาญระบบแจ้งซ่อม, การจองห้องประชุม, และข้อมูลงานโสตฯ

# TASK
1. ให้ข้อมูลตารางการใช้ห้องและตรวจสอบสถานะห้องว่าง
2. รับแจ้งซ่อมและติดตามงานซ่อม
3. สรุปงานประจำวันสำหรับเจ้าหน้าที่
4. ค้นหาภาพกิจกรรมย้อนหลัง (Photo Gallery)
5. ค้นหาวิดีโอกิจกรรมย้อนหลัง (Video Gallery)

ข้อควรจำ: ห้ามใช้ Markdown (ตัวหนา/ตัวเอียง) ในการตอบกลับ ให้ใช้การเว้นวรรคหรือ Emoji แทน

# CONTEXT (DATA MAPPING)
**Room IDs (ต้องส่งค่าภาษาอังกฤษนี้เท่านั้น):**
[ม.ปลาย]
- ลีลาวดี/ลีลา -> "sh_leelawadee"
- หอประชุม/พลศึกษา -> "sh_auditorium"
- ห้องประชุมชั้น 3/อำนวยการ -> "sh_admin_3"
- ศาสตร์พระราชา -> "sh_king_science"
- ศูนย์ภาษา -> "sh_language_center"
[ม.ต้น]
- พญาสัตบรรณ/พญา -> "jh_phaya"
- โรงยิม/อเนกประสงค์ -> "jh_gym"
- จามจุรี -> "jh_chamchuri"

**Video Gallery Categories:**
- กีฬาสี, วันสำคัญ, ประชาสัมพันธ์, กิจกรรมอื่นๆ

**Date Handling:**
- "วันนี้" -> "today", "พรุ่งนี้" -> "tomorrow"
- วันที่ระบุ -> "YYYY-MM-DD" (เช่น "2024-12-25")

# FORMAT (JSON ONLY)
ต้องตอบกลับเป็น JSON บรรทัดเดียวเสมอตาม Structure นี้:
{
  "thought": "วิเคราะห์สิ่งที่ผู้ใช้ต้องการ...",
  "intent": "INTENT_NAME",
  "params": { ...parameter object... },
  "message": "ข้อความตอบกลับผู้ใช้ (ห้ามใช้ Markdown)"
}

# INTENTS
1. **CHECK_ROOM_SCHEDULE** (ขอตาราง/ดูคิว) -> params: { room, date }
2. **CHECK_AVAILABILITY** (เช็คว่างไหม/ระบุเวลา) -> params: { room, date, startTime, endTime }
3. **CREATE_REPAIR** (แจ้งซ่อม) -> params: { description, room }
4. **CHECK_REPAIR** (ติดตามงาน) -> params: { ticketId }
5. **MY_WORK** (งานส่วนตัว) -> params: { date }
6. **GALLERY_SEARCH** (หารูปภาพ/Photo) -> params: { keyword, date }
7. **VIDEO_GALLERY_SEARCH** (หาวิดีโอ/ดูวิดีโอ/คลิป/vtr) -> params: { keyword, date }
8. **IT_KNOWLEDGE_SEARCH** (ถามปัญหา IT/ขอรหัส/วิธีแก้) -> params: { query }
9. **DAILY_SUMMARY** (สรุปงาน) -> params: {}
10. **UNKNOWN** (ไม่เข้าใจ/คุยเล่น) -> params: {}

# EXAMPLES
User: "วันนี้ห้องลีลาวดีว่างไหม"
Bot: {"thought": "User ถามถึงสถานะห้องลีลาวดี (sh_leelawadee) วันนี้", "intent": "CHECK_ROOM_SCHEDULE", "params": {"room": "sh_leelawadee", "date": "today"}, "message": "กำลังตรวจสอบตารางห้องลีลาวดีวันนี้ให้ค่ะ..."}

User: "ขอดูวิดีโอกีฬาสีปีที่แล้ว"
Bot: {"thought": "User หาวิดีโอเกี่ยวกับงานกีฬาสี ปีที่แล้ว", "intent": "VIDEO_GALLERY_SEARCH", "params": {"keyword": "กีฬาสี", "date": "last year"}, "message": "กำลังค้นหาวิดีโอกีฬาสีให้ค่ะ..."}

User: "มี vtr โรงเรียนไหม"
Bot: {"thought": "User หาวิดีโอ VTR โรงเรียน", "intent": "VIDEO_GALLERY_SEARCH", "params": {"keyword": "vtr โรงเรียน"}, "message": "กำลังค้นหา VTR โรงเรียนให้ค่ะ..."}

User: "แจ้งซ่อมคอมห้อง 411"
Bot: {"thought": "User ต้องการแจ้งซ่อม ระบุห้อง 411 และอาการคอมเสีย", "intent": "CREATE_REPAIR", "params": {"room": "411", "description": "คอมพิวเตอร์"}, "message": "รับเรื่องแจ้งซ่อมคอมพิวเตอร์ ห้อง 411 ค่ะ"}

เริ่มการทำงานได้:`;

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
    const dateContext = `[บริบทเวลาปัจจุบัน: ${currentDate}]`;
    const fullPrompt = `${AI_SYSTEM_PROMPT}\n\n${dateContext}`;

    return geminiModel.startChat({
        history: [
            {
                role: 'user',
                parts: [{ text: fullPrompt }],
            },
            {
                role: 'model',
                parts: [{ text: 'รับทราบค่ะ พร้อมให้บริการข้อมูลระบบ CRMS6 IT อย่างเต็มรูปแบบค่ะ' }],
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

// Rank videos using AI (RAG-lite)
export async function rankVideosWithAI(userQuery: string, videos: any[]): Promise<any[]> {
    if (!videos || videos.length === 0) return [];

    console.log(`[Gemini RAG] Ranking ${videos.length} videos for query: "${userQuery}"`);

    // Prepare lightweight context for AI
    const videoListShort = videos.map(v => ({
        id: v.id,
        title: v.title,
        category: v.category,
        date: v.date,
        description: v.description ? v.description.substring(0, 100) : ''
    }));

    const prompt = `
    Analyze this user search query: "${userQuery}"
    Select the top 5 most relevant videos from this list.
    Rank them by semantic relevance (meaning > exact match).
    If a video is somewhat relevant but not exact, include it.
    If nothing is relevant, return empty list.

    Video List:
    ${JSON.stringify(videoListShort)}

    Output JSON only:
    [
        { "id": "video_id", "reason": "why it matches" }
    ]
    `;

    try {
        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Extract JSON from potential markdown blocks (using [\s\S] for dotAll compatibility)
        const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('[Gemini RAG] No JSON found in response');
            return [];
        }

        let rankedItems = JSON.parse(jsonMatch[0]);
        // Handle case if AI returns object instead of array
        if (!Array.isArray(rankedItems)) rankedItems = [rankedItems];

        console.log(`[Gemini RAG] AI selected ${rankedItems.length} videos`);

        // Re-map back to full video objects
        return rankedItems.map((item: any) => {
            const fullVideo = videos.find(v => v.id === item.id);
            return fullVideo ? { ...fullVideo, aiReason: item.reason } : null;
        }).filter(Boolean);

    } catch (error) {
        console.error('[Gemini RAG] Error ranking videos:', error);
        return videos.slice(0, 5); // Fallback to latest 5
    }
}

// Rank photos using AI (RAG-lite)
export async function rankPhotosWithAI(userQuery: string, photos: any[]): Promise<any[]> {
    if (!photos || photos.length === 0) return [];

    console.log(`[Gemini RAG] Ranking ${photos.length} photos for query: "${userQuery}"`);

    // Prepare lightweight context for AI
    const photoListShort = photos.map(p => ({
        id: p.id,
        title: p.title,
        location: p.location,
        date: p.date,
        facebookLink: p.facebookLink ? 'yes' : 'no'
    }));

    const prompt = `
    Analyze this user search query: "${userQuery}"
    Select the top 5 most relevant photo albums/jobs from this list.
    Rank them by semantic relevance (meaning > exact match).
    
    Context Mapping:
    - User asks for "รูปกีฬาสี" -> Look for "Sports Day" or related events
    - User asks for "ห้องประชุม" -> Look for title OR location
    
    Photo List:
    ${JSON.stringify(photoListShort)}

    Output JSON only:
    [
        { "id": "photo_id", "reason": "why it matches" }
    ]
    `;

    try {
        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Extract JSON from potential markdown blocks (using [\s\S] for dotAll compatibility)
        const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('[Gemini RAG] No JSON found in response');
            return [];
        }

        let rankedItems = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(rankedItems)) rankedItems = [rankedItems];

        console.log(`[Gemini RAG] AI selected ${rankedItems.length} photos`);

        // Re-map back to full objects
        return rankedItems.map((item: any) => {
            const fullPhoto = photos.find(p => p.id === item.id);
            return fullPhoto ? { ...fullPhoto, aiReason: item.reason } : null;
        }).filter(Boolean);

    } catch (error) {
        console.error('[Gemini RAG] Error ranking photos:', error);
        return photos.slice(0, 5); // Fallback to latest 5
    }
}

// Find answer from Knowledge Base (RAG-lite)
export async function findAnswerWithAI(query: string, knowledgeItems: any[]): Promise<string | null> {
    if (!knowledgeItems || knowledgeItems.length === 0) return null;

    console.log(`[Gemini RAG] Finding answer for: "${query}" from ${knowledgeItems.length} items`);

    const context = knowledgeItems.map(item => `- Q: ${item.question}\n- A: ${item.answer}\n`).join('\n');

    const prompt = `
    User Question: "${query}"

    Available Knowledge Base:
    ${context}

    Task:
    1. Find the best matching answer from the knowledge base.
    2. If found, answer politely in Thai (can paraphrase slightly to be natural).
    3. If NO matching answer found in context, answer based on your general IT knowledge, BUT start the sentence with "💡 คำแนะนำเบื้องต้น: " (General Suggestion).

    Answer:
    `;

    try {
        const result = await geminiModel.generateContent(prompt);
        const response = result.response.text().trim();

        // If the response is valid (either from KB or General Suggestion), return it.
        // We no longer return null for general questions.
        return response;

    } catch (error) {
        console.error('[Gemini RAG] Error finding answer:', error);
        return null;
    }
}