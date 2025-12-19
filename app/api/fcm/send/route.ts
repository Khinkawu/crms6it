import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    // For development, we use environment variables
    // For production, consider using service account JSON file
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: projectId,
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    } else {
        // Fallback for environments without service account
        admin.initializeApp({
            projectId: projectId,
        });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, title, body: messageBody, data } = body;

        if (!token) {
            return NextResponse.json(
                { error: 'Token is required' },
                { status: 400 }
            );
        }

        // Construct the message
        const message = {
            token,
            notification: {
                title: title || 'CRMS6 IT',
                body: messageBody || 'มีการแจ้งเตือนใหม่',
            },
            data: data || {},
            webpush: {
                headers: {
                    Urgency: 'high',
                },
                notification: {
                    icon: '/icon.png',
                    badge: '/icon.png',
                    vibrate: [100, 50, 100],
                    requireInteraction: true,
                },
                fcmOptions: {
                    link: data?.url || '/',
                },
            },
        };

        // Send the message
        const response = await admin.messaging().send(message);

        return NextResponse.json({
            success: true,
            messageId: response
        });
    } catch (error: any) {
        console.error('FCM Send Error:', error);

        // Handle specific FCM errors
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
            // Token is invalid or expired - could trigger cleanup here
            return NextResponse.json(
                { error: 'Invalid or expired token', needsRefresh: true },
                { status: 410 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Failed to send notification' },
            { status: 500 }
        );
    }
}
