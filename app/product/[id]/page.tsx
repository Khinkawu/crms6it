"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Product } from "../../../types";
import { useAuth } from "../../../context/AuthContext";
import BorrowModal from "../../components/BorrowModal";

import QRCode from "react-qr-code";

const ProductDetailPage = () => {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);

    const fetchProduct = async () => {
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
    };

    useEffect(() => {
        fetchProduct();
    }, [id]);

    const handleLogin = () => {
        router.push(`/login`);
    };

    const handleBorrow = () => {
        setIsBorrowModalOpen(true);
    };

    const handleBorrowSuccess = () => {
        fetchProduct();
    };

    const handleRequisition = () => {
        alert("Open Requisition Modal");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Oops!</h1>
                    <p className="text-white/60">{error || "Product not found"}</p>
                    <button
                        onClick={() => router.push("/")}
                        className="mt-6 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    const isAvailable = product.status === "available";

    return (
        <div className="min-h-screen p-4 md:p-8 pb-24">
            <BorrowModal
                isOpen={isBorrowModalOpen}
                onClose={() => setIsBorrowModalOpen(false)}
                product={product}
                onSuccess={handleBorrowSuccess}
            />

            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">

                {/* Header / Image Section */}
                <div className="glass-panel p-2 relative overflow-hidden group">
                    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black/20 relative">
                        {product.imageUrl ? (
                            <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-contain hover:scale-105 transition-transform duration-500"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20">
                                No Image Available
                            </div>
                        )}

                        {/* Status Badge Overlay */}
                        <div className="absolute top-4 right-4">
                            <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg backdrop-blur-md border border-white/10
                ${isAvailable
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10"
                                    : "bg-red-500/20 text-red-400 border-red-500/30 shadow-red-500/10"
                                }`}
                            >
                                {product.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Details Section */}
                <div className="glass-panel p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{product.name}</h1>
                            <p className="text-xl text-white/60">{product.brand}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-white/40 mb-1">Stock ID</p>
                            <p className="font-mono text-white/80 bg-white/5 px-3 py-1 rounded-lg inline-block">
                                {product.stockId || product.id}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white/80">
                        <div className="space-y-1">
                            <p className="text-sm text-white/40">Location</p>
                            <p className="font-medium">{product.location}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-white/40">Price</p>
                            <p className="font-medium">฿{product.price.toLocaleString()}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-white/40">Purchase Date</p>
                            <p className="font-medium">
                                {product.purchaseDate?.toDate().toLocaleDateString("th-TH", {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-white/40">Warranty</p>
                            <p className="font-medium">{product.warrantyInfo}</p>
                        </div>
                    </div>
                </div>

                {/* QR Code Asset Tag */}
                <div className="mt-8 border-t border-white/10 pt-8">
                    <h3 className="text-white font-bold mb-4">Asset Tag</h3>
                    <div className="bg-white p-4 rounded-xl inline-block shadow-xl">
                        <div className="flex flex-col items-center gap-2">
                            <QRCode
                                value={`${window.location.origin}/product/${product.id}`}
                                size={128}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                            />
                            <div className="text-center">
                                <p className="text-black font-bold text-sm">{product.name}</p>
                                <p className="text-black/60 text-xs font-mono">{product.stockId || product.id}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Area */}
            <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#020617] via-[#020617]/90 to-transparent z-40">
                <div className="max-w-4xl mx-auto">
                    {!user ? (
                        // Scenario A: Not Logged In
                        <button
                            onClick={handleLogin}
                            className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-white font-bold text-lg shadow-lg transition-all active:scale-[0.98]"
                        >
                            Login to Action
                        </button>
                    ) : isAvailable ? (
                        // Scenario B: Logged In & Available
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={handleBorrow}
                                className="py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                ยืมสินค้า (Borrow)
                            </button>
                            <button
                                onClick={handleRequisition}
                                className="py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                ขอเบิก (Requisition)
                            </button>
                        </div>
                    ) : (
                        // Scenario C: Logged In & Unavailable
                        <button
                            disabled
                            className="w-full py-4 rounded-2xl bg-white/5 border border-white/5 text-white/40 font-bold text-lg cursor-not-allowed"
                        >
                            Unavailable
                        </button>
                    )}
                </div>
            </div>

            {/* Spacer for fixed bottom bar */}
            <div className="h-20"></div>
        </div>
    );
};

export default ProductDetailPage;
