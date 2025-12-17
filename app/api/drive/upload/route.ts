import { NextRequest, NextResponse } from 'next/server';
import { initiateResumableUpload } from '@/lib/googleDrive';
import { getThaiAcademicYear, getThaiMonthName, getThaiMonthNumber } from '@/lib/academicYear';

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

        // 1. Prepare Folder Logic Params
        const jobDate = new Date(jobDateStr);
        const { academicYear, semester } = getThaiAcademicYear(jobDate);
        const monthName = getThaiMonthName(jobDate);
        const monthNum = getThaiMonthNumber(jobDate);
        const dayNum = jobDate.getDate().toString().padStart(2, '0');

        // Buddhist Era Year (2 digits): 2024 + 543 = 2567 -> "67"
        const buddhistYear = ((jobDate.getFullYear() + 543) % 100).toString().padStart(2, '0');

        // Folder Naming Conventions
        const fullMonthFolderName = monthName;
        const fullEventFolderName = `${buddhistYear}-${monthNum}-${dayNum} ${eventName}`;

        // 2. Initiate Resumable Upload
        const result = await initiateResumableUpload({
            // These params are not used for initiation but required by interface type
            fileBuffer: Buffer.from([]),
            fileName: fileName,
            mimeType: mimeType,
            rootFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!,
            year: academicYear.toString(),
            semester: semester.toString(),
            month: fullMonthFolderName,
            eventName: fullEventFolderName
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
