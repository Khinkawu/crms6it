import { NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export async function POST(request: Request) {
    try {
        const { email, ticketId, room, problem, technicianNote, completionImage } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // 1. Find User by Email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

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
                    altText: "✅ Repair Completed: " + problem,
                    contents: {
                        type: "bubble",
                        header: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "text",
                                    text: "✅ Repair Completed",
                                    weight: "bold",
                                    color: "#1DB446",
                                    size: "lg"
                                }
                            ]
                        },
                        hero: completionImage ? {
                            type: "image",
                            url: completionImage,
                            size: "full",
                            aspectRatio: "20:13",
                            aspectMode: "cover"
                        } : undefined,
                        body: {
                            type: "box",
                            layout: "vertical",
                            contents: [
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
                                                    text: "Room",
                                                    color: "#aaaaaa",
                                                    size: "sm",
                                                    flex: 1
                                                },
                                                {
                                                    type: "text",
                                                    text: room,
                                                    wrap: true,
                                                    color: "#666666",
                                                    size: "sm",
                                                    flex: 5
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
                                                    text: "Issue",
                                                    color: "#aaaaaa",
                                                    size: "sm",
                                                    flex: 1
                                                },
                                                {
                                                    type: "text",
                                                    text: problem,
                                                    wrap: true,
                                                    color: "#666666",
                                                    size: "sm",
                                                    flex: 5
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
                                                    text: "Note",
                                                    color: "#aaaaaa",
                                                    size: "sm",
                                                    flex: 1
                                                },
                                                {
                                                    type: "text",
                                                    text: technicianNote || "-",
                                                    wrap: true,
                                                    color: "#666666",
                                                    size: "sm",
                                                    flex: 5
                                                }
                                            ]
                                        }
                                    ]
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
