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

// Helper: Initiate Resumable Upload (Returns Session URI)
export const initiateResumableUpload = async ({
    fileName,
    mimeType,
    rootFolderId,
    year,
    semester,
    month,
    eventName
}: UploadParams) => {
    const drive = getDriveClient();

    // 1. Prepare Folder Hierarchy (Same as before)
    const yearFolder = await getOrCreateFolder(drive, rootFolderId, `ปีการศึกษา ${year}`);
    const semesterFolder = await getOrCreateFolder(drive, yearFolder.id, `ภาคเรียนที่ ${semester}`);
    const monthFolder = await getOrCreateFolder(drive, semesterFolder.id, month);
    const eventFolder = await getOrCreateFolder(drive, monthFolder.id, eventName);

    // 2. Prepare Metadata
    const requestBody = {
        name: fileName,
        mimeType: mimeType,
        parents: [eventFolder.id],
    };

    // 3. Request Session URI explicitly using the auth client
    // We use the underlying transporter to make a request that returns the location header
    const accessToken = await drive.context._options.auth.getAccessToken();

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
            // 'X-Upload-Content-Type': mimeType, // Optional but good practice
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Failed to initiate upload: ${response.statusText}`);
    }

    const uploadUrl = response.headers.get('Location');
    if (!uploadUrl) {
        throw new Error('No upload URL received from Google Drive');
    }

    return {
        uploadUrl,
        folderLink: eventFolder.webViewLink,
        fileId: '' // File ID is not available yet
    };
};

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
    // Keep this for backward compatibility or server-side usage if needed
    const drive = getDriveClient();
    const yearFolder = await getOrCreateFolder(drive, rootFolderId, `ปีการศึกษา ${year}`);
    const semesterFolder = await getOrCreateFolder(drive, yearFolder.id, `ภาคเรียนที่ ${semester}`);
    const monthFolder = await getOrCreateFolder(drive, semesterFolder.id, month);
    const eventFolder = await getOrCreateFolder(drive, monthFolder.id, eventName);

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
        folderLink: eventFolder.webViewLink
    };
};
