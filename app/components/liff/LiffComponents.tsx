"use client";

import React from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface LiffSkeletonProps {
    status?: string;
    showProgress?: boolean;
}

/**
 * Shared loading skeleton for LIFF pages
 * Provides consistent loading experience across all LIFF mini apps
 */
export function LiffSkeleton({ status = "กรุณารอสักครู่...", showProgress = true }: LiffSkeletonProps) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white px-8 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-green-50 rounded-full blur-3xl opacity-60"></div>

            <div className="w-full max-w-sm space-y-8 text-center relative z-10">
                <div className="relative w-32 h-32 mx-auto mb-6 animate-liff-fade-in">
                    <img src="/logo_2.png" alt="Logo" className="w-full h-full object-contain drop-shadow-sm" />
                </div>

                <div className="space-y-4">
                    <h3 className="text-gray-800 font-semibold text-xl tracking-tight">{status}</h3>

                    {showProgress && (
                        <div className="w-48 mx-auto h-1.5 bg-gray-100 rounded-full overflow-hidden relative shadow-inner">
                            <div className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-liff-progress shadow-lg"></div>
                        </div>
                    )}
                </div>

                <div className="pt-4">
                    <p className="text-xs text-gray-400 font-light tracking-wide">
                        ระบบกำลังตรวจสอบข้อมูลจากเซิร์ฟเวอร์
                        <br />
                        เพื่อให้มั่นใจในความปลอดภัยของคุณ
                    </p>
                </div>
            </div>
        </div>
    );
}

interface LiffErrorProps {
    error: string;
    liffId?: string;
    onRetry?: () => void;
}

/**
 * Shared error display for LIFF pages
 */
export function LiffError({ error, liffId, onRetry }: LiffErrorProps) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-red-50 text-red-600 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="font-bold text-lg mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-sm mb-4 max-w-xs">{error}</p>
            {process.env.NODE_ENV === 'development' && liffId && (
                <div className="text-xs text-gray-400 mb-4">ID: {liffId}</div>
            )}
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                    ลองใหม่อีกครั้ง
                </button>
            )}
        </div>
    );
}

/**
 * Haptic feedback utility for LINE LIFF
 * Provides vibration feedback on supported devices
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        const patterns: Record<string, number | number[]> = {
            light: 10,
            medium: 25,
            heavy: 50
        };
        navigator.vibrate(patterns[type]);
    }
}

/**
 * Button with haptic feedback
 */
interface HapticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    hapticType?: 'light' | 'medium' | 'heavy';
    children: React.ReactNode;
}

export function HapticButton({ hapticType = 'light', onClick, children, ...props }: HapticButtonProps) {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        triggerHaptic(hapticType);
        onClick?.(e);
    };

    return (
        <button onClick={handleClick} {...props}>
            {children}
        </button>
    );
}
