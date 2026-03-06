"use client";

import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { motion } from "framer-motion";

interface NotificationToggleProps {
    className?: string;
    showLabel?: boolean;
}

export default function NotificationToggle({ className = "", showLabel = true }: NotificationToggleProps) {
    const { isSupported, isEnabled, isLoading, permissionStatus, enableNotifications, disableNotifications } = usePushNotifications();

    // Don't render if not supported
    if (!isSupported) {
        return null; // Or show message that it's not supported
    }

    const handleToggle = async () => {
        if (isLoading) return;

        if (isEnabled) {
            await disableNotifications();
        } else {
            await enableNotifications();
        }
    };

    const isDisabled = isLoading || permissionStatus === "denied";

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {showLabel && (
                <span className={`text-sm font-medium ${isEnabled ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {isLoading ? "กำลังโหลด..." : isEnabled ? "เปิดใช้งานแล้ว" : "ปิดใช้งาน"}
                </span>
            )}

            <button
                onClick={handleToggle}
                disabled={isDisabled}
                className={`
                    relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                    ${isEnabled ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'}
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <span
                    className={`
                        inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300
                        ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
                    `}
                />
            </button>

            {permissionStatus === "denied" && (
                <span className="text-xs text-red-500">ถูกบล็อก</span>
            )}
        </div>
    );
}

/**
 * Compact version for header/nav
 */
export function NotificationBell() {
    const { isSupported, isEnabled, isLoading, enableNotifications } = usePushNotifications();

    if (!isSupported) return null;

    return (
        <button
            onClick={enableNotifications}
            disabled={isLoading || isEnabled}
            className={`relative p-2 rounded-lg transition-colors ${isEnabled
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
            title={isEnabled ? "การแจ้งเตือนเปิดอยู่" : "เปิดการแจ้งเตือน"}
        >
            {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
            ) : isEnabled ? (
                <BellRing size={20} />
            ) : (
                <Bell size={20} />
            )}
            {!isEnabled && !isLoading && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            )}
        </button>
    );
}
