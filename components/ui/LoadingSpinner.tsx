"use client";

import React from "react";

interface LoadingSpinnerProps {
    size?: "sm" | "md" | "lg" | "xl";
    text?: string;
    fullScreen?: boolean;
}

const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-10 h-10 border-3",
    xl: "w-16 h-16 border-4"
};

/**
 * Modern loading spinner with optional text
 */
export default function LoadingSpinner({
    size = "md",
    text,
    fullScreen = false
}: LoadingSpinnerProps) {
    const spinner = (
        <div className="flex flex-col items-center justify-center gap-3">
            <div
                className={`
                    ${sizeClasses[size]}
                    border-gray-200 dark:border-gray-700
                    border-t-cyan-500
                    rounded-full
                    animate-spin
                `}
            />
            {text && (
                <p className="text-sm text-text-secondary font-medium animate-pulse">
                    {text}
                </p>
            )}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
                {spinner}
            </div>
        );
    }

    return spinner;
}

/**
 * Loading overlay for sections
 */
export function LoadingOverlay({ text }: { text?: string }) {
    return (
        <div className="absolute inset-0 bg-card/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-inherit">
            <LoadingSpinner size="lg" text={text} />
        </div>
    );
}

/**
 * Button loading state
 */
export function ButtonSpinner() {
    return (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    );
}
