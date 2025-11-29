"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product } from "../types";

export default function Dashboard() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState({
        total: 0,
        available: 0,
        borrowed: 0,
        repairs: 0
    });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

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
                if (data.status === 'available') available++;
                if (data.status === 'borrowed') borrowed++;
            });

            setStats(prev => ({ ...prev, total, available, borrowed }));
        });

        // Repair Stats
        const repairQ = query(collection(db, "repair_tickets"), where("status", "!=", "completed"));
        const unsubRepairs = onSnapshot(repairQ, (snapshot) => {
            setStats(prev => ({ ...prev, repairs: snapshot.size }));
        });

        // Recent Activity
        const activityQ = query(collection(db, "repair_tickets"), orderBy("createdAt", "desc"), limit(5));
        const unsubActivity = onSnapshot(activityQ, (snapshot) => {
            const acts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                type: 'repair'
            }));
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
        { title: "Total Assets", value: stats.total, icon: "📦", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
        { title: "Available", value: stats.available, icon: "✅", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
        { title: "Borrowed", value: stats.borrowed, icon: "⏳", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20" },
        { title: "Active Repairs", value: stats.repairs, icon: "🔧", color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
    ];

    const quickActions = [
        { name: "Add Item", icon: "➕", path: "/admin/add-product", role: ['admin'] },
        { name: "Scan QR", icon: "📷", path: "/scan", role: ['admin', 'technician', 'user'] },
        { name: "Report Issue", icon: "⚠️", path: "/repair", role: ['admin', 'technician', 'user'] },
        { name: "My Profile", icon: "👤", path: "/profile", role: ['admin', 'technician', 'user'] },
    ];

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-brand-gradient shadow-lg shadow-primary-start/20 text-white p-8 md:p-12">
                <div className="relative z-10">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2">
                        Good morning, {user.displayName?.split(' ')[0] || "User"}! 👋
                    </h1>
                    <p className="text-white/90 text-lg font-medium opacity-90">
                        {today}
                    </p>
                </div>

                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/5 rounded-full blur-2xl"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, index) => (
                    <div key={index} className="card p-6 flex items-center gap-4 card-hover">
                        <div className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center text-2xl shadow-sm`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary">{stat.title}</p>
                            <p className="text-3xl font-bold text-text">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Quick Actions */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-bold text-text">Quick Actions</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {quickActions.filter(action => !role || action.role.includes(role)).map((action, index) => (
                            <button
                                key={index}
                                onClick={() => router.push(action.path)}
                                className="card p-6 flex flex-col items-center justify-center gap-3 hover:border-primary-start/30 hover:bg-primary-start/5 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                    {action.icon}
                                </div>
                                <span className="font-medium text-text group-hover:text-primary-start transition-colors">
                                    {action.name}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Recent Activity Section */}
                    <div className="card p-6 mt-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-text">Recent Activity</h2>
                            <button className="text-sm text-primary-start font-medium hover:underline">View All</button>
                        </div>
                        <div className="space-y-4">
                            {recentActivity.length > 0 ? (
                                recentActivity.map((act) => (
                                    <div key={act.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-input-bg transition-colors border border-transparent hover:border-border">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                                            {act.requesterName?.[0] || "U"}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-text">{act.requesterName}</p>
                                            <p className="text-xs text-text-secondary">Reported issue in {act.room}</p>
                                        </div>
                                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-input-bg text-text-secondary border border-border">
                                            {act.status}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-text-secondary text-center py-4">No recent activity.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* System Status */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-text">System Status</h2>
                    <div className="card p-6 space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-text-secondary">Storage Usage</span>
                                <span className="font-bold text-text">45%</span>
                            </div>
                            <div className="w-full h-2 bg-input-bg rounded-full overflow-hidden">
                                <div className="h-full w-[45%] bg-brand-gradient rounded-full"></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-text-secondary">Monthly Budget</span>
                                <span className="font-bold text-text">72%</span>
                            </div>
                            <div className="w-full h-2 bg-input-bg rounded-full overflow-hidden">
                                <div className="h-full w-[72%] bg-brand-gradient rounded-full"></div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border">
                            <h3 className="font-bold text-text mb-3">Top Performers</h3>
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-input-bg flex items-center justify-center text-xs font-bold text-text-secondary">
                                            {i}
                                        </div>
                                        <div className="flex-1">
                                            <div className="h-3 w-24 bg-input-bg rounded mb-1"></div>
                                            <div className="h-2 w-16 bg-input-bg/50 rounded"></div>
                                        </div>
                                        <div className="text-xs font-bold text-emerald-500">9{8 - i}%</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}