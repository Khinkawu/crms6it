"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { db, storage } from "../../../lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import QRCode from "react-qr-code";
import { Product } from "../../../types";

const AddProductPage = () => {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: "",
        brand: "",
        price: "",
        purchaseDate: "",
        warrantyInfo: "",
        location: "",
        quantity: "1",
    });
    const [isBulk, setIsBulk] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [newProductId, setNewProductId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Protect Route
    if (!authLoading && !user) {
        router.push("/login");
        return null;
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleBulkToggle = () => {
        setIsBulk(!isBulk);
        setFormData(prev => ({ ...prev, quantity: !isBulk ? "10" : "1" }));
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const resizeImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                const maxWidth = 800;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error("Canvas to Blob failed"));
                        }
                    },
                    "image/webp",
                    0.7
                );
            };
            img.onerror = (err) => reject(err);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!imageFile) throw new Error("Please select an image.");

            // 1. Resize & Compress Image
            const resizedImageBlob = await resizeImage(imageFile);

            // 2. Upload Image
            const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name.replace(/\.[^/.]+$/, "")}.webp`);
            const snapshot = await uploadBytes(storageRef, resizedImageBlob);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // 3. Add to Firestore
            const productData: Omit<Product, "id"> = {
                name: formData.name,
                brand: formData.brand,
                price: parseFloat(formData.price),
                purchaseDate: Timestamp.fromDate(new Date(formData.purchaseDate)),
                warrantyInfo: formData.warrantyInfo,
                location: formData.location,
                imageUrl: downloadURL,
                stockId: "", // Will update after getting doc ID
                status: "available",
                createdAt: Timestamp.now(),
                type: isBulk ? 'bulk' : 'unique',
                quantity: isBulk ? parseInt(formData.quantity) : 1,
                borrowedCount: 0,
            };

            const docRef = await addDoc(collection(db, "products"), productData);

            setNewProductId(docRef.id);
            setSuccess(true);

            // Clear form
            setFormData({
                name: "",
                brand: "",
                price: "",
                purchaseDate: "",
                warrantyInfo: "",
                location: "",
                quantity: "1",
            });
            setIsBulk(false);
            setImageFile(null);
            setImagePreview(null);

        } catch (err: any) {
            console.error("Error adding product:", err);
            setError(err.message || "Failed to add product.");
        } finally {
            setLoading(false);
        }
    };

    const handlePrintQR = () => {
        window.print();
    };

    if (authLoading) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;

    return (
        <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
            <div className="w-full max-w-2xl relative">

                {/* Success State with QR Code */}
                {success && newProductId ? (
                    <div className="glass-panel p-8 text-center animate-fade-in space-y-6">
                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold text-white">Product Added!</h2>
                        <p className="text-white/60">The product has been successfully added to inventory.</p>

                        <div className="bg-white p-4 rounded-xl inline-block shadow-2xl mx-auto print:block print:absolute print:top-0 print:left-0 print:w-full print:h-full print:flex print:items-center print:justify-center">
                            <QRCode
                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/product/${newProductId}`}
                                size={200}
                            />
                            <p className="text-black text-sm font-mono mt-2">{newProductId}</p>
                        </div>

                        <div className="flex gap-4 justify-center print:hidden">
                            <button
                                onClick={handlePrintQR}
                                className="px-6 py-3 rounded-xl bg-white text-blue-900 font-bold hover:bg-blue-50 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Print QR
                            </button>
                            <button
                                onClick={() => setSuccess(false)}
                                className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                            >
                                Add Another
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Form State */
                    <div className="glass-panel p-8 animate-fade-in">
                        <h1 className="text-3xl font-bold text-white mb-2">Add New Product</h1>
                        <p className="text-white/50 mb-8">Enter product details to add to inventory.</p>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Image Upload */}
                            <div
                                className={`relative w-full h-48 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden group
                  ${imagePreview ? 'border-primary/50 bg-primary/5' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}`}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center p-4">
                                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                            <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-white/60 font-medium">Click or drop image here</p>
                                        <p className="text-white/30 text-xs mt-1">Supports JPG, PNG, WEBP</p>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageSelect}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                    <span className="text-sm font-medium text-white/70">Bulk Item?</span>
                                    <button
                                        type="button"
                                        onClick={handleBulkToggle}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isBulk ? 'bg-emerald-500' : 'bg-white/20'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isBulk ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>

                            {isBulk && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/70">Quantity</label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        value={formData.quantity}
                                        onChange={handleInputChange}
                                        min="1"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/70">Product Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
                                        placeholder="e.g. MacBook Pro 16"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/70">Brand / Model</label>
                                    <input
                                        type="text"
                                        name="brand"
                                        value={formData.brand}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
                                        placeholder="e.g. Apple / M1 Pro"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/70">Price</label>
                                    <input
                                        type="number"
                                        name="price"
                                        value={formData.price}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/70">Purchase Date</label>
                                    <input
                                        type="date"
                                        name="purchaseDate"
                                        value={formData.purchaseDate}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all [color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/70">Warranty Info</label>
                                    <input
                                        type="text"
                                        name="warrantyInfo"
                                        value={formData.warrantyInfo}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
                                        placeholder="e.g. 1 Year AppleCare+"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/70">Location</label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
                                        placeholder="e.g. Cabinet A, Room 101"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Processing...
                                    </span>
                                ) : (
                                    "Add Product"
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddProductPage;
