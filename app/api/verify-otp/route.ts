import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
    try {
        const { otp, lineUserId } = await request.json();

        if (!otp || !lineUserId) {
            return NextResponse.json(
                { success: false, error: 'ข้อมูลไม่ครบถ้วน' },
                { status: 400 }
            );
        }

        // Get stored OTP
        const otpDoc = await adminDb.collection('otp_codes').doc(lineUserId).get();

        if (!otpDoc.exists) {
            return NextResponse.json(
                { success: false, error: 'ไม่พบ OTP กรุณาขอ OTP ใหม่' },
                { status: 400 }
            );
        }

        const otpData = otpDoc.data()!;

        // Check expiry
        const expiresAt = otpData.expiresAt.toDate ? otpData.expiresAt.toDate() : new Date(otpData.expiresAt);
        if (new Date() > expiresAt) {
            await adminDb.collection('otp_codes').doc(lineUserId).delete();
            return NextResponse.json(
                { success: false, error: 'OTP หมดอายุแล้ว กรุณาขอ OTP ใหม่' },
                { status: 400 }
            );
        }

        // Check attempts (max 3)
        if (otpData.attempts >= 3) {
            await adminDb.collection('otp_codes').doc(lineUserId).delete();
            return NextResponse.json(
                { success: false, error: 'พยายามเกิน 3 ครั้ง กรุณาขอ OTP ใหม่' },
                { status: 400 }
            );
        }

        // Verify OTP — compare against hash (bcrypt) or plaintext fallback for old records
        const storedHash = otpData.otpHash;
        const isValid = storedHash
            ? await bcrypt.compare(otp, storedHash)
            : otpData.otp === otp;

        if (!isValid) {
            await adminDb.collection('otp_codes').doc(lineUserId).update({
                attempts: FieldValue.increment(1)
            });
            return NextResponse.json(
                { success: false, error: 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่' },
                { status: 400 }
            );
        }

        // OTP verified! Create binding
        const email = otpData.email;

        // Find user by email
        const usersSnapshot = await adminDb.collection('users').where('email', '==', email).limit(1).get();

        let userId: string;
        let displayName = 'ผู้ใช้ LINE';

        if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            userId = userDoc.id;
            displayName = userDoc.data().displayName || displayName;

            // Update user with lineUserId
            await adminDb.collection('users').doc(userId).update({
                lineUserId,
                updatedAt: FieldValue.serverTimestamp()
            });
        } else {
            // Create new user if not exists
            const newUserRef = adminDb.collection('users').doc();
            userId = newUserRef.id;
            await newUserRef.set({
                email,
                lineUserId,
                role: 'user',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });
        }

        // Create line_bindings entry
        await adminDb.collection('line_bindings').doc(lineUserId).set({
            uid: userId,
            email,
            displayName,
            linkedAt: FieldValue.serverTimestamp()
        });

        // Delete OTP
        await adminDb.collection('otp_codes').doc(lineUserId).delete();

        return NextResponse.json({
            success: true,
            displayName,
            email,
            message: 'ผูกบัญชีสำเร็จ!'
        });

    } catch (error) {
        console.error('[verify-otp] Error:', error);
        return NextResponse.json(
            { success: false, error: 'เกิดข้อผิดพลาดภายในระบบ' },
            { status: 500 }
        );
    }
}
