"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Admin Error]", error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">โหลดข้อมูลไม่สำเร็จ</h2>
            <p className="text-text-secondary mb-6 text-sm">
                เกิดข้อผิดพลาดในการโหลดหน้านี้ กรุณาลองใหม่อีกครั้ง
            </p>
            {process.env.NODE_ENV === "development" && (
                <p className="mb-4 text-xs font-mono text-red-500 max-w-sm">{error.message}</p>
            )}
            <button
                onClick={reset}
                className="flex items-center gap-2 px-5 py-2.5 bg-card border border-border rounded-xl font-medium text-text hover:bg-background transition-colors"
            >
                <RefreshCw size={16} />
                ลองใหม่
            </button>
        </div>
    );
}

