"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { X, PackageSearch, AlertTriangle } from "lucide-react";

interface BorrowedItem {
    id: string;
    productName: string;
    borrowerName: string;
    userRoom: string;
    userPhone?: string;
    borrowDate: any;
    returnDate: any;
}

interface BorrowedStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function formatDate(timestamp: any): string {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function isOverdue(returnDate: any): boolean {
    if (!returnDate) return false;
    const date = returnDate.toDate ? returnDate.toDate() : new Date(returnDate);
    return date < new Date();
}

export default function BorrowedStatusModal({ isOpen, onClose }: BorrowedStatusModalProps) {
    const [items, setItems] = useState<BorrowedItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        const q = query(
            collection(db, "transactions"),
            where("type", "==", "borrow"),
            where("status", "==", "active")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: BorrowedItem[] = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() } as BorrowedItem));

            // Sort client-side by returnDate ascending
            list.sort((a, b) => {
                const aDate = a.returnDate?.toDate?.() ?? new Date(0);
                const bDate = b.returnDate?.toDate?.() ?? new Date(0);
                return aDate.getTime() - bDate.getTime();
            });

            setItems(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen]);

    if (!isOpen) return null;

    const overdueItems = items.filter((i) => isOverdue(i.returnDate));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold text-text flex items-center gap-2">
                            <PackageSearch size={22} className="text-amber-500" />
                            รายการค้างคืน
                        </h2>
                        <p className="text-sm text-text-secondary mt-0.5">
                            {items.length} รายการ
                            {overdueItems.length > 0 && (
                                <span className="ml-2 text-red-500 font-medium">
                                    · เกินกำหนด {overdueItems.length} รายการ
                                </span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-border/50 text-text-secondary transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-text-secondary">
                            กำลังโหลด...
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-text-secondary gap-2">
                            <PackageSearch size={32} strokeWidth={1.5} />
                            <p>ไม่มีรายการค้างคืน</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-800 text-text-secondary font-medium border-b border-border sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">สินค้า</th>
                                    <th className="px-4 py-3">ผู้ยืม</th>
                                    <th className="px-4 py-3">ห้อง</th>
                                    <th className="px-4 py-3">เบอร์โทร</th>
                                    <th className="px-4 py-3">วันยืม</th>
                                    <th className="px-4 py-3">กำหนดคืน</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {items.map((item) => {
                                    const overdue = isOverdue(item.returnDate);
                                    return (
                                        <tr
                                            key={item.id}
                                            className={`transition-colors ${overdue ? "bg-red-50/50 dark:bg-red-900/10" : "hover:bg-gray-50/50"}`}
                                        >
                                            <td className="px-4 py-3 font-medium text-text">
                                                <div className="flex items-center gap-1.5">
                                                    {overdue && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                                                    {item.productName}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-text">{item.borrowerName}</td>
                                            <td className="px-4 py-3 text-text-secondary">{item.userRoom}</td>
                                            <td className="px-4 py-3 text-text-secondary">{item.userPhone || "-"}</td>
                                            <td className="px-4 py-3 text-text-secondary">{formatDate(item.borrowDate)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`font-medium ${overdue ? "text-red-500" : "text-text"}`}>
                                                    {formatDate(item.returnDate)}
                                                    {overdue && <span className="ml-1 text-xs">(เกินกำหนด)</span>}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
