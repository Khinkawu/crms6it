"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

interface UseSessionTimeoutOptions {
    timeoutMinutes?: number;
    warningMinutes?: number;
    onTimeout?: () => void;
    onWarning?: () => void;
}

/**
 * Hook for session timeout with user activity detection
 * @param options Configuration options
 */
export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
    const {
        timeoutMinutes = 60,  // 1 hour default
        warningMinutes = 5,   // 5 minute warning
        onTimeout,
        onWarning
    } = options;

    const { user, signOut } = useAuth();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const warningRef = useRef<NodeJS.Timeout | null>(null);
    const warningShownRef = useRef(false);

    const handleTimeout = useCallback(() => {
        if (onTimeout) {
            onTimeout();
        } else {
            toast.error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", {
                duration: 5000,
                icon: "⏰"
            });
            signOut();
        }
    }, [onTimeout, signOut]);

    const handleWarning = useCallback(() => {
        if (!warningShownRef.current) {
            warningShownRef.current = true;
            if (onWarning) {
                onWarning();
            } else {
                toast("เซสชันจะหมดอายุใน " + warningMinutes + " นาที", {
                    duration: 10000,
                    icon: "⚠️"
                });
            }
        }
    }, [onWarning, warningMinutes]);

    const resetTimers = useCallback(() => {
        // Clear existing timers
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (warningRef.current) {
            clearTimeout(warningRef.current);
        }

        warningShownRef.current = false;

        if (!user) return;

        const timeoutMs = timeoutMinutes * 60 * 1000;
        const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;

        // Set warning timer
        warningRef.current = setTimeout(handleWarning, warningMs);

        // Set timeout timer
        timeoutRef.current = setTimeout(handleTimeout, timeoutMs);
    }, [user, timeoutMinutes, warningMinutes, handleWarning, handleTimeout]);

    // Initialize and setup activity listeners
    useEffect(() => {
        if (!user) return;

        const activityEvents = [
            "mousedown",
            "mousemove",
            "keydown",
            "scroll",
            "touchstart",
            "click"
        ];

        // Throttle reset to avoid too many calls
        let lastReset = Date.now();
        const throttledReset = () => {
            const now = Date.now();
            if (now - lastReset > 30000) { // Only reset every 30 seconds
                lastReset = now;
                resetTimers();
            }
        };

        // Add event listeners
        activityEvents.forEach(event => {
            document.addEventListener(event, throttledReset, { passive: true });
        });

        // Initial timer setup
        resetTimers();

        // Cleanup
        return () => {
            activityEvents.forEach(event => {
                document.removeEventListener(event, throttledReset);
            });
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (warningRef.current) {
                clearTimeout(warningRef.current);
            }
        };
    }, [user, resetTimers]);

    return {
        resetTimers
    };
}
