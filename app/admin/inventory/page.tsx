"use client";

import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, where, increment } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Product } from "../../../types";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import BorrowModal from "../../components/BorrowModal";
import RequisitionModal from "../../components/RequisitionModal";
import EditProductModal from "../../components/EditProductModal";
import AddItemModal from "../../components/AddItemModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toast from "react-hot-toast";

export default function InventoryPage() {
    const { user, role, loading: authLoading } = useAuth();
    const router = useRouter();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState<'all' | 'available' | 'borrowed' | 'requisitioned'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);

    // Modal State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
    const [isRequisitionModalOpen, setIsRequisitionModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [isReturnConfirmOpen, setIsReturnConfirmOpen] = useState(false);
    const [processingAction, setProcessingAction] = useState(false);

    // Bulk Selection State
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchProducts();
        }
    }, [user]);

    // Reset to first page when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filter]);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const productsList: Product[] = [];
            querySnapshot.forEach((doc) => {
                productsList.push({ id: doc.id, ...doc.data() } as Product);
            });
            setProducts(productsList);
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCardClick = (product: Product) => {
        setSelectedProduct(product);
        setIsDetailModalOpen(true);
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedProduct(null);
    };

    const handleBorrowClick = (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        setSelectedProduct(product);
        setIsBorrowModalOpen(true);
    };

    const handleRequisitionClick = (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        setSelectedProduct(product);
        setIsRequisitionModalOpen(true);
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch =
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.location.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (filter === 'all') return true;

        const isBulk = product.type === 'bulk';
        const available = isBulk ? (product.quantity || 0) - (product.borrowedCount || 0) : (product.status === 'available' ? 1 : 0);
        const borrowedCount = product.borrowedCount || 0;

        if (filter === 'available') {
            return available > 0;
        }

        if (filter === 'borrowed') {
            if (isBulk) return borrowedCount > 0;
            return product.status === 'borrowed';
        }

        if (filter === 'requisitioned') {
            // Unavailable / Requisitioned / Out of Stock
            if (isBulk) return available <= 0 && borrowedCount === 0;
            return product.status === 'requisitioned' || product.status === 'unavailable' || product.status === 'ไม่ว่าง';
        }

        return true;
    });

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-start"></div>
            </div>
        );
    }

    const isAdmin = role === 'admin';

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedItems(new Set());
    };

    const toggleItemSelection = (e: React.MouseEvent, productId: string) => {
        e.stopPropagation();
        const newSelected = new Set(selectedItems);
        if (newSelected.has(productId)) {
            newSelected.delete(productId);
        } else {
            newSelected.add(productId);
        }
        setSelectedItems(newSelected);
    };

    const handleEditClick = (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        setSelectedProduct(product);
        setIsEditModalOpen(true);
    };

    const handleReturnClick = (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        setSelectedProduct(product);
        setIsReturnConfirmOpen(true);
    };

    const confirmReturn = async () => {
        if (!selectedProduct) return;
        setProcessingAction(true);
        try {
            const productRef = doc(db, "products", selectedProduct.id!);

            if (selectedProduct.type === 'bulk') {
                await updateDoc(productRef, {
                    borrowedCount: increment(-1),
                    updatedAt: serverTimestamp()
                });
            } else {
                await updateDoc(productRef, {
                    status: "available",
                    borrowedBy: null,
                    borrowedDate: null,
                    returnDate: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }

            // Log Activity
            const { logActivity } = await import("@/utils/logger");
            await logActivity({
                action: 'return',
                productName: selectedProduct.name,
                userName: user?.displayName || "Unknown",
                details: `Returned item: ${selectedProduct.name}`,
                imageUrl: selectedProduct.imageUrl
            });

            toast.success("คืนอุปกรณ์เรียบร้อยแล้ว!");
            fetchProducts();
        } catch (error) {
            console.error("Error returning item:", error);
            toast.error("เกิดข้อผิดพลาดในการคืนอุปกรณ์");
        } finally {
            setProcessingAction(false);
            setIsReturnConfirmOpen(false);
            setSelectedProduct(null);
        }
    };

    const handleBulkPrint = () => {
        const selectedProducts = products.filter(p => selectedItems.has(p.id!));
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>พิมพ์ QR Code</title>
                        <style>
                            body { font-family: sans-serif; padding: 20px; }
                            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px; }
                            .tag { border: 1px solid #000; padding: 10px; border-radius: 8px; text-align: center; page-break-inside: avoid; display: flex; flex-direction: column; align-items: center; }
                            .qr-container { display: flex; justify-content: center; margin-bottom: 5px; }
                            .name { font-weight: bold; font-size: 12px; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
                            .id { font-family: monospace; font-size: 10px; color: #555; }
                            @media print {
                                .no-print { display: none; }
                            }
                        </style>
                        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                    </head>
                    <body>
                        <div class="no-print" style="margin-bottom: 20px;">
                            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">🖨️ พิมพ์</button>
                        </div>
                        <div class="grid">
                            ${selectedProducts.map(p => `
                                <div class="tag">
                                    <div id="qr-${p.id}" class="qr-container"></div>
                                    <div class="name">${p.name}</div>
                                    <div class="id">${p.stockId || p.id}</div>
                                    <script>
                                        new QRCode(document.getElementById("qr-${p.id}"), {
                                            text: "${window.location.origin}/product/${p.id}",
                                            width: 100,
                                            height: 100
                                        });
                                    </script>
                                </div>
                            `).join('')}
                        </div>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    // Stats Calculation
    const stats = {
        total: products.length,
        available: products.filter(p => {
            const isBulk = p.type === 'bulk';
            return isBulk ? ((p.quantity || 0) - (p.borrowedCount || 0) > 0) : p.status === 'available';
        }).length,
        borrowed: products.filter(p => {
            const isBulk = p.type === 'bulk';
            return isBulk ? (p.borrowedCount || 0) > 0 : p.status === 'borrowed';
        }).length,
        unavailable: products.filter(p => {
            const isBulk = p.type === 'bulk';
            return isBulk ? ((p.quantity || 0) - (p.borrowedCount || 0) <= 0 && (p.borrowedCount || 0) === 0) : (p.status === 'requisitioned' || p.status === 'unavailable' || p.status === 'ไม่ว่าง');
        }).length
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header & Stats */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-text">ระบบจัดการวัสดุ อุปกรณ์</h1>
                        <p className="text-text-secondary">จัดการ ยืม-คืน และเบิกวัสดุ อุปกรณ์</p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        {isAdmin && (
                            <>
                                {isSelectionMode ? (
                                    <div className="flex gap-2 animate-fade-in">
                                        <button
                                            onClick={handleBulkPrint}
                                            disabled={selectedItems.size === 0}
                                            className="px-4 py-2 rounded-xl bg-primary-start text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            พิมพ์ ({selectedItems.size})
                                        </button>
                                        <button
                                            onClick={toggleSelectionMode}
                                            className="px-4 py-2 rounded-xl bg-card border border-border text-text hover:bg-border/50"
                                        >
                                            ยกเลิก
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsAddItemModalOpen(true)}
                                            className="px-4 py-2 rounded-xl bg-primary-start text-white font-bold shadow-lg hover:shadow-primary-start/30 hover:scale-105 transition-all flex items-center gap-2"
                                        >
                                            <span>+</span> เพิ่มอุปกรณ์
                                        </button>
                                        <button
                                            onClick={toggleSelectionMode}
                                            className="px-4 py-2 rounded-xl bg-card border border-border text-text hover:bg-border/50 flex items-center gap-2"
                                        >
                                            <span>🖨️</span> พิมพ์ QR Code
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center text-2xl shadow-sm text-gray-500">
                            📦
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary">ทั้งหมด</p>
                            <p className="text-3xl font-bold text-text">{stats.total}</p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-2xl shadow-sm text-emerald-500">
                            ✅
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary">ว่าง / พร้อมใช้</p>
                            <p className="text-3xl font-bold text-text">{stats.available}</p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-2xl shadow-sm text-orange-500">
                            ⏳
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary">ถูกยืม</p>
                            <p className="text-3xl font-bold text-text">{stats.borrowed}</p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-2xl shadow-sm text-red-500">
                            ❌
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary">ไม่ว่าง / หมด</p>
                            <p className="text-3xl font-bold text-text">{stats.unavailable}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-sm">
                {/* Search */}
                <div className="relative w-full lg:w-96">
                    <input
                        type="text"
                        placeholder="ค้นหา (ชื่อ, แบรนด์, สถานที่)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-text focus:outline-none focus:border-cyan-500/50 transition-all"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">🔍</div>
                </div>

                {/* Filters & Toggle */}
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
                    <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
                        {[
                            { id: 'all', label: 'ทั้งหมด' },
                            { id: 'available', label: 'ว่าง' },
                            { id: 'borrowed', label: 'ถูกยืม' },
                            { id: 'requisitioned', label: 'ไม่ว่าง' }
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
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-card shadow-sm text-cyan-600' : 'text-text-secondary hover:text-text'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {currentItems.map((product) => {
                        const isBulk = product.type === 'bulk';
                        const available = isBulk ? (product.quantity || 0) - (product.borrowedCount || 0) : (product.status === 'available' ? 1 : 0);
                        const total = isBulk ? product.quantity || 0 : 1;
                        const percentage = isBulk ? (available / total) * 100 : (available > 0 ? 100 : 0);
                        const isAvailable = available > 0;

                        return (
                            <div
                                key={product.id}
                                onClick={() => handleCardClick(product)}
                                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-all group cursor-pointer relative"
                            >
                                {/* Selection Overlay */}
                                {isSelectionMode && (
                                    <div className="absolute inset-0 z-20 bg-black/10 backdrop-blur-[1px] flex items-start justify-start p-3 rounded-xl" onClick={(e) => toggleItemSelection(e, product.id!)}>
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedItems.has(product.id!) ? 'bg-primary-start border-primary-start' : 'bg-white border-gray-300'}`}>
                                            {selectedItems.has(product.id!) && <span className="text-white text-sm">✓</span>}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    {/* Image Thumbnail */}
                                    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-input-bg border border-border relative">
                                        {product.imageUrl ? (
                                            <img
                                                src={product.imageUrl}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-text-secondary/30">
                                                <span className="text-2xl">📦</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-bold text-text truncate text-base">{product.name}</h3>
                                            <p className="text-xs text-text-secondary truncate">{product.brand} • {product.location}</p>
                                        </div>

                                        {/* Status Badge */}
                                        <div className="mt-1">
                                            {isBulk ? (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-medium">
                                                        <span className="text-text-secondary">คงเหลือ</span>
                                                        <span className={`${available > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            {available} / {total}
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1 bg-input-bg rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${percentage > 50 ? 'bg-emerald-500' : percentage > 20 ? 'bg-orange-500' : 'bg-red-500'
                                                                }`}
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${product.status === 'available'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                                    : product.status === 'borrowed'
                                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                                    }`}>
                                                    {product.status === 'requisitioned' ? 'ไม่ว่าง' : (product.status === 'available' ? 'ว่าง' : (product.status === 'borrowed' ? 'ถูกยืม' : product.status))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Edit Button (Admin Only) */}
                                {isAdmin && !isSelectionMode && (
                                    <button
                                        onClick={(e) => handleEditClick(e, product)}
                                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 text-text shadow-sm hover:bg-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                        title="แก้ไข"
                                    >
                                        ✏️
                                    </button>
                                )}

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-border">
                                    {isAvailable && (
                                        <>
                                            <button
                                                onClick={(e) => handleBorrowClick(e, product)}
                                                className="px-3 py-1.5 rounded-lg border border-cyan-500 text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 text-xs font-bold transition-colors"
                                            >
                                                ยืม
                                            </button>
                                            <button
                                                onClick={(e) => handleRequisitionClick(e, product)}
                                                className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 text-xs font-bold transition-colors"
                                            >
                                                เบิก
                                            </button>
                                        </>
                                    )}

                                    {(product.status === 'borrowed' || product.status === 'ไม่ว่าง' || (isBulk && (product.borrowedCount || 0) > 0)) && (
                                        <button
                                            onClick={(e) => handleReturnClick(e, product)}
                                            disabled={processingAction}
                                            className="col-span-2 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 text-xs font-bold transition-colors"
                                        >
                                            {processingAction ? "กำลังดำเนินการ..." : "คืนอุปกรณ์"}
                                        </button>
                                    )}

                                    {!isAvailable && !(product.status === 'borrowed' || product.status === 'ไม่ว่าง' || (isBulk && (product.borrowedCount || 0) > 0)) && (
                                        <button disabled className="col-span-2 px-3 py-1.5 rounded-lg bg-input-bg text-text-secondary text-xs font-bold cursor-not-allowed">
                                            ไม่ว่าง
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-background border-b border-border text-text-secondary font-medium">
                                <tr>
                                    <th className="px-6 py-4">สถานะ</th>
                                    <th className="px-6 py-4">ชื่อสินค้า</th>
                                    <th className="px-6 py-4">แบรนด์</th>
                                    <th className="px-6 py-4">สถานที่</th>
                                    <th className="px-6 py-4">หมวดหมู่</th>
                                    <th className="px-6 py-4 text-right">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {currentItems.map((product) => {
                                    const isBulk = product.type === 'bulk';
                                    const available = isBulk ? (product.quantity || 0) - (product.borrowedCount || 0) : (product.status === 'available' ? 1 : 0);
                                    const isAvailable = available > 0;

                                    return (
                                        <tr key={product.id} onClick={() => handleCardClick(product)} className="hover:bg-background/50 transition-colors cursor-pointer">
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold border ${isAvailable
                                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                    : product.status === 'borrowed'
                                                        ? 'bg-orange-100 text-orange-700 border-orange-200'
                                                        : 'bg-red-100 text-red-700 border-red-200'
                                                    }`}>
                                                    {isAvailable ? 'ว่าง' : (product.status === 'borrowed' ? 'ถูกยืม' : 'ไม่ว่าง')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-text">{product.name}</td>
                                            <td className="px-6 py-4 text-text-secondary">{product.brand}</td>
                                            <td className="px-6 py-4 text-text-secondary">{product.location}</td>
                                            <td className="px-6 py-4 text-text-secondary">{product.category || "-"}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-cyan-600 hover:text-cyan-700 font-medium hover:underline">
                                                    ดูรายละเอียด
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {filteredProducts.length === 0 && (
                <div className="p-12 text-center text-text-secondary">
                    ไม่พบรายการที่ค้นหา
                </div>
            )}

            {/* Pagination Controls */}
            {filteredProducts.length > itemsPerPage && (
                <div className="flex justify-center items-center gap-2 mt-8">
                    <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-2 rounded-lg border border-border bg-card text-text hover:bg-border/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        &lt;
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                        <button
                            key={number}
                            onClick={() => paginate(number)}
                            className={`w-10 h-10 rounded-lg font-bold transition-all ${currentPage === number
                                ? "bg-primary-start text-white shadow-lg"
                                : "bg-card border border-border text-text hover:bg-border/50"
                                }`}
                        >
                            {number}
                        </button>
                    ))}

                    <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 rounded-lg border border-border bg-card text-text hover:bg-border/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        &gt;
                    </button>
                </div>
            )}

            {/* Product Detail Modal */}
            {isDetailModalOpen && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={handleCloseDetailModal}
                    ></div>
                    <div className="relative bg-card rounded-2xl max-w-2xl w-full shadow-soft-lg overflow-hidden flex flex-col md:flex-row animate-fade-in-up">

                        {/* Left: Image & QR */}
                        <div className="w-full md:w-1/2 bg-input-bg p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border">
                            <div className="aspect-square w-full max-w-[200px] rounded-xl overflow-hidden bg-white shadow-sm mb-6">
                                {selectedProduct.imageUrl ? (
                                    <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                                )}
                            </div>
                            <div className="bg-white p-3 rounded-xl shadow-sm">
                                <QRCode
                                    value={`${window.location.origin}/product/${selectedProduct.id}`}
                                    size={100}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>
                            <p className="text-xs text-text-secondary mt-2 font-mono">{selectedProduct.stockId || selectedProduct.id}</p>
                        </div>

                        {/* Right: Details */}
                        <div className="w-full md:w-1/2 p-6 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-text">{selectedProduct.name}</h2>
                                    <p className="text-text-secondary">{selectedProduct.brand}</p>
                                </div>
                                <button onClick={handleCloseDetailModal} className="text-text-secondary hover:text-text">✕</button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">สถานที่</p>
                                        <p className="font-medium text-text">{selectedProduct.location}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">หมวดหมู่</p>
                                        <p className="font-medium text-text">{selectedProduct.category || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">หมายเลขเครื่อง</p>
                                        <p className="font-medium text-text">{selectedProduct.serialNumber || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">วันที่ซื้อ</p>
                                        <p className="font-medium text-text">
                                            {selectedProduct.purchaseDate ? selectedProduct.purchaseDate.toDate().toLocaleDateString('th-TH') : "-"}
                                        </p>
                                    </div>
                                </div>

                                {selectedProduct.description && (
                                    <div>
                                        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">รายละเอียด</p>
                                        <p className="text-sm text-text bg-input-bg p-3 rounded-lg border border-border">
                                            {selectedProduct.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Modals */}
            {selectedProduct && (
                <>
                    <BorrowModal
                        isOpen={isBorrowModalOpen}
                        onClose={() => setIsBorrowModalOpen(false)}
                        product={selectedProduct}
                        onSuccess={() => {
                            fetchProducts();
                        }}
                    />
                    <RequisitionModal
                        isOpen={isRequisitionModalOpen}
                        onClose={() => setIsRequisitionModalOpen(false)}
                        product={selectedProduct}
                        onSuccess={() => {
                            fetchProducts();
                        }}
                    />
                    <EditProductModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        product={selectedProduct}
                        onSuccess={() => {
                            fetchProducts();
                        }}
                    />
                    <ConfirmationModal
                        isOpen={isReturnConfirmOpen}
                        onClose={() => setIsReturnConfirmOpen(false)}
                        onConfirm={confirmReturn}
                        title="คืนวัสดุ อุปกรณ์"
                        message={`ต้องการคืนวัสดุ อุปกรณ์  "${selectedProduct.name}"?`}
                        confirmText="คืน"
                    />
                </>
            )}

            <AddItemModal
                isOpen={isAddItemModalOpen}
                onClose={() => setIsAddItemModalOpen(false)}
                onSuccess={() => {
                    fetchProducts();
                }}
            />
        </div>
    );
}
