import { NextResponse } from 'next/server';
import { Client, FlexMessage, TextMessage } from '@line/bot-sdk';
import { adminDb } from '../../../lib/firebaseAdmin';

// Initialize LINE Client
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new Client(config);

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const events = body.events;

        if (!events || events.length === 0) {
            return NextResponse.json({ status: 'ok' });
        }

        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                await handleMessageEvent(event);
            } else {
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

    // Check Keywords
    if (text === 'Track Status' || text === 'ติดตามสถานะ') {
        await handleTrackStatus(replyToken, userId);
    } else {
        // Optional: Handle other messages or ignore
        // await client.replyMessage(replyToken, { type: 'text', text: `Echo: ${text}` });
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
            const statusColor = getStatusColor(data.status);
            const statusText = getStatusThai(data.status);
            const dateStr = data.createdAt ? data.createdAt.toDate().toLocaleDateString('th-TH') : '-';

            bubbles.push({
                type: 'bubble',
                size: 'mega',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    backgroundColor: statusColor,
                    paddingAll: '20px',
                    contents: [
                        {
                            type: 'text',
                            text: statusText,
                            weight: 'bold',
                            size: 'xl',
                            color: '#ffffff',
                            align: 'center'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    paddingAll: '20px',
                    contents: [
                        {
                            type: 'text',
                            text: data.description || 'No description',
                            weight: 'bold',
                            size: 'lg',
                            color: '#333333',
                            wrap: true
                        },
                        {
                            type: 'separator',
                            margin: 'lg',
                            color: '#eeeeee'
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            margin: 'lg',
                            spacing: 'sm',
                            contents: [
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '📍 สถานที่',
                                            color: '#aaaaaa',
                                            size: 'sm',
                                            flex: 2
                                        },
                                        {
                                            type: 'text',
                                            text: data.room || 'Unknown',
                                            wrap: true,
                                            color: '#666666',
                                            size: 'sm',
                                            flex: 4
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
                                            text: '📅 วันที่',
                                            color: '#aaaaaa',
                                            size: 'sm',
                                            flex: 2
                                        },
                                        {
                                            type: 'text',
                                            text: dateStr,
                                            wrap: true,
                                            color: '#666666',
                                            size: 'sm',
                                            flex: 4
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },

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
        await client.replyMessage(replyToken, { type: 'text', text: `เกิดข้อผิดพลาด: ${(error as any).message}` });
    }
}

// Helpers
function getStatusColor(status: string): string {
    switch (status) {
        case 'pending': return '#f59e0b'; // Amber
        case 'in_progress': return '#3b82f6'; // Blue
        case 'waiting_parts': return '#f97316'; // Orange
        case 'completed': return '#10b981'; // Emerald
        default: return '#64748b';
    }
}

function getStatusThai(status: string): string {
    switch (status) {
        case 'pending': return 'รอดำเนินการ';
        case 'in_progress': return 'กำลังดำเนินการ';
        case 'waiting_parts': return 'รออะไหล่';
        case 'completed': return 'เสร็จสิ้น';
        default: return status;
    }
}
