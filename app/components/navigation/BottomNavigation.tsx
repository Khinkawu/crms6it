"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { useState } from "react";
import {
    Home, Wrench, Calendar, Settings, User,
    Plus, X, Package, Users, ClipboardList
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function BottomNavigation() {
    const { user, role } = useAuth();
    const pathname = usePathname();
    const [fabOpen, setFabOpen] = useState(false);

    if (!user) return null;

    const isAdmin = role === 'admin' || role === 'moderator' || role === 'technician';

    const navItems = [
        { name: "หน้าหลัก", icon: Home, path: "/" },
        { name: "แจ้งซ่อม", icon: Wrench, path: "/repair" },
        { name: "action", icon: Plus, path: null }, // FAB placeholder
        { name: "จองห้อง", icon: Calendar, path: "/booking" },
        { name: "โปรไฟล์", icon: User, path: "/profile" },
    ];

    const fabActions = [
        { name: "แจ้งซ่อม", icon: Wrench, path: "/repair", color: "from-orange-500 to-red-500" },
        { name: "จองห้อง", icon: Calendar, path: "/booking", color: "from-blue-500 to-cyan-500" },
        ...(isAdmin ? [
            { name: "จัดการซ่อม", icon: ClipboardList, path: "/admin/repairs", color: "from-violet-500 to-purple-500" },
            { name: "อุปกรณ์", icon: Package, path: "/admin/inventory", color: "from-emerald-500 to-teal-500" },
        ] : []),
    ];

    const isActive = (path: string | null) => path && pathname === path;

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

            {/* FAB Actions */}
            <AnimatePresence>
                {fabOpen && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 md:hidden">
                        {fabActions.map((action, index) => (
                            <motion.div
                                key={action.path}
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Link
                                    href={action.path}
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
                            </motion.div>
                        ))}
                    </div>
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
                                    onClick={() => setFabOpen(!fabOpen)}
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

                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
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
        </>
    );
}
