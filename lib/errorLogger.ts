/**
 * errorLogger — Central error logging for crms6it
 * Server-side only (uses Admin SDK).
 * Fire-and-forget: never throws, never blocks main flow.
 *
 * Usage:
 *   import { logError } from '@/lib/errorLogger'
 *   logError({ source: 'fcm', severity: 'critical', message: '...', path: '/api/notify-repair' })
 *
 * Client-side errors → POST /api/errors (which calls logError server-side)
 */

import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export type ErrorSource = 'client' | 'server' | 'firestore' | 'fcm' | 'line' | 'batch' | 'auth';
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

interface ErrorLogEvent {
    source: ErrorSource;
    message: string;
    severity?: ErrorSeverity;
    path?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    stack?: string;
}

/**
 * Log error to Firestore `errorLogs` collection.
 * Sends LINE alert to admin for critical/high severity.
 */
export function logError(event: ErrorLogEvent): void {
    const severity = event.severity ?? 'high';

    adminDb.collection('errorLogs').add({
        ...event,
        severity,
        resolved: false,
        ts: FieldValue.serverTimestamp(),
    }).catch(() => {});

    if (severity === 'critical' || severity === 'high') {
        sendLineAdminAlert({ ...event, severity }).catch(() => {});
    }
}

async function sendLineAdminAlert(event: ErrorLogEvent & { severity: ErrorSeverity }): Promise<void> {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const adminLineId = process.env.LINE_ADMIN_USER_ID;
    if (!token || !adminLineId) return;

    const now = new Date().toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    const severityIcon = event.severity === 'critical' ? '🔴' : '🟠';
    const lines = [
        `${severityIcon} crms6it Error Alert`,
        `──────────────────`,
        `Source: ${event.source.toUpperCase()}`,
        `Severity: ${event.severity}`,
        event.path ? `Path: ${event.path}` : null,
        `Message: ${event.message.slice(0, 200)}`,
        event.userId ? `User: ${event.userId}` : null,
        `Time: ${now}`,
    ].filter(Boolean).join('\n');

    await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            to: adminLineId,
            messages: [{ type: 'text', text: lines }],
        }),
    });
}
