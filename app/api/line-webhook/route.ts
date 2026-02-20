import { NextResponse } from 'next/server';
import { Client, FlexMessage, TextMessage, validateSignature } from '@line/bot-sdk';
import { adminDb } from '../../../lib/firebaseAdmin';
import { processAIMessage } from '@/lib/aiAgent';
import { getThaiStatus, getStatusHexColor } from '@/utils/repairHelpers';

// Initialize LINE Client
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new Client(config);

// Send typing indicator to show AI is thinking
async function sendTypingIndicator(userId: string): Promise<void> {
    try {
        // LINE doesn't have a native typing indicator API
        // But we can use loading animation via chat action
        await fetch(`https://api.line.me/v2/bot/chat/loading/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.channelAccessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chatId: userId,
                loadingSeconds: 10, // Max 60 seconds
            }),
        });
    } catch (error) {
        // Silently fail - loading indicator is nice-to-have
        console.error('Error sending typing indicator:', error);
    }
}

export async function POST(req: Request) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get('x-line-signature') || '';

        if (!validateSignature(rawBody, process.env.LINE_CHANNEL_SECRET!, signature)) {
            return new Response('Unauthorized', { status: 401 });
        }

        const body = JSON.parse(rawBody);
        const events = body.events;

        if (!events || events.length === 0) {
            return NextResponse.json({ status: 'ok' });
        }

        for (const event of events) {
            if (event.type === 'message') {
                if (event.message.type === 'text') {
                    await handleMessageEvent(event);
                } else if (event.message.type === 'image') {
                    await handleImageMessage(event);
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Error in LINE Webhook:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}

async function handleMessageEvent(event: any) {
    const userId = event.source.userId;
    const text = event.message.text.trim();
    const replyToken = event.replyToken;

    // Check Keywords first
    if (text === 'Track Status' || text === 'ติดตามสถานะ') {
        await handleTrackStatus(replyToken, userId);
        return;
    }

    // Process with AI Agent
    try {
        // Show typing indicator
        await sendTypingIndicator(userId);

        console.log('[AI Agent] Processing message from user:', userId);
        console.log('[AI Agent] Message:', text);

        // Get AI response
        const aiReply = await processAIMessage(userId, text);

        console.log('[AI Agent] Reply:', aiReply?.substring(0, 100));

        // Reply to user
        await client.replyMessage(replyToken, {
            type: 'text',
            text: aiReply,
        });
    } catch (error: any) {
        console.error('=== AI Agent Error ===');
        console.error('Error name:', error?.name);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        console.error('Full error:', JSON.stringify(error, null, 2));
        console.error('======================');

        await client.replyMessage(replyToken, {
            type: 'text',
            text: 'ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งนะคะ',
        });
    }
}

// Handle image messages for repair reports
async function handleImageMessage(event: any) {
    const userId = event.source.userId;
    const messageId = event.message.id;
    const replyToken = event.replyToken;

    try {
        // Show typing indicator
        await sendTypingIndicator(userId);

        // Get image content from LINE
        const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
            headers: {
                'Authorization': `Bearer ${config.channelAccessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch image');
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // Process image with AI Agent
        const aiReply = await processAIMessage(userId, '', imageBuffer, contentType);

        await client.replyMessage(replyToken, {
            type: 'text',
            text: aiReply,
        });
    } catch (error) {
        console.error('Image processing error:', error);
        await client.replyMessage(replyToken, {
            type: 'text',
            text: 'ขออภัยค่ะ ไม่สามารถวิเคราะห์รูปภาพได้ กรุณาลองใหม่อีกครั้งนะคะ',
        });
    }
}

async function handleTrackStatus(replyToken: string, userId: string) {
    try {
        // 1. Check Binding
        const bindingDoc = await adminDb.collection('line_bindings').doc(userId).get();

        if (!bindingDoc.exists) {
            // Not Linked -> Invite to Register
            await client.replyMessage(replyToken, {
                type: 'flex',
                altText: 'กรุณาลงทะเบียน / Please Register',
                contents: {
                    type: 'bubble',
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            { type: 'text', text: 'ไม่พบข้อมูลบัญชี', weight: 'bold', size: 'xl', color: '#ef4444' },
                            { type: 'text', text: 'กรุณาเชื่อมต่อบัญชีโรงเรียนก่อนใช้งาน', margin: 'md', wrap: true },
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                color: '#0ea5e9',
                                action: {
                                    type: 'uri',
                                    label: 'ลงทะเบียน / Register',
                                    uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR}` // Using Repair LIFF as entry
                                }
                            }
                        ]
                    }
                }
            });
            return;
        }

        const userData = bindingDoc.data();
        const email = userData?.email;

        if (!email) {
            await client.replyMessage(replyToken, { type: 'text', text: 'ข้อมูลบัญชีไม่สมบูรณ์ (Missing Email).' });
            return;
        }

        // 2. Query Repairs
        const repairsSnapshot = await adminDb.collection('repair_tickets')
            .where('requesterEmail', '==', email)
            .where('status', 'in', ['pending', 'in_progress', 'waiting_parts']) // Active only
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        if (repairsSnapshot.empty) {
            await client.replyMessage(replyToken, { type: 'text', text: 'ไม่พบรายการแจ้งซ่อมที่กำลังดำเนินการอยู่ครับ' });
            return;
        }

        // 3. Construct Flex Carousel
        const bubbles: any[] = [];

        repairsSnapshot.forEach(doc => {
            const data = doc.data();
            const statusColor = getStatusHexColor(data.status);
            const statusText = getThaiStatus(data.status);
            const dateStr = data.createdAt
                ? data.createdAt.toDate().toLocaleDateString('th-TH', {
                    day: 'numeric', month: 'short', year: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                })
                : '-';

            // Resolve Image - Only use HTTPS URLs, skip base64 data URLs (too large for LINE API)
            const rawImageUrl = data.images?.[0] || data.imageUrl || data.imageOneUrl || null;
            const imageUrl = rawImageUrl && rawImageUrl.startsWith('https://') ? rawImageUrl : null;

            bubbles.push({
                type: 'bubble',
                size: 'mega',
                hero: imageUrl ? {
                    type: 'image',
                    url: imageUrl,
                    size: 'full',
                    aspectRatio: '20:13',
                    aspectMode: 'cover',
                    action: {
                        type: 'uri',
                        uri: imageUrl
                    }
                } : undefined,
                header: {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: statusColor,
                    paddingAll: '15px',
                    contents: [
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                {
                                    type: 'text',
                                    text: statusText,
                                    weight: 'bold',
                                    size: 'lg',
                                    color: '#ffffff',
                                    flex: 1
                                },
                                {
                                    type: 'text',
                                    text: `#${doc.id.slice(0, 5)}`,
                                    weight: 'bold',
                                    size: 'xs',
                                    color: '#ffffffcc',
                                    align: 'end',
                                    gravity: 'center'
                                }
                            ]
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    paddingAll: '20px',
                    backgroundColor: '#ffffff',
                    contents: [
                        {
                            type: 'text',
                            text: data.description || 'ไม่ได้ระบุรายละเอียด',
                            weight: 'bold',
                            size: 'lg',
                            color: '#1e293b',
                            wrap: true,
                            maxLines: 3
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            margin: 'lg',
                            spacing: 'md',
                            contents: [
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '📍',
                                            size: 'sm',
                                            flex: 1,
                                            color: '#64748b'
                                        },
                                        {
                                            type: 'text',
                                            text: data.room || 'ไม่ระบุ',
                                            color: '#334155',
                                            size: 'sm',
                                            flex: 9,
                                            wrap: true
                                        }
                                    ]
                                },
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '📅',
                                            size: 'sm',
                                            flex: 1,
                                            color: '#64748b'
                                        },
                                        {
                                            type: 'text',
                                            text: dateStr,
                                            color: '#334155',
                                            size: 'sm',
                                            flex: 9
                                        }
                                    ]
                                }
                            ]
                        },
                        // Technician Note Section
                        ...(data.technicianNote ? [
                            { type: 'separator', margin: 'lg', color: '#f1f5f9' },
                            {
                                type: 'box',
                                layout: 'vertical',
                                margin: 'lg',
                                contents: [
                                    {
                                        type: 'text',
                                        text: '📝 ข้อความจากช่าง:',
                                        size: 'xs',
                                        color: '#64748b',
                                        weight: 'bold'
                                    },
                                    {
                                        type: 'text',
                                        text: data.technicianNote,
                                        size: 'sm',
                                        color: '#059669', // Emerald 600
                                        wrap: true,
                                        margin: 'sm'
                                    }
                                ]
                            }
                        ] : []),
                        // Parts Used Section
                        ...(data.partsUsed && data.partsUsed.length > 0 ? [
                            { type: 'separator', margin: 'lg', color: '#f1f5f9' },
                            {
                                type: 'box',
                                layout: 'vertical',
                                margin: 'lg',
                                spacing: 'xs',
                                contents: [
                                    {
                                        type: 'text',
                                        text: '🛠️ อะไหล่ที่ใช้:',
                                        size: 'xs',
                                        color: '#64748b',
                                        weight: 'bold'
                                    },
                                    ...data.partsUsed.map((p: any) => ({
                                        type: 'box',
                                        layout: 'horizontal',
                                        contents: [
                                            {
                                                type: 'text',
                                                text: `- ${p.name}`,
                                                size: 'xs',
                                                color: '#334155',
                                                flex: 7
                                            },
                                            {
                                                type: 'text',
                                                text: `x${p.quantity}`,
                                                size: 'xs',
                                                color: '#64748b',
                                                align: 'end',
                                                flex: 3
                                            }
                                        ]
                                    }))
                                ]
                            }
                        ] : [])
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    paddingAll: '15px',
                    contents: [
                        {
                            type: 'button',
                            style: 'primary',
                            height: 'sm',
                            action: {
                                type: 'uri',
                                label: 'ดูรายละเอียด',
                                uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR}?mode=history`
                            },
                            color: '#0ea5e9'
                        }
                    ]
                },
                styles: {
                    footer: {
                        separator: true
                    }
                }
            });
        });

        const flexMessage: FlexMessage = {
            type: 'flex',
            altText: 'รายการแจ้งซ่อมของคุณ',
            contents: {
                type: 'carousel',
                contents: bubbles
            }
        };

        await client.replyMessage(replyToken, flexMessage);

    } catch (error) {
        console.error('Track Status Error:', error);
        await client.replyMessage(replyToken, { type: 'text', text: 'ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งนะคะ' });
    }
}

