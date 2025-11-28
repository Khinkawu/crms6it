"use client";

import React, { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";

const LoginPage = () => {
    const { user, signInWithGoogle, error, clearError } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.push("/");
        }
    }, [user, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 p-4">
            {/* Glass Card */}
            <div className="relative w-full max-w-md p-8 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">

                {/* Decorative background elements inside the card */}
                <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-blue-400/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-50px] right-[-50px] w-32 h-32 bg-cyan-400/30 rounded-full blur-3xl"></div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Welcome Back</h1>
                    <p className="text-blue-100 mb-8">Sign in to access the Stock Management System</p>

                    {/* Error Alert */}
                    {error && (
                        <div className="w-full mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 backdrop-blur-md text-white text-sm animate-pulse">
                            <div className="flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-200" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span>{error}</span>
                            </div>
                            <button onClick={clearError} className="absolute top-2 right-2 text-white/50 hover:text-white">
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Google Sign In Button */}
                    <button
                        onClick={signInWithGoogle}
                        className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 transition-all duration-300 shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <div className="p-1 bg-white rounded-full">
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 4.66c1.61 0 3.1.56 4.28 1.69l3.19-3.19C17.45 1.14 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                        </div>
                        <span className="text-white font-semibold text-lg tracking-wide">Sign in with Google</span>
                    </button>

                    <div className="mt-8 text-blue-200/60 text-xs">
                        <p>Restricted Access: @tesaban6.ac.th only</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
