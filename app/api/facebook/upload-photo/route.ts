import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const GRAPH_API_VERSION = 'v22.0';

interface PhotoData {
    base64: string;
    mimeType: string;
}

export const maxDuration = 60; // Allow more time for upload

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
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
            return NextResponse.json(
                { error: error.error?.message || 'Failed to upload photo' },
                { status: 500 }
            );
        }

        const data = await uploadRes.json();
        return NextResponse.json({
            success: true,
            photoId: data.id
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('Facebook Upload Photo Error:', error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
