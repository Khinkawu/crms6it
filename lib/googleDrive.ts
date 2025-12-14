import { google } from 'googleapis';
import { Readable } from 'stream';

// Initialize Drive API Client (OAuth 2.0)
const getDriveClient = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Google OAuth credentials (Client ID, Secret, Refresh Token) missing');
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });

    return google.drive({ version: 'v3', auth });
};

// Helper: Check if folder exists, if not create it
const getOrCreateFolder = async (drive: any, parentId: string, folderName: string) => {
    try {
        // 1. Search for existing folder
        const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name, webViewLink)',
            spaces: 'drive',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        if (res.data.files && res.data.files.length > 0) {
            return res.data.files[0]; // Return existing
        }

        // 2. Create if not exists
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        };

        const file = await drive.files.create({
            resource: fileMetadata,
            fields: 'id, name, webViewLink',
            supportsAllDrives: true
        });

        return file.data;
    } catch (error) {
        console.error(`Error finding/creating folder ${folderName}:`, error);
        throw error;
    }
};

interface UploadParams {
    fileBuffer: Buffer;
    fileName: string;
    mimeType: string;
    rootFolderId: string;
    year: string;
    semester: string;
    month: string;
    eventName: string;
}

export const uploadFileToDriveHierarchy = async ({
    fileBuffer,
    fileName,
    mimeType,
    rootFolderId,
    year,
    semester,
    month,
    eventName
}: UploadParams) => {
    const drive = getDriveClient();

    // 1. Academic Year Folder (e.g. "ปีการศึกษา 2567")
    const yearFolder = await getOrCreateFolder(drive, rootFolderId, `ปีการศึกษา ${year}`);

    // 2. Semester Folder (e.g. "ภาคเรียนที่ 1")
    const semesterFolder = await getOrCreateFolder(drive, yearFolder.id, `ภาคเรียนที่ ${semester}`);

    // 3. Month Folder (e.g. "12_ธันวาคม")
    const monthFolder = await getOrCreateFolder(drive, semesterFolder.id, month);

    // 4. Event Folder (e.g. "15 กีฬาสี")
    const eventFolder = await getOrCreateFolder(drive, monthFolder.id, eventName);

    // 5. Upload File
    const stream = Readable.from(fileBuffer);
    const media = {
        mimeType: mimeType,
        body: stream,
    };

    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [eventFolder.id],
        },
        media: media,
        fields: 'id, name, webViewLink, webContentLink',
        supportsAllDrives: true
    });

    return {
        file: res.data,
        folderLink: eventFolder.webViewLink // Return the link to the Event Folder so we can save it for the whole job
    };
};
