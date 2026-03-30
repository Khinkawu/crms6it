import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(request: Request) {
    // Require Firebase Bearer token — prevent unauthenticated initiation
    const authHeader = request.headers.get('Authorization');
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!idToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let verifiedUid: string;
    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        verifiedUid = decoded.uid;
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Validate userId matches the authenticated user (prevent spoofing)
    if (!userId || userId !== verifiedUid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://crms6it.vercel.app';
    const redirectUri = `${appUrl}/api/line/callback`;
    const scope = 'profile openid';

    if (!channelId) {
        return NextResponse.json({ error: 'LINE Channel ID is not configured' }, { status: 500 });
    }

    // Generate a one-time nonce — store {uid, createdAt} so callback can look it up
    // This prevents CSRF: attacker cannot predict the nonce
    const nonce = crypto.randomUUID();
    await adminDb.collection('line_auth_nonces').doc(nonce).set({
        uid: verifiedUid,
        createdAt: FieldValue.serverTimestamp(),
    });

    const lineUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}&scope=${scope}`;

    // Return redirect URL as JSON — client must navigate (can't send Authorization header with window.location.href)
    return NextResponse.json({ redirectUrl: lineUrl });
}
