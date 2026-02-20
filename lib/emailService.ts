/**
 * Email Service using Nodemailer
 * For sending OTP and other transactional emails
 */

import nodemailer from 'nodemailer';
import { randomInt } from 'crypto';

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Generate a 6-digit OTP
 */
export function generateOtp(): string {
    return randomInt(100000, 1000000).toString();
}

/**
 * Send OTP email to user
 */
export async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
    try {
        await transporter.sendMail({
            from: `"CRMS6 IT System" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `🔐 รหัส OTP สำหรับผูกบัญชี LINE - ${otp}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
    <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; padding: 40px 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <!-- Logo -->
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="margin: 0; color: #1e293b; font-size: 24px; font-weight: 700;">CRMS6 IT System</h1>
                <p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">ระบบสารสนเทศโรงเรียนเทศบาล 6</p>
            </div>
            
            <!-- Message -->
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                สวัสดีครับ/ค่ะ<br><br>
                คุณได้ขอผูกบัญชี LINE กับระบบ CRMS6 IT<br>
                กรุณาใช้รหัส OTP ด้านล่างนี้เพื่อยืนยันตัวตน:
            </p>
            
            <!-- OTP Box -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <p style="color: rgba(255,255,255,0.8); font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 2px;">รหัส OTP ของคุณ</p>
                <p style="color: white; font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0;">${otp}</p>
            </div>
            
            <!-- Warning -->
            <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.5;">
                    ⏰ รหัสนี้จะหมดอายุใน <strong>5 นาที</strong><br>
                    🔒 ห้ามแชร์รหัสนี้ให้ผู้อื่น
                </p>
            </div>
            
            <!-- Footer -->
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                หากคุณไม่ได้ขอรหัสนี้ กรุณาเพิกเฉยอีเมลนี้<br>
                © 2025 CRMS6 IT System
            </p>
        </div>
    </div>
</body>
</html>
            `,
            text: `รหัส OTP ของคุณคือ: ${otp}\n\nรหัสนี้จะหมดอายุใน 5 นาที\nห้ามแชร์รหัสนี้ให้ผู้อื่น`,
        });

        console.log(`[Email] OTP sent to ${email}`);
        return true;
    } catch (error) {
        console.error('[Email] Failed to send OTP:', error);
        return false;
    }
}
