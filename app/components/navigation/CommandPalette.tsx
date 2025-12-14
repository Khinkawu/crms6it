"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import {
    Search, Home, Wrench, Calendar, Package,
    Users, User, Settings, ClipboardList, X,
    ArrowRight, Command
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

interface CommandItem {
    id: string;
    name: string;
    description?: string;
    icon: React.ElementType;
    path: string;
    category: string;
    keywords?: string[];
    roles?: string[];
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const { role } = useAuth();
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const allCommands: CommandItem[] = [
        // Navigation
        { id: "home", name: "Dashboard", description: "หน้าหลัก", icon: Home, path: "/", category: "Navigation", keywords: ["home", "main", "หน้าหลัก"] },
        { id: "profile", name: "โปรไฟล์", description: "ข้อมูลส่วนตัว", icon: User, path: "/profile", category: "Navigation", keywords: ["profile", "user", "ผู้ใช้"] },

        // Services
        { id: "repair", name: "แจ้งซ่อม", description: "แจ้งปัญหาอุปกรณ์", icon: Wrench, path: "/repair", category: "Services", keywords: ["repair", "fix", "ซ่อม", "แจ้ง"] },
        { id: "booking", name: "จองห้องประชุม", description: "จองห้องและอุปกรณ์", icon: Calendar, path: "/booking", category: "Services", keywords: ["booking", "room", "ห้อง", "จอง"] },

        // Admin
        { id: "admin-repairs", name: "จัดการงานซ่อม", description: "ดูและจัดการงานซ่อมทั้งหมด", icon: ClipboardList, path: "/admin/repairs", category: "Admin", keywords: ["manage", "repairs", "จัดการ"], roles: ["admin", "moderator", "technician"] },
        { id: "admin-bookings", name: "จัดการการจอง", description: "อนุมัติและจัดการการจอง", icon: Calendar, path: "/admin/bookings", category: "Admin", keywords: ["manage", "bookings"], roles: ["admin", "moderator"] },
        { id: "admin-inventory", name: "คลังอุปกรณ์", description: "จัดการอุปกรณ์และสินค้า", icon: Package, path: "/admin/inventory", category: "Admin", keywords: ["inventory", "stock", "อุปกรณ์"], roles: ["admin", "technician"] },
        { id: "admin-users", name: "จัดการผู้ใช้", description: "จัดการบัญชีและสิทธิ์", icon: Users, path: "/admin/users", category: "Admin", keywords: ["users", "manage", "ผู้ใช้"], roles: ["admin"] },
    ];

    // Filter commands based on role and search query
    const filteredCommands = allCommands.filter(cmd => {
        // Role check
        if (cmd.roles && role && !cmd.roles.includes(role)) return false;

        // Search check
        if (!query) return true;
        const searchLower = query.toLowerCase();
        return (
            cmd.name.toLowerCase().includes(searchLower) ||
            cmd.description?.toLowerCase().includes(searchLower) ||
            cmd.keywords?.some(k => k.toLowerCase().includes(searchLower))
        );
    });

    // Group by category
    const groupedCommands = filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) acc[cmd.category] = [];
        acc[cmd.category].push(cmd);
        return acc;
    }, {} as Record<string, CommandItem[]>);

    const flatCommands = Object.values(groupedCommands).flat();

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, flatCommands.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case "Enter":
                e.preventDefault();
                if (flatCommands[selectedIndex]) {
                    router.push(flatCommands[selectedIndex].path);
                    onClose();
                }
                break;
            case "Escape":
                e.preventDefault();
                onClose();
                break;
        }
    }, [isOpen, flatCommands, selectedIndex, router, onClose]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Global keyboard shortcut
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                if (isOpen) {
                    onClose();
                } else {
                    // This will be handled by parent
                }
            }
        };
        document.addEventListener("keydown", handleGlobalKeyDown);
        return () => document.removeEventListener("keydown", handleGlobalKeyDown);
    }, [isOpen, onClose]);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex justify-center items-start pt-[15vh] px-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.15 }}
                        className="relative w-full max-w-xl z-50 pointer-events-auto"
                    >
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                            {/* Search Input */}
                            <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                                <Search size={20} className="text-gray-400 flex-shrink-0" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="ค้นหาคำสั่ง..."
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setSelectedIndex(0);
                                    }}
                                    className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 text-base outline-none"
                                />
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <X size={18} className="text-gray-400" />
                                </button>
                            </div>

                            {/* Results */}
                            <div className="max-h-[60vh] overflow-y-auto py-2">
                                {Object.entries(groupedCommands).length === 0 ? (
                                    <div className="px-4 py-8 text-center text-gray-500">
                                        ไม่พบคำสั่งที่ตรงกัน
                                    </div>
                                ) : (
                                    Object.entries(groupedCommands).map(([category, commands]) => (
                                        <div key={category} className="mb-2">
                                            <p className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                {category}
                                            </p>
                                            {commands.map((cmd) => {
                                                const isSelected = flatCommands[selectedIndex]?.id === cmd.id;
                                                return (
                                                    <button
                                                        key={cmd.id}
                                                        onClick={() => {
                                                            router.push(cmd.path);
                                                            onClose();
                                                        }}
                                                        onMouseEnter={() => setSelectedIndex(flatCommands.findIndex(c => c.id === cmd.id))}
                                                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${isSelected
                                                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                                            }`}
                                                    >
                                                        <div className={`p-2 rounded-xl ${isSelected
                                                            ? "bg-blue-100 dark:bg-blue-900/50"
                                                            : "bg-gray-100 dark:bg-gray-700"
                                                            }`}>
                                                            <cmd.icon size={18} />
                                                        </div>
                                                        <div className="flex-1 text-left">
                                                            <p className="font-medium text-sm">{cmd.name}</p>
                                                            {cmd.description && (
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {cmd.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {isSelected && (
                                                            <ArrowRight size={16} className="text-blue-400" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-[11px] text-gray-400">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-medium">↑↓</kbd>
                                        <span>นำทาง</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-medium">Enter</kbd>
                                        <span>เลือก</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-medium">Esc</kbd>
                                        <span>ปิด</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
