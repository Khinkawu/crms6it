"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
    Home, Wrench, Calendar, Package, Users,
    ClipboardList, LayoutDashboard, Camera, Video,
    Building2, LogOut, Settings, Sun, Moon, ChevronLeft, ChevronRight
} from "lucide-react";
import { NotificationBell } from "../NotificationToggle";

interface SidebarProps {
    onOpenCommandPalette: () => void;
    collapsed: boolean;
    onToggle: () => void;
}

export default function Sidebar({ onOpenCommandPalette, collapsed, onToggle }: SidebarProps) {
    const { user, role, isPhotographer, hasAtlasRole, signOut, getDisplayName } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    if (!user) return null;

    const isAdmin = role === 'admin' || role === 'moderator' || role === 'technician' || role === 'facility_technician' || role === 'atlas';

    const mainItems = [
        { name: "Overview", nameTh: "ภาพรวม", icon: Home, path: "/" },
        { name: "แจ้งซ่อม", nameTh: "แจ้งซ่อม", icon: Wrench, path: "/repair" },
        { name: "จองห้อง / คิว", nameTh: "จองห้อง / คิว", icon: Calendar, path: "/booking" },
        ...(role === 'user' ? [{ name: "คำขอของฉัน", nameTh: "คำขอของฉัน", icon: ClipboardList, path: "/my-requests" }] : []),
        { name: "สถานะทีมโสตฯ", nameTh: "สถานะทีมโสตฯ", icon: Users, path: "/team-status" },
        { name: "ภาพกิจกรรม", nameTh: "ภาพกิจกรรม", icon: Camera, path: "/gallery" },
        { name: "คลังวิดีโอ", nameTh: "คลังวิดีโอ", icon: Video, path: "/video-gallery" },
    ];

    const adminItems = [
        { name: "Command Center", icon: LayoutDashboard, path: "/manage/command-center", roles: ["admin", "moderator"] },
        { name: "จัดการงานซ่อมโสตฯ", icon: ClipboardList, path: "/manage/repairs", roles: ["admin", "moderator", "technician"], allowAtlasRepair: true },
        { name: "จัดการซ่อมอาคาร", icon: Building2, path: "/manage/repairs?tab=facility", roles: ["facility_technician"] },
        { name: "จัดการการจอง", icon: Calendar, path: "/manage/bookings", roles: ["admin", "moderator"] },
        { name: "งานตากล้อง", icon: Camera, path: "/manage/photography", roles: ["admin", "atlas"] },
        { name: "คลังโสตฯ", icon: Package, path: "/manage/inventory", roles: ["admin", "technician"], allowPhotographer: true },
        { name: "คลังอาคาร", icon: Package, path: "/admin/facility/inventory", roles: ["facility_technician"] },
        { name: "ผู้ใช้", icon: Users, path: "/admin/users", roles: ["admin"] },
    ].filter(item => {
        if (item.allowPhotographer && isPhotographer) return true;
        if (item.allowAtlasRepair && hasAtlasRole('repair')) return true;
        return role && item.roles.includes(role);
    });

    const isActive = (path: string) => {
        const [basePath, query] = path.split('?');
        const isBasePathMatch = pathname === basePath;
        if (query) {
            const targetTab = new URLSearchParams(query).get('tab');
            return isBasePathMatch && searchParams.get('tab') === targetTab;
        }
        if (path === '/manage/repairs' || path === '/repair') {
            return isBasePathMatch && (searchParams.get('tab') === 'it' || !searchParams.get('tab'));
        }
        return isBasePathMatch;
    };

    const getRoleBadge = () => {
        const badges: Record<string, { label: string; color: string }> = {
            admin: { label: "Admin", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
            technician: { label: "Tech", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
            moderator: { label: "Mod", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
            facility_technician: { label: "Facility", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
            atlas: { label: "โสตฯ", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
            user: { label: "User", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
        };
        return badges[role || 'user'] || badges.user;
    };

    const badge = getRoleBadge();
    const sidebarWidth = collapsed ? "w-16" : "w-60";


    return (
        <aside className={`hidden md:flex fixed top-0 left-0 h-screen ${sidebarWidth} flex-col z-40 transition-all duration-300 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950`}>

            {/* Logo */}
            <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <img src="/apple-icon.png" alt="Logo" className="w-6 h-6 object-contain" />
                </div>
                {!collapsed && (
                    <span className="font-bold text-gray-900 dark:text-white text-sm tracking-tight whitespace-nowrap">CRMS6 IT</span>
                )}
                <button
                    onClick={onToggle}
                    className={`ml-auto p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors ${collapsed ? "mx-auto" : ""}`}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                {/* MAIN Section */}
                {!collapsed && (
                    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Main</p>
                )}
                {mainItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        title={collapsed ? item.name : undefined}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative
                            ${isActive(item.path)
                                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
                            }`}
                    >
                        <item.icon size={18} strokeWidth={isActive(item.path) ? 2.5 : 2} className="flex-shrink-0" />
                        {!collapsed && <span>{item.name}</span>}
                        {isActive(item.path) && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gray-900 dark:bg-white rounded-r-full" />
                        )}
                        {collapsed && (
                            <span className="absolute left-full ml-2 px-2 py-1 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                {item.name}
                            </span>
                        )}
                    </Link>
                ))}

                {/* ADMIN Section */}
                {adminItems.length > 0 && (
                    <>
                        <div className="pt-3 pb-1">
                            {!collapsed
                                ? <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Admin</p>
                                : <div className="w-full h-px bg-gray-200 dark:border-gray-700" />
                            }
                        </div>
                        {adminItems.map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                title={collapsed ? item.name : undefined}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative
                                    ${isActive(item.path)
                                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
                                    }`}
                            >
                                <item.icon size={18} strokeWidth={isActive(item.path) ? 2.5 : 2} className="flex-shrink-0" />
                                {!collapsed && <span className="truncate">{item.name}</span>}
                                {isActive(item.path) && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gray-900 dark:bg-white rounded-r-full" />
                                )}
                                {collapsed && (
                                    <span className="absolute left-full ml-2 px-2 py-1 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        {item.name}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </>
                )}
            </nav>

            {/* Bottom: Theme + User */}
            <div className="border-t border-gray-200 dark:border-gray-800 p-3 space-y-1 flex-shrink-0">
                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white transition-colors ${collapsed ? "justify-center" : ""}`}
                >
                    {theme === 'light'
                        ? <Moon size={18} className="flex-shrink-0" />
                        : <Sun size={18} className="text-amber-500 flex-shrink-0" />
                    }
                    {!collapsed && <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
                </button>

                {/* User */}
                <Link href="/profile" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${collapsed ? "justify-center" : ""}`}>
                    <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold">
                                {user.displayName?.charAt(0) || user.email?.charAt(0)}
                            </div>
                        )}
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{getDisplayName()}</p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                        </div>
                    )}
                </Link>

                {/* Logout */}
                <button
                    onClick={signOut}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${collapsed ? "justify-center" : ""}`}
                >
                    <LogOut size={18} className="flex-shrink-0" />
                    {!collapsed && <span>ออกจากระบบ</span>}
                </button>
            </div>
        </aside>
    );
}
