import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { to, messages } = body;
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

        if (!token) {
            console.warn('Missing LINE_CHANNEL_ACCESS_TOKEN');
            return NextResponse.json({ status: 'skipped', reason: 'Missing config' });
        }

        if (!to || !messages || messages.length === 0) {
            return NextResponse.json({ error: 'Missing "to" or "messages"' }, { status: 400 });
        }

        // Use LINE Push Message API
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                to,
                messages,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LINE Push API Error:', errorText);
            return NextResponse.json({ status: 'error', error: errorText }, { status: response.status });
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error: any) {
        console.error('Error sending LINE push:', error);
        return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
    }
}
