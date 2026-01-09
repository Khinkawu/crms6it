import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

/**
 * Create a Facebook post from already-uploaded photo IDs
 * Photos should be uploaded first via /api/facebook/upload-photo
 */
export async function POST(request: NextRequest) {
    if (!PAGE_ID || !ACCESS_TOKEN) {
        return NextResponse.json(
            { error: 'Facebook Page ID or Access Token not configured' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { caption, jobId, photoIds, asDraft } = body as {
            caption: string;
            jobId: string;
            photoIds: string[];
            asDraft?: boolean;
        };

        const shouldPublish = !asDraft;

        if (!photoIds || photoIds.length === 0) {
            return NextResponse.json({ error: 'No photo IDs provided' }, { status: 400 });
        }

        let postId: string;

        if (photoIds.length === 1) {
            // Single photo: Already uploaded, just need to publish it
            // For single photos uploaded as unpublished, we need to create a post
            const feedBody = {
                message: caption,
                attached_media: [{ media_fbid: photoIds[0] }],
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
        } else {
            // Multiple photos: Create feed post with all attached media
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
