"use client";

import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { motion } from "framer-motion";

interface NotificationToggleProps {
    className?: string;
    showLabel?: boolean;
}

export default function NotificationToggle({ className = "", showLabel = true }: NotificationToggleProps) {
    const { isSupported, isEnabled, isLoading, permissionStatus, enableNotifications } = usePushNotifications();

    // Don't render if not supported
    if (!isSupported) {
        return null;
    }

    const handleClick = async () => {
        if (isEnabled) {
            // Already enabled, maybe show info
            return;
        }
        await enableNotifications();
    };

    const getStatusIcon = () => {
        if (isLoading) {
            return <Loader2 size={20} className="animate-spin" />;
        }
        if (isEnabled) {
            return <BellRing size={20} />;
        }
        if (permissionStatus === "denied") {
            return <BellOff size={20} />;
        }
        return <Bell size={20} />;
    };

    const getStatusText = () => {
        if (isLoading) return "กำลังโหลด...";
        if (isEnabled) return "เปิดการแจ้งเตือนแล้ว";
        if (permissionStatus === "denied") return "การแจ้งเตือนถูกบล็อก";
        return "เปิดการแจ้งเตือน";
    };

    const getButtonStyle = () => {
        if (isEnabled) {
            return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
        }
        if (permissionStatus === "denied") {
            return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 cursor-not-allowed";
        }
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900/50";
    };

    return (
        <motion.button
            onClick={handleClick}
            disabled={isLoading || isEnabled || permissionStatus === "denied"}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium transition-all ${getButtonStyle()} ${className}`}
            whileTap={{ scale: 0.98 }}
        >
            {getStatusIcon()}
            {showLabel && (
                <span className="text-sm">{getStatusText()}</span>
            )}
        </motion.button>
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
