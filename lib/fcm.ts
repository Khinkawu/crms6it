"use client";

import { getMessaging, getToken, onMessage, isSupported, deleteToken } from "firebase/messaging";
import { initializeApp, getApps, getApp } from "firebase/app";
import { doc, setDoc, getDoc, arrayRemove, updateDoc } from "firebase/firestore";
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
            console.debug("FCM not supported in this browser");
            return null;
        }

        // Check notification permission
        if (Notification.permission === "denied") {
            console.debug("Notification permission denied");
            return null;
        }

        // Request permission if not granted
        if (Notification.permission !== "granted") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                console.debug("Notification permission not granted");
                return null;
            }
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.debug("Service Worker registered:", registration);

        // Wait for service worker to be active to avoid "no active Service Worker" error
        await navigator.serviceWorker.ready;
        console.debug("Service Worker is ready");

        // Get messaging instance
        const messaging = getMessaging(app);

        // Get FCM token
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration,
        });

        if (token) {
            console.debug("FCM Token obtained:", token.substring(0, 20) + "...");
            // Save token to user's document
            await saveTokenToUser(userId, token);
            return token;
        }

        console.debug("No FCM token available");
        return null;
    } catch (error) {
        console.error("Error getting FCM token:", error);
        return null;
    }
}

/**
 * Save FCM token to user's document in Firestore
 * Smart token management: keeps only last 3 tokens to prevent accumulation
 */
async function saveTokenToUser(userId: string, token: string): Promise<void> {
    try {
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const data = userDoc.data();
            let tokens: string[] = data.fcmTokens || [];

            // Check if token already exists
            if (!tokens.includes(token)) {
                // Add new token
                tokens.push(token);

                // Keep only last 3 tokens (oldest get removed)
                if (tokens.length > 3) {
                    tokens = tokens.slice(-3);
                }
            }

            await updateDoc(userRef, {
                fcmTokens: tokens,
                lastTokenUpdate: new Date(),
            });
        } else {
            // Create user document with token
            await setDoc(userRef, {
                fcmTokens: [token],
                lastTokenUpdate: new Date(),
            }, { merge: true });
        }
        console.debug("FCM token saved to user document");
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
        console.debug("FCM token removed from user document");
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
            console.debug("Foreground message received:", payload);
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

/**
 * Unsubscribe from push notifications
 * Removes token from Firestore and deletes it from messaging
 */
export async function unsubscribeFromPushNotifications(userId: string): Promise<boolean> {
    try {
        const messaging = getMessaging(app);

        // We need to get the current token first to remove it from Firestore
        // We can't trust the one in local storage/state completely if we want to be thorough
        // But getToken might re-register... 
        // A better approach if we don't have the token stored in state is to just delete from messaging
        // and maybe clean up Firestore later or assume it's stale. 
        // However, standard flow: get current token -> remove from DB -> delete from Messaging

        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        // Check if we can get a token without prompting or re-registering? 
        // getToken will resolve if one exists.

        const currentToken = await getToken(messaging, { vapidKey });

        if (currentToken) {
            await removeTokenFromUser(userId, currentToken);
            await deleteToken(messaging);
            console.debug("FCM token deleted and removed from user");
            return true;
        }

        return false;
    } catch (error) {
        console.error("Error unsubscribing from notifications:", error);
        return false;
    }
}
