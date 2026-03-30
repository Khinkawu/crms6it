import { NextRequest, NextResponse } from 'next/server';
import { initiateResumableUpload } from '@/lib/googleDrive';
import { getThaiAcademicYear, getThaiMonthName } from '@/lib/academicYear';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// Route segment config for App Router
export const maxDuration = 10;
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
            const decoded = await adminAuth.verifyIdToken(token);
            const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
            const role = userDoc.data()?.role;
            if (!['photographer', 'moderator', 'admin'].includes(role)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } catch {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid or expired token' },
                { status: 401 }
            );
        }

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

        const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://crms6it.vercel.app';

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
