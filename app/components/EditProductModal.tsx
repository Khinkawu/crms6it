"use client";

import React, { useState, useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Product } from "../../types";

interface EditProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onSuccess: () => void;
}

const EditProductModal: React.FC<EditProductModalProps> = ({ isOpen, onClose, product, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: "",
        brand: "",
        location: "",
        category: "",
        serialNumber: "",
        description: "",
        price: 0,
        warrantyInfo: "",
        imageUrl: "",
    });

    // Stock Management
    const [stockMode, setStockMode] = useState<'set' | 'add'>('add');
    const [stockInput, setStockInput] = useState<number>(0);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && product) {
            setFormData({
                name: product.name || "",
                brand: product.brand || "",
                location: product.location || "",
                category: product.category || "",
                serialNumber: product.serialNumber || "",
                description: product.description || "",
                price: product.price || 0,
                warrantyInfo: product.warrantyInfo || "",
                imageUrl: product.imageUrl || "",
            });
            setStockInput(0);
        }
    }, [isOpen, product]);

    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const productRef = doc(db, "products", product.id!);

            const updates: any = {
                ...formData,
                price: Number(formData.price),
                updatedAt: serverTimestamp(),
            };

            // Handle Stock Update for Bulk Items
            if (product.type === 'bulk') {
                const currentQty = product.quantity || 0;
                let newQty = currentQty;

                if (stockInput !== 0) {
                    if (stockMode === 'set') {
                        newQty = Number(stockInput);
                    } else {
                        newQty = currentQty + Number(stockInput);
                    }

                    if (newQty < 0) {
                        throw new Error("Stock quantity cannot be negative.");
                    }

                    updates.quantity = newQty;

                    // Update status if stock becomes available/unavailable
                    const borrowed = product.borrowedCount || 0;
                    if (newQty - borrowed > 0) {
                        updates.status = 'available';
                    } else {
                        updates.status = 'requisitioned'; // Or unavailable
                    }
                }
            }

            await updateDoc(productRef, updates);

            // Log Activity
            const { logActivity } = await import("../../utils/logger");
            await logActivity({
                action: 'update',
                productName: formData.name,
                userName: "Admin", // TODO: Pass actual user
                details: `Updated details. ${product.type === 'bulk' && stockInput !== 0 ? `Stock updated by ${stockInput}` : ''}`,
                imageUrl: formData.imageUrl
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error updating product:", err);
            setError(err.message || "Failed to update product.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

            <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-soft-lg overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-text">Edit Product</h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text">✕</button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <form id="edit-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Basic Info Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Basic Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Product Name</label>
                                    <input name="name" value={formData.name} onChange={handleInputChange} className="input-field" required />
                                </div>
                                <div>
                                    <label className="label">Brand</label>
                                    <input name="brand" value={formData.brand} onChange={handleInputChange} className="input-field" required />
                                </div>
                                <div>
                                    <label className="label">Location</label>
                                    <input name="location" value={formData.location} onChange={handleInputChange} className="input-field" required />
                                </div>
                                <div>
                                    <label className="label">Category</label>
                                    <input name="category" value={formData.category} onChange={handleInputChange} className="input-field" />
                                </div>
                            </div>
                        </div>

                        {/* Details Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Price</label>
                                    <input type="number" name="price" value={formData.price} onChange={handleInputChange} className="input-field" />
                                </div>
                                <div>
                                    <label className="label">Warranty Info</label>
                                    <input name="warrantyInfo" value={formData.warrantyInfo} onChange={handleInputChange} className="input-field" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="label">Image URL</label>
                                    <input name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} className="input-field" placeholder="https://..." />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="label">Description</label>
                                    <textarea name="description" value={formData.description} onChange={handleInputChange} className="input-field h-24 resize-none" />
                                </div>
                            </div>
                        </div>

                        {/* Stock Management (Bulk Only) */}
                        {product.type === 'bulk' && (
                            <div className="p-4 bg-input-bg rounded-xl border border-border space-y-4">
                                <h3 className="text-sm font-bold text-primary-start uppercase tracking-wider flex items-center gap-2">
                                    📦 Stock Management
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-text">
                                    <span>Current Total: <strong className="text-lg">{product.quantity || 0}</strong></span>
                                    <span>Borrowed: <strong>{product.borrowedCount || 0}</strong></span>
                                    <span>Available: <strong>{(product.quantity || 0) - (product.borrowedCount || 0)}</strong></span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                    <div>
                                        <label className="label">Update Mode</label>
                                        <div className="flex bg-card rounded-lg border border-border p-1">
                                            <button
                                                type="button"
                                                onClick={() => setStockMode('add')}
                                                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${stockMode === 'add' ? 'bg-primary-start text-white shadow-sm' : 'text-text-secondary hover:text-text'}`}
                                            >
                                                Add / Remove
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setStockMode('set')}
                                                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${stockMode === 'set' ? 'bg-primary-start text-white shadow-sm' : 'text-text-secondary hover:text-text'}`}
                                            >
                                                Set Total
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label">
                                            {stockMode === 'add' ? 'Amount to Add (use negative to remove)' : 'New Total Quantity'}
                                        </label>
                                        <input
                                            type="number"
                                            value={stockInput}
                                            onChange={(e) => setStockInput(parseInt(e.target.value) || 0)}
                                            className="input-field font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Unique Item Specifics */}
                        {product.type !== 'bulk' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Serial Number</label>
                                        <input name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="input-field" />
                                    </div>
                                </div>
                            </div>
                        )}

                    </form>
                </div>

                <div className="p-6 border-t border-border flex justify-between items-center bg-card">
                    <button
                        type="button"
                        onClick={async () => {
                            if (confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
                                setLoading(true);
                                try {
                                    const { deleteDoc, doc } = await import("firebase/firestore");
                                    await deleteDoc(doc(db, "products", product.id!));

                                    // Log Activity
                                    const { logActivity } = await import("../../utils/logger");
                                    await logActivity({
                                        action: 'update', // Using update as a generic 'change' or add a 'delete' action if supported
                                        productName: product.name,
                                        userName: "Admin",
                                        details: `Deleted product: ${product.name}`,
                                        imageUrl: product.imageUrl
                                    });

                                    onSuccess();
                                    onClose();
                                } catch (err: any) {
                                    console.error("Error deleting product:", err);
                                    setError("Failed to delete product.");
                                    setLoading(false);
                                }
                            }
                        }}
                        className="px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-medium transition-colors"
                        disabled={loading}
                    >
                        Delete Product
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="btn-secondary">Cancel</button>
                        <button form="edit-form" type="submit" disabled={loading} className="btn-primary">
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditProductModal;
