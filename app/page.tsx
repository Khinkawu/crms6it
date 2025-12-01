"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product } from "../types";
import { LogAction } from "../utils/logger";

interface ActivityLog {
    id: string;
    action: LogAction;
    productName: string;
    userName: string;
    imageUrl?: string;
    details?: string;
    timestamp: any;
}

export default function Dashboard() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState({
        total: 0,
        available: 0,
        borrowed: 0,
        repairs: 0
    });
    const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (!user) return;

        // Inventory Stats
        const q = query(collection(db, "products"));
        const unsubInventory = onSnapshot(q, (snapshot) => {
            let total = 0;
            let available = 0;
            let borrowed = 0;

            snapshot.forEach((doc) => {
                const data = doc.data() as Product;
                total++;
                const isBulk = data.type === 'bulk';
                if (isBulk) {
                    if ((data.quantity || 0) - (data.borrowedCount || 0) > 0) available++;
                    if ((data.borrowedCount || 0) > 0) borrowed++;
                } else {
                    if (data.status === 'available') available++;
                    if (data.status === 'borrowed') borrowed++;
                }
            });

            setStats(prev => ({ ...prev, total, available, borrowed }));
        });

        // Repair Stats
        const repairQ = query(collection(db, "repair_tickets"), where("status", "!=", "completed"));
        const unsubRepairs = onSnapshot(repairQ, (snapshot) => {
            setStats(prev => ({ ...prev, repairs: snapshot.size }));
        });

        // Recent Activity (All Logs)
        const activityQ = query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(20));
        const unsubActivity = onSnapshot(activityQ, (snapshot) => {
            const acts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ActivityLog[];
            setRecentActivity(acts);
        });

        return () => {
            unsubInventory();
            unsubRepairs();
            unsubActivity();
        };
    }, [user]);

    if (loading || !user) return null;

    const statCards = [
        { title: "อุปกรณ์ทั้งหมด", value: stats.total, icon: "📦", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
        { title: "พร้อมใช้งาน", value: stats.available, icon: "✅", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
        { title: "ถูกยืม", value: stats.borrowed, icon: "⏳", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20" },
        { title: "แจ้งซ่อม", value: stats.repairs, icon: "🔧", color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
    ];

    const quickActions = [
        { name: "เพิ่มอุปกรณ์", icon: "➕", path: "/admin/inventory", role: ['admin'] },
        { name: "สแกน QR", icon: "📷", path: "/scan", role: ['admin', 'technician', 'user'] },
        { name: "แจ้งซ่อม", icon: "⚠️", path: "/repair", role: ['admin', 'technician', 'user'] },
        { name: "โปรไฟล์", icon: "👤", path: "/profile", role: ['admin', 'technician', 'user'] },
    ];

    const getActionStyle = (action: LogAction) => {
        switch (action) {
            case 'borrow': return { icon: '⏳', label: 'ยืมอุปกรณ์', color: 'text-orange-600', bg: 'bg-orange-100' };
            case 'return': return { icon: '✅', label: 'คืนอุปกรณ์', color: 'text-emerald-600', bg: 'bg-emerald-100' };
            case 'requisition': return { icon: '📦', label: 'เบิกอุปกรณ์', color: 'text-purple-600', bg: 'bg-purple-100' };
            case 'repair': return { icon: '🔧', label: 'แจ้งซ่อม', color: 'text-red-600', bg: 'bg-red-100' };
            case 'add':
            case 'create': return { icon: '✨', label: 'เพิ่มอุปกรณ์ใหม่', color: 'text-blue-600', bg: 'bg-blue-100' };
            case 'update': return { icon: '✏️', label: 'แก้ไขข้อมูล', color: 'text-amber-600', bg: 'bg-amber-100' };
            case 'delete': return { icon: '🗑️', label: 'ลบอุปกรณ์', color: 'text-gray-600', bg: 'bg-gray-100' };
            default: return { icon: '📝', label: 'กิจกรรม', color: 'text-gray-600', bg: 'bg-gray-100' };
        }
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate();
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return "เมื่อสักครู่";
        if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
        if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
        if (days === 1) return "เมื่อวาน";
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    };

    const today = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/20 text-white p-8 md:p-10">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-2">
                            สวัสดี, {user.displayName?.split(' ')[0] || "User"}! 👋
                        </h1>
                        <p className="text-white/90 text-lg font-medium opacity-90">
                            {today}
                        </p>
                    </div>
                    {/* <div className="bg-white/20 backdrop-blur-md rounded-xl p-3 px-5 border border-white/30">
                        <p className="text-sm font-medium opacity-90">สถานะระบบ</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                            <span className="font-bold">ปกติ</span>
                        </div>
                    </div> */}
                </div>

                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/5 rounded-full blur-2xl"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, index) => (
                    <div key={index} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                        <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center text-2xl shadow-sm`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{stat.title}</p>
                            <p className="text-2xl font-bold text-text">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Quick Actions & ... */}
                <div className="space-y-8">
                    {/* Quick Actions */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                            <span>⚡</span> เมนูด่วน
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            {quickActions.filter(action => !role || action.role.includes(role)).map((action, index) => (
                                <button
                                    key={index}
                                    onClick={() => router.push(action.path)}
                                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-input-bg border border-transparent hover:border-primary-start/30 hover:bg-primary-start/5 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                        {action.icon}
                                    </div>
                                    <span className="text-sm font-medium text-text group-hover:text-primary-start transition-colors">
                                        {action.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tips or Announcement could go here */}
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2">💡 ทริกการใช้งาน</h3>
                            <p className="text-white/90 text-sm leading-relaxed">
                                คุณสามารถเชื่อมต่อ Line ได้ที่หน้า Profile เพื่อให้ได้รับข้อมูลแจ้งเตือนอัตโนมัติ
                            </p>
                        </div>
                        <div className="absolute -bottom-4 -right-4 text-9xl opacity-10">📱</div>
                    </div>
                </div>

                {/* Right Column: Recent Activity (Takes 2 cols on large screens) */}
                <div className="lg:col-span-2">
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-lg font-bold text-text flex items-center gap-2">
                                <span>🕒</span> กิจกรรมล่าสุด
                            </h2>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-input-bg text-text-secondary">
                                {recentActivity.length} รายการ
                            </span>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar p-0">
                            {recentActivity.length > 0 ? (
                                <div className="divide-y divide-border">
                                    {recentActivity.map((act) => {
                                        const style = getActionStyle(act.action);
                                        return (
                                            <div key={act.id} className="p-4 hover:bg-gray-50/50 transition-colors flex gap-4 items-start group">
                                                {/* Icon */}
                                                <div className={`w-10 h-10 rounded-full ${style.bg} ${style.color} flex-shrink-0 flex items-center justify-center text-lg shadow-sm mt-1`}>
                                                    {style.icon}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-sm font-bold text-text truncate pr-2">
                                                            {act.productName}
                                                        </p>
                                                        <span className="text-[10px] text-text-secondary whitespace-nowrap bg-input-bg px-1.5 py-0.5 rounded">
                                                            {formatTime(act.timestamp)}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-text-secondary mt-0.5">
                                                        โดย <span className="font-medium text-text">{act.userName}</span> • {style.label}
                                                    </p>

                                                    {act.details && (
                                                        <p className="text-xs text-gray-500 mt-1.5 bg-input-bg/50 p-2 rounded-lg border border-border/50 italic">
                                                            &quot;{act.details}&quot;
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Image (Optional) */}
                                                {act.imageUrl && (
                                                    <div className="w-12 h-12 rounded-lg bg-input-bg border border-border overflow-hidden flex-shrink-0">
                                                        <img src={act.imageUrl} alt="Product" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                                    <div className="text-4xl mb-3 opacity-20">📝</div>
                                    <p>ยังไม่มีกิจกรรมล่าสุด</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}