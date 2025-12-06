"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "../../../hooks/useLiff";
import { Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { signInWithCustomToken } from "firebase/auth";
import { db, auth } from "../../../lib/firebase";
import RepairForm from "../../../components/repair/RepairForm";

export default function RepairLiffPage() {
    const { profile, isLoggedIn, error } = useLiff(process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR || "");
    const router = useRouter();
    const [status, setStatus] = useState("Checking permissions...");
    const [isReady, setIsReady] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string>("");

    useEffect(() => {
        const checkBindingAndLogin = async () => {
            // Basic Debug Info
            const debug = [
                `Ver: v2.1`,
                `Online: ${navigator.onLine}`,
                `LIFF: ${isLoggedIn ? "Yes" : "No"}`,
                `UID: ${profile?.userId?.slice(0, 5) || "N/A"}`,
                `API: ${process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "OK" : "MISSING"}`,
                `Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "MISSING"}`,
                `AuthDom: ${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "MISSING"}`
            ].join(" | ");
            setDebugInfo(debug);

            if (!isLoggedIn || !profile) return;

            try {
                // Optimize: Skip client-side getDoc. Use API to check binding & get token.
                setStatus("Synchronizing account...");

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

                // Sign In to Firebase (Silent)
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
                <div className="mt-2 text-xs text-gray-400">ID: {process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR}</div>
            </div>
        );
    }

    if (isReady) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-0">
                {/* Render Form Directly! */}
                <RepairForm />
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
