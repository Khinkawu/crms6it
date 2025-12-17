"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import {
    Home, Wrench, Calendar, Package, Users,
    ClipboardList, LayoutDashboard, Camera
} from "lucide-react";

interface SideQuickAccessProps {
    onOpenCommandPalette: () => void;
}

export default function SideQuickAccess({ onOpenCommandPalette }: SideQuickAccessProps) {
    const { user, role, isPhotographer } = useAuth();
    const pathname = usePathname();

    if (!user) return null;

    const isAdmin = role === 'admin' || role === 'moderator' || role === 'technician';

    const mainItems = [
        { name: "Dashboard", icon: LayoutDashboard, path: "/" },
        { name: "แจ้งซ่อม", icon: Wrench, path: "/repair" },
        { name: "จองห้อง", icon: Calendar, path: "/booking" },
        { name: "ภาพกิจกรรม", icon: Camera, path: "/gallery" },
    ];

    const adminItems = [
        { name: "Command Center", icon: LayoutDashboard, path: "/admin/dashboard", roles: ["admin", "moderator"] },
        { name: "งานซ่อม", icon: ClipboardList, path: "/admin/repairs", roles: ["moderator", "technician"] },
        { name: "การจอง", icon: Calendar, path: "/admin/bookings", roles: ["moderator"] },
        { name: "งานตากล้อง", icon: Camera, path: "/admin/photography", roles: ["admin", "moderator"] },
        { name: "อุปกรณ์", icon: Package, path: "/admin/inventory", roles: ["technician"], allowPhotographer: true },
        { name: "ผู้ใช้", icon: Users, path: "/admin/users", roles: ["admin"] },
    ].filter(item => {
        if (item.allowPhotographer && isPhotographer) return true;
        return role && item.roles.includes(role);
    });

    const isActive = (path: string) => pathname === path;

    return (
        <aside className="hidden md:flex fixed top-16 left-0 h-[calc(100vh-4rem)] w-16 flex-col items-center py-4 z-30">
            {/* Glass background */}
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-700/50" />

            <div className="relative flex flex-col items-center gap-1 flex-1">
                {/* Main Navigation */}
                {mainItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`relative group p-3 rounded-xl transition-all duration-200 ${isActive(item.path)
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-200"
                            }`}
                    >
                        {isActive(item.path) && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
                        )}
                        <item.icon size={22} strokeWidth={isActive(item.path) ? 2.5 : 2} />

                        {/* Tooltip */}
                        <span className="absolute left-full ml-2 px-2 py-1 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            {item.name}
                        </span>
                    </Link>
                ))}

                {/* Divider */}
                {adminItems.length > 0 && (
                    <div className="w-8 h-px bg-gray-200 dark:bg-gray-700 my-2" />
                )}

                {/* Admin Navigation */}
                {adminItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`relative group p-3 rounded-xl transition-all duration-200 ${isActive(item.path)
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-200"
                            }`}
                    >
                        {isActive(item.path) && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
                        )}
                        <item.icon size={22} strokeWidth={isActive(item.path) ? 2.5 : 2} />

                        {/* Tooltip */}
                        <span className="absolute left-full ml-2 px-2 py-1 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            {item.name}
                        </span>
                    </Link>
                ))}
            </div>
        </aside>
    );
}
