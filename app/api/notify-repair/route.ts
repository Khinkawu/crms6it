import { NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { requesterName, room, description, imageOneUrl, zone } = body;
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

        if (!token) {
            console.warn('Missing LINE_CHANNEL_ACCESS_TOKEN');
            return NextResponse.json({ status: 'skipped', reason: 'Missing config' });
        }

        // 1. Find relevant technicians
        const techsQuery = query(collection(db, "users"), where("role", "==", "technician"));
        const techsSnap = await getDocs(techsQuery);

        let targetUserIds: string[] = [];

        techsSnap.forEach(doc => {
            const data = doc.data();
            const responsibility = data.responsibility || 'all'; // Default to all if not set
            const lineId = data.lineUserId;

            if (!lineId) return;

            // Logic:
            // Common -> Notify everyone
            // Junior High -> Notify Junior + All
            // Senior High -> Notify Senior + All
            if (zone === 'common') {
                targetUserIds.push(lineId);
            } else if (zone === 'junior_high' && (responsibility === 'junior_high' || responsibility === 'all')) {
                targetUserIds.push(lineId);
            } else if (zone === 'senior_high' && (responsibility === 'senior_high' || responsibility === 'all')) {
                targetUserIds.push(lineId);
            }
        });

        // Deduplicate
        targetUserIds = Array.from(new Set(targetUserIds));

        // Fallback to default technician if no one found (optional, but good for safety)
        if (targetUserIds.length === 0 && process.env.LINE_TECHNICIAN_ID) {
            console.log("No specific technicians found, using fallback ID.");
            targetUserIds.push(process.env.LINE_TECHNICIAN_ID);
        }

        if (targetUserIds.length === 0) {
            console.log("No technicians found to notify.");
            return NextResponse.json({ status: 'skipped', reason: 'No technicians found' });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';
        const deepLink = `${appUrl}/admin/repairs?ticketId=${body.ticketId}`; // Ensure ticketId is passed in body

        const messages: any[] = [
            {
                type: "flex",
                altText: `🔧 งานซ่อมใหม่: ${room}`,
                contents: {
                    type: "bubble",
                    header: {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: "#1d9befff", // Red for urgency
                        paddingAll: "lg",
                        contents: [
                            {
                                type: "text",
                                text: "NEW REPAIR REQUEST",
                                color: "#ffffff",
                                weight: "bold",
                                size: "xs",
                                align: "center"
                            },
                            {
                                type: "text",
                                text: "มีงานซ่อมใหม่!",
                                color: "#ffffff",
                                weight: "bold",
                                size: "xl",
                                margin: "md",
                                align: "center"
                            }
                        ]
                    },
                    hero: imageOneUrl ? {
                        type: "image",
                        url: imageOneUrl,
                        size: "full",
                        aspectRatio: "20:13",
                        aspectMode: "cover",
                        action: {
                            type: "uri",
                            uri: imageOneUrl
                        }
                    } : undefined,
                    body: {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: description,
                                weight: "bold",
                                size: "lg",
                                wrap: true
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
                                                text: "👤 ผู้แจ้ง",
                                                color: "#aaaaaa",
                                                size: "sm",
                                                flex: 2
                                            },
                                            {
                                                type: "text",
                                                text: requesterName,
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
                        spacing: "sm",
                        contents: [
                            {
                                type: "button",
                                style: "primary",
                                color: "#1d9befff", // Red button
                                action: {
                                    type: "uri",
                                    label: "รับงานซ่อม",
                                    uri: deepLink
                                }
                            }
                        ]
                    }
                }
            }
        ];

        // Use Multicast API
        await fetch('https://api.line.me/v2/bot/message/multicast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                to: targetUserIds,
                messages: messages,
            }),
        });

        return NextResponse.json({ status: 'ok', notifiedCount: targetUserIds.length });

    } catch (error) {
        console.error('Error sending LINE notification:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
