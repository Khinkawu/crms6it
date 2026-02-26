import { NextRequest, NextResponse } from 'next/server';
import { prepareDailyReportFolderPath } from '@/lib/googleDrive';
import { getThaiAcademicYear, getThaiMonthName } from '@/lib/academicYear';
import { adminAuth } from '@/lib/firebaseAdmin';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

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
        const { photographerName, dateStr } = body;

        if (!photographerName || !dateStr) {
            return NextResponse.json(
                { error: 'Missing required fields (photographerName, dateStr)' },
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

        // Parse date string (YYYY-MM-DD)
        const [yearStr, monthStr, dayStr] = dateStr.split('-');
        const year = parseInt(yearStr, 10);
        const jobDate = new Date(year, parseInt(monthStr, 10) - 1, parseInt(dayStr, 10), 12, 0, 0);

        const { academicYear, semester } = getThaiAcademicYear(jobDate);
        const buddhistYear = ((year + 543) % 100).toString().padStart(2, '0');

        // Target Date Folder Format: YY-MM-DD (e.g., 69-02-26)
        const dateFolder = `${buddhistYear}-${monthStr}-${dayStr}`;
        const monthFolderName = getThaiMonthName(jobDate);

        // Create folder hierarchy
        const { folderId, folderLink } = await prepareDailyReportFolderPath({ // Using the new function
            rootFolderId,
            year: academicYear.toString(),
            semester: semester.toString(),
            month: monthFolderName,
            photographerName,
            dateFolder
        });

        return NextResponse.json({
            success: true,
            folderId,
            folderLink
        });

    } catch (error: any) {
        console.error('[prepare-daily-report] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
