"use strict";

import React, { useRef, useEffect, useState } from "react";
import { Product } from "../../types";
import { X, Calendar, MapPin, Tag, Hash, Package, Clock, Download, Upload, RotateCcw, Edit, ExternalLink, Printer, Box, History, ArrowDownToLine, ArrowUpFromLine, Plus, Loader2 } from "lucide-react";
import Image from "next/image";
import QRCode from "react-qr-code";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface ActivityLogItem {
    id: string;
    action: string;
    productName: string;
    userName: string;
    details?: string;
    timestamp: Timestamp;
}

interface ProductDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onAction: (action: 'borrow' | 'requisition' | 'edit' | 'return', product: Product) => void;
}

export default function ProductDetailModal({ isOpen, onClose, product, onAction }: ProductDetailModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const [activityHistory, setActivityHistory] = useState<ActivityLogItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch product activity history
    useEffect(() => {
        const fetchProductHistory = async () => {
            if (!product.name) return;

            setLoadingHistory(true);
            try {
                const q = query(
                    collection(db, "activities"),
                    where("productName", "==", product.name),
                    orderBy("timestamp", "desc"),
                    limit(5)
                );
                const snapshot = await getDocs(q);
                const logs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as ActivityLogItem[];
                setActivityHistory(logs);
            } catch (error) {
                console.error("Error fetching product history:", error);
            } finally {
                setLoadingHistory(false);
            }
        };

        if (isOpen && product.name) {
            fetchProductHistory();
        }
    }, [isOpen, product.name]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Add both touch and mouse events for iOS PWA compatibility
            document.addEventListener("touchstart", handleClickOutside, { passive: true });
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.body.style.overflow = '';
            document.removeEventListener("touchstart", handleClickOutside);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Helper function for action icons and labels
    const getActionConfig = (action: string) => {
        switch (action) {
            case 'borrow':
                return { icon: ArrowDownToLine, label: 'ยืม', color: 'text-amber-600', bg: 'bg-amber-50' };
            case 'return':
                return { icon: RotateCcw, label: 'คืน', color: 'text-emerald-600', bg: 'bg-emerald-50' };
            case 'requisition':
                return { icon: ArrowUpFromLine, label: 'เบิก', color: 'text-blue-600', bg: 'bg-blue-50' };
            case 'add':
                return { icon: Plus, label: 'เพิ่ม', color: 'text-purple-600', bg: 'bg-purple-50' };
            default:
                return { icon: Clock, label: action, color: 'text-gray-600', bg: 'bg-gray-50' };
        }
    };

    const formatTimeAgo = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
        if (hours < 24) return `${hours} ชม.ที่แล้ว`;
        if (days < 7) return `${days} วันที่แล้ว`;
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    };

    if (!isOpen) return null;

    const statusConfig = {
        available: { label: 'พร้อมใช้', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        borrowed: { label: 'ถูกยืม', color: 'bg-amber-100 text-amber-700 border-amber-200' },
        maintenance: { label: 'ส่งซ่อม', color: 'bg-red-100 text-red-700 border-red-200' },
        requisitioned: { label: 'เบิกแล้ว', color: 'bg-gray-100 text-gray-700 border-gray-200' },
        unavailable: { label: 'ไม่ว่าง', color: 'bg-red-100 text-red-700 border-red-200' },
        'ไม่ว่าง': { label: 'ไม่ว่าง', color: 'bg-red-100 text-red-700 border-red-200' }
    };

    const statusInfo = statusConfig[product.status] || { label: product.status, color: 'bg-gray-100 text-gray-500' };

    // Calculate Available Stock for Bulk
    const availableStock = product.type === 'bulk'
        ? (product.quantity || 0) - (product.borrowedCount || 0)
        : (product.status === 'available' ? 1 : 0);

    const isAvailable = product.status === 'available' || (product.type === 'bulk' && availableStock > 0);
    const isBorrowed = product.status === 'borrowed' || (product.type === 'bulk' && (product.borrowedCount || 0) > 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div
                ref={modalRef}
                className="bg-white dark:bg-card w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in overscroll-contain overflow-y-auto md:overflow-hidden"
            >
                {/* Header with Image Background Effect */}
                <div className="relative h-48 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {/* Blurred Background */}
                    {product.imageUrl && (
                        <div className="absolute inset-0 blur-xl opacity-50 transform scale-110">
                            <Image
                                src={product.imageUrl}
                                alt=""
                                fill
                                priority
                                sizes="100vw"
                                className="object-cover"
                            />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors z-10"
                    >
                        <X size={20} />
                    </button>

                    <div className="absolute bottom-4 left-6 right-6 text-white">
                        <div className="flex items-center gap-2 mb-1 opacity-90">
                            <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-xs font-medium border border-white/10">
                                {product.type === 'unique' ? 'ครุภัณฑ์ (Unique)' : 'วัสดุสิ้นเปลือง (Bulk)'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border border-white/10 backdrop-blur-md ${statusInfo.color}`}>
                                {statusInfo.label}
                            </span>
                        </div>
                    </div>

                </div>


                {/* Content */}
                <div className="p-6 md:p-8 md:overflow-y-auto custom-scrollbar space-y-8">

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Left: Main Image */}
                        <div className="w-full md:w-1/3 flex-shrink-0">
                            <div className="aspect-square relative rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-700 shadow-inner group cursor-pointer" onClick={() => window.open(product.imageUrl, '_blank')}>
                                {product.imageUrl ? (
                                    <Image
                                        src={product.imageUrl}
                                        alt={product.name}
                                        fill
                                        priority
                                        sizes="(max-width: 768px) 100vw, 33vw"
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                        <Package size={48} className="mb-2 opacity-50" />
                                        <span className="text-xs">ไม่มีรูปภาพ</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <ExternalLink className="text-white drop-shadow-md" size={24} />
                                </div>
                            </div>
                        </div>

                        {/* Right: Details Grid */}
                        <div className="flex-1 space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                    {product.name}
                                    {product.stockId && (
                                        <span className="text-base font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600">
                                            #{product.stockId}
                                        </span>
                                    )}
                                </h2>
                            </div>
                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Tag size={12} /> แบรนด์/ยี่ห้อ</span>
                                    <p className="font-semibold text-gray-900 dark:text-white line-clamp-1">{product.brand || "-"}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Hash size={12} /> หมวดหมู่/Category</span>
                                    <p className="font-semibold text-gray-900 dark:text-white line-clamp-1">{product.category || "-"}</p>
                                </div>

                                {/* Serial Number */}
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Hash size={12} /> Serial Number (S/N)</span>
                                    <p className="font-mono text-sm bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded border border-gray-100 dark:border-gray-600 inline-block text-gray-700 dark:text-gray-200 break-all">
                                        {product.serialNumber || "-"}
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Printer size={12} /> QR Code</span>

                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-1 rounded border border-gray-100 items-center justify-center flex shrink-0">
                                            <QRCode
                                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/product/${product.id || ''}`}
                                                size={48}
                                                className="w-12 h-12"
                                            />
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    const printWindow = window.open('', '', 'width=600,height=600');
                                                    if (printWindow) {
                                                        printWindow.document.write(`
                                                            <html><head><title>Print QR</title></head>
                                                            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;">
                                                                <div style="border:2px solid black;padding:20px;text-align:center;border-radius:10px;">
                                                                    ${(document.getElementById(`modal-qr-${product.id}`) as any)?.outerHTML || ''}
                                                                    <div style="font-weight:bold;margin-top:10px;font-size:18px;">${product.name}</div>
                                                                    <div style="font-family:monospace;color:#555;">${product.stockId || product.id}</div>
                                                                </div>
                                                                <script>window.onload=()=>{window.print();window.close();}</script>
                                                            </body></html>`
                                                        );
                                                        printWindow.document.close();
                                                    }
                                                }}
                                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                                title="Print QR"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const origin = window.location.origin;
                                                        const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${origin}/product/${product.id}`)}`;
                                                        const response = await fetch(url);
                                                        const blob = await response.blob();
                                                        const downloadLink = document.createElement('a');
                                                        downloadLink.href = URL.createObjectURL(blob);
                                                        downloadLink.download = `QR_${product.name}_${product.stockId || product.id}.png`;
                                                        document.body.appendChild(downloadLink);
                                                        downloadLink.click();
                                                        document.body.removeChild(downloadLink);
                                                    } catch (e) {
                                                        console.error("Download failed", e);
                                                        alert("Could not download QR Code");
                                                    }
                                                }}
                                                className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors border border-transparent hover:border-cyan-100"
                                                title="Download PNG"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'none' }}>
                                    <QRCode
                                        id={`modal-qr-${product.id || ''}`}
                                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/product/${product.id || ''}`}
                                        size={150}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><MapPin size={12} /> สถานที่จัดเก็บ</span>
                                    <p className="font-semibold text-gray-900 dark:text-white">{product.location || "-"}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Package size={12} /> จำนวนคงเหลือ</span>
                                    <p className={`font-bold text-lg ${availableStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                        {availableStock} <span className="text-sm text-gray-400 font-normal">/ {product.quantity || 1}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100 dark:border-gray-700" />

                    {/* Additional Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* Left Column: Info, Description & Actions */}
                        <div className="space-y-6">
                            {/* Product Info */}
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Clock size={16} className="text-blue-500" /> ข้อมูลสินค้า
                                </h3>
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-300 space-y-2">
                                    <p><span className="font-medium text-gray-700 dark:text-gray-200">วันที่เพิ่ม:</span> {product.createdAt?.toDate ? product.createdAt.toDate().toLocaleDateString('th-TH') : '-'}</p>
                                    <p><span className="font-medium text-gray-700 dark:text-gray-200">อัปเดตล่าสุด:</span> {product.updatedAt?.toDate ? product.updatedAt.toDate().toLocaleDateString('th-TH') : '-'}</p>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Tag size={16} className="text-emerald-500" /> รายละเอียดเพิ่มเติม
                                </h3>
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-300 min-h-[100px] border border-gray-100 dark:border-gray-700">
                                    {product.description ? (
                                        <p className="leading-relaxed whitespace-pre-line text-gray-700 dark:text-gray-200">{product.description}</p>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-2 py-4">
                                            <Box size={24} />
                                            <span className="text-xs">ไม่มีรายละเอียด</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Download size={16} className="text-purple-500" /> จัดการรายการ
                                </h3>
                                <div className="flex gap-2">
                                    {isAvailable && (
                                        <button
                                            onClick={() => onAction('borrow', product)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white dark:bg-card text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700"
                                        >
                                            <Download size={16} /> ยืม
                                        </button>
                                    )}
                                    {isAvailable && (
                                        <button
                                            onClick={() => onAction('requisition', product)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white dark:bg-card text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700"
                                        >
                                            <Upload size={16} /> เบิก
                                        </button>
                                    )}
                                    {isBorrowed && (
                                        <button
                                            onClick={() => onAction('return', product)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white dark:bg-card text-gray-700 dark:text-gray-200 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700"
                                        >
                                            <RotateCcw size={16} /> คืน
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onAction('edit', product)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-600 transition-all border border-gray-200 dark:border-gray-600"
                                    >
                                        <Edit size={16} /> แก้ไข
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Activity History */}
                        <div className="space-y-3">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <History size={16} className="text-indigo-500" /> ประวัติล่าสุด
                            </h3>
                            <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                {loadingHistory ? (
                                    <div className="p-8 flex items-center justify-center">
                                        <Loader2 size={20} className="animate-spin text-gray-400" />
                                        <span className="ml-2 text-sm text-gray-400">กำลังโหลด...</span>
                                    </div>
                                ) : activityHistory.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        <History size={28} className="mx-auto mb-2 opacity-30" />
                                        <p>ยังไม่มีประวัติการใช้งาน</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {activityHistory.slice(0, 5).map((log) => {
                                            const config = getActionConfig(log.action);
                                            const IconComponent = config.icon;
                                            return (
                                                <div key={log.id} className="flex items-start gap-3 p-3.5 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <div className={`p-2 rounded-lg ${config.bg} shrink-0`}>
                                                        <IconComponent size={14} className={config.color} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
                                                            <span className="text-xs text-gray-400">•</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{log.userName}</span>
                                                        </div>
                                                        {log.details && (
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{log.details}</p>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 shrink-0">{formatTimeAgo(log.timestamp)}</span>
                                                </div>
                                            );
                                        })}
                                        {/* Empty slots to always show 5 rows */}
                                        {activityHistory.length < 5 && Array.from({ length: 5 - activityHistory.length }).map((_, i) => (
                                            <div key={`empty-${i}`} className="flex items-center justify-center p-3.5 text-gray-300 dark:text-gray-600">
                                                <span className="text-xs">—</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
