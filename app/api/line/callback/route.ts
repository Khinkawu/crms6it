import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const nonce = searchParams.get('state'); // nonce stored in Firestore on login
    const error = searchParams.get('error');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (error || !code || !nonce) {
        return NextResponse.redirect(`${appUrl}/profile?error=line_login_failed`);
    }

    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    const redirectUri = `${appUrl}/api/line/callback`;

    if (!channelId || !channelSecret) {
        return NextResponse.json({ error: 'LINE Channel configuration missing' }, { status: 500 });
    }

    try {
        // 1. Look up nonce → get uid (CSRF protection: reject unknown/expired nonces)
        const nonceDoc = await adminDb.collection('line_auth_nonces').doc(nonce).get();
        if (!nonceDoc.exists) {
            return NextResponse.redirect(`${appUrl}/profile?error=line_login_failed`);
        }
        const uid: string = nonceDoc.data()!.uid;
        const createdAt: Date = nonceDoc.data()!.createdAt?.toDate?.() ?? new Date(0);

        // Expire nonces after 10 minutes
        if (Date.now() - createdAt.getTime() > 10 * 60 * 1000) {
            await adminDb.collection('line_auth_nonces').doc(nonce).delete();
            return NextResponse.redirect(`${appUrl}/profile?error=line_login_failed`);
        }

        // Consume nonce immediately (prevent replay)
        await adminDb.collection('line_auth_nonces').doc(nonce).delete();

        // 2. Exchange code for access token
        const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

        // 3. Get LINE User Profile
        const profileResponse = await fetch('https://api.line.me/v2/profile', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!profileResponse.ok) {
            console.error('LINE Profile Error');
            return NextResponse.redirect(`${appUrl}/profile?error=profile_fetch_failed`);
        }

        const profileData = await profileResponse.json();
        const lineUserId: string = profileData.userId;
        const lineDisplayName: string = profileData.displayName || '';

        // 4. Write both Firestore docs server-side (lineUserId never touches the URL)
        const userDoc = await adminDb.collection('users').doc(uid).get();
        await adminDb.collection('users').doc(uid).set({
            lineUserId,
            lineDisplayName,
        }, { merge: true });

        await adminDb.collection('line_bindings').doc(lineUserId).set({
            uid,
            email: userDoc.data()?.email || '',
            displayName: userDoc.data()?.displayName || '',
            lineDisplayName,
            photoURL: userDoc.data()?.photoURL || '',
            linkedAt: FieldValue.serverTimestamp(),
        });

        // 5. Redirect without sensitive data in URL
        return NextResponse.redirect(`${appUrl}/profile?action=link_line_success`);

    } catch (err) {
        console.error('LINE Callback Error:', err);
        return NextResponse.redirect(`${appUrl}/profile?error=internal_error`);
    }
}
