import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

/**
 * Convert Google Drive sharing URL to direct download URL
 * Input:  https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * Output: https://drive.google.com/uc?export=download&id=FILE_ID
 */
function convertDriveUrl(url: string): string {
    // Extract file ID from various Google Drive URL formats
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,  // /file/d/FILE_ID/...
        /id=([a-zA-Z0-9_-]+)/,           // ?id=FILE_ID
        /\/d\/([a-zA-Z0-9_-]+)/,         // /d/FILE_ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return `https://drive.google.com/uc?export=download&id=${match[1]}`;
        }
    }

    // If no pattern matched, return as-is (might already be a direct URL)
    return url;
}

export async function POST(request: NextRequest) {
    if (!PAGE_ID || !ACCESS_TOKEN) {
        return NextResponse.json(
            { error: 'Facebook Page ID or Access Token not configured' },
            { status: 500 }
        );
    }

    try {
        // Accept JSON body with URLs instead of FormData with files
        const body = await request.json();
        const { caption, jobId, photoUrls } = body as {
            caption: string;
            jobId: string;
            photoUrls: string[];
        };

        if (!photoUrls || photoUrls.length === 0) {
            return NextResponse.json({ error: 'No photo URLs provided' }, { status: 400 });
        }

        console.log('[Facebook Post] Caption received:', caption);
        console.log('[Facebook Post] Photo URLs:', photoUrls.length);

        // 1. Upload photos to Facebook using URL (published=false)
        const photoIds: string[] = [];

        for (const originalUrl of photoUrls) {
            const directUrl = convertDriveUrl(originalUrl);

            const params = new URLSearchParams({
                url: directUrl,
                published: 'false',
                access_token: ACCESS_TOKEN,
            });

            const uploadRes = await fetch(`https://graph.facebook.com/v18.0/${PAGE_ID}/photos?${params}`, {
                method: 'POST',
            });

            if (!uploadRes.ok) {
                const error = await uploadRes.json();
                console.error('Facebook Photo Upload Error:', error);
                throw new Error(`Failed to upload photo: ${error.error?.message}`);
            }

            const data = await uploadRes.json();
            photoIds.push(data.id);
        }

        // 2. Create Feed Post with attached media
        const feedBody = {
            message: caption,
            attached_media: photoIds.map(id => ({ media_fbid: id })),
            access_token: ACCESS_TOKEN,
        };

        const postRes = await fetch(`https://graph.facebook.com/v18.0/${PAGE_ID}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedBody),
        });

        if (!postRes.ok) {
            const error = await postRes.json();
            console.error('Facebook Feed Post Error:', error);
            throw new Error(`Failed to create post: ${error.error?.message}`);
        }

        const postData = await postRes.json();
        const postId = postData.id;

        // 3. Update Firestore Job
        if (jobId) {
            await adminDb.collection('photography_jobs').doc(jobId).update({
                facebookPostId: postId,
                facebookPostedAt: FieldValue.serverTimestamp(),
            });
        }

        return NextResponse.json({ success: true, postId });

    } catch (error: any) {
        console.error('Facebook API Route Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}

