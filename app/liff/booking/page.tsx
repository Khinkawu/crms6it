"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "../../../hooks/useLiff";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import BookingForm from "../../components/BookingForm";
import { LiffSkeleton, LiffError, triggerHaptic } from "../../components/liff/LiffComponents";
import liff from "@line/liff";

export default function BookingLiffPage() {
    const { profile, isLoggedIn, isLoading: liffLoading, error } = useLiff(process.env.NEXT_PUBLIC_LINE_LIFF_ID_BOOKING || "");
    const router = useRouter();
    const [status, setStatus] = useState("กรุณารอสักครู่...");
    const [isReady, setIsReady] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        const checkBindingAndLogin = async () => {
            if (!isLoggedIn || !profile) return;

            try {
                // Optimize: Fast Path - Check if already logged in via Firebase
                if (auth.currentUser) {
                    setStatus("กำลังตรวจสอบสิทธิ์...");
                    setIsReady(true);
                    return;
                }

                // Optimize: Skip client-side getDoc. Use API to check binding & get token.
                setStatus("กำลังตรวจสอบการผูกบัญชี...");

                const res = await fetch("/api/auth/line-custom-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lineUserId: profile.userId })
                });

                if (res.status === 404) {
                    // Not bound -> Go to Entry
                    const currentLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID_BOOKING || "";
                    router.push(`/liff/entry?returnUrl=${encodeURIComponent("/liff/booking")}&liffId=${currentLiffId}`);
                    return;
                }

                if (!res.ok) throw new Error("Auth Failed");

                // User requested change for Sync step
                setStatus("กำลังอัปเดตข้อมูลผู้ใช้...");

                const { token } = await res.json();

                // Sign In to Firebase (Silent) - With Timeout
                const signInPromise = signInWithCustomToken(auth, token);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Login Timeout")), 10000)
                );

                await Promise.race([signInPromise, timeoutPromise]);

                setIsReady(true);

            } catch (err) {
                console.error(err);
                setStatus("เกิดข้อผิดพลาด: " + (err as any).message);
            }
        };

        checkBindingAndLogin();
    }, [isLoggedIn, profile, router]);

    // Handle successful booking
    const handleSuccess = () => {
        triggerHaptic('medium');
        setShowSuccess(true);
    };

    // Handle cancel/close
    const handleClose = () => {
        triggerHaptic('light');
        if (typeof liff !== 'undefined' && liff.isInClient()) {
            liff.closeWindow();
        } else {
            window.close();
        }
    };

    if (error) {
        return (
            <LiffError
                error={error}
                liffId={process.env.NEXT_PUBLIC_LINE_LIFF_ID_BOOKING}
                onRetry={() => window.location.reload()}
            />
        );
    }

    // Success overlay
    if (showSuccess) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-liff-fade-in">
                    <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">จองสำเร็จ!</h2>
                <p className="text-gray-500 mb-8">ระบบได้บันทึกการจองของคุณเรียบร้อยแล้ว</p>
                <button
                    onClick={handleClose}
                    className="px-8 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors shadow-lg"
                >
                    ปิด
                </button>
            </div>
        );
    }

    if (isReady) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-0">
                <BookingForm
                    onSuccess={handleSuccess}
                    onCancel={handleClose}
                />
            </div>
        );
    }

    return <LiffSkeleton status={status} />;
}
