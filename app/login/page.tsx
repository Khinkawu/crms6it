"use client";

import React, { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.push("/");
        }
    }, [user, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary-start/10 rounded-full blur-3xl animate-fade-in"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary-end/10 rounded-full blur-3xl animate-fade-in delay-100"></div>
            </div>

            <div className="w-full max-w-md animate-fade-in-up relative z-10">
                <div className="card p-8 md:p-10 text-center shadow-soft-lg border-t-4 border-t-primary-start">

                    {/* Logo Area */}
                    <div className="mb-8 flex flex-col items-center">
                        <img
                            src="/logo_2.png"
                            alt="CRMS6 IT Logo"
                            className="w-24 h-24 mb-4 object-contain"
                        />
                        <h1 className="text-3xl font-bold text-text tracking-tight">CRMS6 IT</h1>
                        <p className="text-sm font-medium text-text-secondary uppercase tracking-widest mt-1">งานโสตทัศนศึกษา</p>
                    </div>

                    {/* Login Form */}
                    <div className="space-y-6">
                        <div className="text-left">
                            <h2 className="text-xl font-semibold text-text mb-2">Welcome</h2>
                            <p className="text-text-secondary text-sm">กรุณาใช้ E-mail @tesaban6.ac.th เพื่อเข้าสู่ระบบเท่านั้น</p>
                        </div>

                        <button
                            onClick={signInWithGoogle}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-card border border-border hover:bg-input-bg transition-all shadow-sm hover:shadow-md group"
                        >
                            <img
                                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                alt="Google"
                                className="w-6 h-6"
                            />
                            <span className="font-medium text-text group-hover:text-primary-start transition-colors">
                                Sign in with Google
                            </span>
                        </button>

                        <p className="text-xs text-text-secondary mt-8">
                            By signing in, you agree to the internal usage policy.
                        </p>
                    </div>
                </div>

                <p className="text-center text-xs text-text-secondary mt-8 opacity-60">
                    © {new Date().getFullYear()} CRMS6 IT Department. All rights reserved.
                </p>
            </div>
        </div>
    );
}
