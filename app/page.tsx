"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product } from "../types";

// Update Interface to handle both Transactions and Activities
interface DashboardItem {
    id: string;
    productName: string;
    // Transaction fields
    borrowerName?: string;
    status?: 'active' | 'completed' | 'requisitioned';
    returnDate?: any;
    // Activity fields
    userName?: string;
    action?: string;
    timestamp?: any;
    // Common
    borrowDate?: any;
    updatedAt?: any;
    type?: string;
}

export default function Home() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [stats, setStats] = useState({
        total: 0,
        available: 0,
        borrowed: 0,
        lowStock: 0
    });
    const [recentActivity, setRecentActivity] = useState<DashboardItem[]>([]);
    const [myBorrows, setMyBorrows] = useState<DashboardItem[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchDashboardData();
        }
    }, [user]);

    const fetchDashboardData = async () => {
        try {
            // 1. Fetch Products for Stats
            const productsRef = collection(db, "products");
            const productsSnapshot = await getDocs(productsRef);

            let total = 0;
            let available = 0;
            let borrowed = 0;
            let lowStock = 0;

            productsSnapshot.forEach((doc) => {
                const data = doc.data() as Product;
                total++;
                if (data.status === 'available') available++;
                if (data.status === 'borrowed') borrowed++;
            });

            if (available < 5) lowStock = available;

            setStats({ total, available, borrowed, lowStock });

            // 2. Fetch Recent Activity (From 'activities' collection)
            const activitiesRef = collection(db, "activities");
            const qActivity = query(activitiesRef, orderBy("timestamp", "desc"), limit(5));
            const activitySnapshot = await getDocs(qActivity);

            const activities: DashboardItem[] = [];
            activitySnapshot.forEach((doc) => {
                const data = doc.data();
                activities.push({
                    id: doc.id,
                    ...data,
                    // Map timestamp correctly
                    updatedAt: data.timestamp
                } as any);
            });

            setRecentActivity(activities);

            // 3. Fetch My Active Borrows
            if (user?.email) {
                const transactionsRef = collection(db, "transactions");
                const qMyBorrows = query(
                    transactionsRef,
                    where("borrowerEmail", "==", user.email),
                    where("status", "==", "active")
                );
                const myBorrowsSnapshot = await getDocs(qMyBorrows);
                const myBorrowsList: DashboardItem[] = [];
                myBorrowsSnapshot.forEach((doc) => {
                    myBorrowsList.push({ id: doc.id, ...doc.data() } as DashboardItem);
                });

                myBorrowsList.sort((a, b) => {
                    const dateA = a.returnDate?.toDate().getTime() || 0;
                    const dateB = b.returnDate?.toDate().getTime() || 0;
                    return dateA - dateB;
                });

                setMyBorrows(myBorrowsList);
            }

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoadingData(false);
        }
    };

    const formatTimeAgo = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return `Just now`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        return timestamp.toDate().toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    // --- FIX: Logic การเช็คสถานะสำหรับ Activity Feed ---
    const getActionLabel = (activity: DashboardItem) => {
        // เช็คจาก field 'action' ของ activities collection ก่อน
        if (activity.action === 'borrow') return <span className="text-blue-400">Borrowed</span>;
        if (activity.action === 'return') return <span className="text-emerald-400">Returned</span>;
        if (activity.action === 'requisition') return <span className="text-purple-400">Requisitioned</span>;

        // Fallback: ถ้าไม่มี action ให้เช็ค status เดิม
        if (activity.status === 'active') return <span className="text-blue-400">Borrowed</span>;
        if (activity.status === 'completed') return <span className="text-emerald-400">Returned</span>;

        return <span className="text-white/60">Unknown</span>;
    };

    if (authLoading || loadingData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-lg text-white/60 font-light">
                        Overview of your inventory and movements.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-white/40 font-mono">
                        Last updated: {new Date().toLocaleTimeString()}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Assets', value: stats.total, trend: 'Items', color: 'text-emerald-400' },
                    { label: 'Available', value: stats.available, trend: 'Ready', color: 'text-primary' },
                    { label: 'Borrowed', value: stats.borrowed, trend: 'Active', color: 'text-accent' },
                    { label: 'Low Stock', value: stats.available < 5 ? 'Alert' : 'Good', trend: stats.available < 5 ? 'Restock' : 'Stable', color: stats.available < 5 ? 'text-rose-400' : 'text-emerald-400' },
                ].map((stat, i) => (
                    <div key={i} className="glass-card p-6 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl group-hover:bg-primary/20 transition-colors duration-500"></div>
                        <div className="relative z-10">
                            <p className="text-white/60 text-sm font-medium tracking-wide uppercase">{stat.label}</p>
                            <h3 className="text-3xl font-bold text-white mt-2 mb-1">{stat.value}</h3>
                            <div className={`text-sm ${stat.color} flex items-center gap-1 font-medium`}>
                                <span>{stat.trend}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: My Borrows + Recent Activity */}
                <div className="lg:col-span-2 space-y-6">

                    {/* My Active Borrows Section */}
                    <div className="glass-panel p-6 md:p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                        <div className="flex items-center gap-3 mb-6">
                            <h3 className="text-xl font-semibold text-white">My Active Borrows</h3>
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold border border-cyan-500/30">
                                {myBorrows.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {myBorrows.length === 0 ? (
                                <div className="text-center py-6 bg-white/5 rounded-xl border border-white/5 border-dashed">
                                    <p className="text-white/40">You don&apos;t have any active borrows.</p>
                                    <button
                                        onClick={() => router.push('/admin/inventory')}
                                        className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                                    >
                                        Browse Inventory &rarr;
                                    </button>
                                </div>
                            ) : (
                                myBorrows.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/10 hover:border-cyan-500/30 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-lg border border-cyan-500/20 text-cyan-400">
                                                💻
                                            </div>
                                            <div>
                                                <p className="text-white font-medium group-hover:text-cyan-400 transition-colors">
                                                    {item.productName}
                                                </p>
                                                <p className="text-white/40 text-xs">
                                                    Borrowed: {formatDate(item.borrowDate)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Due Date</p>
                                            <p className="text-white font-mono text-sm bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                                {formatDate(item.returnDate)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Recent Activity Feed */}
                    <div className="glass-panel p-6 md:p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
                            <button className="text-sm text-primary hover:text-accent transition-colors">View All</button>
                        </div>

                        <div className="space-y-4">
                            {recentActivity.length === 0 ? (
                                <p className="text-white/40 text-center py-4">No recent activity.</p>
                            ) : (
                                recentActivity.map((activity) => (
                                    <div key={activity.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-2xl shadow-inner border border-white/10">
                                                {/* Icon based on Action */}
                                                {activity.action === 'return' ? '↩️' : (activity.type === 'requisition' ? '📦' : '💻')}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium group-hover:text-primary transition-colors">
                                                    {activity.productName || 'Unknown Item'}
                                                </p>
                                                <p className="text-white/40 text-sm">
                                                    <span className="text-white/60">{activity.userName || activity.borrowerName || "Unknown User"}</span>
                                                    <span className="mx-2">•</span>
                                                    {getActionLabel(activity)}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-white/30 text-sm font-mono">
                                            {formatTimeAgo(activity.updatedAt || activity.timestamp || activity.borrowDate)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions & Status */}
                <div className="space-y-6">
                    <div className="glass-panel p-6">
                        <h3 className="text-lg font-semibold text-white mb-6">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => router.push('/admin/add-product')}
                                className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all aspect-square"
                            >
                                <span className="text-2xl">➕</span>
                                <span className="text-sm font-medium text-white/80">Add Item</span>
                            </button>
                            <button
                                onClick={() => router.push('/admin/inventory')}
                                className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all aspect-square"
                            >
                                <span className="text-2xl">📦</span>
                                <span className="text-sm font-medium text-white/80">Inventory</span>
                            </button>
                            <button
                                onClick={() => router.push('/scan')}
                                className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all aspect-square"
                            >
                                <span className="text-2xl">📷</span>
                                <span className="text-sm font-medium text-white/80">Scan QR</span>
                            </button>
                            <button
                                onClick={() => router.push('/admin/inventory')}
                                className="glass-card p-4 flex flex-col items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all aspect-square"
                            >
                                <span className="text-2xl">📥</span>
                                <span className="text-sm font-medium text-white/80">Check In</span>
                            </button>
                        </div>
                    </div>

                    <div className="glass-panel p-6 bg-gradient-to-br from-primary/20 to-accent/10 border-primary/20">
                        <h3 className="text-lg font-semibold text-white mb-2">System Status</h3>
                        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            All Systems Operational
                        </div>
                        <p className="text-white/40 text-xs mt-4">
                            Database: Connected<br />
                            Sync: Real-time
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}