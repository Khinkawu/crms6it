import { NextRequest, NextResponse } from 'next/server';
import { initiateResumableUploadToFolder } from '@/lib/googleDrive';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { logError } from '@/lib/errorLogger';

// Route segment config for App Router
export const maxDuration = 10;
export const dynamic = 'force-dynamic';

/**
 * POST /api/drive/upload-to-folder
 * 
 * Initiate resumable upload to a pre-created folder.
 * Use with /api/drive/prepare-folder for parallel uploads.
 * 
 * Flow:
 * 1. Call /api/drive/prepare-folder to get folderId (once)
 * 2. Call this endpoint for each file with the folderId (parallel safe)
 * 3. Use returned uploadUrl to PUT file content directly to Google Drive
 */
export async function POST(req: NextRequest) {
    try {
        // Security: Verify Firebase Auth Token
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized: Missing or invalid Authorization header' },
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];
        try {
            const decoded = await adminAuth.verifyIdToken(token);
            const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
            const role = userDoc.data()?.role;
            if (!['photographer', 'moderator', 'admin', 'atlas'].includes(role)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } catch {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid or expired token' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { fileName, mimeType, folderId } = body;

        if (!fileName || !mimeType || !folderId) {
            return NextResponse.json(
                { error: 'Missing required fields (fileName, mimeType, folderId)' },
                { status: 400 }
            );
        }

        // Pass browser origin so Google CORS headers are set on the session URI
        const clientOrigin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/');

        const { uploadUrl } = await initiateResumableUploadToFolder({
            fileName,
            mimeType,
            folderId,
            clientOrigin: clientOrigin || undefined,
        });

        return NextResponse.json({
            success: true,
            uploadUrl
        });

    } catch (error: any) {
        const errorMessage = error.message || 'Internal Server Error';
        console.error('[upload-to-folder] Error:', error);
        logError({
            source: 'server',
            severity: 'high',
            message: `Drive Upload To Folder Error: ${errorMessage}`,
            path: '/api/drive/upload-to-folder',
            stack: error.stack,
        });
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
