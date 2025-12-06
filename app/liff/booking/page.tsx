"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "../../../hooks/useLiff";
import { Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import BookingForm from "../../components/BookingForm";

export default function BookingLiffPage() {
    const { profile, isLoggedIn, error } = useLiff(process.env.NEXT_PUBLIC_LINE_LIFF_ID_BOOKING || "");
    const router = useRouter();
    const [status, setStatus] = useState("กรุณารอสักครู่...");
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const checkBindingAndLogin = async () => {
            if (!isLoggedIn || !profile) return;

            try {
                // Optimize: Fast Path
                if (auth.currentUser) {
                    setStatus("กำลังเข้าสู่ระบบ...");
                    setIsReady(true);
                    return;
                }

                setStatus("กำลังตรวจสอบสิทธิ์...");
                // Optimize: Use API directly to check binding & get token
                const res = await fetch("/api/auth/line-custom-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lineUserId: profile.userId })
                });

                if (res.status === 404) {
                    // Not bound -> Go to Entry
                    router.push("/liff/entry");
                    return;
                }

                if (!res.ok) throw new Error("Auth Failed");

                // User requested change for Sync step
                setStatus("กำลังอัปเดตข้อมูลผู้ใช้...");

                const { token } = await res.json();

                // Silent Login
                await signInWithCustomToken(auth, token);

                setIsReady(true);

            } catch (err) {
                console.error(err);
                setStatus("เกิดข้อผิดพลาด: " + (err as any).message);
            }
        };

        checkBindingAndLogin();
    }, [isLoggedIn, profile, router]);

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-red-50 text-red-600 font-mono text-sm max-w-sm text-center">
                <AlertCircle className="w-8 h-8 mb-2" />
                {error}
                <div className="mt-2 text-xs text-gray-400">ID: {process.env.NEXT_PUBLIC_LINE_LIFF_ID_BOOKING}</div>
            </div>
        );
    }

    if (isReady) {
        // BookingForm handles its own layout, but we wrap it to ensure full screen
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-0">
                {/* Pass callbacks or props if BookingForm expects them, checking page source... 
                    It expects onSuccess and onCancel.
                 */}
                <BookingForm
                    onSuccess={() => {/* Maybe close window or show success overlay? for now just let it be */ }}
                    onCancel={() => {/* Close window? */ }}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white px-8">
            <div className="w-full max-w-xs space-y-4 text-center">
                <div className="relative w-20 h-20 mx-auto">
                    <img src="/logo_2.png" alt="Logo" className="w-full h-full object-contain opacity-80" />
                </div>

                <h3 className="text-gray-700 font-medium text-lg">{status}</h3>

                {/* Fake Progress Bar */}
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 left-0 h-full w-1/3 bg-blue-500 rounded-full animate-progress-smooth"></div>
                </div>
                <p className="text-xs text-gray-400">กำลังเชื่อมต่อฐานข้อมูล...</p>
            </div>

            {/* Inline CSS for smoother animation */}
            <style jsx>{`
                @keyframes progress-smooth {
                    0% { left: -40%; width: 40%; }
                    50% { left: 100%; width: 40%; }
                    100% { left: -40%; width: 40%; }
                }
                .animate-progress-smooth {
                    animation: progress-smooth 1.5s infinite linear;
                }
            `}</style>
        </div>
    );
}
