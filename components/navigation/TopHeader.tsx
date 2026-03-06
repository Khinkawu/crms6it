"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useState } from "react";
import {
    Search, Command, Sun, Moon,
    ChevronDown, LogOut, User, Camera
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationBell } from "../NotificationToggle";

interface TopHeaderProps {
    onOpenCommandPalette: () => void;
}

export default function TopHeader({ onOpenCommandPalette }: TopHeaderProps) {
    const { user, role, isPhotographer, signOut, getDisplayName } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    if (!user) return null;

    const getRoleBadge = () => {
        const badges: Record<string, { label: string; bg: string }> = {
            admin: { label: "Admin", bg: "bg-gray-900 dark:bg-white text-white dark:text-gray-900" },
            technician: { label: "Tech", bg: "bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-900" },
            moderator: { label: "Mod", bg: "bg-gray-600 dark:bg-gray-400 text-white dark:text-gray-900" },
            facility_technician: { label: "Facility", bg: "bg-gray-600 dark:bg-gray-400 text-white dark:text-gray-900" },
            user: { label: "User", bg: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300" }
        };
        return badges[role || 'user'] || badges.user;
    };

    const badge = getRoleBadge();

    return (
        <header className="flex h-16 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
            <div className="relative w-full px-6 flex items-center justify-between gap-4">
                {/* Left: Search / Command Palette Trigger */}
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
                    {/* Notification Bell */}
                    <NotificationBell />

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
                            onTouchEnd={(e) => { e.preventDefault(); setUserMenuOpen(!userMenuOpen); }}
                            className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 hover:bg-gray-200/80 dark:hover:bg-gray-700/50 transition-colors"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" />
                                ) : (
                                    <div className={`w-full h-full flex items-center justify-center font-bold text-xs ${badge.bg}`}>
                                        {user.displayName?.charAt(0) || user.email?.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <ChevronDown size={14} className={`text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown */}
                        <AnimatePresence>
                            {userMenuOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setUserMenuOpen(false)}
                                        onTouchEnd={(e) => { e.preventDefault(); setUserMenuOpen(false); }}
                                    />
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
                                                {getDisplayName()}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {user.email}
                                            </p>
                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${badge.bg}`}>
                                                {badge.label}
                                            </span>
                                            {isPhotographer && (
                                                <span className="inline-block mt-1 ml-1 px-2 py-0.5 rounded text-[10px] font-bold text-white bg-gray-700 flex-inline items-center gap-1">
                                                    <Camera size={10} className="inline mr-1" />
                                                    Photo
                                                </span>
                                            )}
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
