"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { FacilityItem } from "../types";

interface UseFacilityInventoryOptions {
    searchQuery?: string;
    filterCategory?: string | 'all';
}

interface UseFacilityInventoryReturn {
    inventory: FacilityItem[];
    filteredInventory: FacilityItem[];
    loading: boolean;
    categories: string[];
}

/**
 * Hook for fetching facility inventory items (spare parts) from Firestore
 */
export function useFacilityInventory(options: UseFacilityInventoryOptions = {}): UseFacilityInventoryReturn {
    const { searchQuery = '', filterCategory = 'all' } = options;

    const [inventory, setInventory] = useState<FacilityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, "facility_inventory"),
            orderBy("category", "asc"),
            orderBy("name", "asc"),
            limit(500)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: FacilityItem[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FacilityItem));
            setInventory(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Filter items
    const filteredInventory = inventory.filter(item => {
        let matchesCategory = true;
        if (filterCategory !== 'all') {
            matchesCategory = item.category === filterCategory;
        }

        const matchesSearch =
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.location || "").toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesSearch;
    });

    // Extract unique categories for filter dropdowns
    const categories = Array.from(new Set(inventory.map(item => item.category))).sort();

    return { inventory, filteredInventory, loading, categories };
}
