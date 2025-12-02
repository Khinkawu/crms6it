"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDocs, where, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { Product, ProductStatus, ActivityLog } from "../../../types";
import { logActivity } from "../../../utils/logger";
import toast from "react-hot-toast";
import Image from "next/image";
import LogTable from "../../components/LogTable";
import ConfirmationModal from "../../components/ConfirmationModal";
import BorrowModal from "../../components/BorrowModal";
import RequisitionModal from "../../components/RequisitionModal";
import EditProductModal from "../../components/EditProductModal";
import { incrementStats, decrementStats, updateStatsOnStatusChange } from "../../../utils/aggregation";
import {
    Download, Upload, RotateCcw, Edit, Package,
    LayoutGrid, List, Check, Search, History, Printer, Plus
} from "lucide-react";

export default function InventoryDashboard() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [filter, setFilter] = useState<ProductStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Modal State
    const [activeModal, setActiveModal] = useState<'borrow' | 'requisition' | 'edit' | 'return' | null>(null);

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

    const handleAction = (action: 'borrow' | 'requisition' | 'edit' | 'return', product: Product) => {
        setSelectedProduct(product);
        setActiveModal(action);
    };

    const handleReturnConfirm = async () => {
        if (!selectedProduct?.id) return;

        try {
            const productRef = doc(db, "products", selectedProduct.id);
            const isBulk = selectedProduct.type === 'bulk';

            if (isBulk) {
                // Bulk Item Logic
                await updateDoc(productRef, {
                    borrowedCount: increment(-1),
                    updatedAt: serverTimestamp()
                });

                // Update Stats for Bulk
                const currentBorrowed = selectedProduct.borrowedCount || 0;
                const totalQty = selectedProduct.quantity || 0;

                // If borrowed count goes to 0, decrement 'borrowed' stat
                if (currentBorrowed === 1) {
                    await decrementStats('borrowed');
                }

                // If it becomes available (was out of stock)
                const wasAvailable = totalQty - currentBorrowed > 0;
                const willBeAvailable = totalQty - (currentBorrowed - 1) > 0;

                if (!wasAvailable && willBeAvailable) {
                    await incrementStats('available');
                }

            } else {
                // Unique Item Logic
                await updateDoc(productRef, {
                    status: 'available',
                    updatedAt: serverTimestamp()
                });

                // Update Stats
                await updateStatsOnStatusChange('borrowed', 'available');
            }

            // Log activity
            await logActivity({
                action: 'return',
                productName: selectedProduct.name,
                userName: user?.displayName || "Admin",
                details: `Returned item: ${selectedProduct.name}`,
                imageUrl: selectedProduct.imageUrl
            });

            toast.success("คืนวัสดุเรียบร้อยแล้ว");
            setActiveModal(null);
        } catch (error) {
            console.error("Error returning product:", error);
            toast.error("เกิดข้อผิดพลาดในการคืนวัสดุ");
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

        const qrCodeUrl = (id: string) => `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${id}`;

        const htmlContent = `
            <html>
                <head>
                    <title>Print QR Codes</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px; }
                        .card { border: 1px solid #ccc; padding: 10px; text-align: center; border-radius: 8px; page-break-inside: avoid; }
                        img { width: 100px; height: 100px; }
                        .name { font-size: 12px; margin-top: 5px; font-weight: bold; }
                        .id { font-size: 10px; color: #666; }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <h1 class="no-print">QR Codes (${selectedProductIds.size > 0 ? selectedProductIds.size : filteredProducts.length} items)</h1>
                    <button class="no-print" onclick="window.print()" style="padding: 10px 20px; margin-bottom: 20px; cursor: pointer;">Print Now</button>
                    <div class="grid">
                        ${(selectedProductIds.size > 0
                ? products.filter(p => p.id && selectedProductIds.has(p.id))
                : filteredProducts
            ).map(p => `
                            <div class="card">
                                <img src="${qrCodeUrl(p.id!)}" alt="QR Code" />
                                <div class="name">${p.name}</div>
                                <div class="id">${p.id!.slice(0, 8)}...</div>
                            </div>
                        `).join('')}
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // Filter Logic
    const filteredProducts = products.filter(p => {
        const matchesFilter = filter === 'all' || p.status === filter;
        const matchesSearch =
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.serialNumber || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });



    if (loading || !user || role !== 'admin') return null;

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
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleOpenLogModal('activity')}
                                className="px-4 py-2 bg-white dark:bg-card border border-border text-text font-bold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                            >
                                <History size={20} /> ประวัติการใช้งาน
                            </button>
                            <button
                                onClick={toggleSelectionMode}
                                className={`px-4 py-2 border font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all ${isSelectionMode ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-white dark:bg-card border-border text-text hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                            >
                                <Printer size={20} /> {isSelectionMode ? 'ยกเลิกเลือก' : 'พิมพ์ QR Code'}
                            </button>
                            {isSelectionMode && (
                                <button
                                    onClick={handleBulkPrint}
                                    disabled={selectedProductIds.size === 0}
                                    className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-xl shadow-sm hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    พิมพ์ ({selectedProductIds.size})
                                </button>
                            )}
                            <button
                                onClick={() => router.push('/admin/add-product')}
                                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:shadow-cyan-500/20 flex items-center gap-2"
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredProducts.map((product) => (
                                <div
                                    key={product.id}
                                    className={`bg-card border rounded-xl overflow-hidden hover:shadow-md transition-all group flex flex-col h-full ${selectedProductIds.has(product.id!) ? 'border-cyan-500 ring-1 ring-cyan-500 bg-cyan-50/30' : 'border-border'
                                        }`}
                                >
                                    {/* Image Section */}
                                    <div
                                        className="h-48 bg-gray-100 relative cursor-pointer"
                                        onClick={() => isSelectionMode ? handleSelectProduct(product.id) : handleAction('edit', product)}
                                    >
                                        {product.imageUrl ? (
                                            <img
                                                src={product.imageUrl}
                                                alt={product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-text-secondary">
                                                <Package size={48} />
                                            </div>
                                        )}

                                        {/* Status Badge */}
                                        <div className="absolute top-2 right-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold shadow-sm ${product.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                                                product.status === 'borrowed' ? 'bg-amber-100 text-amber-700' :
                                                    product.status === 'maintenance' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {product.status === 'available' ? 'พร้อมใช้' :
                                                    product.status === 'borrowed' ? 'ถูกยืม' :
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
                                                        onClick={() => handleAction('borrow', product)}
                                                        className="px-3 py-1.5 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Download size={16} /> ยืม
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction('requisition', product)}
                                                        className="px-3 py-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Upload size={16} /> เบิก
                                                    </button>
                                                </>
                                            )}

                                            {(product.status === 'borrowed' || (product.type === 'bulk' && (product.borrowedCount || 0) > 0)) && (
                                                <button
                                                    onClick={() => handleAction('return', product)}
                                                    className="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <RotateCcw size={16} /> คืน
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleAction('edit', product)}
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
                                        {filteredProducts.map((product) => (
                                            <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
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
                                                                    onClick={() => handleAction('borrow', product)}
                                                                    className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                                                                    title="ยืม"
                                                                >
                                                                    <Download size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAction('requisition', product)}
                                                                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                                    title="เบิก"
                                                                >
                                                                    <Upload size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {(product.status === 'borrowed' || (product.type === 'bulk' && (product.borrowedCount || 0) > 0)) && (
                                                            <button
                                                                onClick={() => handleAction('return', product)}
                                                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                title="คืน"
                                                            >
                                                                <RotateCcw size={16} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleAction('edit', product)}
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
                </div>

                {/* Modals */}
                {activeModal === 'borrow' && selectedProduct && (
                    <BorrowModal
                        isOpen={true}
                        onClose={() => setActiveModal(null)}
                        product={selectedProduct}
                        onSuccess={() => setActiveModal(null)}
                    />
                )}

                {activeModal === 'requisition' && selectedProduct && (
                    <RequisitionModal
                        isOpen={true}
                        onClose={() => setActiveModal(null)}
                        product={selectedProduct}
                        onSuccess={() => setActiveModal(null)}
                    />
                )}

                {activeModal === 'edit' && selectedProduct && (
                    <EditProductModal
                        isOpen={true}
                        onClose={() => setActiveModal(null)}
                        product={selectedProduct}
                        onSuccess={() => setActiveModal(null)}
                    />
                )}

                <ConfirmationModal
                    isOpen={activeModal === 'return'}
                    onClose={() => setActiveModal(null)}
                    onConfirm={handleReturnConfirm}
                    title="ยืนยันการคืน"
                    message={`คุณต้องการบันทึกการคืน "${selectedProduct?.name}" ใช่หรือไม่?`}
                    confirmText="ยืนยันการคืน"
                    isDangerous={false}
                />

                {/* Log Modal */}
                {isLogModalOpen && (
                    <LogTable
                        logs={activityLogs}
                        title={logType === 'stock' ? 'รายงานวัสดุคงคลัง' : 'ประวัติการใช้งาน'}
                        onClose={() => setIsLogModalOpen(false)}
                        onGenerateReport={handleFetchLogs}
                        isLoading={isLogLoading}
                    />
                )}
            </div>
        </div>
    );
}
