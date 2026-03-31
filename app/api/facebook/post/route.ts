import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const GRAPH_API_VERSION = 'v22.0';

/**
 * Create a Facebook post from already-uploaded photo IDs
 * Photos should be uploaded first via /api/facebook/upload-photo
 */
export async function POST(request: NextRequest) {
    // Verify Firebase ID token — only photographer/moderator/admin can post
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

        // Idempotency check — if job already has a Facebook post, return success immediately.
        // Prevents duplicate posts when the client retries after a Vercel timeout.
        if (jobId) {
            const existing = await adminDb.collection('photography_jobs').doc(jobId).get();
            const existingData = existing.data();
            if (existingData?.facebookPostId) {
                return NextResponse.json({
                    success: true,
                    postId: existingData.facebookPostId,
                    permalinkUrl: existingData.facebookPermalink ?? null,
                    alreadyExists: true,
                });
            }
        }

        const feedBody = {
            message: caption,
            attached_media: photoIds.map(id => ({ media_fbid: id })),
            published: shouldPublish ? 'true' : 'false',
            access_token: ACCESS_TOKEN,
        };

        const postRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedBody),
        });

        const postResponseText = await postRes.text();

        if (!postRes.ok) {
            // Handle "Already Posted" — Facebook content-duplicate detection.
            // The post was created in a previous attempt but Firestore was not updated.
            // Treat as success so the job can be marked completed in Firestore.
            let fbErrorSubcode: number | undefined;
            try {
                const fbError = JSON.parse(postResponseText);
                fbErrorSubcode = fbError?.error?.error_subcode;
            } catch {
                // non-JSON error body — fall through to normal error handling
            }

            if (fbErrorSubcode === 1366051) {
                // Post already exists on Facebook (content duplicate).
                // Mark the job as posted without storing the lost post ID.
                if (jobId) {
                    await adminDb.collection('photography_jobs').doc(jobId).update({
                        facebookPostedAt: FieldValue.serverTimestamp(),
                        facebookNote: 'Post already existed on Facebook (duplicate detected)',
                    });
                }
                return NextResponse.json({
                    success: true,
                    alreadyPosted: true,
                    message: 'Post already exists on Facebook',
                });
            }

            throw new Error(`Failed to create post: ${postResponseText}`);
        }

        const postData = JSON.parse(postResponseText);
        const postId: string = postData.id;

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
