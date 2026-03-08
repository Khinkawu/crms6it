"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import ErrorBoundary from "./ErrorBoundary";
import BottomNavigation from "./navigation/BottomNavigation";
import Sidebar from "./navigation/Sidebar";
import TopHeader from "./navigation/TopHeader";
import CommandPalette from "./navigation/CommandPalette";
import { useAuth } from "@/context/AuthContext";
import { isFCMSupported, setupPushNotifications } from "@/lib/fcm";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { user } = useAuth();

    // Auto-register FCM token after login — mobile only (push to desktop = noise, bell is enough)
    useEffect(() => {
        if (!user) return;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (!isMobile) return;
        async function autoRegister() {
            const supported = await isFCMSupported();
            if (!supported || typeof Notification === 'undefined') return;
            if (Notification.permission === 'denied') return;
            setupPushNotifications(user!.uid).catch(() => {});
        }
        autoRegister();
    }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            e.preventDefault();
            setCommandPaletteOpen(prev => !prev);
        }
    }, []);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    const isFullScreenPage = pathname === "/login" || pathname?.startsWith("/liff");

    if (isFullScreenPage) {
        return <ErrorBoundary>{children}</ErrorBoundary>;
    }

    const sidebarW = sidebarCollapsed ? "left-16" : "left-60";
    const contentML = sidebarCollapsed ? "md:ml-16" : "md:ml-60";

    return (
        <ErrorBoundary>
            {/* Desktop: Sidebar */}
            <Suspense fallback={null}>
                <Sidebar
                    onOpenCommandPalette={() => setCommandPaletteOpen(true)}
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(prev => !prev)}
                />
            </Suspense>

            {/* Desktop: Top Header (right of sidebar) */}
            <div className={`hidden md:block fixed top-0 right-0 ${sidebarW} h-16 z-30 transition-all duration-300`}>
                <TopHeader onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
            </div>

            {/* Main Content */}
            <main className="min-h-screen transition-all duration-300">
                <div className={`px-4 pt-4 pb-24 ${contentML} md:pt-20 md:pb-8 md:px-8 transition-all duration-300`}>
                    {children}
                </div>
            </main>

            {/* Mobile: Bottom Navigation */}
            <Suspense fallback={null}>
                <BottomNavigation />
            </Suspense>

            {/* Command Palette (Global) */}
            <CommandPalette
                isOpen={commandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
            />
        </ErrorBoundary>
    );
}
