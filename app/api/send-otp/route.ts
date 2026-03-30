import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { generateOtp, sendOtpEmail } from '@/lib/emailService';
import { FieldValue } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';
import { logWebEvent } from '@/lib/analytics';

// IP-based rate limit: 5 requests per 60 seconds
const ipRateLimit = new Map<string, { count: number; resetAt: number }>();
const IP_LIMIT = 5;
const IP_WINDOW_MS = 60 * 1000;

function checkIpRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = ipRateLimit.get(ip);
    if (!entry || now > entry.resetAt) {
        ipRateLimit.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
        return true;
    }
    if (entry.count >= IP_LIMIT) return false;
    entry.count++;
    return true;
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        // Skip IP rate limit for internal server-to-server calls (e.g. LINE Bot aiAgent)
        const isInternal = request.headers.get('x-internal-source') === process.env.CRMS_API_SECRET_KEY;
        if (!isInternal && !checkIpRateLimit(ip)) {
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
        }

        const { email, lineUserId } = await request.json();

        // Validate email domain
        if (!email || !email.endsWith('@tesaban6.ac.th')) {
            return NextResponse.json(
                { success: false, error: 'กรุณาใช้ email @tesaban6.ac.th เท่านั้น' },
                { status: 400 }
            );
        }

        if (!lineUserId) {
            return NextResponse.json(
                { success: false, error: 'ไม่พบข้อมูล LINE User ID' },
                { status: 400 }
            );
        }

        // Check if already bound
        const existingBinding = await adminDb.collection('line_bindings').doc(lineUserId).get();
        if (existingBinding.exists) {
            return NextResponse.json(
                { success: false, error: 'บัญชี LINE นี้ถูกผูกแล้ว' },
                { status: 400 }
            );
        }

        // Rate limit: ห้ามขอ OTP ซ้ำภายใน 60 วินาที
        const existingOtp = await adminDb.collection('otp_codes').doc(lineUserId).get();
        if (existingOtp.exists) {
            const createdAt = existingOtp.data()?.createdAt?.toDate?.() as Date | undefined;
            if (createdAt && Date.now() - createdAt.getTime() < 60 * 1000) {
                return NextResponse.json(
                    { success: false, error: 'กรุณารอ 1 นาทีก่อนขอ OTP ใหม่' },
                    { status: 429 }
                );
            }
        }

        // Generate OTP
        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Store hashed OTP in Firestore (never store plaintext)
        await adminDb.collection('otp_codes').doc(lineUserId).set({
            email,
            otpHash,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt,
            attempts: 0
        });

        // Send OTP via email
        const emailSent = await sendOtpEmail(email, otp);

        if (!emailSent) {
            return NextResponse.json(
                { success: false, error: 'ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่' },
                { status: 500 }
            );
        }

        logWebEvent({ eventType: 'otp_send', metadata: { email } });
        return NextResponse.json({
            success: true,
            message: `ส่ง OTP ไปที่ ${email} แล้ว กรุณาตรวจสอบอีเมล`
        });

    } catch (error) {
        console.error('[send-otp] Error:', error);
        return NextResponse.json(
            { success: false, error: 'เกิดข้อผิดพลาดภายในระบบ' },
            { status: 500 }
        );
    }
}
