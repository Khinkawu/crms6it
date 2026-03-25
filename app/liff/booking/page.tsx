"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "../../../hooks/useLiff";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import BookingForm from "@/components/BookingForm";
import { LiffSkeleton, LiffError, triggerHaptic } from "@/components/liff/LiffComponents";
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
                    setTimeout(() => reject(new Error("Login Timeout")), 30000)
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
            <div className="min-h-screen flex flex-col items-center justify-center bg-white px-8 py-12 text-center">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 ring-4 ring-green-100">
                    <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">จองสำเร็จ!</h2>
                <p className="text-sm text-gray-500 mb-8">ระบบได้บันทึกการจองของคุณเรียบร้อยแล้ว</p>
                <button
                    onClick={handleClose}
                    className="px-8 py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 active:scale-95 transition-all"
                >
                    ปิด
                </button>
            </div>
        );
    }

    if (isReady) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Header */}
                <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm flex items-center px-4 py-3">
                    <div className="flex-1">
                        <p className="text-xs text-gray-400 leading-none">ระบบสารสนเทศ</p>
                        <h1 className="text-sm font-semibold text-gray-900 leading-tight mt-0.5">จองห้องประชุม</h1>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                        aria-label="ปิด"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto">
                    <BookingForm
                        onSuccess={handleSuccess}
                        onCancel={handleClose}
                    />
                </div>
            </div>
        );
    }

    return <LiffSkeleton status={status} />;
}
