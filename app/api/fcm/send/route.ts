import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
// Import to ensure Firebase Admin is initialized
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, userId, title, body: messageBody, data } = body;

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

        // Handle specific FCM errors - cleanup invalid tokens
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {

            // Get userId and token from request body for cleanup
            try {
                const body = await request.clone().json();
                const { token, userId } = body;

                if (userId && token) {
                    // Remove invalid token from user's document
                    const userRef = adminDb.collection('users').doc(userId);
                    const userDoc = await userRef.get();

                    if (userDoc.exists) {
                        const data = userDoc.data();
                        const tokens: string[] = data?.fcmTokens || [];
                        const updatedTokens = tokens.filter(t => t !== token);

                        await userRef.update({ fcmTokens: updatedTokens });
                        console.log(`[FCM Cleanup] Removed invalid token from user ${userId}`);
                    }
                }
            } catch (cleanupError) {
                console.error('Error during token cleanup:', cleanupError);
            }

            return NextResponse.json(
                { error: 'Invalid or expired token', needsRefresh: true, cleaned: true },
                { status: 410 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Failed to send notification' },
            { status: 500 }
        );
    }
}

