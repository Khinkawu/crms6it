import { google } from 'googleapis';


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

interface PrepareFolderParams {
    rootFolderId: string;
    year: string;
    semester: string;
    month: string;
    eventName: string;
}

interface PreparedFolder {
    folderId: string;
    folderLink: string;
}

/**
 * Pre-create folder hierarchy for an event (call ONCE before parallel uploads)
 * This prevents race condition when multiple files try to create the same folder
 */
export const prepareFolderPath = async ({
    rootFolderId,
    year,
    semester,
    month,
    eventName
}: PrepareFolderParams): Promise<PreparedFolder> => {
    const drive = getDriveClient();

    // Create folder hierarchy sequentially (safe, no race condition)
    const yearFolder = await getOrCreateFolder(drive, rootFolderId, `ปีการศึกษา ${year}`);
    const semesterFolder = await getOrCreateFolder(drive, yearFolder.id, `ภาคเรียนที่ ${semester}`);
    const monthFolder = await getOrCreateFolder(drive, semesterFolder.id, month);
    const eventFolder = await getOrCreateFolder(drive, monthFolder.id, eventName);

    return {
        folderId: eventFolder.id,
        folderLink: eventFolder.webViewLink
    };
};

interface UploadToFolderParams {
    fileName: string;
    mimeType: string;
    folderId: string;  // Use pre-created folder ID
    origin?: string;
}

/**
 * Initiate resumable upload to a specific folder (for parallel uploads)
 * Call prepareFolderPath first to get the folderId
 */
export const initiateResumableUploadToFolder = async ({
    fileName,
    mimeType,
    folderId,
    origin
}: UploadToFolderParams): Promise<{ uploadUrl: string }> => {
    // Prepare metadata with pre-existing folder ID
    const requestBody = {
        name: fileName,
        mimeType: mimeType,
        parents: [folderId],
    };

    // Get access token
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Google OAuth credentials missing');
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const accessToken = await auth.getAccessToken();

    const headers: HeadersInit = {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
    };

    if (origin) {
        headers['X-Upload-Content-Type'] = mimeType;
        headers['Origin'] = origin;
    }

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to initiate upload: ${response.status} ${errorText}`);
    }

    const uploadUrl = response.headers.get('Location');
    if (!uploadUrl) {
        throw new Error('No upload URL received from Google Drive');
    }

    return { uploadUrl };
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
    origin?: string; // Add origin parameter for CORS
}

// Helper: Initiate Resumable Upload (Returns Session URI)
export const initiateResumableUpload = async ({
    fileName,
    mimeType,
    rootFolderId,
    year,
    semester,
    month,
    eventName,
    origin
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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Google OAuth credentials missing');
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const accessToken = await auth.getAccessToken();

    // Pass the Origin header if provided, otherwise default to wildcard or omit
    const headers: HeadersInit = {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
    };

    if (origin) {
        headers['X-Upload-Content-Type'] = mimeType;
        // headers['X-Upload-Content-Length'] = ''; // Optional
        headers['Origin'] = origin;
    }

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST',
        headers: headers,
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


