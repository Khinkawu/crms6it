"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDocs, where, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { Product, ProductStatus, ActivityLog } from "../../../types";
import { logActivity } from "../../../utils/logger";
import toast from "react-hot-toast";
import Image from "next/image";
import { incrementStats, decrementStats, updateStatsOnStatusChange } from "../../../utils/aggregation";
import {
    Download, Upload, RotateCcw, Edit, Package,
    LayoutGrid, List, Check, Search, History, Printer, Plus
} from "lucide-react";
import { Suspense } from 'react';

// Performance: Lazy-loaded modals
import {
    LazyBorrowModal,
    LazyEditProductModal,
    LazyRequisitionModal,
    LazyReturnModal,
    LazyLogTable
} from "../../components/LazyComponents";
import dynamic from "next/dynamic";
const ProductDetailModal = dynamic(() => import("../../components/ProductDetailModal"), { ssr: false });

// Performance: Pagination, Empty State, Skeleton
import { usePagination } from "../../../hooks/usePagination";
import Pagination from "../../components/ui/Pagination";
import { EmptyInventory, EmptySearchResults } from "../../components/ui/EmptyState";
import { PageSkeleton, CardSkeleton } from "../../components/ui/Skeleton";

// ... existing imports ...

// ... inside component ...

// REMOVED handleReturnConfirm as logic is now in ReturnModal

// ...



function InventoryContent() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    // ... rest of the component logic

    const [products, setProducts] = useState<Product[]>([]);
    const [filter, setFilter] = useState<ProductStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Modal State
    const [activeModal, setActiveModal] = useState<'borrow' | 'requisition' | 'edit' | 'return' | 'detail' | null>(null);

    // Log Modal State
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logType, setLogType] = useState<'stock' | 'activity'>('stock');
    const [activityLogs, setActivityLogs] = useState<any[]>([]);

    useEffect(() => {
        if (!loading) {
            if (!user || role !== 'admin') {
                router.push("/");
            }
        }
    }, [user, role, loading, router]);

    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, "products"), orderBy("updatedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const productList: Product[] = [];
            snapshot.forEach((doc) => {
                productList.push({ id: doc.id, ...doc.data() } as Product);
            });
            setProducts(productList);
        });

        return () => unsubscribe();
    }, [user]);

    // Deep Link Effect
    useEffect(() => {
        const id = searchParams.get('id');
        if (id && products.length > 0) {
            const found = products.find(p => p.id === id);
            if (found) {
                setSelectedProduct(found);
                setActiveModal('detail');
            }
        }
    }, [searchParams, products]);

    const handleAction = (action: 'borrow' | 'requisition' | 'edit' | 'return' | 'detail', product: Product) => {
        if (action === 'detail') {
            setSelectedProduct(product);
            setActiveModal('detail');
            // Update URL without reload to support sharing/back button
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('id', product.id || '');
            window.history.pushState({}, '', newUrl.toString());
        } else {
            setSelectedProduct(product);
            setActiveModal(action);
        }
    };

    const handleCloseModal = () => {
        setActiveModal(null);
        // Clear ID from URL if closing detail modal
        if (activeModal === 'detail') {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('id');
            window.history.pushState({}, '', newUrl.toString());
        }
    };



    const [isLogLoading, setIsLogLoading] = useState(false);

    const handleOpenLogModal = (type: 'stock' | 'activity') => {
        setLogType(type);
        setActivityLogs([]); // Clear previous logs
        setIsLogModalOpen(true);
    };

    const handleFetchLogs = async (startDate: string, endDate: string) => {
        setIsLogLoading(true);
        try {
            // Parse start date (YYYY-MM-DD) to local start of day
            const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);

            // Parse end date (YYYY-MM-DD) to local end of day
            const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
            const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

            const q = query(
                collection(db, "activities"),
                where("timestamp", ">=", start),
                where("timestamp", "<=", end),
                orderBy("timestamp", "desc")
            );

            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setActivityLogs(logs as any);

            if (logs.length === 0) {
                toast("ไม่พบข้อมูลในช่วงเวลาที่เลือก", { icon: 'ℹ️' });
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
            toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
        } finally {
            setIsLogLoading(false);
        }
    };


    // Selection Logic
    const handleSelectProduct = (id: string | undefined) => {
        if (!id) return;
        const newSelected = new Set(selectedProductIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedProductIds(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedProductIds.size === filteredProducts.length) {
            setSelectedProductIds(new Set());
        } else {
            const allIds = filteredProducts.map(p => p.id).filter((id): id is string => !!id);
            setSelectedProductIds(new Set(allIds));
        }
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedProductIds(new Set()); // Clear selection when toggling
    };



    // QR Code Bulk Print Logic (Preserved)
    const handleBulkPrint = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        const origin = window.location.origin;
        // Use react-qr-code approach conceptually, but for raw HTML print we use a clear API or just text if preferred. 
        // Actually, the previous code used `api.qrserver.com`. Let's stick to that but with full URL.
        const qrCodeUrl = (id: string) => `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${origin}/product/${id}`)}`;

        const htmlContent = `
            <html>
                <head>
                    <title>Print QR Codes</title>
                    <style>
                        body { font-family: 'Sarabun', sans-serif; padding: 20px; }
                        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; }
                        .card { 
                            border: 2px solid #000; 
                            padding: 10px; 
                            text-align: center; 
                            border-radius: 8px; 
                            page-break-inside: avoid;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                        }
                        img { width: 100px; height: 100px; display: block; margin-bottom: 5px; }
                        .name { font-size: 14px; font-weight: bold; line-height: 1.2; margin-bottom: 2px; }
                        .id { font-size: 10px; color: #555; font-family: monospace; }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <h1 class="no-print">QR Codes (${selectedProductIds.size > 0 ? selectedProductIds.size : filteredProducts.length} items)</h1>
                    <button class="no-print" onclick="window.print()" style="padding: 10px 20px; margin-bottom: 20px; cursor: pointer; font-size: 16px;">Print Now</button>
                    <div class="grid">
                        ${(selectedProductIds.size > 0
                ? products.filter(p => p.id && selectedProductIds.has(p.id))
                : filteredProducts
            ).map(p => `
                            <div class="card">
                                <img src="${qrCodeUrl(p.id!)}" alt="QR Code" />
                                <div class="name">${p.name}</div>
                                <div class="id">${p.stockId || p.id}</div>
                            </div>
                        `).join('')}
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const [isDownloading, setIsDownloading] = useState(false);

    const handleBulkDownload = async () => {
        setIsDownloading(true);
        try {
            // Dynamic import for JSZip and FileSaver to strictly avoid SSR issues if any, though "use client" handles most.
            // But we need to make sure they are installed.
            const JSZip = (await import('jszip')).default;
            const { saveAs } = await import('file-saver');

            const zip = new JSZip();
            const origin = window.location.origin;

            const items = selectedProductIds.size > 0
                ? products.filter(p => p.id && selectedProductIds.has(p.id))
                : filteredProducts;

            if (items.length === 0) {
                toast.error("No items to download");
                return;
            }

            const promises = items.map(async (p) => {
                if (!p.id) return;
                try {
                    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${origin}/product/${p.id}`)}`;
                    const response = await fetch(url);
                    const blob = await response.blob();
                    // Filename: Name_IDFirst4.png
                    const safeName = p.name.replace(/[^a-z0-9]/gi, '_').slice(0, 20);
                    zip.file(`${safeName}_${p.stockId || p.id}.png`, blob);
                } catch (err) {
                    console.error("Failed to fetch QR for", p.name, err);
                }
            });

            await Promise.all(promises);

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `qr_codes_${new Date().toISOString().slice(0, 10)}.zip`);
            toast.success("Downloaded QR Codes");

        } catch (error) {
            console.error("Bulk download error:", error);
            toast.error("Failed to create zip file");
        } finally {
            setIsDownloading(false);
        }
    };

    // Filter Logic
    // Filter Logic
    const filteredProducts = products.filter(p => {
        let matchesFilter = false;

        if (filter === 'all') {
            matchesFilter = true;
        } else if (filter === 'available') {
            // Unique: status 'available'. Bulk: quantity > borrowedCount
            const isBulkAvailable = p.type === 'bulk' && (p.quantity || 0) > (p.borrowedCount || 0);
            matchesFilter = p.status === 'available' || isBulkAvailable;
        } else if (filter === 'borrowed') {
            // Unique: status 'borrowed' OR 'ไม่ว่าง'. Bulk: borrowedCount > 0
            const isBulkBorrowed = p.type === 'bulk' && (p.borrowedCount || 0) > 0;
            matchesFilter = p.status === 'borrowed' || p.status === 'ไม่ว่าง' || isBulkBorrowed;
        } else if (filter === 'maintenance') {
            matchesFilter = p.status === 'maintenance';
        } else if (filter === 'requisitioned') {
            // Matches 'requisitioned', 'เบิกแล้ว', 'unavailable', 'out_of_stock'
            const reqStatuses = ['requisitioned', 'เบิกแล้ว', 'unavailable', 'out_of_stock'];
            matchesFilter = reqStatuses.includes(p.status || '');
        }

        const matchesSearch =
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.serialNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.stockId || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });



    // Pagination for filtered products
    const {
        paginatedData: paginatedProducts,
        currentPage,
        totalPages,
        goToPage,
        startIndex,
        endIndex,
        totalItems
    } = usePagination({ data: filteredProducts, itemsPerPage: 12 });

    if (loading || !user || role !== 'admin') {
        return <PageSkeleton />;
    }

    return (
        <div className="animate-fade-in pb-20">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header & Stats */}
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-text mb-1">คลังพัสดุ</h1>
                            <p className="text-text-secondary">จัดการรายการวัสดุและครุภัณฑ์ทั้งหมด</p>
                        </div>
                        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full sm:w-auto">
                            <button
                                onClick={() => handleOpenLogModal('activity')}
                                className="px-4 py-2 bg-white dark:bg-card border border-border text-text font-bold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2"
                            >
                                <History size={20} /> ประวัติ
                            </button>
                            <button
                                onClick={toggleSelectionMode}
                                className={`px-4 py-2 border font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all ${isSelectionMode ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-white dark:bg-card border-border text-text hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                            >
                                <Printer size={20} /> {isSelectionMode ? 'ยกเลิก' : 'พิมพ์ QR'}
                            </button>
                            {isSelectionMode && (
                                <>
                                    <button
                                        onClick={handleBulkPrint}
                                        disabled={selectedProductIds.size === 0}
                                        className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-xl shadow-sm hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Printer size={20} /> พิมพ์ ({selectedProductIds.size})
                                    </button>
                                    <button
                                        onClick={handleBulkDownload}
                                        disabled={selectedProductIds.size === 0 || isDownloading}
                                        className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isDownloading ? <span className="animate-spin">⏳</span> : <Download size={20} />}
                                        โหลด ({selectedProductIds.size})
                                    </button>
                                </>
                            )}

                            <button
                                onClick={() => router.push('/admin/add-product')}
                                className="col-span-2 sm:col-span-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-2"
                            >
                                <Plus size={20} /> เพิ่มรายการใหม่
                            </button>
                        </div>
                    </div>
                </div>





                {/* Control Bar */}
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-sm">
                    {/* Search */}
                    <div className="relative w-full lg:w-96">
                        <input
                            type="text"
                            placeholder="ค้นหา (ชื่อ, แบรนด์, S/N)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-text focus:outline-none focus:border-cyan-500/50 transition-all"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                            <Search size={20} />
                        </div>
                    </div>

                    {/* Filters & Toggle */}
                    <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
                        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
                            {[
                                { id: 'all', label: 'ทั้งหมด' },
                                { id: 'available', label: 'พร้อมใช้' },
                                { id: 'borrowed', label: 'ถูกยืม' },
                                { id: 'maintenance', label: 'ส่งซ่อม' },
                                { id: 'requisitioned', label: 'เบิกแล้ว' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id as any)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filter === tab.id
                                        ? 'bg-cyan-500 text-white shadow-md'
                                        : 'bg-background border border-border text-text-secondary hover:bg-border/50'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex bg-background border border-border rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-card shadow-sm text-cyan-600' : 'text-text-secondary hover:text-text'}`}
                                title="Grid View"
                            >
                                <LayoutGrid size={20} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-card shadow-sm text-cyan-600' : 'text-text-secondary hover:text-text'}`}
                                title="List View"
                            >
                                <List size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="max-w-7xl mx-auto">
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {paginatedProducts.map((product) => (
                                <div
                                    key={product.id}
                                    className={`stagger-item hover-lift bg-card border rounded-xl overflow-hidden hover:shadow-md transition-all group flex flex-col h-full cursor-pointer ${selectedProductIds.has(product.id!) ? 'border-cyan-500 ring-1 ring-cyan-500 bg-cyan-50/30' : 'border-border'
                                        }`}
                                    onClick={() => handleAction('detail', product)}
                                >
                                    {/* Image Section */}
                                    <div
                                        className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden"
                                        onClick={(e) => {
                                            if (isSelectionMode) {
                                                e.stopPropagation();
                                                handleSelectProduct(product.id!);
                                            }
                                        }}
                                    >
                                        {product.imageUrl ? (
                                            <div className="relative w-full h-full">
                                                <img
                                                    src={product.imageUrl}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary">
                                                <Package size={32} strokeWidth={1.5} />
                                                <span className="text-xs mt-2 font-medium">ไม่มีรูปภาพ</span>
                                            </div>
                                        )}

                                        {/* Status Badge */}
                                        <div className="absolute top-2 right-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold shadow-sm ${product.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                                                product.status === 'borrowed' || product.status === 'ไม่ว่าง' ? 'bg-amber-100 text-amber-700' :
                                                    product.status === 'maintenance' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {product.status === 'available' ? 'พร้อมใช้' :
                                                    product.status === 'borrowed' || product.status === 'ไม่ว่าง' ? 'ถูกยืม' :
                                                        product.status === 'maintenance' ? 'ส่งซ่อม' : 'เบิกแล้ว'}
                                            </span>
                                        </div>

                                        {/* Selection Checkbox */}
                                        {(isSelectionMode || selectedProductIds.has(product.id!)) && (
                                            <div className="absolute top-2 left-2">
                                                <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${selectedProductIds.has(product.id!)
                                                    ? 'bg-cyan-500 border-cyan-500'
                                                    : 'bg-white/90 border-gray-300'
                                                    }`}>
                                                    {selectedProductIds.has(product.id!) && (
                                                        <Check size={16} className="text-white" />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Section */}
                                    <div className="p-4 flex flex-col flex-1 gap-3">
                                        <div>
                                            <h3 className="font-bold text-text text-lg truncate" title={product.name}>
                                                {product.name}
                                            </h3>
                                            <p className="text-sm text-text-secondary truncate">{product.brand} {product.model}</p>
                                            <p className="text-xs text-text-secondary truncate mt-1">📍 {product.location}</p>

                                            {/* Stock Level for Bulk */}
                                            {product.type === 'bulk' && (
                                                <div className="mt-2 text-xs font-medium text-text-secondary bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1 inline-block">
                                                    คงเหลือ: <span className="text-text dark:text-gray-200 font-bold">{product.quantity ? product.quantity - (product.borrowedCount || 0) : 0}</span> / {product.quantity || 0}
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="mt-auto grid grid-cols-2 gap-2">
                                            {(product.status === 'available' || (product.type === 'bulk' && (product.quantity || 0) > (product.borrowedCount || 0))) && (
                                                <>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAction('borrow', product);
                                                        }}
                                                        className="tap-scale px-3 py-1.5 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Download size={16} /> ยืม
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAction('requisition', product);
                                                        }}
                                                        className="tap-scale px-3 py-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Upload size={16} /> เบิก
                                                    </button>
                                                </>
                                            )}

                                            {(product.status === 'borrowed' || product.status === 'ไม่ว่าง' || (product.type === 'bulk' && (product.borrowedCount || 0) > 0)) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAction('return', product);
                                                    }}
                                                    className="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <RotateCcw size={16} /> คืน
                                                </button>
                                            )}

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAction('edit', product);
                                                }}
                                                className="px-3 py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                                            >
                                                <Edit size={16} /> แก้ไข
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-text-secondary font-medium border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 w-16">รูปภาพ</th>
                                            <th className="px-4 py-3">ชื่อรายการ</th>
                                            <th className="px-4 py-3">S/N</th>
                                            <th className="px-4 py-3">สถานที่</th>
                                            <th className="px-4 py-3">สถานะ</th>
                                            <th className="px-4 py-3 text-center">จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {paginatedProducts.map((product) => (
                                            <tr
                                                key={product.id}
                                                className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                                onClick={() => handleAction('detail', product)}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden">
                                                        {product.imageUrl ? (
                                                            <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-text-secondary">
                                                                <Package size={20} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-text">
                                                    <div>{product.name}</div>
                                                    <div className="text-xs text-text-secondary">{product.brand} {product.model}</div>
                                                </td>
                                                <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                                                    {product.serialNumber || "-"}
                                                </td>
                                                <td className="px-4 py-3 text-text-secondary">
                                                    {product.location}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${product.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                                                        product.status === 'borrowed' ? 'bg-amber-100 text-amber-700' :
                                                            product.status === 'maintenance' ? 'bg-red-100 text-red-700' :
                                                                'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {product.status === 'available' ? 'พร้อมใช้' :
                                                            product.status === 'borrowed' ? 'ถูกยืม' :
                                                                product.status === 'maintenance' ? 'ส่งซ่อม' : 'เบิกแล้ว'}
                                                    </span>
                                                    {product.type === 'bulk' && (
                                                        <div className="text-xs text-text-secondary mt-1">
                                                            {product.quantity ? product.quantity - (product.borrowedCount || 0) : 0} / {product.quantity}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center gap-2">
                                                        {(product.status === 'available' || (product.type === 'bulk' && (product.quantity || 0) > (product.borrowedCount || 0))) && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleAction('borrow', product);
                                                                    }}
                                                                    className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                                                                    title="ยืม"
                                                                >
                                                                    <Download size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleAction('requisition', product);
                                                                    }}
                                                                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                                    title="เบิก"
                                                                >
                                                                    <Upload size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {(product.status === 'borrowed' || product.status === 'ไม่ว่าง' || (product.type === 'bulk' && (product.borrowedCount || 0) > 0)) && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAction('return', product);
                                                                }}
                                                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                title="คืน"
                                                            >
                                                                <RotateCcw size={16} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAction('edit', product);
                                                            }}
                                                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                                            title="แก้ไข"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {filteredProducts.length === 0 && (
                        searchQuery ? (
                            <EmptySearchResults query={searchQuery} />
                        ) : (
                            <EmptyInventory onAdd={() => router.push('/admin/add-product')} />
                        )
                    )}
                </div>

                {/* Pagination */}
                {filteredProducts.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={goToPage}
                            totalItems={totalItems}
                            startIndex={startIndex}
                            endIndex={endIndex}
                        />
                    </div>
                )}

                {/* Modals - Lazy Loaded */}
                {
                    activeModal === 'borrow' && selectedProduct && (
                        <LazyBorrowModal
                            isOpen={true}
                            onClose={handleCloseModal}
                            product={selectedProduct}
                            onSuccess={handleCloseModal}
                        />
                    )
                }

                {
                    activeModal === 'requisition' && selectedProduct && (
                        <LazyRequisitionModal
                            isOpen={true}
                            onClose={handleCloseModal}
                            product={selectedProduct}
                            onSuccess={handleCloseModal}
                        />
                    )
                }

                {
                    activeModal === 'edit' && selectedProduct && (
                        <LazyEditProductModal
                            isOpen={true}
                            onClose={handleCloseModal}
                            product={selectedProduct}
                            onSuccess={handleCloseModal}
                        />
                    )
                }

                {
                    activeModal === 'return' && selectedProduct && (
                        <LazyReturnModal
                            isOpen={true}
                            onClose={handleCloseModal}
                            product={selectedProduct}
                            onSuccess={handleCloseModal}
                        />
                    )
                }

                {/* Product Detail Modal */}
                {
                    activeModal === 'detail' && selectedProduct && (
                        <ProductDetailModal
                            isOpen={true}
                            onClose={handleCloseModal}
                            product={selectedProduct}
                            onAction={(action, product) => handleAction(action, product)}
                        />
                    )
                }



                {/* Log Modal - Lazy Loaded */}
                {
                    isLogModalOpen && (
                        <LazyLogTable
                            logs={activityLogs}
                            title={logType === 'stock' ? 'รายงานวัสดุคงคลัง' : 'ประวัติการใช้งาน'}
                            onClose={() => setIsLogModalOpen(false)}
                            onGenerateReport={handleFetchLogs}
                            isLoading={isLogLoading}
                        />
                    )
                }
            </div >
        </div >
    );
}

export default function InventoryDashboard() {
    return (
        <Suspense fallback={<div className="flex justify-center p-8">Loading...</div>}>
            <InventoryContent />
        </Suspense>
    );
}
