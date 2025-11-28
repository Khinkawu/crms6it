"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";

export default function Sidebar() {
    const { user, signOut } = useAuth();
    const pathname = usePathname();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    if (!user) return null;

    const menuItems = [
        { name: "Dashboard", icon: "🏠", path: "/" },
        { name: "Inventory", icon: "📦", path: "/admin/inventory" },
        { name: "Scan QR", icon: "📷", path: "/scan" },
    ];

    const upcomingItems = [
        { name: "Repair System", icon: "🔧", path: "/repair" },
        { name: "Meeting Room", icon: "📅", path: "/booking" },
    ];

    const isActive = (path: string) => pathname === path;

    return (
        <>
            {/* Mobile Hamburger */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white/10 border border-white/10 text-white backdrop-blur-md"
            >
                {isMobileOpen ? "✕" : "☰"}
            </button>

            {/* Sidebar Container */}
            <aside className={`
                fixed top-0 left-0 h-full w-64 z-40
                bg-[#0f172a]/80 backdrop-blur-xl border-r border-white/10
                transition-transform duration-300 ease-in-out
                ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}>
                <div className="flex flex-col h-full p-6">
                    {/* Logo Area */}
                    <div className="mb-8 px-2">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                            Super App
                        </h1>
                        <p className="text-xs text-white/40 mt-1">Stock & Services</p>
                    </div>

                    {/* Main Menu */}
                    <nav className="space-y-2 flex-1">
                        {menuItems.map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                onClick={() => setIsMobileOpen(false)}
                                className={`
                                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                                    ${isActive(item.path)
                                        ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                                        : "text-white/60 hover:bg-white/5 hover:text-white hover:pl-5"
                                    }
                                `}
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span className="font-medium">{item.name}</span>
                            </Link>
                        ))}

                        <div className="my-4 border-t border-white/10 mx-2"></div>
                        <p className="px-4 text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">
                            Coming Soon
                        </p>

                        {upcomingItems.map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                onClick={() => setIsMobileOpen(false)}
                                className={`
                                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 opacity-60
                                    ${isActive(item.path)
                                        ? "bg-white/10 text-white"
                                        : "text-white/40 hover:bg-white/5 hover:text-white/80"
                                    }
                                `}
                            >
                                <span className="text-xl grayscale">{item.icon}</span>
                                <span className="font-medium">{item.name}</span>
                            </Link>
                        ))}
                    </nav>

                    {/* User Profile & Logout */}
                    <div className="mt-auto pt-6 border-t border-white/10">
                        <div className="flex items-center gap-3 mb-4 px-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 p-[1px]">
                                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-lg font-bold text-white">
                                            {user.displayName?.charAt(0) || user.email?.charAt(0)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {user.displayName || "User"}
                                </p>
                                <p className="text-xs text-white/40 truncate">
                                    {user.email}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={signOut}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm font-medium"
                        >
                            <span>🚪</span> Log Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-fade-in"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}
        </>
    );
}
