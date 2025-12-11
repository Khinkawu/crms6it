"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Product, ProductStatus } from "../types";

interface UseInventoryOptions {
    filterStatus?: ProductStatus | 'all';
    searchQuery?: string;
}

interface UseInventoryReturn {
    products: Product[];
    filteredProducts: Product[];
    loading: boolean;
}

/**
 * Hook for fetching inventory products from Firestore
 * Includes filtering by status and search query
 */
export function useInventory(options: UseInventoryOptions = {}): UseInventoryReturn {
    const { filterStatus = 'all', searchQuery = '' } = options;

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "products"), orderBy("updatedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const productList: Product[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Product));
            setProducts(productList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Filter products
    const filteredProducts = products.filter(p => {
        let matchesFilter = false;

        if (filterStatus === 'all') {
            matchesFilter = true;
        } else if (filterStatus === 'available') {
            const isBulkAvailable = p.type === 'bulk' && (p.quantity || 0) > (p.borrowedCount || 0);
            matchesFilter = p.status === 'available' || isBulkAvailable;
        } else if (filterStatus === 'borrowed') {
            const isBulkBorrowed = p.type === 'bulk' && (p.borrowedCount || 0) > 0;
            matchesFilter = p.status === 'borrowed' || p.status === 'ไม่ว่าง' || isBulkBorrowed;
        } else if (filterStatus === 'maintenance') {
            matchesFilter = p.status === 'maintenance';
        } else if (filterStatus === 'requisitioned') {
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

    return { products, filteredProducts, loading };
}

// Helper functions for status display
export const getProductStatusLabel = (status: ProductStatus): string => {
    switch (status) {
        case 'available': return 'พร้อมใช้';
        case 'borrowed':
        case 'ไม่ว่าง': return 'ถูกยืม';
        case 'maintenance': return 'ส่งซ่อม';
        default: return 'เบิกแล้ว';
    }
};

export const getProductStatusColor = (status: ProductStatus): string => {
    switch (status) {
        case 'available': return 'bg-emerald-100 text-emerald-700';
        case 'borrowed':
        case 'ไม่ว่าง': return 'bg-amber-100 text-amber-700';
        case 'maintenance': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-700';
    }
};
