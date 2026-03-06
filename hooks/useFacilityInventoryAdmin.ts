"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDocs, where, increment, limit } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { Product, ProductStatus } from "../types";
import { logActivity } from "../utils/logger";
import toast from "react-hot-toast";

interface UseFacilityInventoryAdminOptions {
    userId?: string;
    userName?: string;
}

export function useFacilityInventoryAdmin({ userId, userName }: UseFacilityInventoryAdminOptions) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const q = query(collection(db, "facility_inventory"), orderBy("updatedAt", "desc"), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const productList: Product[] = [];
            snapshot.forEach((doc) => {
                productList.push({ id: doc.id, ...doc.data() } as Product);
            });
            setProducts(productList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    // Handle delete
    const handleDeleteProduct = async (product: Product) => {
        if (!product.id) return false;
        if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบรายการ "${product.name}"?`)) return false;

        try {
            await deleteDoc(doc(db, "facility_inventory", product.id));

            if (product.imageUrl) {
                try {
                    const imageRef = ref(storage, product.imageUrl);
                    await deleteObject(imageRef);
                } catch (imgErr) {
                    console.error("Error deleting image:", imgErr);
                }
            }

            await logActivity({
                action: 'delete',
                productName: product.name,
                userName: userName || 'Admin',
                details: `ลบรายการวัสดุ/อุปกรณ์ ${product.name}`,
                status: 'completed'
            });

            toast.success("ลบรายการสำเร็จ");
            return true;
        } catch (error) {
            console.error("Error deleting product:", error);
            toast.error("เกิดข้อผิดพลาดในการลบรายการ");
            return false;
        }
    };


    return {
        products,
        loading,
        handleDeleteProduct
    };
}
