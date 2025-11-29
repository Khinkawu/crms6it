"use client";

import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Product } from "../../../types";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";

export default function InventoryPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Selection & Print State
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    // Return Modal State
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [processingReturn, setProcessingReturn] = useState(false);

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

    const handleReturnClick = (product: Product) => {
        setSelectedProduct(product);
        setIsReturnModalOpen(true);
    };

    const confirmReturn = async () => {
        if (!selectedProduct || !selectedProduct.id) return;

        setProcessingReturn(true);
        try {
            const transactionsRef = collection(db, "transactions");
            const q = query(
                transactionsRef,
                where("productId", "==", selectedProduct.id),
                where("status", "==", "active")
            );
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("No active borrow transaction found for this item.");
                setIsReturnModalOpen(false);
                return;
            }

            const transactionDoc = querySnapshot.docs[0];

            await updateDoc(doc(db, "transactions", transactionDoc.id), {
                status: "completed",
                actualReturnDate: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            await updateDoc(doc(db, "products", selectedProduct.id), {
                status: "available"
            });

            const { logActivity } = await import("../../../utils/logger");
            await logActivity({
                action: 'return',
                productName: selectedProduct.name,
                userName: user?.displayName || user?.email || "Admin",
                imageUrl: selectedProduct.imageUrl
            });

            alert("Item returned successfully!");
            setIsReturnModalOpen(false);
            fetchProducts();

        } catch (error) {
            console.error("Error processing return:", error);
            alert("Failed to return item. Please try again.");
        } finally {
            setProcessingReturn(false);
        }
    };

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Selection Logic
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = new Set(filteredProducts.map(p => p.id!));
            setSelectedItems(allIds);
        } else {
            setSelectedItems(new Set());
        }
    };

    const handleSelectItem = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
    };

    const handlePrint = () => {
        setIsPrintModalOpen(true);
        // Optional: Automatically trigger print dialog after a short delay
        // setTimeout(() => window.print(), 500);
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20 md:ml-64 p-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white">Inventory</h1>
                    <p className="text-white/60">Manage your assets and track status.</p>
                </div>
                <div className="w-full md:w-auto flex gap-4">
                    <input
                        type="text"
                        placeholder="Search items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary transition-colors"
                    />
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedItems.size > 0 && (
                <div className="sticky top-4 z-30 bg-cyan-500/20 backdrop-blur-md border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between animate-fade-in-up">
                    <div className="text-cyan-200 font-medium">
                        {selectedItems.size} items selected
                    </div>
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2 rounded-lg bg-cyan-500 text-white font-bold shadow-lg hover:bg-cyan-400 transition-all flex items-center gap-2"
                    >
                        <span>🖨️</span> Print QR Codes
                    </button>
                </div>
            )}

            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="p-4 w-12">
                                    <input
                                        type="checkbox"
                                        onChange={handleSelectAll}
                                        checked={filteredProducts.length > 0 && selectedItems.size === filteredProducts.length}
                                        className="rounded border-white/30 bg-white/10 text-cyan-500 focus:ring-cyan-500"
                                    />
                                </th>
                                <th className="p-4 text-white/40 font-medium text-sm uppercase tracking-wider">Item</th>
                                <th className="p-4 text-white/40 font-medium text-sm uppercase tracking-wider">Location</th>
                                <th className="p-4 text-white/40 font-medium text-sm uppercase tracking-wider">Status</th>
                                <th className="p-4 text-white/40 font-medium text-sm uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredProducts.map((product) => (
                                <tr key={product.id} className={`hover:bg-white/5 transition-colors group ${selectedItems.has(product.id!) ? 'bg-white/5' : ''}`}>
                                    <td className="p-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.has(product.id!)}
                                            onChange={() => handleSelectItem(product.id!)}
                                            className="rounded border-white/30 bg-white/10 text-cyan-500 focus:ring-cyan-500"
                                        />
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden flex-shrink-0 border border-white/10">
                                                {product.imageUrl ? (
                                                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-white/20">No Img</div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{product.name}</p>
                                                <p className="text-white/40 text-sm">{product.brand}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-white/60">{product.location}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${product.status === 'available'
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                            : product.status === 'borrowed'
                                                ? 'bg-accent/20 text-accent border-accent/30'
                                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                                            }`}>
                                            {product.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        {product.status === 'borrowed' ? (
                                            <button
                                                onClick={() => handleReturnClick(product)}
                                                className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all text-sm font-medium"
                                            >
                                                Return Item
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => router.push(`/product/${product.id}`)}
                                                className="px-4 py-2 rounded-lg bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 transition-all text-sm"
                                            >
                                                View
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredProducts.length === 0 && (
                    <div className="p-8 text-center text-white/40">
                        No items found.
                    </div>
                )}
            </div>

            {/* Return Confirmation Modal */}
            {isReturnModalOpen && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsReturnModalOpen(false)}
                    ></div>
                    <div className="relative bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in-up">
                        <h3 className="text-xl font-bold text-white mb-2">Confirm Return</h3>
                        <p className="text-white/60 mb-6">
                            Are you sure you want to mark <strong>{selectedProduct.name}</strong> as returned?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsReturnModalOpen(false)}
                                className="flex-1 py-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmReturn}
                                disabled={processingReturn}
                                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all disabled:opacity-50"
                            >
                                {processingReturn ? 'Processing...' : 'Confirm Return'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print QR Modal */}
            {isPrintModalOpen && (
                <div className="fixed inset-0 z-[100] bg-white text-black overflow-auto print-area">
                    <div className="p-8 no-print flex justify-between items-center bg-gray-100 border-b">
                        <h2 className="text-2xl font-bold">Print Preview ({selectedItems.size} items)</h2>
                        <div className="flex gap-4">
                            <button
                                onClick={() => window.print()}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                            >
                                Print Now
                            </button>
                            <button
                                onClick={() => setIsPrintModalOpen(false)}
                                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-400"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    <div className="p-8 grid grid-cols-3 md:grid-cols-4 gap-8">
                        {products.filter(p => selectedItems.has(p.id!)).map(product => (
                            <div key={product.id} className="border-2 border-black p-4 rounded-lg flex flex-col items-center text-center page-break-inside-avoid">
                                <QRCode
                                    value={`${window.location.origin}/product/${product.id}`}
                                    size={128}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                />
                                <div className="mt-2">
                                    <p className="font-bold text-sm leading-tight">{product.name}</p>
                                    <p className="font-mono text-xs text-gray-600 mt-1">{product.stockId || product.id}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
