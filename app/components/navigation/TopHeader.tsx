"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import { useState } from "react";
import {
    Search, Command, Sun, Moon,
    ChevronDown, LogOut, User, Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TopHeaderProps {
    onOpenCommandPalette: () => void;
}

export default function TopHeader({ onOpenCommandPalette }: TopHeaderProps) {
    const { user, role, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    if (!user) return null;

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
        <header className="hidden md:flex fixed top-0 left-0 right-0 h-16 z-40">
            {/* Glass background */}
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl border-b border-gray-200/50 dark:border-gray-700/50" />

            <div className="relative w-full max-w-[1800px] mx-auto px-6 flex items-center justify-between">
                {/* Left: Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                        <div className="w-full h-full rounded-[10px] bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                            <img src="/logo_2.png" alt="Logo" className="w-7 h-7 object-contain" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">CRMS6 IT</h1>
                    </div>
                </Link>

                {/* Center: Search / Command Palette Trigger */}
                <button
                    onClick={onOpenCommandPalette}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-200/80 dark:hover:bg-gray-700/50 transition-colors group min-w-[280px]"
                >
                    <Search size={16} className="text-gray-400" />
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex-1 text-left">ค้นหา...</span>
                    <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-gray-700 text-[10px] font-medium text-gray-500 dark:text-gray-400 shadow-sm">
                        <Command size={10} />
                        <span>K</span>
                    </kbd>
                </button>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 hover:bg-gray-200/80 dark:hover:bg-gray-700/50 transition-colors tap-scale"
                    >
                        {theme === 'light' ? (
                            <Moon size={18} className="text-gray-600 dark:text-gray-300" />
                        ) : (
                            <Sun size={18} className="text-amber-500" />
                        )}
                    </button>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 hover:bg-gray-200/80 dark:hover:bg-gray-700/50 transition-colors"
                        >
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${badge.color} p-0.5`}>
                                <div className="w-full h-full rounded-md bg-white dark:bg-gray-900 overflow-hidden">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${badge.color} text-white font-bold text-xs`}>
                                            {user.displayName?.charAt(0) || user.email?.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <ChevronDown size={14} className={`text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown */}
                        <AnimatePresence>
                            {userMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-full mt-2 w-64 p-2 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 shadow-xl z-50"
                                    >
                                        {/* User Info */}
                                        <div className="px-3 py-2 mb-1">
                                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                                {user.displayName || "User"}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {user.email}
                                            </p>
                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold text-white bg-gradient-to-r ${badge.color}`}>
                                                {badge.label}
                                            </span>
                                        </div>

                                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

                                        <Link
                                            href="/profile"
                                            onClick={() => setUserMenuOpen(false)}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                                        >
                                            <User size={16} />
                                            โปรไฟล์
                                        </Link>

                                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

                                        <button
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                signOut();
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <LogOut size={16} />
                                            ออกจากระบบ
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
}
