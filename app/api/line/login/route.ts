import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://crms6it.vercel.app';
    const redirectUri = `${appUrl}/api/line/callback`;
    const state = userId; // Pass userId as state to identify user on callback
    const scope = 'profile openid';

    if (!channelId) {
        return NextResponse.json({ error: 'LINE Channel ID is not configured' }, { status: 500 });
    }

    const lineUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}`;

    return NextResponse.redirect(lineUrl);
}
