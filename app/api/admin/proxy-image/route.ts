import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * Shared auth check — requires a valid Firebase ID token.
 * Returns the decoded token on success, or a 401 NextResponse on failure.
 */
async function requireAuth(request: Request): Promise<{ uid: string } | NextResponse> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        return await adminAuth.verifyIdToken(token);
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
}

/**
 * GET /api/admin/proxy-image?url=<firebase-storage-url>
 *
 * Server-side proxy for Firebase Storage images.
 * Bypasses CORS restrictions when client-side access is blocked.
 * Returns the image as base64 data URL.
 * Requires: Firebase ID token in Authorization header.
 */
export async function GET(request: Request) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { searchParams } = new URL(request.url);
        const imageUrl = searchParams.get('url');

        if (!imageUrl) {
            return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
        }

        // Validate it's a Firebase Storage URL — use hostname to prevent SSRF bypass via path/query tricks
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(imageUrl);
        } catch {
            return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
        }
        if (parsedUrl.hostname !== 'firebasestorage.googleapis.com') {
            return NextResponse.json({ error: 'Only Firebase Storage URLs allowed' }, { status: 403 });
        }

        // Fetch from server-side (no CORS restrictions)
        const response = await fetch(imageUrl);
        if (!response.ok) {
            return NextResponse.json({ error: `Failed to fetch: ${response.status}` }, { status: response.status });
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';
        const base64 = Buffer.from(buffer).toString('base64');
        const dataUrl = `data:${contentType};base64,${base64}`;

        return NextResponse.json({ dataUrl });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Proxy image error:', error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/**
 * POST /api/admin/proxy-image
 * Batch fetch: accepts { urls: string[] }, returns { results: { [url]: dataUrl } }
 * Requires: Firebase ID token in Authorization header.
 */
export async function POST(request: Request) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { urls } = await request.json();

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: 'Missing urls array' }, { status: 400 });
        }

        // Limit batch size
        const limitedUrls = urls.slice(0, 20);
        const results: Record<string, string> = {};

        await Promise.all(limitedUrls.map(async (url: string) => {
            try {
                let parsedBatch: URL;
                try { parsedBatch = new URL(url); } catch { return; }
                if (parsedBatch.hostname !== 'firebasestorage.googleapis.com') return;
                const response = await fetch(url);
                if (!response.ok) return;
                const buffer = await response.arrayBuffer();
                const contentType = response.headers.get('content-type') || 'image/png';
                const base64 = Buffer.from(buffer).toString('base64');
                results[url] = `data:${contentType};base64,${base64}`;
            } catch {
                // Skip failed URLs silently
            }
        }));

        return NextResponse.json({ results });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Batch proxy image error:', error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
