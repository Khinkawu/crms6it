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
    const [status, setStatus] = useState("Checking permissions...");
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const checkBindingAndLogin = async () => {
            if (!isLoggedIn || !profile) return;

            try {
                setStatus("Synchronizing account...");
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

                const { token } = await res.json();

                // Silent Login
                await signInWithCustomToken(auth, token);

                setIsReady(true);

            } catch (err) {
                console.error(err);
                setStatus("Error: " + (err as any).message);
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-white">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-500 font-medium animate-pulse">{status}</p>
        </div>
    );
}
