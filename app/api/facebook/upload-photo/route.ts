import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { logError } from '@/lib/errorLogger';

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const GRAPH_API_VERSION = 'v22.0';

interface PhotoData {
    base64: string;
    mimeType: string;
}

export const maxDuration = 60; // Allow more time for upload

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BASE64_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
        const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
        const role = userDoc.data()?.role;
        if (!['photographer', 'moderator', 'admin', 'atlas'].includes(role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!PAGE_ID || !ACCESS_TOKEN) {
        return NextResponse.json(
            { error: 'Facebook Page ID or Access Token not configured' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { photo, published } = body as {
            photo: PhotoData;
            published?: boolean;
        };

        if (!photo || !photo.base64) {
            return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
        }

        if (!ALLOWED_MIME_TYPES.has(photo.mimeType)) {
            return NextResponse.json({ error: 'Invalid image type. Allowed: jpeg, png, webp' }, { status: 400 });
        }

        if (photo.base64.length > MAX_BASE64_BYTES) {
            return NextResponse.json({ error: 'Image too large (max 20MB)' }, { status: 413 });
        }

        const buffer = Buffer.from(photo.base64, 'base64');

        // Create form data for multipart upload
        const formData = new FormData();
        const blob = new Blob([buffer], { type: photo.mimeType });
        formData.append('source', blob, 'photo.jpg');
        formData.append('access_token', ACCESS_TOKEN);
        formData.append('published', published ? 'true' : 'false');

        const uploadRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/photos`, {
            method: 'POST',
            body: formData,
        });

        if (!uploadRes.ok) {
            const error = await uploadRes.json();
            console.error('Facebook Photo Upload Error:', error);
            const errMsg = error.error?.message || 'Failed to upload photo';

            // Token invalid / revoked — needs admin to re-authorize and update Vercel env
            if (error.error?.code === 190) {
                logError({
                    source: 'server',
                    severity: 'high',
                    message: `Facebook Access Token invalid (code 190, subcode ${error.error?.error_subcode}): ${errMsg}`,
                    path: '/api/facebook/upload-photo',
                    metadata: { facebookError: error },
                });
                return NextResponse.json(
                    { error: 'Facebook Access Token หมดอายุหรือถูกยกเลิก — ผู้ดูแลระบบต้องอัปเดต Token ใหม่', code: 'FB_TOKEN_INVALID' },
                    { status: 503 }
                );
            }

            logError({
                source: 'server',
                severity: 'high',
                message: `Facebook Upload Photo API Error: ${errMsg}`,
                path: '/api/facebook/upload-photo',
                metadata: { facebookError: error },
            });
            return NextResponse.json({ error: errMsg }, { status: 500 });
        }

        const data = await uploadRes.json();
        return NextResponse.json({
            success: true,
            photoId: data.id
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('Facebook Upload Photo Error:', error);
        logError({
            source: 'server',
            severity: 'high',
            message: `Facebook Upload Photo Exception: ${errorMessage}`,
            path: '/api/facebook/upload-photo',
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
