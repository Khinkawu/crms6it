"use client";

import { useState, useEffect } from "react";
import liff from "@line/liff";

export interface LiffProfile {
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
}

interface UseLiffReturn {
    profile: LiffProfile | null;
    isLoggedIn: boolean;
    error: string | null;
}

export function useLiff(liffId: string): UseLiffReturn {
    const [profile, setProfile] = useState<LiffProfile | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // SSR Check
        if (typeof window === "undefined") return;

        const initializeLiff = async () => {
            try {
                await liff.init({ liffId });

                if (!liff.isLoggedIn()) {
                    liff.login();
                    return;
                }

                setIsLoggedIn(true);
                const userProfile = await liff.getProfile();
                setProfile(userProfile as LiffProfile);

            } catch (err: any) {
                console.error("LIFF Initialization Error:", err);
                setError(err.message || "Failed to initialize LIFF");
            }
        };

        if (liffId) {
            initializeLiff();
        } else {
            setError("LIFF ID is invalid or missing");
        }

    }, [liffId]);

    return { profile, isLoggedIn, error };
}
