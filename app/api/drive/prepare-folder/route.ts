import { NextRequest, NextResponse } from 'next/server';
import { prepareFolderPath } from '@/lib/googleDrive';
import { getThaiAcademicYear, getThaiMonthName } from '@/lib/academicYear';
import { adminAuth } from '@/lib/firebaseAdmin';

// Route segment config for App Router
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

/**
 * POST /api/drive/prepare-folder
 * 
 * Creates the folder hierarchy for an event BEFORE files are uploaded.
 * Call this ONCE, then use the returned folderId for parallel file uploads.
 * 
 * This prevents race condition where multiple parallel uploads create duplicate folders.
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
        const { eventName, jobDate: jobDateStr } = body;

        if (!eventName || !jobDateStr) {
            return NextResponse.json(
                { error: 'Missing required fields (eventName, jobDate)' },
                { status: 400 }
            );
        }

        const rootFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
        if (!rootFolderId) {
            return NextResponse.json(
                { error: 'GOOGLE_DRIVE_PARENT_FOLDER_ID not configured' },
                { status: 500 }
            );
        }

        // Parse date string (YYYY-MM-DD) directly to avoid timezone issues
        const [yearStr, monthStr, dayStr] = jobDateStr.split('-');
        const year = parseInt(yearStr, 10);
        const jobDate = new Date(year, parseInt(monthStr, 10) - 1, parseInt(dayStr, 10), 12, 0, 0);

        const { academicYear, semester } = getThaiAcademicYear(jobDate);
        const buddhistYear = ((year + 543) % 100).toString().padStart(2, '0');

        // Folder structure: /ปีการศึกษา/ภาคเรียน/เดือน/วันที่-ชื่องาน
        const monthFolderName = getThaiMonthName(jobDate);
        const eventFolderName = `${buddhistYear}-${monthStr}-${dayStr} ${eventName}`;

        // Create folder hierarchy (sequential, no race condition)
        const { folderId, folderLink } = await prepareFolderPath({
            rootFolderId,
            year: academicYear.toString(),
            semester: semester.toString(),
            month: monthFolderName,
            eventName: eventFolderName
        });

        return NextResponse.json({
            success: true,
            folderId,
            folderLink
        });

    } catch (error: any) {
        console.error('[prepare-folder] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
