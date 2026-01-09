import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

interface PhotoData {
    base64: string;
    mimeType: string;
}

/**
 * Upload a single photo using FormData (binary upload)
 * This avoids the 10MB URL-based upload limit
 */
async function uploadPhotoWithFormData(
    photoData: PhotoData,
    published: boolean,
    caption?: string
): Promise<string> {
    const buffer = Buffer.from(photoData.base64, 'base64');

    // Create form data for multipart upload
    const formData = new FormData();
    const blob = new Blob([buffer], { type: photoData.mimeType });
    formData.append('source', blob, 'photo.jpg');
    formData.append('access_token', ACCESS_TOKEN!);
    formData.append('published', published ? 'true' : 'false');
    if (caption && published) {
        formData.append('message', caption);
    }

    const uploadRes = await fetch(`https://graph.facebook.com/v18.0/${PAGE_ID}/photos`, {
        method: 'POST',
        body: formData,
    });

    if (!uploadRes.ok) {
        const error = await uploadRes.json();
        console.error('Facebook Photo Upload Error:', error);
        throw new Error(`Failed to upload photo: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await uploadRes.json();
    return data.post_id || data.id;
}

export async function POST(request: NextRequest) {
    if (!PAGE_ID || !ACCESS_TOKEN) {
        return NextResponse.json(
            { error: 'Facebook Page ID or Access Token not configured' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { caption, jobId, photos, asDraft } = body as {
            caption: string;
            jobId: string;
            photos: PhotoData[];
            asDraft?: boolean;
        };

        const shouldPublish = !asDraft; // true = publish, false = draft

        if (!photos || photos.length === 0) {
            return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
        }

        let postId: string;

        if (photos.length === 1) {
            // Single photo: Post directly with caption (or as draft)
            postId = await uploadPhotoWithFormData(photos[0], shouldPublish, caption);
        } else {
            // Multiple photos: Upload unpublished in parallel, then create feed post
            const CONCURRENCY = 5;
            const photoIds: string[] = [];

            for (let i = 0; i < photos.length; i += CONCURRENCY) {
                const batch = photos.slice(i, i + CONCURRENCY);
                const batchResults = await Promise.all(
                    batch.map(photoData => uploadPhotoWithFormData(photoData, false))
                );
                photoIds.push(...batchResults);
            }

            // Create Feed Post with attached media
            const feedBody = {
                message: caption,
                attached_media: photoIds.map(id => ({ media_fbid: id })),
                published: shouldPublish ? 'true' : 'false',
                access_token: ACCESS_TOKEN,
            };

            const postRes = await fetch(`https://graph.facebook.com/v18.0/${PAGE_ID}/feed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(feedBody),
            });

            const postResponseText = await postRes.text();
            if (!postRes.ok) {
                throw new Error(`Failed to create post: ${postResponseText}`);
            }

            const postData = JSON.parse(postResponseText);
            postId = postData.id;
        }

        // Generate shareable permalink URL
        const actualPostId = postId.includes('_') ? postId.split('_')[1] : postId;
        const permalinkUrl = `https://www.facebook.com/permalink.php?story_fbid=${actualPostId}&id=${PAGE_ID}`;

        // Update Firestore Job
        if (jobId) {
            await adminDb.collection('photography_jobs').doc(jobId).update({
                facebookPostId: postId,
                facebookPermalink: permalinkUrl,
                facebookPostedAt: FieldValue.serverTimestamp(),
            });
        }

        return NextResponse.json({ success: true, postId, permalinkUrl });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('Facebook API Route Error:', error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
