---
name: google-drive-integration
description: Google Drive API integration patterns including OAuth, folder hierarchy, resumable uploads, and parallel upload optimization. Use when implementing file uploads, managing folders, or debugging Drive API issues.
metadata:
  author: crms6-it
  version: "1.0.0"
---

# Google Drive Integration Skill

Comprehensive guide for integrating Google Drive API in Next.js applications, with focus on folder management and large file uploads.

## When to Apply

Reference these guidelines when:
- Implementing file uploads to Google Drive
- Creating folder hierarchies (Academic Year > Semester > Month > Event)
- Debugging OAuth token issues
- Optimizing upload performance with parallel uploads
- Handling resumable uploads for large files

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DRIVE UPLOAD FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Client (Browser)                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. prepareFolderPath() - Get folder ID (once)           │   │
│  │  2. initiateResumableUpload() - Get upload URL (per file)│   │
│  │  3. PUT file data directly to upload URL                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  Server (API Routes)                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  /api/drive/prepare-folder - Create folder hierarchy     │   │
│  │  /api/drive/upload-to-folder - Get resumable upload URL  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  Google Drive API                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  OAuth 2.0 with Refresh Token                            │   │
│  │  Resumable Upload Protocol                               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. OAuth 2.0 Authentication

### Setup with Refresh Token

```typescript
// lib/googleDrive.ts
import { google } from 'googleapis';

const getDriveClient = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Google OAuth credentials missing');
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });

    return google.drive({ version: 'v3', auth });
};
```

### Environment Variables

```bash
# .env.local
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_DRIVE_FOLDER_ID=root-folder-id-for-uploads
```

### Getting Refresh Token

```bash
# Use OAuth Playground or run custom script
# 1. Go to https://developers.google.com/oauthplayground/
# 2. Select Drive API v3 scopes
# 3. Authorize with your Google account
# 4. Exchange authorization code for refresh token
```

---

## 3. Folder Hierarchy Pattern

### CRMS6 IT Folder Structure

```
📁 Photography Jobs Root
├── 📁 ปีการศึกษา 2567
│   ├── 📁 ภาคเรียนที่ 1
│   │   ├── 📁 พฤษภาคม
│   │   │   ├── 📁 งานไหว้ครู
│   │   │   └── 📁 งานเปิดภาคเรียน
│   │   └── 📁 มิถุนายน
│   │       └── 📁 งานวันสุนทรภู่
│   └── 📁 ภาคเรียนที่ 2
│       └── ...
└── 📁 ปีการศึกษา 2568
    └── ...
```

### getOrCreateFolder Function

```typescript
// ✅ Idempotent: Check if exists, create if not
const getOrCreateFolder = async (
  drive: any, 
  parentId: string, 
  folderName: string
) => {
    // 1. Search for existing folder
    const query = `mimeType='application/vnd.google-apps.folder' ` +
                  `and name='${folderName}' ` +
                  `and '${parentId}' in parents and trashed=false`;
    
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
};
```

---

## 4. Parallel Upload Pattern (v1.14.0+)

### Problem: Race Condition

```typescript
// ❌ BAD: Each upload creates its own folder = race condition
const uploadFile = async (file) => {
    const yearFolder = await getOrCreateFolder(rootId, 'ปีการศึกษา 2567');
    const semFolder = await getOrCreateFolder(yearFolder.id, 'ภาคเรียนที่ 1');
    // ... more folder creation
    // If 10 files upload simultaneously, they might create duplicate folders!
};
```

### Solution: Prepare Folder Once, Upload in Parallel

```typescript
// ✅ GOOD: Separate folder creation from file uploading

// Step 1: Create folder ONCE before all uploads
export const prepareFolderPath = async ({
    rootFolderId, year, semester, month, eventName
}): Promise<{ folderId: string, folderLink: string }> => {
    const drive = getDriveClient();
    
    // Sequential folder creation (safe)
    const yearFolder = await getOrCreateFolder(drive, rootFolderId, `ปีการศึกษา ${year}`);
    const semFolder = await getOrCreateFolder(drive, yearFolder.id, `ภาคเรียนที่ ${semester}`);
    const monthFolder = await getOrCreateFolder(drive, semFolder.id, month);
    const eventFolder = await getOrCreateFolder(drive, monthFolder.id, eventName);
    
    return {
        folderId: eventFolder.id,
        folderLink: eventFolder.webViewLink
    };
};

// Step 2: Upload each file to the pre-created folder (parallel safe)
export const initiateResumableUploadToFolder = async ({
    fileName, mimeType, folderId, origin
}): Promise<{ uploadUrl: string }> => {
    // Use the pre-created folderId - no race condition!
    const requestBody = { name: fileName, mimeType, parents: [folderId] };
    // ... initiate resumable upload
};
```

### Client-side Parallel Upload

```typescript
// Component: MyPhotographyJobsModal.tsx

const handleUpload = async () => {
    // Step 1: Prepare folder ONCE
    const folderRes = await fetch('/api/drive/prepare-folder', {
        method: 'POST',
        body: JSON.stringify({ year, semester, month, eventName })
    });
    const { folderId, folderLink } = await folderRes.json();
    
    // Step 2: Upload all files in PARALLEL using the same folderId
    const uploadPromises = files.map(async (file, index) => {
        // Get resumable upload URL
        const uploadRes = await fetch('/api/drive/upload-to-folder', {
            method: 'POST',
            body: JSON.stringify({ fileName: file.name, mimeType: file.type, folderId })
        });
        const { uploadUrl } = await uploadRes.json();
        
        // Upload directly to Google (parallel)
        await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
        });
        
        // Update progress
        setProgress(prev => ({ ...prev, [index]: 100 }));
    });
    
    await Promise.all(uploadPromises);
    console.log('All files uploaded to:', folderLink);
};
```

---

## 5. Resumable Upload Protocol

### Why Resumable Upload?

| Feature | Simple Upload | Resumable Upload |
|---------|---------------|------------------|
| Max file size | 5MB | 5TB |
| Resume after failure | ❌ | ✅ |
| Progress tracking | ❌ | ✅ |
| Client-side PUT | ❌ | ✅ |

### Flow

```
1. POST /upload/drive/v3/files?uploadType=resumable
   → Get upload session URI (Location header)

2. PUT <file data> to session URI
   → File uploaded directly to Google

3. (Optional) If interrupted, resume with Range header
```

### Implementation

```typescript
export const initiateResumableUpload = async (params: UploadParams) => {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const accessToken = await auth.getAccessToken();

    const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': mimeType,
                'Origin': origin  // Required for CORS
            },
            body: JSON.stringify({
                name: fileName,
                mimeType: mimeType,
                parents: [folderId]
            })
        }
    );

    const uploadUrl = response.headers.get('Location');
    return { uploadUrl };
};
```

---

## 6. Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Token expired | Check refresh token |
| `403 Forbidden` | No permission | Check folder sharing/ownership |
| `404 Not Found` | Invalid parent folder | Verify folder ID exists |
| `429 Rate Limit` | Too many requests | Implement exponential backoff |

### Retry Pattern

```typescript
const uploadWithRetry = async (uploadFn: () => Promise<any>, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await uploadFn();
        } catch (error) {
            if (error.code === 429 && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.log(`Rate limited, retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
};
```

---

## 7. API Routes Reference

### /api/drive/prepare-folder

```typescript
// POST - Create folder hierarchy, return folderId
// Body: { year, semester, month, eventName }
// Response: { folderId, folderLink }
```

### /api/drive/upload-to-folder

```typescript
// POST - Get resumable upload URL for a file
// Body: { fileName, mimeType, folderId }
// Response: { uploadUrl }
```

### /api/drive/upload (Legacy)

```typescript
// POST - Combined folder creation + upload initiation
// Body: { fileName, mimeType, year, semester, month, eventName }
// Response: { uploadUrl, folderLink }
// ⚠️ Not recommended for parallel uploads due to race condition
```

---

## 8. Feedback Format

- **[DRIVE-CRITICAL]**: Upload completely failing, data loss risk
- **[DRIVE-AUTH]**: Token expired, OAuth issues
- **[DRIVE-QUOTA]**: Storage quota exceeded, rate limiting
- **[DRIVE-RACE]**: Race condition in folder creation
- **[DRIVE-CORS]**: Cross-origin issues with resumable upload
