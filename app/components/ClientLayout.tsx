"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { useSessionTimeout } from "../../hooks/useSessionTimeout";
import ErrorBoundary from "./ErrorBoundary";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Session timeout - auto logout after 60 minutes of inactivity
    useSessionTimeout({
        timeoutMinutes: 60,
        warningMinutes: 5
    });

    // Define routes that should NOT have the sidebar/layout wrapper
    const isFullScreenPage = pathname === "/login" || pathname?.startsWith("/liff");

    if (isFullScreenPage) {
        return <ErrorBoundary>{children}</ErrorBoundary>;
    }

    return (
        <ErrorBoundary>
            <Sidebar />
            <main className="relative min-h-screen md:ml-64 p-4 md:p-8 transition-all duration-300">
                <div className="max-w-7xl mx-auto pt-16 md:pt-0">
                    {children}
                </div>
            </main>
        </ErrorBoundary>
    );
}
