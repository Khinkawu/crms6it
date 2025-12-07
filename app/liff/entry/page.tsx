"use client";

import React, { useEffect, useState } from "react";
import liff from "@line/liff";
import { auth, db } from "../../../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, LogIn, AlertCircle, ShieldCheck } from "lucide-react";

export default function LIFFEntryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [lineUserId, setLineUserId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initializeLiff = async () => {
            try {
                const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR || process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";

                if (!liffId) {
                    throw new Error("ไม่พบค่า LIFF ID ในการตั้งค่า");
                }

                // Race liff.init with a 5s timeout
                await Promise.race([
                    liff.init({ liffId }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("การเชื่อมต่อกับ LINE ใช้เวลานานเกินไป")), 5000))
                ]);

                if (!liff.isLoggedIn()) {
                    liff.login();
                    return;
                }

                const profile = await liff.getProfile();
                const userId = profile.userId;
                setLineUserId(userId);

                // Check Binding
                const bindingRef = doc(db, "line_bindings", userId);
                const bindingSnap = await getDoc(bindingRef);

                if (bindingSnap.exists()) {
                    toast.success("ยินดีต้อนรับกลับครับ!");
                    const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
                    router.push(returnUrl || "/liff/repair");
                } else {
                    setIsLoading(false);
                }

            } catch (err: any) {
                console.error("LIFF Init Error:", err);
                setError(err.message || "ไม่สามารถเริ่มต้นระบบ LINE ได้");
                setIsLoading(false);
            }
        };

        initializeLiff();
    }, [router]);

    const handleGoogleLogin = async () => {
        if (!lineUserId) {
            toast.error("ไม่พบข้อมูลผู้ใช้ LINE กรุณารีโหลดหน้านี้ใหม่");
            return;
        }

        try {
            const provider = new GoogleAuthProvider();
            // Force account selection to avoid auto-login with wrong account
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            if (!user.email?.endsWith("@tesaban6.ac.th")) {
                toast.error("อนุญาตเฉพาะบัญชี @tesaban6.ac.th เท่านั้น");
                await auth.signOut();
                return;
            }

            // Create Binding
            await setDoc(doc(db, "line_bindings", lineUserId), {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                linkedAt: serverTimestamp()
            });

            toast.success("ผูกบัญชีสำเร็จ!");

            const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
            router.push(returnUrl || "/liff/repair");

        } catch (err: any) {
            console.error("Login Error:", err);
            toast.error("การเข้าสู่ระบบล้มเหลว กรุณาลองใหม่อีกครั้ง");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin relative z-10" />
                </div>
                <p className="mt-4 text-gray-500 font-medium animate-pulse">กำลังเชื่อมต่อระบบ...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <AlertCircle size={40} />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">เกิดข้อผิดพลาด</h1>
                <p className="text-gray-500 mb-6 max-w-xs mx-auto leading-relaxed">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-8 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition shadow-lg shadow-gray-200"
                >
                    ลองใหม่อีกครั้ง
                </button>
            </div>
        );
    }

    // If inside LINE App and NOT bound, force external browser for Google Login
    if (!isLoading && liff.isInClient()) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white p-8 text-center relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60"></div>

                <div className="relative z-10 max-w-sm w-full">
                    <div className="w-20 h-20 mb-8 mx-auto bg-gradient-to-tr from-blue-50 to-indigo-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm transform -rotate-3">
                        <ShieldCheck size={40} />
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 mb-3">
                        ยืนยันตัวตนครั้งแรก
                    </h1>
                    <p className="text-gray-500 mb-8 leading-relaxed font-light">
                        เพื่อความปลอดภัย กรุณากดยืนยันตัวตนผ่านเว็บเบราว์เซอร์<br />
                        (สำหรับการใช้งานครั้งแรกเท่านั้น)
                    </p>

                    <button
                        onClick={async () => {
                            liff.openWindow({ url: window.location.href, external: true });
                        }}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                        เปิดใน Google Chrome / Safari
                    </button>

                    <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        Secure System by Antigravity
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-blue-50/50 to-white"></div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto w-full relative z-10 animate-fade-in">
                <div className="w-32 h-32 mb-8 relative">
                    <img src="/logo_2.png" alt="Logo" className="w-full h-full object-contain drop-shadow-lg" />
                </div>

                <div className="space-y-2 mb-10">
                    <h1 className="text-2xl font-bold text-gray-900">
                        เชื่อมต่อบัญชีโรงเรียน
                    </h1>
                    <p className="text-gray-500 font-light leading-relaxed">
                        กรุณาลงชื่อเข้าใช้ด้วยบัญชี <span className="font-medium text-blue-600">@tesaban6.ac.th</span><br />
                        เพื่อเริ่มใช้งานระบบแจ้งซ่อมและจองห้อง
                    </p>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-4 bg-white border border-gray-200 text-gray-700 font-bold py-4 px-6 rounded-2xl shadow-sm hover:bg-gray-50 hover:shadow-md hover:border-gray-300 transition-all duration-200 active:scale-[0.98] group"
                >
                    <div className="w-6 h-6 relative transition-transform group-hover:scale-110">
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-full h-full object-contain" />
                    </div>
                    <span>ลงชื่อเข้าใช้ด้วย Google</span>
                </button>
            </div>

            <div className="p-6 text-center relative z-10">
                <p className="text-xs text-gray-300 font-light">
                    &copy; 2024 CRMS System. All rights reserved.
                </p>
            </div>
        </div>
    );
}
