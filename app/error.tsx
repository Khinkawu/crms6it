"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[App Error]", error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-background">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-text mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-text-secondary mb-6 max-w-md">
                ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง
            </p>
            {process.env.NODE_ENV === "development" && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-left max-w-lg w-full overflow-auto">
                    <p className="text-sm font-mono text-red-600 dark:text-red-400">{error.message}</p>
                </div>
            )}
            <div className="flex gap-3">
                <button
                    onClick={reset}
                    className="flex items-center gap-2 px-6 py-3 bg-card border border-border rounded-xl font-medium text-text hover:bg-background transition-colors"
                >
                    <RefreshCw size={18} />
                    ลองใหม่
                </button>
                <button
                    onClick={() => (window.location.href = "/")}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-all"
                >
                    <Home size={18} />
                    กลับหน้าหลัก
                </button>
            </div>
        </div>
    );
}
