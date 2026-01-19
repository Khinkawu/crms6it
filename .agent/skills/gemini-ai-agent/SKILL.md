---
name: gemini-ai-agent
description: Advanced Gemini AI Agent development guide including PTCF prompting, ReAct patterns, Zod validation, and hybrid state machine architecture.
metadata:
  author: crms6-it
  version: "2.0.0"
---

# 🤖 Advanced Gemini AI Agent Skill

คู่มือพัฒนา AI Agent บน LINE Bot โดยใช้ **Gemini 2.5 Flash** ด้วยเทคนิคระดับสูง (Agentic Patterns 2025)

---

## 🏗️ Architecture Design

### Hybrid Model: State Machine + ReAct

เราใช้โมเดลผสมผสานเพื่อให้ Bot มีความเสถียร (Reliability) แต่ยังยืดหยุ่น (Flexibility)

| Component | Responsibility | เหมาะกับ |
|-----------|----------------|----------|
| **State Machine** | ควบคุม Flow ที่มีลำดับชัดเจน | แจ้งซ่อม, จองห้อง, ยืนยันข้อมูล |
| **ReAct Agent** | คิดวิเคราะห์และเลือก Tool | ตอบคำถามทั่วไป, ช่วยเหลือ, ค้นหาข้อมูล |

#### Flow Diagram
```mermaid
graph TD
    UserData[User Message] --> determining{Check Context State}
    determining -->|In Flow| StateHandler[Execute State Logic]
    determining -->|Idle| Router[Intent Router (AI)]
    
    Router -->|Ask Info| ReAct[AI Answer]
    Router -->|Action| FunctionCall[Execute Function]
    Router -->|Start Flow| SetState[Set Context State]
    
    SetState --> StateHandler
```

---

## 📝 Prompt Engineering (PTCF Framework)

มาตรฐาน Google 2025: **P**ersona, **T**ask, **C**ontext, **F**ormat

### System Prompt Template

```typescript
const SYSTEM_PROMPT = `
# PERSONA
คุณคือ "IT Support Agent" ของโรงเรียนเทศบาล 6 นครเชียงราย
บุคลิก: สุภาพ, กระตือรือร้น, เชี่ยวชาญด้านไอที, ใช้ภาษาไทยที่เป็นธรรมชาติ (มี "ครับ" ลงท้าย)

# TASK
หน้าที่หลักของคุณคือ:
1. รับเรื่องแจ้งซ่อมคอมพิวเตอร์และอุปกรณ์ไอที
2. ช่วยเหลือการจองห้องประชุมและห้องคอมฯ
3. ตอบคำถามพื้นฐานเกี่ยวกับการใช้งานระบบ

# CONTEXT
- เวลาปัจจุบัน: ${new Date().toLocaleString('th-TH')}
- ผู้ใช้งาน: ${user.displayName} (Role: ${user.role})
- สถานที่: อาคาร CT, อาคาร 4, อาคาร 7
- กฎเหล็ก: ห้ามตอบเรื่องการเมือง ศาสนา และเรื่องส่วนตัวที่ไม่เกี่ยวกับงาน

# FORMAT
ตอบกลับเป็น JSON เสมอตาม Schema นี้:
{
  "thought": "วิเคราะห์สิ่งที่ผู้ใช้ต้องการ...",
  "reply": "ข้อความตอบกลับผู้ใช้",
  "action": "ชื่อฟังก์ชันที่จะเรียก (ถ้ามี)",
  "parameters": { ... }
}
`;
```

---

## 🛡️ Function Calling Reliability

ใช้ **Zod** เพื่อ Validate parameters ที่ AI ส่งมา ป้องกัน Hallucination

### 1. Define Schema with Zod

```typescript
import { z } from "zod";

// Schema สำหรับฟังก์ชันแจ้งซ่อม
const CreateRepairSchema = z.object({
  description: z.string().min(5, "ระบุอาการเสียให้ละเอียดกว่านี้หน่อยครับ"),
  room: z.string().regex(/^[0-9]{3,4}$/, "รหัสห้องต้องเป็นตัวเลข 3-4 หลัก"),
  zone: z.enum(["junior", "senior"], "ระบุโซนให้ถูกต้อง (ม.ต้น/ม.ปลาย)"),
});

type CreateRepairParams = z.infer<typeof CreateRepairSchema>;
```

### 2. Safe Execution Wrapper

```typescript
async function safeExecute<T>(
  schema: z.ZodSchema<T>,
  input: any,
  fn: (params: T) => Promise<any>
) {
  const result = schema.safeParse(input);
  
  if (!result.success) {
    // AI ส่ง params ผิด -> แจ้ง AI ให้ถามใหม่
    return {
      status: "error",
      message: `Invalid parameters: ${result.error.issues[0].message}. Please ask user again.`,
    };
  }
  
  try {
    return await fn(result.data);
  } catch (error) {
    return { status: "error", message: `System error: ${error.message}` };
  }
}
```

---

## 🔄 Multi-step Reasoning (Chain of Thought)

สอนให้ AI "คิด" ก่อน "ทำ" เพื่อลดความผิดพลาด

**User:** "คอมห้อง 314 เปิดไม่ติด จอดับ"

**AI Thinking Process:**
1. **Analyze:** ผู้ใช้แจ้งปัญหา (แจ้งซ่อม)
2. **Missing Info:** ได้อาการ (เปิดไม่ติด), ห้อง (314) -> ขาด "โซน" และ "ชื่อผู้แจ้ง"
3. **Decide:** ต้องถามข้อมูลเพิ่มก่อนสร้าง Ticket
4. **Action:** ถามกลับ "ขอทราบชื่อผู้แจ้งด้วยครับ และห้อง 314 อยู่โซนไหนครับ?"

**Implementation:**
ใช้ฟิลด์ `thought` ใน JSON response เพื่อดูวิธีคิดของ AI (Debugging ได้ดีมาก)

---

## 🐞 Debugging AI Logic

### Trace Logs
บันทึก Conversation ID และ Thought Process ลง Firestore เพื่อตรวจสอบภายหลัง

```typescript
// log/ai_traces/{traceId}
{
  userId: "...",
  input: "คอมพัง",
  aiThought: "User แจ้งปัญหาแต่ข้อมูลไม่ครบ",
  aiFunctionCall: null,
  aiResponse: "คอมพิวเตอร์มีอาการยังไงครับ?",
  timestamp: ...
}
```

### Evaluation
เช็คว่า AI ตัดสินใจถูกไหมจาก Logs:
- [ ] AI เข้าใจ Intent ถูกต้อง?
- [ ] AI เรียก Function ถูกตัว?
- [ ] AI Extract parameters ครบถ้วน?

---

## 📦 Ready-to-use Patterns

### 1. Intent Router
```typescript
async function routeIntent(message: string) {
  const needsTools = await gemini.generateContent({
    prompt: `Analyze intent: "${message}". Return one: [SEARCH, REPAIR, BOOKING, CHAT]`,
  });
  // Route to specific handler
}
```

### 2. Image Vision Handler
```typescript
async function handleImage(imageBuffer: Buffer) {
  const analysis = await geminiVision.generateContent([
    "ภาพนี้คืออุปกรณ์อะไร? มีความเสียหายตรงไหน?",
    imageBuffer
  ]);
  return analysis.text();
}
```

---

## 🔗 Related Skills
- `typescript-patterns/SKILL.md` - สำหรับ Type safety
- `firebase-debug/SKILL.md` - สำหรับตรวจสอบ Logs ใน Firestore
