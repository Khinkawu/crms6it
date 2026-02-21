import { NextResponse } from 'next/server';

/**
 * GET /api/admin/proxy-image?url=<firebase-storage-url>
 * 
 * Server-side proxy for Firebase Storage images.
 * Bypasses CORS restrictions when client-side access is blocked.
 * Returns the image as base64 data URL.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const imageUrl = searchParams.get('url');

        if (!imageUrl) {
            return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
        }

        // Validate it's a Firebase Storage URL
        if (!imageUrl.includes('firebasestorage.googleapis.com')) {
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
    } catch (error: any) {
        console.error('Proxy image error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/admin/proxy-image
 * Batch fetch: accepts { urls: string[] }, returns { results: { [url]: dataUrl } }
 */
export async function POST(request: Request) {
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
                if (!url.includes('firebasestorage.googleapis.com')) return;
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
    } catch (error: any) {
        console.error('Batch proxy image error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
