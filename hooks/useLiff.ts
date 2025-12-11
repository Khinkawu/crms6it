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
    isLoading: boolean;
    error: string | null;
}

export function useLiff(liffId: string): UseLiffReturn {
    const [profile, setProfile] = useState<LiffProfile | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // SSR Check
        if (typeof window === "undefined") return;

        const initializeLiff = async () => {
            try {
                setIsLoading(true);

                // Race liff.init with a 10s timeout
                await Promise.race([
                    liff.init({ liffId }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("LIFF initialization timeout")), 10000)
                    )
                ]);

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
            } finally {
                setIsLoading(false);
            }
        };

        if (liffId) {
            initializeLiff();
        } else {
            setError("LIFF ID is invalid or missing");
            setIsLoading(false);
        }

    }, [liffId]);

    return { profile, isLoggedIn, isLoading, error };
}
