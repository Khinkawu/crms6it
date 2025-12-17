import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToDriveHierarchy } from '@/lib/googleDrive';
import { getThaiAcademicYear, getThaiMonthName, getThaiMonthNumber } from '@/lib/academicYear';

// Route segment config for App Router
export const maxDuration = 60; // Max 60 seconds for Vercel Hobby
export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
    try {
        // 1. Check OAuth Credentials
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
        const folderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

        if (!clientId || !clientSecret || !refreshToken || !folderId) {
            return NextResponse.json(
                { error: 'Server configuration error: Missing Google Drive credentials' },
                { status: 503 }
            );
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const eventName = formData.get('eventName') as string;
        const jobDateStr = formData.get('jobDate') as string; // ISO string

        if (!file || !eventName || !jobDateStr) {
            return NextResponse.json(
                { error: 'Missing required fields (file, eventName, jobDate)' },
                { status: 400 }
            );
        }

        // 2. Prepare Folder Logic Params
        const jobDate = new Date(jobDateStr);
        const { academicYear, semester } = getThaiAcademicYear(jobDate);
        const monthName = getThaiMonthName(jobDate);
        const monthNum = getThaiMonthNumber(jobDate);
        const dayNum = jobDate.getDate().toString().padStart(2, '0');

        // Buddhist Era Year (2 digits): 2024 + 543 = 2567 -> "67"
        const buddhistYear = ((jobDate.getFullYear() + 543) % 100).toString().padStart(2, '0');

        // Folder Naming Conventions
        // Year: "ปีการศึกษา 2567" (Handled in lib)
        // Semester: "ภาคเรียนที่ 1" (Handled in lib)
        // Month: "ธันวาคม" (Thai month name only)
        const fullMonthFolderName = monthName;
        // Event: "68-12-15 กีฬาสี" (YY-MM-DD + Event Name)
        const fullEventFolderName = `${buddhistYear}-${monthNum}-${dayNum} ${eventName}`;

        // 3. Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 4. Upload to Drive
        const result = await uploadFileToDriveHierarchy({
            fileBuffer: buffer,
            fileName: file.name,
            mimeType: file.type,
            rootFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!,
            year: academicYear.toString(),
            semester: semester.toString(),
            month: fullMonthFolderName,
            eventName: fullEventFolderName
        });

        return NextResponse.json({
            success: true,
            folderLink: result.folderLink,
            fileId: result.file.id
        });

    } catch (error: any) {
        console.error('Upload API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
