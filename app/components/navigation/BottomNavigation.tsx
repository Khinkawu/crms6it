"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import { useState } from "react";
import {
    Home, Wrench, Calendar, User,
    Plus, Package, ClipboardList, MoreHorizontal,
    Settings, X, LogOut, Sun, Moon, Camera
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PhotographyJobModal from "../PhotographyJobModal";

export default function BottomNavigation() {
    const { user, role, isPhotographer, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const pathname = usePathname();
    const [fabOpen, setFabOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [photoJobModalOpen, setPhotoJobModalOpen] = useState(false);

    if (!user) return null;

    const isAdmin = role === 'admin' || role === 'moderator' || role === 'technician';
    const isModerator = role === 'admin' || role === 'moderator';
    const canAssignPhotoJobs = role === 'admin' || role === 'moderator';

    // Main nav items - change last item based on role
    const navItems = [
        { name: "หน้าหลัก", icon: Home, path: "/" },
        { name: "แจ้งซ่อม", icon: Wrench, path: "/repair" },
        { name: "action", icon: Plus, path: null }, // FAB placeholder
        { name: "จองห้อง", icon: Calendar, path: "/booking" },
        // Show "เพิ่มเติม" for admin users, "โปรไฟล์" for regular users
        isAdmin
            ? { name: "เพิ่มเติม", icon: MoreHorizontal, path: "more" }
            : { name: "โปรไฟล์", icon: User, path: "/profile" },
    ];

    // FAB quick actions - add photo job assignment for admins
    const fabActions = [
        { name: "แจ้งซ่อม", icon: Wrench, path: "/repair", color: "from-orange-500 to-red-500", isModal: false },
        { name: "จองห้อง", icon: Calendar, path: "/booking", color: "from-blue-500 to-cyan-500", isModal: false },
        ...(canAssignPhotoJobs ? [
            { name: "มอบหมายงานภาพ", icon: Camera, path: null, color: "from-amber-500 to-yellow-500", isModal: true, modalAction: () => setPhotoJobModalOpen(true) }
        ] : []),
    ];

    // More menu items for admin
    const moreMenuItems = [
        { name: "โปรไฟล์", icon: User, path: "/profile", roles: ["user", "admin", "moderator", "technician"] },
        { name: "ประมวลภาพกิจกรรม", icon: Camera, path: "/gallery", roles: ["user", "admin", "moderator", "technician"] },
        { name: "จัดการงานซ่อม", icon: ClipboardList, path: "/admin/repairs", roles: ["admin", "moderator", "technician"] },
        { name: "จัดการการจอง", icon: Calendar, path: "/admin/bookings", roles: ["admin", "moderator"] },
        { name: "จัดการอุปกรณ์", icon: Package, path: "/admin/inventory", roles: ["admin", "technician"], allowPhotographer: true },
        { name: "จัดการผู้ใช้", icon: Settings, path: "/admin/users", roles: ["admin"] },
    ].filter(item => {
        if (item.allowPhotographer && isPhotographer) return true;
        return role && item.roles.includes(role);
    });

    const isActive = (path: string | null) => {
        if (path === "more") return moreMenuOpen;
        return path && pathname === path;
    };

    const isAdminPage = pathname?.startsWith('/admin');

    return (
        <>
            {/* FAB Overlay */}
            <AnimatePresence>
                {fabOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setFabOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* More Menu Overlay */}
            <AnimatePresence>
                {moreMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setMoreMenuOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* FAB Actions */}
            <AnimatePresence>
                {fabOpen && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 md:hidden">
                        {fabActions.map((action, index) => (
                            <motion.div
                                key={action.name}
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                {action.isModal ? (
                                    <button
                                        onClick={() => {
                                            setFabOpen(false);
                                            action.modalAction?.();
                                        }}
                                        className="flex items-center gap-3 group"
                                    >
                                        <span className="px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-lg">
                                            {action.name}
                                        </span>
                                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center shadow-xl text-white`}>
                                            <action.icon size={20} />
                                        </div>
                                    </button>
                                ) : (
                                    <Link
                                        href={action.path!}
                                        onClick={() => setFabOpen(false)}
                                        className="flex items-center gap-3 group"
                                    >
                                        <span className="px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-lg">
                                            {action.name}
                                        </span>
                                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center shadow-xl text-white`}>
                                            <action.icon size={20} />
                                        </div>
                                    </Link>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>

            {/* More Menu (Admin Menu) */}
            <AnimatePresence>
                {moreMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-20 right-4 z-50 md:hidden"
                    >
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden min-w-[200px]">
                            <div className="p-2">
                                {moreMenuItems.map((item, index) => (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        onClick={() => setMoreMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === item.path
                                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                            }`}
                                    >
                                        <item.icon size={20} />
                                        <span className="font-medium text-sm">{item.name}</span>
                                    </Link>
                                ))}

                                {/* Divider */}
                                <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />

                                {/* Theme Toggle Button */}
                                <button
                                    onClick={toggleTheme}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-amber-500" />}
                                    <span className="font-medium text-sm">{theme === 'light' ? 'โหมดกลางคืน' : 'โหมดกลางวัน'}</span>
                                </button>

                                {/* Logout Button */}
                                <button
                                    onClick={() => {
                                        setMoreMenuOpen(false);
                                        signOut();
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <LogOut size={20} />
                                    <span className="font-medium text-sm">ออกจากระบบ</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
                {/* Glass background */}
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl border-t border-gray-200/50 dark:border-gray-700/50" />

                {/* Safe area padding for iPhone */}
                <div className="relative flex items-center justify-around h-16 pb-safe">
                    {navItems.map((item) => {
                        // FAB center button
                        if (item.path === null) {
                            return (
                                <button
                                    key="fab"
                                    onClick={() => {
                                        setFabOpen(!fabOpen);
                                        setMoreMenuOpen(false);
                                    }}
                                    className="relative -mt-6"
                                >
                                    <motion.div
                                        animate={{ rotate: fabOpen ? 45 : 0 }}
                                        className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-xl shadow-blue-500/30"
                                    >
                                        <Plus size={28} className="text-white" strokeWidth={2.5} />
                                    </motion.div>
                                </button>
                            );
                        }

                        // More menu button
                        if (item.path === "more") {
                            return (
                                <button
                                    key="more"
                                    onClick={() => {
                                        setMoreMenuOpen(!moreMenuOpen);
                                        setFabOpen(false);
                                    }}
                                    className="flex flex-col items-center gap-0.5 px-3 py-2 group"
                                >
                                    <div className="relative">
                                        <item.icon
                                            size={22}
                                            className={`transition-all duration-200 ${moreMenuOpen || isAdminPage
                                                ? "text-blue-600 dark:text-blue-400 scale-110"
                                                : "text-gray-500 dark:text-gray-400 group-active:scale-90"
                                                }`}
                                            strokeWidth={moreMenuOpen || isAdminPage ? 2.5 : 2}
                                        />
                                        {(moreMenuOpen || isAdminPage) && (
                                            <motion.div
                                                layoutId="bottomNavIndicator"
                                                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full"
                                            />
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-medium transition-colors ${moreMenuOpen || isAdminPage
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-gray-500 dark:text-gray-400"
                                        }`}>
                                        {item.name}
                                    </span>
                                </button>
                            );
                        }

                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                onClick={() => {
                                    setFabOpen(false);
                                    setMoreMenuOpen(false);
                                }}
                                className="flex flex-col items-center gap-0.5 px-3 py-2 group"
                            >
                                <div className="relative">
                                    <item.icon
                                        size={22}
                                        className={`transition-all duration-200 ${active
                                            ? "text-blue-600 dark:text-blue-400 scale-110"
                                            : "text-gray-500 dark:text-gray-400 group-active:scale-90"
                                            }`}
                                        strokeWidth={active ? 2.5 : 2}
                                    />
                                    {active && (
                                        <motion.div
                                            layoutId="bottomNavIndicator"
                                            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full"
                                        />
                                    )}
                                </div>
                                <span className={`text-[10px] font-medium transition-colors ${active
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-gray-500 dark:text-gray-400"
                                    }`}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Photography Job Modal */}
            {canAssignPhotoJobs && (
                <PhotographyJobModal
                    isOpen={photoJobModalOpen}
                    onClose={() => setPhotoJobModalOpen(false)}
                    requesterId={user.uid}
                />
            )}
        </>
    );
}
