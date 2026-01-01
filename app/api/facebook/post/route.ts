import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

/**
 * Convert Google Drive sharing URL to direct download URL
 */
function convertDriveUrl(url: string): string {
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /id=([a-zA-Z0-9_-]+)/,
        /\/d\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return `https://drive.google.com/uc?export=download&id=${match[1]}`;
        }
    }
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
        const body = await request.json();
        const { caption, jobId, photoUrls } = body as {
            caption: string;
            jobId: string;
            photoUrls: string[];
        };

        if (!photoUrls || photoUrls.length === 0) {
            return NextResponse.json({ error: 'No photo URLs provided' }, { status: 400 });
        }

        let postId: string;

        if (photoUrls.length === 1) {
            // Single photo: Post directly
            const params = new URLSearchParams({
                url: convertDriveUrl(photoUrls[0]),
                message: caption,
                published: 'true',
                access_token: ACCESS_TOKEN,
            });

            const uploadRes = await fetch(`https://graph.facebook.com/v18.0/${PAGE_ID}/photos?${params}`, {
                method: 'POST',
            });

            const responseText = await uploadRes.text();
            if (!uploadRes.ok) {
                throw new Error(`Failed to post photo: ${responseText}`);
            }

            const data = JSON.parse(responseText);
            postId = data.post_id || data.id;

        } else {
            // Multiple photos: Upload unpublished, then create feed post
            const photoIds: string[] = [];

            for (const originalUrl of photoUrls) {
                const params = new URLSearchParams({
                    url: convertDriveUrl(originalUrl),
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

            // Create Feed Post with attached media
            const feedBody = {
                message: caption,
                attached_media: photoIds.map(id => ({ media_fbid: id })),
                published: 'true',
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

    } catch (error: any) {
        console.error('Facebook API Route Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
