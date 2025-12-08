"use strict";

import React, { useRef, useEffect } from "react";
import { Product } from "../../types";
import { X, Calendar, MapPin, Tag, Hash, Package, Clock, Download, Upload, RotateCcw, Edit, ExternalLink, Printer } from "lucide-react";
import Image from "next/image";
import QRCode from "react-qr-code";

interface ProductDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onAction: (action: 'borrow' | 'requisition' | 'edit' | 'return', product: Product) => void;
}

export default function ProductDetailModal({ isOpen, onClose, product, onAction }: ProductDetailModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

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
                className="bg-white dark:bg-card w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
            >
                {/* Header with Image Background Effect */}
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                    {/* Blurred Background */}
                    {product.imageUrl && (
                        <div className="absolute inset-0 blur-xl opacity-50 transform scale-110">
                            <Image
                                src={product.imageUrl}
                                alt=""
                                fill
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
                        <h2 className="text-2xl font-bold truncate shadow-sm">{product.name}</h2>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-8">

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Left: Main Image */}
                        <div className="w-full md:w-1/3 flex-shrink-0">
                            <div className="aspect-square relative rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shadow-inner group cursor-pointer" onClick={() => window.open(product.imageUrl, '_blank')}>
                                {product.imageUrl ? (
                                    <Image
                                        src={product.imageUrl}
                                        alt={product.name}
                                        fill
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
                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 flex items-center gap-1"><Tag size={12} /> แบรนด์/ยี่ห้อ</span>
                                    <p className="font-semibold text-gray-900 line-clamp-1">{product.brand || "-"}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 flex items-center gap-1"><Hash size={12} /> หมวดหมู่/Category</span>
                                    <p className="font-semibold text-gray-900 line-clamp-1">{product.category || "-"}</p>
                                </div>

                                {/* Serial Number */}
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 flex items-center gap-1"><Hash size={12} /> Serial Number (S/N)</span>
                                    <p className="font-mono text-sm bg-gray-50 px-2 py-1 rounded border border-gray-100 inline-block text-gray-700 break-all">
                                        {product.serialNumber || "-"}
                                    </p>
                                </div>

                                {/* Compact QR Code Section */}
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 flex items-center gap-1"><Printer size={12} /> QR Code</span>

                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-1 rounded border border-gray-100 shrink-0">
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
                                    <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={12} /> สถานที่จัดเก็บ</span>
                                    <p className="font-semibold text-gray-900">{product.location || "-"}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-gray-500 flex items-center gap-1"><Package size={12} /> จำนวนคงเหลือ</span>
                                    <p className={`font-bold text-lg ${availableStock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {availableStock} <span className="text-sm text-gray-400 font-normal">/ {product.quantity || 1}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Additional Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <Clock size={16} className="text-blue-500" /> ประวัติและรายละเอียด
                            </h3>
                            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2">
                                <p><span className="font-medium text-gray-700">วันที่เพิ่ม:</span> {product.createdAt?.toDate ? product.createdAt.toDate().toLocaleDateString('th-TH') : '-'}</p>
                                <p><span className="font-medium text-gray-700">อัปเดตล่าสุด:</span> {product.updatedAt?.toDate ? product.updatedAt.toDate().toLocaleDateString('th-TH') : '-'}</p>
                                {product.description && (
                                    <div className="pt-2 border-t border-gray-200 mt-2">
                                        <p className="text-gray-500 text-xs mb-1">รายละเอียดเพิ่มเติม:</p>
                                        <p className="leading-relaxed">{product.description}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions Panel */}
                        <div className="space-y-2">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <Download size={16} className="text-purple-500" /> จัดการรายการ
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {isAvailable && (
                                    <button
                                        onClick={() => onAction('borrow', product)}
                                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-cyan-50 text-cyan-600 font-bold hover:bg-cyan-100 transition-all border border-cyan-100"
                                    >
                                        <Download size={18} /> ยืมอุปกรณ์นี้
                                    </button>
                                )}
                                {isAvailable && (
                                    <button
                                        onClick={() => onAction('requisition', product)}
                                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-purple-50 text-purple-600 font-bold hover:bg-purple-100 transition-all border border-purple-100"
                                    >
                                        <Upload size={18} /> เบิกใช้งาน
                                    </button>
                                )}
                                {isBorrowed && (
                                    <button
                                        onClick={() => onAction('return', product)}
                                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-50 text-amber-600 font-bold hover:bg-amber-100 transition-all border border-amber-100"
                                    >
                                        <RotateCcw size={18} /> แจ้งคืนอุปกรณ์
                                    </button>
                                )}
                                <button
                                    onClick={() => onAction('edit', product)}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-all border border-gray-200"
                                >
                                    <Edit size={18} /> แก้ไขข้อมูล
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
