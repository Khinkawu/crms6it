import { NextRequest, NextResponse } from 'next/server';
import { initiateResumableUploadToFolder } from '@/lib/googleDrive';
import { adminAuth } from '@/lib/firebaseAdmin';

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
            await adminAuth.verifyIdToken(token);
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

        const origin = req.headers.get('origin') || req.headers.get('referer') || '';

        const { uploadUrl } = await initiateResumableUploadToFolder({
            fileName,
            mimeType,
            folderId,
            origin
        });

        return NextResponse.json({
            success: true,
            uploadUrl
        });

    } catch (error: any) {
        console.error('[upload-to-folder] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
