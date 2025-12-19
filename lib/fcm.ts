"use client";

import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { initializeApp, getApps, getApp } from "firebase/app";
import { doc, setDoc, getDoc, arrayUnion, arrayRemove, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// Firebase config (same as main app)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Get or initialize Firebase app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * Check if FCM is supported in current browser
 */
export async function isFCMSupported(): Promise<boolean> {
    try {
        return await isSupported();
    } catch {
        return false;
    }
}

/**
 * Get FCM token for the current device
 * @param userId - User ID to associate the token with
 * @returns FCM token or null if not supported/denied
 */
export async function getFCMToken(userId: string): Promise<string | null> {
    try {
        const supported = await isFCMSupported();
        if (!supported) {
            console.log("FCM not supported in this browser");
            return null;
        }

        // Check notification permission
        if (Notification.permission === "denied") {
            console.log("Notification permission denied");
            return null;
        }

        // Request permission if not granted
        if (Notification.permission !== "granted") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                console.log("Notification permission not granted");
                return null;
            }
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("Service Worker registered:", registration);

        // Get messaging instance
        const messaging = getMessaging(app);

        // Get FCM token
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration,
        });

        if (token) {
            console.log("FCM Token obtained:", token.substring(0, 20) + "...");
            // Save token to user's document
            await saveTokenToUser(userId, token);
            return token;
        }

        console.log("No FCM token available");
        return null;
    } catch (error) {
        console.error("Error getting FCM token:", error);
        return null;
    }
}

/**
 * Save FCM token to user's document in Firestore
 */
async function saveTokenToUser(userId: string, token: string): Promise<void> {
    try {
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            // Add token to array (avoid duplicates)
            await updateDoc(userRef, {
                fcmTokens: arrayUnion(token),
                lastTokenUpdate: new Date(),
            });
        } else {
            // Create user document with token
            await setDoc(userRef, {
                fcmTokens: [token],
                lastTokenUpdate: new Date(),
            }, { merge: true });
        }
        console.log("FCM token saved to user document");
    } catch (error) {
        console.error("Error saving FCM token:", error);
    }
}

/**
 * Remove FCM token from user's document (for logout)
 */
export async function removeTokenFromUser(userId: string, token: string): Promise<void> {
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            fcmTokens: arrayRemove(token),
        });
        console.log("FCM token removed from user document");
    } catch (error) {
        console.error("Error removing FCM token:", error);
    }
}

/**
 * Listen for foreground messages
 * @param callback - Function to call when message received
 */
export function onForegroundMessage(callback: (payload: any) => void): () => void {
    try {
        const messaging = getMessaging(app);
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log("Foreground message received:", payload);
            callback(payload);
        });
        return unsubscribe;
    } catch (error) {
        console.error("Error setting up foreground message listener:", error);
        return () => { };
    }
}

/**
 * Request notification permission and setup FCM
 * Returns true if successful
 */
export async function setupPushNotifications(userId: string): Promise<boolean> {
    const token = await getFCMToken(userId);
    return token !== null;
}
