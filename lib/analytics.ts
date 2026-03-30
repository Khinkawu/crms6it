/**
 * Analytics — Server-side event logger
 * Fire-and-forget: never throws, never blocks main flow.
 * All writes go through Admin SDK (server-side only).
 */

import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export type WebEventType =
    | 'repair_submit'
    | 'repair_status_update'
    | 'booking_create'
    | 'booking_approve'
    | 'booking_reject'
    | 'booking_cancel'
    | 'booking_edit'
    | 'photo_upload'
    | 'photo_assign'
    | 'gallery_view'
    | 'video_upload'
    | 'knowledge_create'
    | 'user_login'
    | 'line_link'
    | 'otp_send'
    | 'otp_verify'
    | 'fcm_send'
    | 'api_error';

interface WebEvent {
    eventType: WebEventType;
    userId?: string;
    role?: string;
    metadata?: Record<string, unknown>;
    durationMs?: number;
    error?: string;
}

/**
 * Log a web/API event to Firestore `usage_events` collection.
 * Call from server-side API routes only.
 */
export function logWebEvent(event: WebEvent): void {
    adminDb.collection('usage_events').add({
        ...event,
        ts: FieldValue.serverTimestamp(),
    }).catch(() => {
        // Intentionally swallowed — analytics must not affect production flow
    });
}
