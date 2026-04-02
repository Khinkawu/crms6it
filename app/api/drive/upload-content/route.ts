import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
        return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const uploadUrl = req.headers.get('X-Drive-Upload-Url');
    if (!uploadUrl) {
        return NextResponse.json({ error: 'Missing X-Drive-Upload-Url header' }, { status: 400 });
    }

    const contentType = req.headers.get('Content-Type') || 'application/octet-stream';

    const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: req.body,
        headers: { 'Content-Type': contentType },
        // @ts-ignore — duplex required for streaming request body in Node.js
        duplex: 'half',
    });

    if (!response.ok) {
        const text = await response.text();
        return NextResponse.json(
            { error: `Drive upload failed: ${response.status} ${text}` },
            { status: 502 }
        );
    }

    const data = await response.json();
    return NextResponse.json(data);
}
