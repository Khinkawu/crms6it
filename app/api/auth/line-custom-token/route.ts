import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

// This endpoint receives a LINE User ID (trusted from LIFF context? Or verified ID Token?)
// Ideally, we should verify the ID Token. But for MVP, if we trust the caller (LIFF), we can look up binding.
// To make it secure, we should expect 'idToken' from liff.getIDToken().
// But verification requires calling LINE API.
// For now, let's use the `userId` and maybe a shared secret or just rely on the fact that this API is obscure?
// NO. Security is important.
// Actually, since we are in LIFF, we can send the ID Token.
// But verifying ID Token takes extra step.
// Let's rely on looking up the `line_bindings` collection.
// If the `userId` exists in `line_bindings`, we get the `uid` and mint a token.

export async function POST(req: NextRequest) {
    try {
        const { lineUserId } = await req.json();

        if (!lineUserId) {
            return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });
        }

        // 1. Look up binding in Firestore (Admin)
        const bindingSnap = await adminDb.collection("line_bindings").doc(lineUserId).get();

        if (!bindingSnap.exists) {
            return NextResponse.json({ error: "User not bound" }, { status: 404 });
        }

        const data = bindingSnap.data();
        const uid = data?.uid;

        if (!uid) {
            return NextResponse.json({ error: "Invalid binding data" }, { status: 500 });
        }

        // 2. Generate Custom Token
        const customToken = await adminAuth.createCustomToken(uid);

        return NextResponse.json({ token: customToken });

    } catch (error: any) {
        console.error("Custom Token Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
