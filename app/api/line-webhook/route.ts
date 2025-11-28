import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const events = body.events;

        if (!events || events.length === 0) {
            return NextResponse.json({ status: 'ok' });
        }

        for (const event of events) {
            if (event.type === 'message') {
                const userId = event.source.userId;
                const replyToken = event.replyToken;

                if (userId && replyToken) {
                    await replyToUser(replyToken, userId);
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Error in LINE Webhook:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}

async function replyToUser(replyToken: string, userId: string) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
        console.error('LINE_CHANNEL_ACCESS_TOKEN is missing');
        return;
    }

    await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            replyToken: replyToken,
            messages: [
                {
                    type: 'text',
                    text: `Your User ID is:\n${userId}`,
                },
            ],
        }),
    });
}
