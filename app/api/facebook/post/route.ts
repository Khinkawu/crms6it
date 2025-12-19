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

        let postId: string;

        if (photoUrls.length === 1) {
            // Single photo: Post directly with published=true (appears on timeline)
            const directUrl = convertDriveUrl(photoUrls[0]);

            const params = new URLSearchParams({
                url: directUrl,
                message: caption,
                published: 'true',
                access_token: ACCESS_TOKEN,
            });

            console.log('[Facebook Post] Single photo - posting directly');

            const uploadRes = await fetch(`https://graph.facebook.com/v18.0/${PAGE_ID}/photos?${params}`, {
                method: 'POST',
            });

            const responseText = await uploadRes.text();
            console.log('[Facebook Post] Single Photo Response Status:', uploadRes.status);
            console.log('[Facebook Post] Single Photo Response:', responseText);

            if (!uploadRes.ok) {
                throw new Error(`Failed to post photo: ${responseText}`);
            }

            const data = JSON.parse(responseText);
            postId = data.post_id || data.id;

        } else {
            // Multiple photos: Upload unpublished, then create feed post
            console.log('[Facebook Post] Multiple photos - using attached_media');

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

            // Create Feed Post with attached media
            const feedBody = {
                message: caption,
                attached_media: photoIds.map(id => ({ media_fbid: id })),
                published: 'true',
                access_token: ACCESS_TOKEN,
            };

            console.log('[Facebook Post] Creating feed post with attached_media');

            const postRes = await fetch(`https://graph.facebook.com/v18.0/${PAGE_ID}/feed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(feedBody),
            });

            const postResponseText = await postRes.text();
            console.log('[Facebook Post] Feed API Response Status:', postRes.status);
            console.log('[Facebook Post] Feed API Response:', postResponseText);

            if (!postRes.ok) {
                throw new Error(`Failed to create post: ${postResponseText}`);
            }

            const postData = JSON.parse(postResponseText);
            postId = postData.id;
        }

        // 3. Generate shareable permalink URL
        // postId format is "pageId_postId" - we need to extract the actual post ID
        const actualPostId = postId.includes('_') ? postId.split('_')[1] : postId;
        const permalinkUrl = `https://www.facebook.com/permalink.php?story_fbid=${actualPostId}&id=${PAGE_ID}`;

        console.log('[Facebook Post] Permalink URL:', permalinkUrl);

        // 4. Update Firestore Job
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

