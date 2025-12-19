"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { setupPushNotifications, onForegroundMessage, isFCMSupported } from "@/lib/fcm";
import toast from "react-hot-toast";

interface UsePushNotificationsReturn {
    isSupported: boolean;
    isEnabled: boolean;
    isLoading: boolean;
    permissionStatus: NotificationPermission | "unsupported";
    enableNotifications: () => Promise<boolean>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
    const { user } = useAuth();
    const [isSupported, setIsSupported] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | "unsupported">("default");

    // Check FCM support on mount
    useEffect(() => {
        async function checkSupport() {
            const supported = await isFCMSupported();
            setIsSupported(supported);

            if (supported && typeof Notification !== "undefined") {
                setPermissionStatus(Notification.permission);
                setIsEnabled(Notification.permission === "granted");
            } else {
                setPermissionStatus("unsupported");
            }

            setIsLoading(false);
        }
        checkSupport();
    }, []);

    // Setup foreground message listener
    useEffect(() => {
        if (!isSupported || !isEnabled || !user) return;

        const unsubscribe = onForegroundMessage((payload) => {
            // Show toast for foreground notifications
            const title = payload.notification?.title || "แจ้งเตือน";
            const body = payload.notification?.body || "";

            toast(
                `🔔 ${title}\n${body}`,
                {
                    duration: 5000,
                    style: {
                        background: '#4F46E5',
                        color: '#fff',
                        padding: '16px',
                        borderRadius: '12px',
                    },
                }
            );
        });

        return () => unsubscribe();
    }, [isSupported, isEnabled, user]);

    // Enable notifications
    const enableNotifications = useCallback(async (): Promise<boolean> => {
        if (!user) {
            toast.error("กรุณาเข้าสู่ระบบก่อน");
            return false;
        }

        if (!isSupported) {
            toast.error("เบราว์เซอร์ไม่รองรับการแจ้งเตือน");
            return false;
        }

        setIsLoading(true);

        try {
            const success = await setupPushNotifications(user.uid);

            if (success) {
                setIsEnabled(true);
                setPermissionStatus("granted");
                toast.success("เปิดการแจ้งเตือนสำเร็จ! 🔔");
                return true;
            } else {
                toast.error("ไม่สามารถเปิดการแจ้งเตือนได้");
                return false;
            }
        } catch (error) {
            console.error("Error enabling notifications:", error);
            toast.error("เกิดข้อผิดพลาดในการเปิดการแจ้งเตือน");
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [user, isSupported]);

    return {
        isSupported,
        isEnabled,
        isLoading,
        permissionStatus,
        enableNotifications,
    };
}
