import { NextResponse } from 'next/server';
import { logError, ErrorSource } from '@/lib/errorLogger';

/**
 * POST /api/errors
 * Receives client-side errors from ErrorBoundary and onSnapshot handlers.
 *
 * Security:
 * - No auth required (ErrorBoundary runs before login)
 * - Rate limited per IP: 10 requests / 60s
 * - source is validated against allowlist (never trusts caller)
 * - All string inputs are truncated to prevent oversized writes
 * - Does NOT expose internal state in response
 */

// ── In-memory rate limiter (per IP, resets on cold start) ─────────────────────
// Production: replace with Redis or Vercel KV for persistence across instances.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }
    entry.count += 1;
    if (entry.count > RATE_LIMIT) return true;
    return false;
}

// ── Allowlist: only accept known source values ─────────────────────────────────
const VALID_SOURCES: ErrorSource[] = ['client', 'server', 'firestore', 'fcm', 'line', 'batch', 'auth'];

export async function POST(req: Request) {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? req.headers.get('x-real-ip')
        ?? 'unknown';

    if (isRateLimited(ip)) {
        return NextResponse.json({ ok: false }, { status: 429 });
    }

    try {
        const body = await req.json();
        const { message, stack, path, userId, source } = body;

        // Validate required field
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json({ ok: false }, { status: 400 });
        }

        // Validate source against allowlist — never trust arbitrary strings
        const safeSource: ErrorSource = VALID_SOURCES.includes(source) ? source : 'client';

        logError({
            source: safeSource,
            severity: 'high',
            message: message.slice(0, 500),
            stack: stack ? String(stack).slice(0, 1000) : undefined,
            path: path ? String(path).slice(0, 200) : undefined,
            userId: userId ? String(userId).slice(0, 128) : undefined,
        });

        // Return minimal response — no internal details
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
}
