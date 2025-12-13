"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useState } from "react";
import {
    LayoutDashboard, Package, Wrench, Users,
    History, Calendar, Sun, Moon, LogOut,
    Menu, X, ChevronRight
} from "lucide-react";

export default function Sidebar() {
    const { user, role, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const pathname = usePathname();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    if (!user) return null;

    const allMenuItems = [
        { name: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/", roles: ['user', 'technician', 'admin', 'moderator'] },
        { name: "ระบบจัดการอุปกรณ์", icon: <Package size={20} />, path: "/admin/inventory", roles: ['technician', 'admin'] },
        { name: "ระบบงานซ่อม", icon: <Wrench size={20} />, path: "/admin/repairs", roles: ['technician', 'admin', 'moderator'] },
        { name: "จัดการการจอง", icon: <Calendar size={20} />, path: "/admin/bookings", roles: ['admin', 'moderator'] },
        { name: "จัดการผู้ใช้", icon: <Users size={20} />, path: "/admin/users", roles: ['admin'] },
    ];

    const menuItems = allMenuItems.filter(item => role && item.roles.includes(role));

    const upcomingItems = [
        { name: "แจ้งซ่อม", icon: <Wrench size={20} />, path: "/repair" },
        { name: "จองห้องประชุม", icon: <Calendar size={20} />, path: "/booking" },
    ];

    const isActive = (path: string) => pathname === path;

    const getRoleBadge = () => {
        const badges: Record<string, { label: string; color: string }> = {
            admin: { label: "Admin", color: "from-purple-500 to-indigo-500" },
            technician: { label: "Tech", color: "from-cyan-500 to-blue-500" },
            moderator: { label: "Mod", color: "from-amber-500 to-orange-500" },
            user: { label: "User", color: "from-emerald-500 to-teal-500" }
        };
        return badges[role || 'user'] || badges.user;
    };

    const badge = getRoleBadge();

    return (
        <>
            {/* Mobile Hamburger - Floating Button */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="md:hidden fixed top-4 left-4 z-50 p-3 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-200 shadow-lg shadow-gray-200/50 dark:shadow-none tap-scale"
            >
                {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Sidebar Container - Glassmorphism */}
            <aside className={`
                fixed top-0 left-0 h-full w-72 z-40
                bg-white/70 dark:bg-gray-900/80 backdrop-blur-2xl
                border-r border-gray-200/50 dark:border-gray-700/50
                shadow-xl shadow-gray-200/20 dark:shadow-none
                transition-all duration-300 ease-out
                ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}>
                <div className="flex flex-col h-full">

                    {/* Logo Area - Premium Header */}
                    <div className="p-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/30">
                                    <div className="w-full h-full rounded-[14px] bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                                        <img src="/logo_2.png" alt="Logo" className="w-10 h-10 object-contain" />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">CRMS6 IT</h1>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest">งานโสตทัศนศึกษา</p>
                            </div>
                        </div>
                    </div>

                    {/* Main Menu */}
                    <nav className="flex-1 px-4 overflow-y-auto custom-scrollbar">
                        <p className="px-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">เมนูหลัก</p>

                        <div className="space-y-1">
                            {menuItems.map((item) => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    onClick={() => setIsMobileOpen(false)}
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative
                                        ${isActive(item.path)
                                            ? "bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 font-semibold shadow-sm"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
                                        }
                                    `}
                                >
                                    {isActive(item.path) && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-gradient-to-b from-blue-500 to-cyan-400 rounded-r-full"></div>
                                    )}
                                    <span className={`transition-transform duration-200 ${isActive(item.path) ? "scale-110" : "group-hover:scale-110"}`}>
                                        {item.icon}
                                    </span>
                                    <span className="flex-1 text-sm">{item.name}</span>
                                    {isActive(item.path) && (
                                        <ChevronRight size={16} className="text-blue-400" />
                                    )}
                                </Link>
                            ))}
                        </div>

                        <div className="my-5 mx-3 border-t border-gray-200/50 dark:border-gray-700/50"></div>
                        <p className="px-3 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">บริการ</p>

                        <div className="space-y-1">
                            {upcomingItems.map((item) => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    onClick={() => setIsMobileOpen(false)}
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                                        ${isActive(item.path)
                                            ? "bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
                                        }
                                    `}
                                >
                                    <span className={`transition-transform duration-200 group-hover:scale-110`}>
                                        {item.icon}
                                    </span>
                                    <span className="flex-1 text-sm">{item.name}</span>
                                </Link>
                            ))}
                        </div>
                    </nav>

                    {/* Footer: Theme Toggle & Profile - Premium Card */}
                    <div className="p-4 space-y-3">
                        {/* Theme Toggle - Pill Style */}
                        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-100/80 dark:bg-gray-800/50">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Theme</span>
                            <button
                                onClick={toggleTheme}
                                className="relative w-14 h-7 rounded-full bg-gray-200 dark:bg-gray-700 transition-colors tap-scale"
                            >
                                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center transition-all duration-300 ${theme === 'dark' ? 'left-8' : 'left-1'}`}>
                                    {theme === 'light' ? <Sun size={12} className="text-amber-500" /> : <Moon size={12} className="text-blue-400" />}
                                </div>
                            </button>
                        </div>

                        {/* User Profile Card - Premium Design */}
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/80 dark:to-gray-800/40 border border-gray-200/50 dark:border-gray-700/50">
                            <Link
                                href="/profile"
                                className="flex items-center gap-3 group"
                            >
                                {/* Avatar with gradient ring */}
                                <div className="relative">
                                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${badge.color} p-0.5 shadow-lg`}>
                                        <div className="w-full h-full rounded-[10px] bg-white dark:bg-gray-900 overflow-hidden">
                                            {user.photoURL ? (
                                                <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${badge.color} text-white font-bold text-sm`}>
                                                    {user.displayName?.charAt(0) || user.email?.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Online indicator */}
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {user.displayName || "User"}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white bg-gradient-to-r ${badge.color}`}>
                                            {badge.label}
                                        </span>
                                    </div>
                                </div>

                                <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                            </Link>

                            {/* Logout Button */}
                            <button
                                onClick={signOut}
                                className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-xs font-medium tap-scale"
                            >
                                <LogOut size={14} />
                                ออกจากระบบ
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile - Enhanced blur */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-md z-30 md:hidden animate-fade-in"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}
        </>
    );
}
