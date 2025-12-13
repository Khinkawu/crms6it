"use client";

import React, { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.push("/");
        }
    }, [user, router]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
            {/* Background Decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
            </div>

            <div className="w-full max-w-md animate-fade-in relative z-10">
                {/* Card */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-200/50 dark:border-gray-700/50">

                    {/* Logo Area */}
                    <div className="mb-8 flex flex-col items-center">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 p-0.5 shadow-xl shadow-blue-500/30 mb-4">
                                <div className="w-full h-full rounded-[22px] bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                                    <img
                                        src="/apple-icon.png"
                                        alt="CRMS6 IT Logo"
                                        className="w-16 h-16 object-contain"
                                    />
                                </div>
                            </div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                                <Sparkles size={12} className="text-white" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">CRMS6 IT</h1>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1">งานโสตทัศนศึกษา</p>
                    </div>

                    {/* Login Form */}
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">ยินดีต้อนรับ</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">กรุณาใช้อีเมล @tesaban6.ac.th เพื่อเข้าสู่ระบบ</p>
                        </div>

                        <button
                            onClick={signInWithGoogle}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all shadow-sm hover:shadow-md group tap-scale"
                        >
                            <img
                                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                alt="Google"
                                className="w-6 h-6"
                            />
                            <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                Sign in with Google
                            </span>
                        </button>

                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                            การเข้าสู่ระบบหมายความว่าคุณยอมรับนโยบายการใช้งานภายใน
                        </p>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
                    © {new Date().getFullYear()} CRMS6 IT Department. All rights reserved.
                </p>
            </div>
        </div>
    );
}
