"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, query, where, orderBy, getDocs, limit, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
    X,
    Loader2,
    Wrench,
    Calendar,
    Package,
    ClipboardList,
    MapPin,
    Clock,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    User
} from "lucide-react";

type HistoryType = "repair" | "booking" | "borrow" | "requisition";

interface UserHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    historyType: HistoryType;
}

const historyConfig = {
    repair: {
        title: "ประวัติการแจ้งซ่อม",
        icon: Wrench,
        color: "text-amber-600",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-100"
    },
    booking: {
        title: "ประวัติการจองห้องประชุม",
        icon: Calendar,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-100"
    },
    borrow: {
        title: "ประวัติการยืม/คืน",
        icon: Package,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-100"
    },
    requisition: {
        title: "ประวัติการเบิก",
        icon: ClipboardList,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        borderColor: "border-emerald-100"
    }
};

export default function UserHistoryModal({ isOpen, onClose, historyType }: UserHistoryModalProps) {
    const { user } = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const config = historyConfig[historyType];
    const IconComponent = config.icon;

    useEffect(() => {
        if (!isOpen || !user?.email) return;

        const fetchHistory = async () => {
            setLoading(true);
            setError(null);

            try {
                let q;

                switch (historyType) {
                    case "repair":
                        q = query(
                            collection(db, "repair_tickets"),
                            where("requesterEmail", "==", user.email),
                            orderBy("createdAt", "desc"),
                            limit(50)
                        );
                        break;
                    case "booking":
                        q = query(
                            collection(db, "bookings"),
                            where("requesterEmail", "==", user.email),
                            orderBy("createdAt", "desc"),
                            limit(50)
                        );
                        break;
                    case "borrow":
                        q = query(
                            collection(db, "transactions"),
                            where("type", "==", "borrow"),
                            where("userName", "==", user.displayName),
                            orderBy("transactionDate", "desc"),
                            limit(50)
                        );
                        break;
                    case "requisition":
                        q = query(
                            collection(db, "transactions"),
                            where("type", "==", "requisition"),
                            where("userName", "==", user.displayName),
                            orderBy("transactionDate", "desc"),
                            limit(50)
                        );
                        break;
                }

                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setItems(data);
            } catch (err: any) {
                console.error("Error fetching history:", err);
                if (err.message?.includes("index")) {
                    setError("ระบบต้องการสร้าง index ใน Firestore (กรุณาติดต่อ Admin)");
                } else {
                    setError("ไม่สามารถโหลดข้อมูลได้");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [isOpen, user, historyType]);

    const formatDate = (timestamp: Timestamp | any) => {
        if (!timestamp) return "-";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const getStatusBadge = (status: string, type: HistoryType) => {
        if (type === "repair") {
            switch (status) {
                case "pending":
                    return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">รอดำเนินการ</span>;
                case "in_progress":
                    return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">กำลังซ่อม</span>;
                case "waiting_parts":
                    return <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">รออะไหล่</span>;
                case "completed":
                    return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">เสร็จสิ้น</span>;
                default:
                    return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{status}</span>;
            }
        }

        if (type === "booking") {
            switch (status) {
                case "pending":
                    return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">รออนุมัติ</span>;
                case "approved":
                    return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">อนุมัติแล้ว</span>;
                case "rejected":
                    return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">ถูกปฏิเสธ</span>;
                default:
                    return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{status}</span>;
            }
        }

        if (type === "borrow" || type === "requisition") {
            switch (status) {
                case "active":
                    return <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">ยังไม่คืน</span>;
                case "completed":
                    return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">คืนแล้ว</span>;
                default:
                    return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{status}</span>;
            }
        }

        return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{status}</span>;
    };

    const renderItem = (item: any) => {
        switch (historyType) {
            case "repair":
                return (
                    <div key={item.id} className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{item.description}</p>
                                <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                                    <MapPin size={14} />
                                    <span>{item.room}</span>
                                </div>
                            </div>
                            {getStatusBadge(item.status, "repair")}
                        </div>
                        <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                            <Clock size={12} />
                            <span>{formatDate(item.createdAt)}</span>
                        </div>
                    </div>
                );

            case "booking":
                return (
                    <div key={item.id} className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                                <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                                    <MapPin size={14} />
                                    <span>{item.roomName}</span>
                                </div>
                            </div>
                            {getStatusBadge(item.status, "booking")}
                        </div>
                        <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                            <Clock size={12} />
                            <span>{formatDate(item.startTime)} - {formatDate(item.endTime)}</span>
                        </div>
                    </div>
                );

            case "borrow":
            case "requisition":
                return (
                    <div key={item.id} className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{item.productName || "รายการ"}</p>
                                <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                                    <User size={14} />
                                    <span>{item.userRoom}</span>
                                </div>
                            </div>
                            {getStatusBadge(item.status, historyType)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                            <Clock size={12} />
                            <span>{formatDate(item.transactionDate)}</span>
                            {item.returnDate && historyType === "borrow" && (
                                <span className="ml-2">• กำหนดคืน: {formatDate(item.returnDate)}</span>
                            )}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full sm:max-w-lg max-h-[85vh] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 ${config.bgColor}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-white/80 dark:bg-gray-800/80 ${config.color}`}>
                            <IconComponent size={20} />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{config.title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                            <p className="mt-3 text-sm text-gray-500">กำลังโหลด...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-16 text-red-500">
                            <AlertCircle className="w-10 h-10 mb-3 opacity-60" />
                            <p className="text-sm text-center">{error}</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <IconComponent className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm">ยังไม่มีประวัติ</p>
                        </div>
                    ) : (
                        items.map(item => renderItem(item))
                    )}
                </div>
            </div>
        </div>
    );
}
