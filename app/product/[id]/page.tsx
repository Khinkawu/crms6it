"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Product } from "../../../types";
import { useAuth } from "../../../context/AuthContext";
import BorrowModal from "../../components/BorrowModal";
import RequisitionModal from "../../components/RequisitionModal";
import QRCode from "react-qr-code";
import { MapPin, Tag, Calendar, ShieldCheck, Box, Layers, ArrowLeft, Printer, Share2 } from "lucide-react";

const ProductDetailPage = () => {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
    const [isRequisitionModalOpen, setIsRequisitionModalOpen] = useState(false);

    const fetchProduct = React.useCallback(async () => {
        if (!id) return;
        try {
            const docRef = doc(db, "products", id as string);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
            } else {
                setError("Product not found");
            }
        } catch (err) {
            console.error("Error fetching product:", err);
            setError("Failed to load product details");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchProduct();
    }, [fetchProduct]);

    const handleLogin = () => {
        router.push(`/login`);
    };

    const handleBorrowSuccess = () => fetchProduct();
    const handleRequisitionSuccess = () => fetchProduct();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <div className="text-center max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Box className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">ไม่พบสินค้า</h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">{error || "Product not found"}</p>
                    <button
                        onClick={() => router.push("/")}
                        className="w-full py-3 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
                    >
                        กลับหน้าหลัก
                    </button>
                </div>
            </div>
        );
    }

    // Logic
    const isBulk = product.type === 'bulk';
    const totalQuantity = product.quantity || 0;
    const borrowedCount = product.borrowedCount || 0;
    const availableQuantity = isBulk ? totalQuantity - borrowedCount : (product.status === 'available' ? 1 : 0);
    const isAvailable = availableQuantity > 0;
    const stockPercentage = isBulk && totalQuantity > 0 ? (availableQuantity / totalQuantity) * 100 : 0;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-32">
            <BorrowModal
                isOpen={isBorrowModalOpen}
                onClose={() => setIsBorrowModalOpen(false)}
                product={product}
                onSuccess={handleBorrowSuccess}
            />

            <RequisitionModal
                isOpen={isRequisitionModalOpen}
                onClose={() => setIsRequisitionModalOpen(false)}
                product={product}
                onSuccess={handleRequisitionSuccess}
            />

            {/* Mobile Header (Fixed) */}
            <div className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-40 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{product.name}</h1>
                <button
                    onClick={() => {
                        const printWindow = window.open('', '', 'width=600,height=600');
                        if (printWindow) {
                            printWindow.document.write(`
                                <html><head><title>Print QR</title></head>
                                <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;">
                                    <div style="border:2px solid black;padding:20px;text-align:center;border-radius:10px;">
                                        ${document.getElementById('qr-code-svg')?.outerHTML || ''}
                                        <div style="font-weight:bold;margin-top:10px;font-size:18px;">${product.name}</div>
                                        <div style="font-family:monospace;color:#555;">${product.stockId || product.id}</div>
                                    </div>
                                    <script>window.onload=()=>{window.print();window.close();}</script>
                                </body></html>`
                            );
                            printWindow.document.close();
                        }
                    }}
                    className="p-2 -mr-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                    <Printer size={20} />
                </button>
            </div>

            <div className="pt-20 px-4 md:px-8 max-w-3xl mx-auto space-y-6">

                {/* Hero Image Section */}
                <div className="relative group">
                    <div className="aspect-[4/3] w-full bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 relative">
                        {product.imageUrl ? (
                            <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                <Box size={48} className="mb-2 opacity-50" />
                                <span className="text-sm">ไม่มีรูปภาพ</span>
                            </div>
                        )}

                        {/* Status Badge */}
                        <div className="absolute top-4 right-4 z-10">
                            {isBulk ? (
                                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                                    <Layers size={14} className="text-blue-500" />
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                                        Bulk Item
                                    </span>
                                </div>
                            ) : (
                                <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-md border border-white/10
                                    ${isAvailable
                                        ? "bg-emerald-500 text-white shadow-emerald-500/20"
                                        : "bg-red-500 text-white shadow-red-500/20"
                                    }`}
                                >
                                    {isAvailable ? 'พร้อมใช้งาน' : 'ไม่ว่าง'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Info */}
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                            <Tag size={14} />
                            <span className="text-xs font-semibold tracking-wider uppercase">{product.brand}</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                            {product.name}
                        </h1>
                    </div>

                    {/* Stock Logic for Bulk */}
                    {isBulk && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">คงเหลือในคลัง</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{availableQuantity}</span>
                                        <span className="text-sm text-gray-500 font-medium">/ {totalQuantity} ชิ้น</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">ถูกยืมไป</p>
                                    <p className="text-lg font-semibold text-orange-500">{borrowedCount}</p>
                                </div>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${stockPercentage > 50 ? 'bg-emerald-500' :
                                        stockPercentage > 20 ? 'bg-amber-500' : 'bg-red-500'
                                        }`}
                                    style={{ width: `${stockPercentage}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Location</p>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{product.location}</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Warranty</p>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{product.warrantyInfo}</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Purchased</p>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                    {product.purchaseDate?.toDate().toLocaleDateString("th-TH", { year: '2-digit', month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                <Box size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Stock ID</p>
                                <p className="text-xs font-mono font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[80px]">
                                    {product.stockId || product.id}
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* Description Section */}
                    {product.description && (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                                รายละเอียดเพิ่มเติม
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                {product.description}
                            </p>
                        </div>
                    )}
                    {/* QR Code Section (Hidden but renderable) */}
                    <div className="hidden">
                        <QRCode
                            id="qr-code-svg"
                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/product/${product.id}`}
                            size={128}
                            viewBox={`0 0 256 256`}
                        />
                    </div>
                </div>
            </div>

            {/* Floating Action Bar */}
            <div className="fixed bottom-6 left-4 right-4 z-50 max-w-3xl mx-auto">
                <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-800 p-2 rounded-3xl shadow-2xl flex gap-2">
                    {!user ? (
                        <button
                            onClick={handleLogin}
                            className="flex-1 py-3.5 rounded-2xl bg-gray-900 text-white font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            เข้าสู่ระบบเพื่อใช้งาน
                        </button>
                    ) : isAvailable ? (
                        <>
                            <button
                                onClick={() => setIsBorrowModalOpen(true)}
                                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <Box size={18} />
                                ยืม (Borrow)
                            </button>
                            <button
                                onClick={() => setIsRequisitionModalOpen(true)}
                                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <Share2 size={18} />
                                เบิก (Requisition)
                            </button>
                        </>
                    ) : (
                        <button
                            disabled
                            className="flex-1 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-bold text-sm cursor-not-allowed border border-gray-200 dark:border-gray-700"
                        >
                            {isBulk ? "สินค้าหมด (Out of Stock)" : "ไม่ว่าง (Unavailable)"}
                        </button>
                    )}
                </div>
            </div>
        </div >
    );
};

export default ProductDetailPage;
