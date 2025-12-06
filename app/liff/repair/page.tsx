"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "../../../hooks/useLiff";
import { Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import liff from "@line/liff";

export default function RepairLiffPage() {
    const { profile, isLoggedIn, error } = useLiff(process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR || "");
    const router = useRouter();
    const [status, setStatus] = useState("Checking permissions...");

    useEffect(() => {
        const checkBinding = async () => {
            if (!isLoggedIn || !profile) return;

            try {
                // Check if this LINE user is bound to a school account
                const docRef = doc(db, "line_bindings", profile.userId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setStatus("Redirecting to Repair System...");
                    // If bound, open the actual Web App in External Browser
                    // (Use external browser because the Web App needs Firebase Auth Cookie/Session)
                    if (liff.isInClient()) {
                        liff.openWindow({
                            url: `${window.location.origin}/repair`,
                            external: true
                        });
                    } else {
                        // If already in external browser, just go there
                        router.push("/repair");
                    }
                } else {
                    // Not bound -> Go to Entry (Binding) Page
                    router.push("/liff/entry");
                }
            } catch (err) {
                console.error(err);
                setStatus("Error checking binding.");
            }
        };

        checkBinding();
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

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-500 font-medium animate-pulse">{status}</p>
        </div>
    );
}
