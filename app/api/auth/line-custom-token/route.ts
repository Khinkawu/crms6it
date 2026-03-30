import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebaseAdmin";

/**
 * POST /api/auth/line-custom-token
 * Issues a Firebase custom token for a LINE-linked user.
 *
 * Security: caller must supply a LIFF ID token (liff.getIDToken()).
 * We verify it against LINE's token endpoint before issuing any Firebase token.
 * This prevents anyone who knows a LINE user ID from impersonating a staff account.
 *
 * Body: { liffIdToken: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { liffIdToken } = await req.json();

        if (!liffIdToken || typeof liffIdToken !== "string") {
            return NextResponse.json({ error: "Missing liffIdToken" }, { status: 400 });
        }

        const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
        if (!channelId) {
            console.error("[line-custom-token] LINE_LOGIN_CHANNEL_ID not configured");
            return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
        }

        // 1. Verify LIFF ID token with LINE API
        const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                id_token: liffIdToken,
                client_id: channelId,
            }),
        });

        if (!verifyRes.ok) {
            const errData = await verifyRes.json().catch(() => ({}));
            console.warn("[line-custom-token] LINE token verification failed:", errData);
            return NextResponse.json({ error: "Invalid LINE token" }, { status: 401 });
        }

        const payload = await verifyRes.json();
        const verifiedLineUserId: string = payload.sub;

        if (!verifiedLineUserId) {
            return NextResponse.json({ error: "Invalid LINE token payload" }, { status: 401 });
        }

        // 2. Look up binding in Firestore using the verified LINE user ID
        const bindingSnap = await adminDb.collection("line_bindings").doc(verifiedLineUserId).get();

        if (!bindingSnap.exists) {
            return NextResponse.json({ error: "User not bound" }, { status: 404 });
        }

        const uid = bindingSnap.data()?.uid;
        if (!uid) {
            return NextResponse.json({ error: "Invalid binding data" }, { status: 500 });
        }

        // 3. Issue Firebase custom token
        const customToken = await adminAuth.createCustomToken(uid);
        return NextResponse.json({ token: customToken });

    } catch (error) {
        console.error("[line-custom-token] Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
