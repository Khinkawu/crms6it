"use client";

import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Product } from "../../../types";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import BorrowModal from "../../components/BorrowModal";
import RequisitionModal from "../../components/RequisitionModal";
import EditProductModal from "../../components/EditProductModal";

export default function InventoryPage() {
    const { user, role, loading: authLoading } = useAuth();
    const router = useRouter();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
    const [isRequisitionModalOpen, setIsRequisitionModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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

    const handleEditClick = (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        setSelectedProduct(product);
        setIsEditModalOpen(true);
    };

    const handleReturnClick = async (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        if (!product.id) return;

        if (!confirm("Are you sure you want to return this item?")) return;

        setProcessingAction(true);
        try {
            // Find active transaction
            const transactionsRef = collection(db, "transactions");
            const q = query(
                transactionsRef,
                where("productId", "==", product.id),
                where("status", "==", "active")
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const transactionDoc = querySnapshot.docs[0];
                await updateDoc(doc(db, "transactions", transactionDoc.id), {
                    status: "completed",
                    actualReturnDate: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }

            await updateDoc(doc(db, "products", product.id), {
                status: "available"
            });

            // Log activity
            const { logActivity } = await import("../../../utils/logger");
            await logActivity({
                action: 'return',
                productName: product.name,
                userName: user?.displayName || user?.email || "Admin",
                imageUrl: product.imageUrl
            });

            alert("Item returned successfully!");
            fetchProducts();

        } catch (error) {
            console.error("Error processing return:", error);
            alert("Failed to return item.");
        } finally {
            setProcessingAction(false);
        }
    };

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

    const handleBulkPrint = () => {
        const selectedProducts = products.filter(p => selectedItems.has(p.id!));
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Bulk Print QR Codes</title>
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
                            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">🖨️ Print Now</button>
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

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-text">Inventory</h1>
                    <p className="text-text-secondary">Manage your assets and track status.</p>
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
                                        Print ({selectedItems.size})
                                    </button>
                                    <button
                                        onClick={toggleSelectionMode}
                                        className="px-4 py-2 rounded-xl bg-card border border-border text-text hover:bg-border/50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={toggleSelectionMode}
                                    className="px-4 py-2 rounded-xl bg-card border border-border text-text hover:bg-border/50 flex items-center gap-2"
                                >
                                    <span>🖨️</span> Bulk Print
                                </button>
                            )}
                        </>
                    )}
                    <input
                        type="text"
                        placeholder="Search items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field md:w-64"
                    />
                </div>
            </div>

            {/* Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => {
                    const isBulk = product.type === 'bulk';
                    const available = isBulk ? (product.quantity || 0) - (product.borrowedCount || 0) : (product.status === 'available' ? 1 : 0);
                    const total = isBulk ? product.quantity || 0 : 1;
                    const percentage = isBulk ? (available / total) * 100 : (available > 0 ? 100 : 0);
                    const isAvailable = available > 0;

                    return (
                        <div
                            key={product.id}
                            onClick={() => handleCardClick(product)}
                            className="card overflow-hidden cursor-pointer group relative hover:ring-2 hover:ring-primary-start/50 transition-all flex flex-col h-full"
                        >
                            {/* Image Aspect Video */}
                            <div className="aspect-video w-full bg-input-bg relative overflow-hidden">
                                {isSelectionMode && (
                                    <div className="absolute inset-0 z-20 bg-black/10 backdrop-blur-[1px] flex items-start justify-start p-3" onClick={(e) => toggleItemSelection(e, product.id!)}>
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedItems.has(product.id!) ? 'bg-primary-start border-primary-start' : 'bg-white border-gray-300'}`}>
                                            {selectedItems.has(product.id!) && <span className="text-white text-sm">✓</span>}
                                        </div>
                                    </div>
                                )}

                                {product.imageUrl ? (
                                    <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-text-secondary/30">
                                        <span className="text-4xl">📦</span>
                                    </div>
                                )}

                                {/* Edit Button (Admin Only) */}
                                {isAdmin && !isSelectionMode && (
                                    <div className="absolute top-2 right-2 z-10">
                                        <button
                                            onClick={(e) => handleEditClick(e, product)}
                                            className="bg-white/90 hover:bg-white text-text p-2 rounded-lg shadow-sm backdrop-blur-sm transition-all hover:scale-110"
                                            title="Edit Product"
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                )}

                                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                        View Details
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4 flex-1 flex flex-col">
                                <div className="mb-3">
                                    <h3 className="font-bold text-text truncate">{product.name}</h3>
                                    <p className="text-sm text-text-secondary truncate">{product.brand} • {product.location}</p>
                                </div>

                                {/* Stock / Status Section */}
                                <div className="mt-auto mb-4">
                                    {isBulk ? (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-medium">
                                                <span className="text-text-secondary">Available</span>
                                                <span className={`${available > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {available} / {total}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-input-bg rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${percentage > 50 ? 'bg-emerald-500' : percentage > 20 ? 'bg-orange-500' : 'bg-red-500'
                                                        }`}
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${product.status === 'available'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                            : product.status === 'borrowed'
                                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                                                : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                            }`}>
                                            {product.status.toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                {/* Action Buttons Footer */}
                                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
                                    {isAvailable ? (
                                        <>
                                            <button
                                                onClick={(e) => handleBorrowClick(e, product)}
                                                className="px-3 py-2 rounded-lg border border-cyan-500 text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 text-xs font-bold transition-colors"
                                            >
                                                Borrow
                                            </button>
                                            <button
                                                onClick={(e) => handleRequisitionClick(e, product)}
                                                className="px-3 py-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 text-xs font-bold transition-colors"
                                            >
                                                Withdraw
                                            </button>
                                        </>
                                    ) : product.status === 'borrowed' && !isBulk ? (
                                        <button
                                            onClick={(e) => handleReturnClick(e, product)}
                                            disabled={processingAction}
                                            className="col-span-2 px-3 py-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 text-xs font-bold transition-colors"
                                        >
                                            {processingAction ? "Processing..." : "Return Item"}
                                        </button>
                                    ) : (
                                        <button disabled className="col-span-2 px-3 py-2 rounded-lg bg-input-bg text-text-secondary text-xs font-bold cursor-not-allowed">
                                            Unavailable
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredProducts.length === 0 && (
                <div className="p-12 text-center text-text-secondary">
                    No items found matching your search.
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
                                        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Location</p>
                                        <p className="font-medium text-text">{selectedProduct.location}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Category</p>
                                        <p className="font-medium text-text">{selectedProduct.category || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Serial No.</p>
                                        <p className="font-medium text-text">{selectedProduct.serialNumber || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Purchase Date</p>
                                        <p className="font-medium text-text">
                                            {selectedProduct.purchaseDate ? selectedProduct.purchaseDate.toDate().toLocaleDateString() : "-"}
                                        </p>
                                    </div>
                                </div>

                                {selectedProduct.description && (
                                    <div>
                                        <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Description</p>
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
                </>
            )}
        </div>
    );
}
