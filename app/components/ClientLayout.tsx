"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Define routes that should NOT have the sidebar/layout wrapper
    const isFullScreenPage = pathname === "/login";

    if (isFullScreenPage) {
        return <>{children}</>;
    }

    return (
        <>
            <Sidebar />
            <main className="relative min-h-screen md:ml-64 p-4 md:p-8 transition-all duration-300">
                <div className="max-w-7xl mx-auto pt-16 md:pt-0">
                    {children}
                </div>
            </main>
        </>
    );
}
