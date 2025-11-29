import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is the firebase userId
    const error = searchParams.get('error');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (error || !code || !state) {
        return NextResponse.redirect(`${appUrl}/profile?error=line_login_failed`);
    }

    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    const redirectUri = `${appUrl}/api/line/callback`;

    if (!channelId || !channelSecret) {
        return NextResponse.json({ error: 'LINE Channel configuration missing' }, { status: 500 });
    }

    try {
        // 1. Exchange code for access token
        const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: channelId,
                client_secret: channelSecret,
            }),
        });

        if (!tokenResponse.ok) {
            const errData = await tokenResponse.json();
            console.error('LINE Token Error:', errData);
            return NextResponse.redirect(`${appUrl}/profile?error=token_exchange_failed`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 2. Get User Profile
        const profileResponse = await fetch('https://api.line.me/v2/profile', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!profileResponse.ok) {
            console.error('LINE Profile Error');
            return NextResponse.redirect(`${appUrl}/profile?error=profile_fetch_failed`);
        }

        const profileData = await profileResponse.json();
        const lineUserId = profileData.userId;

        // 3. Redirect to Profile Page with lineUserId to be saved by client
        // Note: In a production app with firebase-admin, we would save it here.
        // For this setup, we pass it back to the client to save.
        return NextResponse.redirect(`${appUrl}/profile?action=link_line&lineUserId=${lineUserId}`);

    } catch (err) {
        console.error('LINE Callback Error:', err);
        return NextResponse.redirect(`${appUrl}/profile?error=internal_error`);
    }
}
