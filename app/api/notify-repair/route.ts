import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { requesterName, room, description, imageOneUrl } = body;
        const technicianId = process.env.LINE_TECHNICIAN_ID;
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

        if (!technicianId || !token) {
            console.warn('Missing LINE_TECHNICIAN_ID or LINE_CHANNEL_ACCESS_TOKEN');
            return NextResponse.json({ status: 'skipped', reason: 'Missing config' });
        }

        const messages: any[] = [
            {
                type: 'text',
                text: `🔧 **แจ้งซ่อมใหม่!**\n\n📍 ห้อง: ${room}\n📝 อาการ: ${description}\n👤 ผู้แจ้ง: ${requesterName}`
            }
        ];

        if (imageOneUrl) {
            messages.push({
                type: 'image',
                originalContentUrl: imageOneUrl,
                previewImageUrl: imageOneUrl
            });
        }

        await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                to: technicianId,
                messages: messages,
            }),
        });

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('Error sending LINE notification:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
