"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useSessionTimeout } from "../../hooks/useSessionTimeout";
import ErrorBoundary from "./ErrorBoundary";
import BottomNavigation from "./navigation/BottomNavigation";
import TopHeader from "./navigation/TopHeader";
import SideQuickAccess from "./navigation/SideQuickAccess";
import CommandPalette from "./navigation/CommandPalette";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

    // Session timeout - auto logout after 60 minutes of inactivity
    useSessionTimeout({
        timeoutMinutes: 60,
        warningMinutes: 5
    });

    // Global keyboard shortcut for Command Palette
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

    // Define routes that should NOT have the navigation wrapper
    const isFullScreenPage = pathname === "/login" || pathname?.startsWith("/liff");

    if (isFullScreenPage) {
        return <ErrorBoundary>{children}</ErrorBoundary>;
    }

    return (
        <ErrorBoundary>
            {/* Desktop: Top Header */}
            <TopHeader onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

            {/* Desktop: Side Quick Access */}
            <SideQuickAccess onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

            {/* Main Content Area */}
            <main className="relative min-h-screen transition-all duration-300">
                {/* Padding adjustments for navigation */}
                {/* Mobile: pt-4, pb-24 (for bottom nav) */}
                {/* Desktop: pt-20 (for top header), pl-20 (for side quick access) */}
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 pt-4 pb-24 md:pt-20 md:pb-8 md:pl-20">
                    {children}
                </div>
            </main>

            {/* Mobile: Bottom Navigation */}
            <BottomNavigation />

            {/* Command Palette (Global) */}
            <CommandPalette
                isOpen={commandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
            />
        </ErrorBoundary>
    );
}
