"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { setupPushNotifications, onForegroundMessage, isFCMSupported, unsubscribeFromPushNotifications } from "@/lib/fcm";
import toast from "react-hot-toast";

const NOTIFICATION_STORAGE_KEY = "push_notifications_enabled";

interface UsePushNotificationsReturn {
    isSupported: boolean;
    isEnabled: boolean;
    isLoading: boolean;
    permissionStatus: NotificationPermission | "unsupported";
    enableNotifications: () => Promise<boolean>;
    disableNotifications: () => Promise<boolean>;
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
                const permission = Notification.permission;
                setPermissionStatus(permission);

                // Check localStorage first, fallback to permission check
                const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
                if (stored !== null) {
                    setIsEnabled(stored === 'true');
                } else {
                    setIsEnabled(permission === "granted");
                }
            } else {
                setPermissionStatus("unsupported");
            }

            setIsLoading(false);
        }
        checkSupport();
    }, []);

    // Listen for storage changes (cross-tab sync only — storage event doesn't fire within same tab)
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === NOTIFICATION_STORAGE_KEY) {
                setIsEnabled(e.newValue === 'true');
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Setup foreground message listener
    useEffect(() => {
        if (!isSupported || !isEnabled || !user) return;

        const unsubscribe = onForegroundMessage((payload) => {
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
                // Save to localStorage for cross-component sync
                localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'true');
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

    // Disable notifications
    const disableNotifications = useCallback(async (): Promise<boolean> => {
        if (!user) return false;

        setIsLoading(true);
        try {
            const success = await unsubscribeFromPushNotifications(user.uid);
            if (success) {
                setIsEnabled(false);
                // Save to localStorage for cross-component sync
                localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'false');
                toast.success("ปิดการแจ้งเตือนแล้ว");
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error disabling notifications:", error);
            toast.error("เกิดข้อผิดพลาดในการปิดการแจ้งเตือน");
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    return {
        isSupported,
        isEnabled,
        isLoading,
        permissionStatus,
        enableNotifications,
        disableNotifications,
    };
}
