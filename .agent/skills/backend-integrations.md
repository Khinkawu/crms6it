---
name: backend-integrations
description: Complete guide for external API integrations including LINE Bot webhooks, Facebook API, FCM notifications, and Google Drive. Covers authentication, token management, and error handling.
---

# Backend Integrations Skill

This skill provides comprehensive guidance for managing external API integrations in CRMS6 IT including LINE, Facebook, FCM, and Google Drive.

## 1. Integration Overview

| Service | Purpose | Key Files |
|---------|---------|-----------|
| **LINE Bot** | Messaging, Webhooks | `app/api/line/*`, `app/api/line-webhook/*` |
| **LINE LIFF** | Web app in LINE | `hooks/useLiff.ts`, `app/liff/*` |
| **Facebook** | Page posting, Photos | `app/api/facebook/*` |
| **FCM** | Push notifications | `app/api/fcm/*`, `lib/fcm.ts` |
| **Google Drive** | File storage | `app/api/drive/*`, `lib/googleDrive.ts` |
| **Nodemailer** | Email sending | `lib/emailService.ts` |

---

## 2. LINE Bot Integration

### Webhook Signature Validation

**Critical Security**: Always validate LINE webhook signatures to prevent spoofed requests.

```typescript
// app/api/line-webhook/route.ts
import crypto from 'crypto';

function validateSignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET!;
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('X-Line-Signature');
  
  if (!signature || !validateSignature(body, signature)) {
    console.error('[LINE Webhook] Invalid signature');
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  // Process webhook events...
  const events = JSON.parse(body).events;
  
  // Always return 200 quickly, process async
  return Response.json({ success: true });
}
```

### Sending Messages

```typescript
import { Client, TextMessage, FlexMessage } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

// Push message to user
async function sendPushMessage(userId: string, text: string) {
  try {
    await client.pushMessage(userId, { type: 'text', text });
    console.log(`[LINE] Message sent to ${userId}`);
  } catch (error) {
    if (error.statusCode === 400) {
      console.error('[LINE] User blocked the bot or invalid userId');
    } else if (error.statusCode === 429) {
      console.error('[LINE] Rate limited - too many requests');
    } else {
      console.error('[LINE] Send failed:', error);
    }
  }
}
```

### Handling Different Event Types

```typescript
async function handleLineEvent(event: WebhookEvent) {
  switch (event.type) {
    case 'message':
      if (event.message.type === 'text') {
        await handleTextMessage(event);
      } else if (event.message.type === 'image') {
        await handleImageMessage(event);
      }
      break;
      
    case 'follow':
      await handleNewFollower(event);
      break;
      
    case 'unfollow':
      await handleUnfollow(event);
      break;
      
    case 'postback':
      await handlePostback(event);
      break;
  }
}
```

---

## 3. FCM Push Notifications

### Preventing Duplicate Notifications

**Problem**: Same notification sent multiple times due to retries or race conditions.

**Solution 1: Idempotency Key**
```typescript
// lib/fcm.ts
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

async function sendNotificationOnce(
  notificationId: string, // Unique ID based on event (e.g., repair_123_statusChange)
  token: string,
  title: string,
  body: string
) {
  const db = getFirestore();
  const notificationRef = doc(db, 'sentNotifications', notificationId);
  
  // Check if already sent
  const existing = await getDoc(notificationRef);
  if (existing.exists()) {
    console.log(`[FCM] Notification ${notificationId} already sent, skipping`);
    return { success: true, skipped: true };
  }
  
  // Mark as sent BEFORE sending (optimistic lock)
  await setDoc(notificationRef, {
    sentAt: new Date(),
    token: token.substring(0, 10) + '...', // Partial for logging
  });
  
  // Send notification
  try {
    await sendFCMNotification(token, title, body);
    return { success: true };
  } catch (error) {
    // If send fails, remove the lock so it can retry
    await deleteDoc(notificationRef);
    throw error;
  }
}

// Usage
await sendNotificationOnce(
  `repair_${repairId}_status_${newStatus}`,
  userToken,
  'สถานะงานซ่อมอัปเดต',
  `งาน #${repairId} เปลี่ยนเป็น ${newStatus}`
);
```

**Solution 2: Debounce in Code**
```typescript
// Debounce notifications for same user within time window
const recentNotifications = new Map<string, number>();

function shouldSendNotification(userId: string, type: string): boolean {
  const key = `${userId}_${type}`;
  const lastSent = recentNotifications.get(key) || 0;
  const now = Date.now();
  
  // Don't send same type within 5 seconds
  if (now - lastSent < 5000) {
    return false;
  }
  
  recentNotifications.set(key, now);
  return true;
}
```

### FCM Token Management

```typescript
// Store token when user grants permission
async function saveUserToken(userId: string, fcmToken: string) {
  const db = getFirestore();
  await updateDoc(doc(db, 'users', userId), {
    fcmToken,
    fcmTokenUpdatedAt: new Date(),
  });
}

// Handle invalid tokens
async function sendWithTokenCleanup(userId: string, token: string, message: Message) {
  try {
    await getMessaging().send({ ...message, token });
  } catch (error) {
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      // Token is invalid - remove it
      console.log(`[FCM] Removing invalid token for user ${userId}`);
      await updateDoc(doc(db, 'users', userId), {
        fcmToken: null,
      });
    }
    throw error;
  }
}
```

---

## 4. Google Drive Integration

### Token Refresh Strategy

Google OAuth tokens expire after 1 hour. Handle refresh properly:

```typescript
// lib/googleDrive.ts
import { google } from 'googleapis';

class GoogleDriveService {
  private oauth2Client;
  
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Set stored tokens
    this.oauth2Client.setCredentials({
      access_token: process.env.GOOGLE_ACCESS_TOKEN,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    
    // Auto-refresh on expiry
    this.oauth2Client.on('tokens', (tokens) => {
      console.log('[Google] New access token received');
      // In production: save new token to secure storage
      if (tokens.refresh_token) {
        console.log('[Google] New refresh token - update env/secrets');
      }
    });
  }
  
  async uploadFile(fileName: string, mimeType: string, content: Buffer) {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    
    try {
      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
        },
        media: {
          mimeType,
          body: Readable.from(content),
        },
        fields: 'id, webViewLink',
      });
      
      return response.data;
    } catch (error) {
      if (error.code === 401) {
        console.error('[Google] Token expired and refresh failed');
        // Trigger re-authentication flow
      }
      throw error;
    }
  }
}
```

### Service Account (Recommended for Server-side)

```typescript
// Using service account (no refresh needed)
import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });
```

---

## 5. Facebook API Integration

### Page Access Token Management

```typescript
// Facebook Page tokens don't expire if you get a "never-expire" token
// But verify before using:

async function verifyFacebookToken() {
  const response = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}&access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`
  );
  const data = await response.json();
  
  if (data.data?.is_valid) {
    console.log('[Facebook] Token valid until:', data.data.expires_at || 'Never');
  } else {
    console.error('[Facebook] Token invalid:', data.data?.error);
  }
}
```

### Posting to Facebook Page

```typescript
async function postToFacebook(message: string, imageUrl?: string) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  
  const endpoint = imageUrl
    ? `https://graph.facebook.com/${pageId}/photos`
    : `https://graph.facebook.com/${pageId}/feed`;
  
  const body = imageUrl
    ? { url: imageUrl, caption: message, access_token: accessToken }
    : { message, access_token: accessToken };
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const result = await response.json();
  
  if (result.error) {
    console.error('[Facebook] Post failed:', result.error);
    throw new Error(result.error.message);
  }
  
  return result;
}
```

---

## 6. Email (Nodemailer) Integration

### Reliable Email Sending

```typescript
// lib/emailService.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App-specific password
  },
});

async function sendEmail(to: string, subject: string, html: string) {
  // Verify connection first
  try {
    await transporter.verify();
  } catch (error) {
    console.error('[Email] SMTP connection failed:', error);
    throw new Error('Email service unavailable');
  }
  
  const result = await transporter.sendMail({
    from: `"CRMS6 IT" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
  
  console.log('[Email] Sent:', result.messageId);
  return result;
}
```

---

## 7. Error Handling Best Practices

### Consistent Error Response

```typescript
// utils/apiError.ts
export class IntegrationError extends Error {
  constructor(
    public service: 'LINE' | 'Facebook' | 'FCM' | 'Google' | 'Email',
    public code: string,
    message: string,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

// Usage
throw new IntegrationError(
  'LINE',
  'RATE_LIMITED',
  'Too many requests to LINE API',
  true // Can retry
);
```

### Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (error instanceof IntegrationError && !error.retryable) {
        throw error; // Don't retry non-retryable errors
      }
      
      if (attempt < maxRetries) {
        console.log(`[Retry] Attempt ${attempt} failed, retrying in ${delayMs}ms`);
        await new Promise(r => setTimeout(r, delayMs * attempt));
      }
    }
  }
  
  throw lastError!;
}
```

---

## 8. Environment Variables Checklist

```bash
# LINE
LINE_CHANNEL_SECRET=          # For webhook signature
LINE_CHANNEL_ACCESS_TOKEN=    # For sending messages
LIFF_ID=                      # For LIFF apps
NEXT_PUBLIC_LIFF_ID=          # Client-side LIFF

# Facebook
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=   # Never-expire page token

# FCM
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Google Drive
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=

# Email
EMAIL_USER=
EMAIL_PASS=                   # App-specific password for Gmail
```

---

## 9. Debugging Integration Issues

### Quick Debug Commands

```bash
# Test LINE webhook locally (ngrok)
ngrok http 3000

# Test Facebook token
curl "https://graph.facebook.com/me?access_token=YOUR_TOKEN"

# Test FCM (requires firebase-admin)
node -e "require('./lib/fcm').testNotification('TOKEN')"
```

### Integration Health Check Endpoint

```typescript
// app/api/health/integrations/route.ts
export async function GET() {
  const results = {
    line: await checkLine(),
    facebook: await checkFacebook(),
    fcm: await checkFCM(),
    email: await checkEmail(),
  };
  
  const allHealthy = Object.values(results).every(r => r.ok);
  
  return Response.json(results, {
    status: allHealthy ? 200 : 503
  });
}
```

---

## 10. Feedback Format

- **[INTEGRATION-CRITICAL]**: Integration completely broken, affecting users
- **[INTEGRATION-AUTH]**: Token expired, authentication issues
- **[INTEGRATION-RATE]**: Rate limiting, too many requests
- **[INTEGRATION-DATA]**: Wrong data format, API contract mismatch
- **[INTEGRATION-NETWORK]**: Timeout, connection issues
