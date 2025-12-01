"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useState } from "react";

export default function Sidebar() {
    const { user, role, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const pathname = usePathname();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    if (!user) return null;

    const allMenuItems = [
        { name: "Dashboard", icon: "grid_view", path: "/", roles: ['user', 'technician', 'admin'] },
        { name: "ระบบจัดการอุปกรณ์", icon: "inventory_2", path: "/admin/inventory", roles: ['technician', 'admin'] },
        { name: "ระบบงานซ่อม", icon: "build", path: "/admin/repairs", roles: ['technician', 'admin'] },
        { name: "จัดการผู้ใช้", icon: "group", path: "/admin/users", roles: ['admin'] },
    ];

    const menuItems = allMenuItems.filter(item => role && item.roles.includes(role));

    const upcomingItems = [
        { name: "ระบบแจ้งซ่อม", icon: "history", path: "/repair" },
        { name: "ระบบจองห้องประชุม", icon: "event", path: "/booking" },
    ];

    const isActive = (path: string) => pathname === path;

    return (
        <>
            {/* Mobile Hamburger */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border text-text shadow-sm"
            >
                {isMobileOpen ? "✕" : "☰"}
            </button>

            {/* Sidebar Container */}
            <aside className={`
                fixed top-0 left-0 h-full w-64 z-40
                bg-card border-r border-border shadow-soft
                transition-transform duration-300 ease-in-out
                ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}>
                <div className="flex flex-col h-full">
                    {/* Logo Area */}
                    <div className="p-8">
                        <div className="flex items-center gap-3">
                            <img src="/logo_2.png" alt="Logo" className="w-20 h-auto object-contain" />
                            <div>
                                <h1 className="text-xl font-bold text-text tracking-tight">CRMS6 IT</h1>
                                <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">งานโสต</p>
                            </div>
                        </div>
                    </div>

                    {/* Main Menu */}
                    <nav className="flex-1 px-4 space-y-1">
                        <p className="px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4 mt-2">Menu</p>

                        {menuItems.map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                onClick={() => setIsMobileOpen(false)}
                                className={`
                                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden
                                    ${isActive(item.path)
                                        ? "bg-primary-start/10 text-primary-start font-semibold"
                                        : "text-text-secondary hover:bg-background hover:text-text"
                                    }
                                `}
                            >
                                {isActive(item.path) && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-gradient rounded-r-full"></div>
                                )}
                                <span className={`text-lg ${isActive(item.path) ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}>
                                    {/* Icons mapped to emojis for now, can be replaced with SVGs */}
                                    {item.icon === "grid_view" && "📊"}
                                    {item.icon === "inventory_2" && "📦"}
                                    {item.icon === "build" && "🔧"}
                                    {item.icon === "group" && "👥"}
                                    {item.icon === "qr_code_scanner" && "📷"}
                                </span>
                                <span>{item.name}</span>
                            </Link>
                        ))}

                        <div className="my-6 border-t border-border mx-4"></div>
                        <p className="px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">General</p>

                        {upcomingItems.map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                onClick={() => setIsMobileOpen(false)}
                                className={`
                                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                                    ${isActive(item.path)
                                        ? "bg-primary-start/10 text-primary-start font-semibold"
                                        : "text-text-secondary hover:bg-background hover:text-text"
                                    }
                                `}
                            >
                                <span className="text-lg opacity-70 group-hover:opacity-100">
                                    {item.icon === "history" && "📝"}
                                    {item.icon === "event" && "📅"}
                                </span>
                                <span>{item.name}</span>
                            </Link>
                        ))}
                    </nav>

                    {/* Footer: Theme Toggle & Profile */}
                    <div className="p-4 border-t border-border space-y-2">
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="w-full flex items-center justify-between px-4 py-2 rounded-xl text-text-secondary hover:bg-background hover:text-text transition-colors"
                        >
                            <span className="text-sm font-medium">Theme</span>
                            <span className="text-lg">{theme === 'light' ? '☀️' : '🌙'}</span>
                        </button>

                        {/* User Profile */}
                        <div className="bg-background rounded-2xl p-2 flex items-center gap-2 hover:bg-border/50 transition-colors group">
                            <Link
                                href="/profile"
                                className="flex-1 flex items-center gap-3 p-2 rounded-xl hover:bg-card/50 transition-colors min-w-0"
                            >
                                <div className="w-10 h-10 rounded-full bg-card border border-border overflow-hidden flex-shrink-0">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-brand-gradient text-white font-bold">
                                            {user.displayName?.charAt(0) || user.email?.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-text truncate">
                                        {user.displayName || "User"}
                                    </p>
                                    <p className="text-xs text-text-secondary truncate">
                                        {role || "Member"}
                                    </p>
                                </div>
                            </Link>
                            <button
                                onClick={signOut}
                                className="p-2 rounded-lg text-text-secondary hover:text-red-500 hover:bg-card transition-all"
                                title="Log Out"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden animate-fade-in"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}
        </>
    );
}
