"use client";

import React, { useEffect, useState } from "react";
import liff from "@line/liff";
import { auth, db } from "../../../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, LogIn, AlertCircle } from "lucide-react";

export default function LIFFEntryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [lineUserId, setLineUserId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initializeLiff = async () => {
            try {
                const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR || process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";
                console.log("Initializing LIFF with ID:", liffId);

                if (!liffId) {
                    throw new Error("LIFF ID is missing in Environment Variables");
                }

                // Race liff.init with a 5s timeout
                await Promise.race([
                    liff.init({ liffId }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("LIFF Init Timeout")), 5000))
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
                    toast.success("Welcome back!");
                    router.push("/repair");
                } else {
                    setIsLoading(false);
                }

            } catch (err: any) {
                console.error("LIFF Init Error:", err);
                setError(err.message || "Failed to initialize LINE.");
                setIsLoading(false);
            }
        };

        initializeLiff();
    }, [router]);

    const handleGoogleLogin = async () => {
        if (!lineUserId) {
            toast.error("No LINE User ID found. Please reload.");
            return;
        }

        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            if (!user.email?.endsWith("@tesaban6.ac.th")) {
                toast.error("Only @tesaban6.ac.th accounts are allowed.");
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

            toast.success("Account linked successfully!");
            router.push("/repair");

        } catch (err: any) {
            console.error("Login Error:", err);
            toast.error("Login failed. Please try again.");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Connecting to system...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle size={32} />
                </div>
                <h1 className="text-xl font-bold text-gray-800 mb-2">Connection Error</h1>
                <p className="text-gray-500 mb-2 max-w-xs mx-auto">{error}</p>
                <div className="text-xs text-gray-400 mb-6 font-mono bg-gray-100 p-2 rounded">
                    LID: {process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR || 'MISSING'}
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
                >
                    Reload
                </button>
            </div>
        );
    }

    // If inside LINE App and NOT bound, force external browser for Google Login
    // If inside LINE App (Client) AND not loading
    if (!isLoading && liff.isInClient()) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
                <div className="w-20 h-20 mb-6 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                    <LogIn size={40} />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-3">
                    One-Time Setup Required
                </h1>
                <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                    To link your school account securely, please open this page in your system browser (Safari/Chrome).
                </p>
                <button
                    onClick={async () => {
                        // Force external browser
                        liff.openWindow({ url: window.location.href, external: true });
                    }}
                    className="w-full max-w-sm bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-blue-700 transition"
                >
                    Open in Browser
                </button>
                <p className="mt-6 text-xs text-gray-400">
                    You only need to do this once.
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto w-full">
                <div className="w-24 h-24 mb-6">
                    <img src="/logo_2.png" alt="Logo" className="w-full h-full object-contain" />
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Link Your Account
                </h1>
                <p className="text-gray-500 mb-8 leading-relaxed">
                    To use the Repair System via LINE, please link your @tesaban6.ac.th account.
                </p>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold py-3.5 px-6 rounded-xl shadow-sm hover:bg-gray-50 hover:shadow-md transition-all active:scale-[0.98]"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    <span>Sign in with Google</span>
                </button>

                <p className="mt-8 text-xs text-gray-400">
                    Secure authentication provided by Firebase
                </p>
            </div>
        </div>
    );
}
