import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebaseAdmin';

export async function POST(request: Request) {
    try {
        const { email, ticketId, room, problem, technicianNote, completionImage } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // 1. Find User by Email
        const usersRef = adminDb.collection('users');
        const querySnapshot = await usersRef.where('email', '==', email).get();

        if (querySnapshot.empty) {
            console.log(`No user found for email: ${email}`);
            return NextResponse.json({ message: 'User not found, notification skipped' });
        }

        const userDoc = querySnapshot.docs[0].data();
        const lineUserId = userDoc.lineUserId;

        if (!lineUserId) {
            console.log(`User ${email} has no linked LINE account.`);
            return NextResponse.json({ message: 'User not linked to LINE, notification skipped' });
        }

        // 2. Send LINE Push Message
        const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!channelAccessToken) {
            console.error('LINE_CHANNEL_ACCESS_TOKEN is missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const message = {
            to: lineUserId,
            messages: [
                {
                    type: "flex",
                    altText: "✅ งานซ่อมเสร็จสิ้น: " + problem,
                    contents: {
                        type: "bubble",
                        size: "mega",
                        header: {
                            type: "box",
                            layout: "vertical",
                            backgroundColor: "#10B981", // สีเขียว Success
                            paddingAll: "20px",
                            contents: [
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        {
                                            type: "text",
                                            text: "COMPLETED",
                                            color: "#ffffff",
                                            weight: "bold",
                                            size: "xs",
                                            flex: 1
                                        },
                                        {
                                            type: "text",
                                            text: "✅ SUCCESS",
                                            color: "#ffffff",
                                            weight: "bold",
                                            size: "xs",
                                            align: "end"
                                        }
                                    ]
                                },
                                {
                                    type: "text",
                                    text: "การซ่อมเสร็จสิ้น",
                                    weight: "bold",
                                    size: "xl",
                                    color: "#ffffff",
                                    margin: "md"
                                },
                                {
                                    type: "text",
                                    text: "ขอบคุณที่ใช้บริการ",
                                    size: "xs",
                                    color: "#E0F2F1",
                                    margin: "xs"
                                }
                            ]
                        },
                        // ตรวจสอบว่ามีรูปภาพแนบมาหรือไม่ ถ้าไม่มีจะไม่แสดงส่วน Hero
                        hero: completionImage ? {
                            type: "image",
                            url: completionImage,
                            size: "full",
                            aspectRatio: "20:13",
                            aspectMode: "cover",
                            action: {
                                type: "uri",
                                uri: completionImage // กดที่รูปเพื่อดูรูปเต็ม
                            }
                        } : undefined,
                        body: {
                            type: "box",
                            layout: "vertical",
                            paddingAll: "20px",
                            contents: [
                                {
                                    type: "text",
                                    text: problem, // ชื่อปัญหา (ตัวใหญ่)
                                    weight: "bold",
                                    size: "lg",
                                    color: "#333333",
                                    wrap: true
                                },
                                {
                                    type: "separator",
                                    margin: "lg",
                                    color: "#eeeeee"
                                },
                                {
                                    type: "box",
                                    layout: "vertical",
                                    margin: "lg",
                                    spacing: "sm",
                                    contents: [
                                        {
                                            type: "box",
                                            layout: "baseline",
                                            spacing: "sm",
                                            contents: [
                                                {
                                                    type: "text",
                                                    text: "📍 สถานที่",
                                                    color: "#aaaaaa",
                                                    size: "sm",
                                                    flex: 2
                                                },
                                                {
                                                    type: "text",
                                                    text: room,
                                                    wrap: true,
                                                    color: "#666666",
                                                    size: "sm",
                                                    flex: 4
                                                }
                                            ]
                                        },
                                        {
                                            type: "box",
                                            layout: "baseline",
                                            spacing: "sm",
                                            contents: [
                                                {
                                                    type: "text",
                                                    text: "📝 บันทึกช่าง",
                                                    color: "#aaaaaa",
                                                    size: "sm",
                                                    flex: 2
                                                },
                                                {
                                                    type: "text",
                                                    text: technicianNote || "-", // ถ้าไม่มีโน้ต ใส่ขีด
                                                    wrap: true,
                                                    color: "#666666",
                                                    size: "sm",
                                                    flex: 4
                                                }
                                            ]
                                        },
                                        {
                                            type: "box",
                                            layout: "baseline",
                                            spacing: "sm",
                                            contents: [
                                                {
                                                    type: "text",
                                                    text: "📅 วันที่",
                                                    color: "#aaaaaa",
                                                    size: "sm",
                                                    flex: 2
                                                },
                                                {
                                                    type: "text",
                                                    text: new Date().toLocaleDateString('th-TH'), // วันที่ปัจจุบัน (Format ไทย)
                                                    wrap: true,
                                                    color: "#666666",
                                                    size: "sm",
                                                    flex: 4
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        footer: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "button",
                                    style: "secondary",
                                    color: "#10B981",
                                    action: {
                                        type: "uri",
                                        label: "เปิดดูประวัติการซ่อม",
                                        // อย่าลืมใส่ LIFF ID ที่ถูกต้องใน .env
                                        uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR}?mode=history`
                                    }
                                }
                            ]
                        }
                    }
                }
            ]
        };

        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('LINE API Error:', errorData);
            return NextResponse.json({ error: 'Failed to send LINE message' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Notification Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
