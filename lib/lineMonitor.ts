import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export type LineLogDirection = 'inbound' | 'outbound';
export type LineLogType = 'text' | 'image' | 'track_status' | 'push_notify' | 'unknown';
export type LineLogStatus = 'ok' | 'error' | 'skipped';

interface LineLogEvent {
    direction: LineLogDirection;
    type: LineLogType;
    status: LineLogStatus;
    lineUserId?: string;
    durationMs?: number;
    error?: string;
}

/**
 * Fire-and-forget: log LINE Bot events to Firestore.
 * Never throws — logging must never break the main flow.
 * No TTL — retained permanently for analytics.
 */
export function logLineEvent(event: LineLogEvent): void {
    adminDb.collection('line_logs').add({
        ...event,
        ts: FieldValue.serverTimestamp(),
    }).catch(() => {
        // Intentionally swallowed — monitoring must not affect production flow
    });
}
