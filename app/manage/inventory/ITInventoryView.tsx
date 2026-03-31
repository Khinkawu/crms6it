"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, orderBy, onSnapshot, getDocs, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Product, ProductStatus } from "../../../types";
import toast from "react-hot-toast";
import {
    Download, Upload, RotateCcw, Edit, Package,
    LayoutGrid, List, Check, Search, History, Printer, Plus
} from "lucide-react";
import dynamic from "next/dynamic";
import { usePagination } from "../../../hooks/usePagination";
import { useQRBulkActions } from "../../../hooks/useQRBulkActions";
import Pagination from "@/components/ui/Pagination";
import { EmptyInventory, EmptySearchResults } from "@/components/ui/EmptyState";

// Lazy-loaded modals
import {
    LazyBorrowModal,
    LazyEditProductModal,
    LazyRequisitionModal,
    LazyReturnModal,
    LazyLogTable,
    LazyBorrowedStatusModal
} from "@/components/LazyComponents";
const ProductDetailModal = dynamic(() => import("@/components/ProductDetailModal"), { ssr: false });

export default function ITInventoryView() {
    const { user, role, isPhotographer, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [products, setProducts] = useState<Product[]>([]);
    const [filter, setFilter] = useState<ProductStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Modal State
    const [activeModal, setActiveModal] = useState<'borrow' | 'requisition' | 'edit' | 'return' | 'detail' | null>(null);
    const [isBorrowedModalOpen, setIsBorrowedModalOpen] = useState(false);

    // Log Modal State
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logType, setLogType] = useState<'stock' | 'activity'>('stock');
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [isLogLoading, setIsLogLoading] = useState(false);

    // Access control: admin, technician, photographer, or atlas can access
    // Note: isPhotographer is already true for atlas users (set in AuthContext Phase 4),
    // but we add || role === 'atlas' here as an explicit belt-and-suspenders guard.
    const hasAccess = role === 'admin' || role === 'technician' || role === 'atlas' || isPhotographer;

    // Fetch IT Inventory
    useEffect(() => {
        if (!user || !hasAccess) return;
        const q = query(collection(db, "products"), orderBy("updatedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const productList: Product[] = [];
            snapshot.forEach((doc) => {
                productList.push({ id: doc.id, ...doc.data() } as Product);
            });
            setProducts(productList);
        });
        return () => unsubscribe();
    }, [user, hasAccess]);

    // Deep Link Effect
    useEffect(() => {
        const id = searchParams.get('productId');
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
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('productId', product.id || '');
            window.history.pushState({}, '', newUrl.toString());
        } else {
            setSelectedProduct(product);
            setActiveModal(action);
        }
    };

    const handleCloseModal = () => {
        setActiveModal(null);
        if (activeModal === 'detail') {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('productId');
            window.history.pushState({}, '', newUrl.toString());
        }
    };

    const handleOpenLogModal = (type: 'stock' | 'activity') => {
        setLogType(type);
        setActivityLogs([]);
        setIsLogModalOpen(true);
    };

    const handleFetchLogs = async (startDate: string, endDate: string, action: string = 'all') => {
        setIsLogLoading(true);
        try {
            const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
            const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
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

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedProductIds(new Set());
    };

    const filteredProducts = products.filter(p => {
        let matchesFilter = false;
        if (filter === 'all') {
            matchesFilter = true;
        } else if (filter === 'available') {
            const isBulkAvailable = p.type === 'bulk' && (p.quantity || 0) > (p.borrowedCount || 0);
            matchesFilter = p.status === 'available' || isBulkAvailable;
        } else if (filter === 'borrowed') {
            const isBulkBorrowed = p.type === 'bulk' && (p.borrowedCount || 0) > 0;
            matchesFilter = p.status === 'borrowed' || p.status === 'ไม่ว่าง' || isBulkBorrowed;
        } else if (filter === 'maintenance') {
            matchesFilter = p.status === 'maintenance';
        } else if (filter === 'requisitioned') {
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

    const { handleBulkPrint, handleBulkDownload, isDownloading } = useQRBulkActions({
        products, filteredProducts, selectedProductIds
    });

    const {
        paginatedData: paginatedProducts,
        currentPage,
        totalPages,
        goToPage,
        startIndex,
        endIndex,
        totalItems
    } = usePagination({ data: filteredProducts, itemsPerPage: 12 });

    if (loading) return null;

    if (!hasAccess) {
        return <div className="text-center py-20 text-text-secondary">คุณไม่มีสิทธิ์เข้าถึงส่วนนี้</div>;
    }

    return (
        <div className="space-y-8">
            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full md:w-auto md:ml-auto">
                    <button onClick={() => handleOpenLogModal('activity')} className="px-4 py-2 bg-white dark:bg-card border border-border text-text font-bold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2"><History size={20} /> ประวัติ</button>
                    {(role === 'admin' || isPhotographer) && <button onClick={() => setIsBorrowedModalOpen(true)} className="px-4 py-2 bg-white dark:bg-card border border-border text-text font-bold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2"><Package size={20} className="text-amber-500" /> ค้างคืน</button>}
                    <button onClick={toggleSelectionMode} className={`px-4 py-2 border font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${isSelectionMode ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white' : 'bg-white dark:bg-card border-border text-text hover:bg-gray-50 dark:hover:bg-gray-800'}`}><Printer size={20} /> {isSelectionMode ? 'ยกเลิก' : 'พิมพ์ QR'}</button>
                    {isSelectionMode && (
                        <>
                            <button onClick={handleBulkPrint} disabled={selectedProductIds.size === 0} className="px-4 py-2 bg-gray-700 text-white font-bold rounded-xl hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Printer size={20} /> พิมพ์ ({selectedProductIds.size})</button>
                            <button onClick={handleBulkDownload} disabled={selectedProductIds.size === 0 || isDownloading} className="px-4 py-2 bg-gray-600 text-white font-bold rounded-xl hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">{isDownloading ? <span className="animate-spin">⏳</span> : <Download size={20} />}โหลด ({selectedProductIds.size})</button>
                        </>
                    )}
                    <button onClick={() => router.push('/manage/add-product')} className="col-span-2 sm:col-span-1 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"><Plus size={20} /> เพิ่มรายการใหม่</button>
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-sm">
                <div className="relative w-full lg:w-96">
                    <input type="text" placeholder="ค้นหา (ชื่อ, แบรนด์, S/N)..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-text focus:outline-none focus:border-cyan-500/50 transition-all" />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><Search size={20} /></div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
                    <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
                        {[{ id: 'all', label: 'ทั้งหมด' }, { id: 'available', label: 'พร้อมใช้' }, { id: 'borrowed', label: 'ถูกยืม' }, { id: 'maintenance', label: 'ส่งซ่อม' }, { id: 'requisitioned', label: 'เบิกแล้ว' }].map((tab) => (
                            <button key={tab.id} onClick={() => setFilter(tab.id as any)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filter === tab.id ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-background border border-border text-text-secondary hover:bg-border/50'}`}>{tab.label}</button>
                        ))}
                    </div>
                    <div className="flex bg-background border border-border rounded-lg p-1">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-card shadow-sm text-gray-900 dark:text-white' : 'text-text-secondary hover:text-text'}`}><LayoutGrid size={20} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-card shadow-sm text-gray-900 dark:text-white' : 'text-text-secondary hover:text-text'}`}><List size={20} /></button>
                    </div>
                </div>
            </div>

            {/* Grid/List Area */}
            <div className="max-w-7xl mx-auto">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {paginatedProducts.map((product) => (
                            <div key={product.id} className={`stagger-item hover-lift bg-card border rounded-xl overflow-hidden hover:shadow-md transition-all group flex flex-col h-full cursor-pointer ${selectedProductIds.has(product.id!) ? 'border-cyan-500 ring-1 ring-cyan-500 bg-cyan-50/30' : 'border-border'}`} onClick={() => handleAction('detail', product)}>
                                <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden" onClick={(e) => { if (isSelectionMode) { e.stopPropagation(); handleSelectProduct(product.id!); } }}>
                                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary"><Package size={32} strokeWidth={1.5} /><span className="text-xs mt-2 font-medium">ไม่มีรูปภาพ</span></div>}
                                    <div className="absolute top-2 right-2"><span className={`px-2 py-1 rounded-full text-xs font-bold shadow-sm ${product.status === 'available' ? 'bg-emerald-100 text-emerald-700' : product.status === 'borrowed' || product.status === 'ไม่ว่าง' ? 'bg-amber-100 text-amber-700' : product.status === 'maintenance' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{product.status === 'available' ? 'พร้อมใช้' : product.status === 'borrowed' || product.status === 'ไม่ว่าง' ? 'ถูกยืม' : product.status === 'maintenance' ? 'ส่งซ่อม' : 'เบิกแล้ว'}</span></div>
                                    {(isSelectionMode || selectedProductIds.has(product.id!)) && <div className="absolute top-2 left-2"><div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${selectedProductIds.has(product.id!) ? 'bg-cyan-500 border-cyan-500' : 'bg-white/90 border-gray-300'}`}>{selectedProductIds.has(product.id!) && <Check size={16} className="text-white" />}</div></div>}
                                </div>
                                <div className="p-4 flex flex-col flex-1 gap-3">
                                    <div>
                                        <h3 className="font-bold text-text text-lg truncate" title={product.name}>{product.name}</h3>
                                        <p className="text-sm text-text-secondary truncate">{product.brand} {product.model}</p>
                                        <p className="text-xs text-text-secondary truncate mt-1">📍 {product.location}</p>
                                        {product.type === 'bulk' && <div className="mt-2 text-xs font-medium text-text-secondary bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1 inline-block">คงเหลือ: <span className="text-text dark:text-gray-200 font-bold">{product.quantity ? product.quantity - (product.borrowedCount || 0) : 0}</span> / {product.quantity || 0}</div>}
                                    </div>
                                    <div className="mt-auto grid grid-cols-2 gap-2">
                                        {(product.status === 'available' || (product.type === 'bulk' && (product.quantity || 0) > (product.borrowedCount || 0))) && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); handleAction('borrow', product); }} className="tap-scale px-3 py-1.5 bg-white dark:bg-card text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"><Download size={16} /> ยืม</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleAction('requisition', product); }} className="tap-scale px-3 py-1.5 bg-white dark:bg-card text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"><Upload size={16} /> เบิก</button>
                                            </>
                                        )}
                                        {(product.status === 'borrowed' || product.status === 'ไม่ว่าง' || (product.type === 'bulk' && (product.borrowedCount || 0) > 0)) && <button onClick={(e) => { e.stopPropagation(); handleAction('return', product); }} className="px-3 py-1.5 bg-white dark:bg-card text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"><RotateCcw size={16} /> คืน</button>}
                                        <button onClick={(e) => { e.stopPropagation(); handleAction('edit', product); }} className="px-3 py-1.5 bg-white dark:bg-card text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"><Edit size={16} /> แก้ไข</button>
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
                                    <tr><th className="px-4 py-3 w-16">รูปภาพ</th><th className="px-4 py-3">ชื่อรายการ</th><th className="px-4 py-3">S/N</th><th className="px-4 py-3">สถานที่</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3 text-center">จัดการ</th></tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paginatedProducts.map((product) => (
                                        <tr key={product.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => handleAction('detail', product)}>
                                            <td className="px-4 py-3"><div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden">{product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package size={20} />}</div></td>
                                            <td className="px-4 py-3 font-medium text-text"><div>{product.name}</div><div className="text-xs text-text-secondary">{product.brand} {product.model}</div></td>
                                            <td className="px-4 py-3 text-text-secondary font-mono text-xs">{product.serialNumber || "-"}</td>
                                            <td className="px-4 py-3 text-text-secondary">{product.location}</td>
                                            <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${product.status === 'available' ? 'bg-emerald-100 text-emerald-700' : product.status === 'borrowed' ? 'bg-amber-100 text-amber-700' : product.status === 'maintenance' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{product.status === 'available' ? 'พร้อมใช้' : product.status === 'borrowed' ? 'ถูกยืม' : product.status === 'maintenance' ? 'ส่งซ่อม' : 'เบิกแล้ว'}</span></td>
                                            <td className="px-4 py-3"><div className="flex justify-center gap-2">{(product.status === 'available' || (product.type === 'bulk' && (product.quantity || 0) > (product.borrowedCount || 0))) && (<><button onClick={(e) => { e.stopPropagation(); handleAction('borrow', product); }} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><Download size={16} /></button><button onClick={(e) => { e.stopPropagation(); handleAction('requisition', product); }} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><Upload size={16} /></button></>)}{(product.status === 'borrowed' || product.status === 'ไม่ว่าง' || (product.type === 'bulk' && (product.borrowedCount || 0) > 0)) && <button onClick={(e) => { e.stopPropagation(); handleAction('return', product); }} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><RotateCcw size={16} /></button>}<button onClick={(e) => { e.stopPropagation(); handleAction('edit', product); }} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><Edit size={16} /></button></div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {filteredProducts.length === 0 && (searchQuery ? <EmptySearchResults query={searchQuery} /> : <EmptyInventory onAdd={() => router.push('/manage/add-product')} />)}
            </div>

            {/* Pagination/Modals */}
            {filteredProducts.length > 0 && <div className="bg-card border border-border rounded-2xl overflow-hidden"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} startIndex={startIndex} endIndex={endIndex} /></div>}
            {activeModal === 'borrow' && selectedProduct && <LazyBorrowModal isOpen={true} onClose={handleCloseModal} product={selectedProduct} onSuccess={handleCloseModal} />}
            {activeModal === 'requisition' && selectedProduct && <LazyRequisitionModal isOpen={true} onClose={handleCloseModal} product={selectedProduct} onSuccess={handleCloseModal} />}
            {activeModal === 'edit' && selectedProduct && <LazyEditProductModal isOpen={true} onClose={handleCloseModal} product={selectedProduct} onSuccess={handleCloseModal} />}
            {activeModal === 'return' && selectedProduct && <LazyReturnModal isOpen={true} onClose={handleCloseModal} product={selectedProduct} onSuccess={handleCloseModal} />}
            {activeModal === 'detail' && selectedProduct && <ProductDetailModal isOpen={true} onClose={handleCloseModal} product={selectedProduct} onAction={(action, product) => handleAction(action, product)} />}
            {isBorrowedModalOpen && <LazyBorrowedStatusModal isOpen={true} onClose={() => setIsBorrowedModalOpen(false)} />}
            {isLogModalOpen && <LazyLogTable logs={activityLogs} title={logType === 'stock' ? 'รายงานวัสดุคงคลัง' : 'ประวัติการใช้งาน'} onClose={() => setIsLogModalOpen(false)} onGenerateReport={handleFetchLogs} isLoading={isLogLoading} />}
        </div>
    );
}
