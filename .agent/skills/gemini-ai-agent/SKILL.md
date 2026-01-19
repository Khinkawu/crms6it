---
name: gemini-ai-agent
description: Gemini AI Agent development patterns for LINE Bot including function calling, multi-step conversations, vision analysis, and context management. Use when building or debugging AI-powered chatbot features.
metadata:
  author: crms6-it
  version: "1.0.0"
---

# Gemini AI Agent Development Skill

Comprehensive guide for building AI agents using Google Gemini, with focus on LINE Bot integration, function calling, and multi-step conversation flows.

## When to Apply

Reference these guidelines when:
- Implementing AI-powered chat features
- Designing multi-step conversation flows
- Adding image analysis capabilities
- Optimizing AI response quality
- Debugging intent recognition issues

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI AGENT ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LINE Bot Webhook                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Receive message → processAIMessage()                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  AI Agent (lib/aiAgent.ts)                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. Load user context from Firestore                     │   │
│  │  2. Check for pending actions / intercept keywords       │   │
│  │  3. Send to Gemini with system prompt                    │   │
│  │  4. Parse JSON response → Execute intent handler         │   │
│  │  5. Save context, return response                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────┼─────────────────────────────────┐  │
│  │                        ▼                                  │  │
│  │  Gemini API (lib/gemini.ts)                               │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Model: gemini-2.5-flash                             │ │  │
│  │  │  System Prompt + Safety Settings                     │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  Agent Functions (lib/agentFunctions.ts)                  │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Database operations via Firebase Admin SDK          │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Gemini Configuration

### Model Settings

```typescript
// lib/gemini.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Text Model
export const geminiModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
        temperature: 0.4,      // Lower = more deterministic
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
    },
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
});

// Vision Model (for image analysis)
export const geminiVisionModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1024,
    },
});
```

### Temperature Guidelines

| Use Case | Temperature | Behavior |
|----------|-------------|----------|
| Function calling | 0.2-0.4 | Consistent JSON output |
| General chat | 0.5-0.7 | Balanced creativity |
| Creative writing | 0.8-1.0 | High variety |

---

## 3. System Prompt Design

### Core Principles

```typescript
export const AI_SYSTEM_PROMPT = `
# บทบาท
คุณคือ "น้องไอที" ผู้ช่วย AI ของฝ่ายโสตทัศนศึกษา โรงเรียนเทศบาล 6

# ข้อกำหนดสำคัญ (ต้องปฏิบัติเสมอ)
1. ห้ามใช้ Markdown (ห้าม **bold**, -, *, bullet)
2. เมื่อเข้าใจ intent ให้ตอบเป็น JSON บรรทัดเดียว (minified)
3. ใช้ภาษาไทยกึ่งทางการ ลงท้ายด้วย "ค่ะ" หรือ "นะคะ"
4. แปลงชื่อห้องเป็น Room ID อัตโนมัติ (ดู mapping ด้านล่าง)
5. แปลง "วันนี้" → "today", "พรุ่งนี้" → "tomorrow"

# Intent Response Format
{"intent":"INTENT_NAME","params":{"key":"value"},"execute":false}

# Supported Intents
- CHECK_REPAIR: ตรวจสอบสถานะงานซ่อม
- CHECK_ROOM_SCHEDULE: ดูตารางห้องประชุม
- CHECK_AVAILABILITY: เช็คห้องว่างช่วงเวลา
- MY_WORK: ดูงานของฉัน (แบ่งตาม role)
- GALLERY_SEARCH: ค้นหารูปกิจกรรม
- CREATE_REPAIR: แจ้งซ่อม
- DAILY_SUMMARY: สรุปงานประจำวัน

# Room ID Mapping
ห้องลีลาวดี = sh_leelawadee
ห้องพญาสัตบรรณ = jh_phaya
หอประชุม = sh_auditorium
ห้องจามจุรี = jh_chamchuri
`;
```

### Key Design Patterns

1. **JSON-only for intents**: Forces structured output
2. **No Markdown rule**: LINE doesn't render markdown well
3. **Room mapping in prompt**: AI learns mappings naturally
4. **Date normalization**: Consistent date handling

---

## 4. Function Calling Pattern

### Intent Detection → Handler Execution

```typescript
// lib/aiAgent.ts

// 1. Parse AI response to extract intent
function parseAIResponse(responseText: string): AIResponse {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try { 
            return JSON.parse(jsonMatch[0]); 
        } catch { }
    }
    return { message: responseText };
}

// 2. Route to appropriate handler
const aiRes = parseAIResponse(responseText);

if (aiRes.intent) {
    switch (aiRes.intent) {
        case 'CHECK_REPAIR':
            reply = await handleCheckRepair(aiRes.params, userProfile);
            break;
        case 'CHECK_ROOM_SCHEDULE':
            reply = await handleRoomSchedule(aiRes.params);
            break;
        case 'MY_WORK':
            reply = await handleMyWork(userProfile, aiRes.params);
            break;
        // ... more intents
    }
}
```

### Handler Pattern

```typescript
async function handleCheckRepair(
    params: Record<string, unknown>, 
    userProfile: UserProfile
): Promise<string> {
    const { ticketId } = params as { ticketId?: string };
    
    if (ticketId) {
        const repair = await getRepairByTicketId(ticketId);
        if (!repair) return `ไม่พบงานซ่อม Ticket ID: ${ticketId} ค่ะ`;
        return formatRepairStatus(repair);
    }
    
    const repairs = await getRepairsByEmail(userProfile.email);
    if (repairs.length === 0) return 'ไม่พบรายการแจ้งซ่อมของคุณค่ะ';
    
    return formatRepairList(repairs);
}
```

---

## 5. Multi-Step Conversation Flow

### State Machine for Repair Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User: "แจ้งซ่อมคอม"                                              │
├─────────────────────────────────────────────────────────────────┤
│ Step 1: awaiting_symptom → "อาการเป็นอย่างไรคะ?"                  │
├─────────────────────────────────────────────────────────────────┤
│ User: "เปิดไม่ติด"                                               │
├─────────────────────────────────────────────────────────────────┤
│ Step 2: awaiting_image → "ส่งรูปมาได้ไหมคะ?"                      │
├─────────────────────────────────────────────────────────────────┤
│ User: [ส่งรูป] → analyzeRepairImage()                            │
├─────────────────────────────────────────────────────────────────┤
│ Step 3: awaiting_intent_confirm → "[วิเคราะห์] แจ้งซ่อมไหมคะ?"   │
├─────────────────────────────────────────────────────────────────┤
│ User: "ยืนยัน"                                                   │
├─────────────────────────────────────────────────────────────────┤
│ Step 4: awaiting_room → "สถานที่/ห้องที่มีปัญหาคะ?"              │
├─────────────────────────────────────────────────────────────────┤
│ User: "ห้อง 401"                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Step 5: awaiting_side → "ฝั่ง ม.ต้น หรือ ม.ปลาย?"               │
├─────────────────────────────────────────────────────────────────┤
│ User: "ม.ปลาย"                                                   │
├─────────────────────────────────────────────────────────────────┤
│ ✅ createRepairFromAI() → แจ้งซ่อมสำเร็จ!                        │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
interface ConversationContext {
    messages: { role: 'user' | 'model'; content: string; timestamp: Date }[];
    pendingAction?: {
        intent: string;
        params: Record<string, any>;
        repairStep?: 'awaiting_symptom' | 'awaiting_image' | 'awaiting_room' | ...;
    };
    lastActivity: Date;
}

// Step handling
if (context.pendingAction?.intent === 'CREATE_REPAIR') {
    const { repairStep, params } = context.pendingAction;
    
    if (repairStep === 'awaiting_symptom') {
        context.pendingAction.params.description = userMessage;
        context.pendingAction.repairStep = 'awaiting_image';
        return 'มีรูปถ่ายอาการไหมคะ? (ส่งรูป หรือตอบ "ไม่มี")';
    }
    
    if (repairStep === 'awaiting_image') {
        // Handle image or skip
    }
    
    // ... more steps
}
```

---

## 6. Context Management

### Configuration

```typescript
const CONTEXT_EXPIRY_MINUTES = 30;  // Context expires after 30 min
const MAX_CONTEXT_MESSAGES = 10;    // Keep last 10 messages
```

### Firestore Storage

```typescript
// Collection: ai_conversations
// Document ID: LINE User ID
{
    messages: [
        { role: 'user', content: 'สวัสดีครับ', timestamp: Timestamp },
        { role: 'model', content: 'สวัสดีค่ะ...', timestamp: Timestamp }
    ],
    pendingAction: {
        intent: 'CREATE_REPAIR',
        params: { description: 'เปิดไม่ติด' },
        repairStep: 'awaiting_room'
    },
    lastActivity: Timestamp
}
```

### Context Functions

```typescript
async function getConversationContext(lineUserId: string): Promise<Context | null> {
    const doc = await adminDb.collection('ai_conversations').doc(lineUserId).get();
    if (!doc.exists) return null;
    
    const data = doc.data()!;
    const lastActivity = data.lastActivity?.toDate() || new Date();
    
    // Check expiry
    const minutesSince = (Date.now() - lastActivity.getTime()) / 1000 / 60;
    if (minutesSince > CONTEXT_EXPIRY_MINUTES) return null;
    
    return { messages: data.messages || [], pendingAction: data.pendingAction, lastActivity };
}

async function saveConversationContext(lineUserId: string, context: Context): Promise<void> {
    // Trim to MAX_CONTEXT_MESSAGES
    const trimmedMessages = context.messages.slice(-MAX_CONTEXT_MESSAGES);
    
    await adminDb.collection('ai_conversations').doc(lineUserId).set({
        messages: trimmedMessages,
        pendingAction: context.pendingAction || null,
        lastActivity: FieldValue.serverTimestamp(),
    });
}
```

---

## 7. Vision Model Integration

### Image Analysis for Repair

```typescript
export async function analyzeRepairImage(
    imageBuffer: Buffer, 
    mimeType: string, 
    symptomDescription: string
): Promise<string> {
    const imagePart = imageToGenerativePart(imageBuffer, mimeType);
    
    const prompt = `
บทบาท: คุณคือผู้เชี่ยวชาญด้าน IT และโสตทัศนูปกรณ์

งานของคุณ: วิเคราะห์รูปภาพอุปกรณ์ที่ผู้ใช้ส่งมา

กรณีรูปเป็นอุปกรณ์ IT/โสตฯ:
1. วิเคราะห์อาการหรือความผิดปกติที่เห็น
2. แนะนำวิธีแก้ไขเบื้องต้น 2-3 ข้อ
3. ถามปิดท้าย "ต้องการเปิดใบแจ้งซ่อมไหมคะ?"

กรณีรูปเป็นสิ่งอื่น:
- แจ้งอย่างสุภาพว่าระบบรองรับเฉพาะงานแจ้งซ่อม IT
`;

    const result = await geminiVisionModel.generateContent([prompt, imagePart]);
    return result.response.text();
}
```

### Image Part Helper

```typescript
export function imageToGenerativePart(buffer: Buffer, mimeType: string) {
    return {
        inlineData: {
            data: buffer.toString('base64'),
            mimeType,
        },
    };
}
```

---

## 8. Role-Based Logic

### MY_WORK Handler by Role

```typescript
async function handleMyWork(userProfile: UserProfile): Promise<string> {
    let response = `👤 งานของ ${userProfile.displayName}\n\n`;

    // Technician: Show repairs in their zone
    if (userProfile.role === 'technician') {
        const repairs = await getRepairsForTechnician(userProfile.responsibility);
        response += formatRepairList(repairs);
    }

    // Photographer: Show photo assignments
    if (userProfile.isPhotographer) {
        const photoJobs = await getPhotoJobsByPhotographer(userProfile.uid);
        response += formatPhotoJobs(photoJobs);
    }

    // Moderator/Admin: Show pending approvals
    if (['moderator', 'admin'].includes(userProfile.role)) {
        const pendingBookings = await getPendingBookings();
        response += formatPendingBookings(pendingBookings);
    }

    return response;
}
```

---

## 9. Best Practices

### ✅ Do

```typescript
// ✅ Clear context after completing multi-step flow
context.messages = [];
context.pendingAction = undefined;
await saveConversationContext(lineUserId, context);

// ✅ Handle cancel keywords at any step
if (['ยกเลิก', 'cancel'].includes(msg.toLowerCase())) {
    await clearPendingAction(lineUserId);
    return 'ยกเลิกเรียบร้อยค่ะ';
}

// ✅ Use Firebase Admin SDK for server-side DB operations
import { adminDb } from '@/lib/firebaseAdmin';
```

### ❌ Don't

```typescript
// ❌ Don't use client-side Firebase in AI agent
import { db } from '@/lib/firebase';  // Wrong! Use adminDb

// ❌ Don't store large data in context
context.pendingAction.params.fullImage = hugeBase64;  // Limit size

// ❌ Don't forget to handle the "no user profile" case
if (!userProfile) {
    return 'กรุณาผูกบัญชีก่อนใช้งานค่ะ';
}
```

---

## 10. Debugging

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| AI returns plain text instead of JSON | System prompt not enforced | Reinforce JSON output in prompt |
| Intent not recognized | Ambiguous user input | Add more examples to prompt |
| Context lost mid-flow | Expiry too short / not saved | Check CONTEXT_EXPIRY_MINUTES |
| Wrong room ID mapping | Missing mapping in prompt | Add to ROOM_MAPPING |

### Debug Logging

```typescript
console.log('[AI Agent] Input:', userMessage);
console.log('[AI Agent] Context:', JSON.stringify(context.pendingAction));
console.log('[AI Agent] AI Response:', responseText);
console.log('[AI Agent] Parsed Intent:', aiRes.intent, aiRes.params);
```

---

## 11. Feedback Format

- **[AI-CRITICAL]**: AI completely non-responsive or crashing
- **[AI-INTENT]**: Wrong intent recognition
- **[AI-FLOW]**: Multi-step flow broken
- **[AI-CONTEXT]**: Context not persisted correctly
- **[AI-VISION]**: Image analysis issues
- **[AI-RESPONSE]**: Response quality issues (too long, wrong tone)
