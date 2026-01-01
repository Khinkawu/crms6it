import { NextRequest, NextResponse } from 'next/server';
import { initiateResumableUpload } from '@/lib/googleDrive';
import { getThaiAcademicYear, getThaiMonthName } from '@/lib/academicYear';

// Route segment config for App Router
export const maxDuration = 10; // 10s is enough for metadata only
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { fileName, mimeType, eventName, jobDate: jobDateStr } = body;

        if (!fileName || !mimeType || !eventName || !jobDateStr) {
            return NextResponse.json(
                { error: 'Missing required fields (fileName, mimeType, eventName, jobDate)' },
                { status: 400 }
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

        const origin = req.headers.get('origin') || req.headers.get('referer') || '';

        const result = await initiateResumableUpload({
            fileBuffer: Buffer.from([]),
            fileName,
            mimeType,
            rootFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!,
            year: academicYear.toString(),
            semester: semester.toString(),
            month: monthFolderName,
            eventName: eventFolderName,
            origin
        });

        return NextResponse.json({
            success: true,
            uploadUrl: result.uploadUrl,
            folderLink: result.folderLink
        });

    } catch (error: any) {
        console.error('Upload Init Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
