import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { geminiModel, AI_SYSTEM_PROMPT } from '@/lib/gemini';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        // Authenticate the request
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
            await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { title, location, date, description, bookingId } = body as {
            title: string;
            location?: string;
            date?: string;
            description?: string;
            bookingId?: string;
        };

        if (!title) {
            return NextResponse.json({ error: 'Job title is required' }, { status: 400 });
        }

        // Fetch Booking Data for additional context if available
        let bookingDescription = '';
        if (bookingId) {
            try {
                const bookingDoc = await adminDb.collection('bookings').doc(bookingId).get();
                if (bookingDoc.exists) {
                    const bookingData = bookingDoc.data();
                    if (bookingData?.description) {
                        bookingDescription = bookingData.description;
                    }
                }
            } catch (e) {
                logger.error('Auto-Caption API', 'Error fetching booking data', e);
            }
        }

        // Fetch recent completed jobs with facebook captions to use as few-shot examples
        const recentJobsSnapshot = await adminDb.collection('photography_jobs')
            .where('status', '==', 'completed')
            .orderBy('completedAt', 'desc')
            .limit(15)
            .get();

        const historicalCaptions: string[] = [];

        recentJobsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.facebookCaption && typeof data.facebookCaption === 'string' && data.facebookCaption.trim().length > 0) {
                if (historicalCaptions.length < 5) { // Limit to 5 best recent examples to learn executive names
                    historicalCaptions.push(data.facebookCaption.trim());
                }
            }
        });

        const promptCtx = historicalCaptions.length > 0
            ? `ตัวอย่างแคปชั่นในอดีต (เรียนรู้สไตล์จากข้อความเหล่านี้ โดยเฉพาะ "ชื่อและตำแหน่ง" ของผู้บริหาร/บุคคลสำคัญ):\n${historicalCaptions.map((c, i) => `--- ตัวอย่างที่ ${i + 1} ---\n${c}`).join('\n\n')}`
            : 'ยังไม่มีตัวอย่างแคปชั่นในอดีต ให้เขียนในสไตล์แอดมินเพจโรงเรียน ทางการแต่เป็นมิตร';

        const prompt = `
# ROLE
คุณคือ PR ช่างภาพและแอดมินเพจ Facebook ของโรงเรียน (CRMS6 IT) 
เป้าหมายของคุณคือการเขียน Facebook Caption สำหรับอัลบั้มภาพกิจกรรม

# TASK
เขียนแคปชั่น Facebook 1 โพสต์ สำหรับงานกิจกรรมต่อไปนี้:
- ชื่องาน: ${title}
- สถานที่: ${location || 'ไม่ระบุ'}
- วันที่: ${date || 'ไม่ระบุ'}

# CONTEXT & SCHEDULE (บริบทและกำหนดการที่เกี่ยวข้อง)
[รายละเอียดเพิ่มเติมจากระบบ]: ${description || '-'}
[วาระ/กำหนดการจากการจองห้อง]: ${bookingDescription || '-'}

หากมีข้อมูลกำหนดการหรือรายชื่อบุคคลสำคัญด้านบน ให้นำมาใช้ประกอบการเขียนแคปชั่นเพื่อความถูกต้องแม่นยำยิ่งขึ้น

# RULES
1. **ประธานในพิธีสำคัญมาก**: ให้ดึงข้อมูล "ผู้บริหาร/ประธานที่กล่าวเปิดงาน" หรือบุคคลสำคัญที่มีบทบาทหลัก (เช่น ผู้อำนวยการโรงเรียน, นายกเทศมนตรีนครเชียงราย ฯลฯ) มาไว้เป็นจุดเด่นตอนเริ่มของโพสต์ โดยอ้างอิงและตรวจสอบชื่อ/ตำแหน่งที่ถูกต้องจากตัวอย่างในอดีต หากเป็นรองผู้อำนวยการมาเปิดแทน ต้องขึ้นต้นด้วยชื่อผู้อำนวยการ มอบหมายให้...
2. **เนื้อหากระชับ**: ไม่ต้องดึงเนื้อหาหรือกำหนดการย่อยๆ มาทั้งหมด ให้คัดมาและ "สรุปรวมเป็นหัวข้อหลักที่สำคัญ" เพื่อความกระชับ
3. **สำคัญที่สุด**: ต้องเขียนให้จบประโยคสมบูรณ์เสมอ ห้ามเขียนข้อความขาดตอนหรือประโยคครึ่งๆ กลางๆ เด็ดขาด
4. ใช้ภาษาที่เป็นทางการแต่เป็นกันเอง อ่านง่าย สุภาพ **และห้ามมีคำลงท้าย ครับ/ค่ะ เด็ดขาด ให้ใช้รูปประโยคแบบบรรยายหรือบทความที่สมบูรณ์ในตัวเอง**
5. **ห้ามใช้ Emoji เด็ดขาด**
6. พยายามรักษา "โทนเสียง (Tone of Voice)" ให้คล้ายคลึงกับตัวอย่างในอดีต (ถ้ามี)
7. มีการเว้นบรรทัดให้น่าอ่าน
8. **ห้ามใส่ Hashtag เด็ดขาด**
9. คืนค่ามาเฉพาะ "ข้อความแคปชั่นที่เนื้อหาครบถ้วนและจบสมบูรณ์แล้ว" เท่านั้น ห้ามมีข้อความเกริ่นนำหรือลงท้ายของ AI เด็ดขาด

# HISTORY CONTEXT
${promptCtx}
`;

        // We use geminiModel to generate the text
        const result = await geminiModel.generateContent(prompt);
        const generatedText = result.response.text().trim();

        if (!generatedText) {
            throw new Error("AI returned empty text");
        }

        return NextResponse.json({ success: true, caption: generatedText });

    } catch (error: any) {
        logger.error('Auto-Caption API', 'Error generating caption', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to generate caption' },
            { status: 500 }
        );
    }
}
