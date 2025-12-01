"use client";

import React, { useState } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Product } from '../../../types';

import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';

export default function InitStatsPage() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState('Idle');
    const [isProcessing, setIsProcessing] = useState(false);

    React.useEffect(() => {
        if (!loading) {
            if (!user || role !== 'admin') {
                router.push('/');
            }
        }
    }, [user, role, loading, router]);

    if (loading || !user || role !== 'admin') return null;

    const handleInitialize = async () => {
        setIsProcessing(true);
        setStatus('Fetching products...');
        try {
            const querySnapshot = await getDocs(collection(db, 'products'));
            let total = 0;
            let available = 0;
            let borrowed = 0;
            let maintenance = 0;

            querySnapshot.forEach((doc) => {
                const data = doc.data() as Product;
                total++;

                // Logic matching Dashboard
                const isBulk = data.type === 'bulk';
                if (isBulk) {
                    // For bulk, we might need a different strategy if we count "items" vs "SKUs".
                    // The current dashboard counts "SKUs" (documents) for total, but checks quantity for availability.
                    // However, the stats object in Dashboard was:
                    /*
                        if (isBulk) {
                            if ((data.quantity || 0) - (data.borrowedCount || 0) > 0) available++;
                            if ((data.borrowedCount || 0) > 0) borrowed++;
                        } else {
                            if (data.status === 'available') available++;
                            if (data.status === 'borrowed') borrowed++;
                        }
                    */
                    // Wait, the previous dashboard logic for bulk was slightly ambiguous in "total".
                    // It just did total++ for every doc.
                    // Let's stick to Document Count for simplicity as "Total Items" usually means "Total SKUs/Entries" in this context, 
                    // OR rewrite logic to be more precise. 
                    // Let's replicate the EXACT logic from the old Dashboard to ensure consistency.

                    if ((data.quantity || 0) - (data.borrowedCount || 0) > 0) available++;
                    if ((data.borrowedCount || 0) > 0) borrowed++;
                } else {
                    if (data.status === 'available') available++;
                    if (data.status === 'borrowed') borrowed++;
                    if (data.status === 'maintenance') maintenance++;
                }
            });

            setStatus(`Found ${total} products. Writing to stats...`);

            await setDoc(doc(db, 'stats', 'inventory'), {
                total,
                available,
                borrowed,
                maintenance
            });

            setStatus('Success! Stats initialized.');
        } catch (error) {
            console.error(error);
            setStatus('Error: ' + (error as any).message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-10 text-center">
            <h1 className="text-2xl font-bold mb-4">Initialize Inventory Stats</h1>
            <p className="mb-6">This will count all existing products and save the totals to <code>stats/inventory</code>.</p>

            <div className="mb-6 p-4 bg-gray-100 rounded">
                Status: <span className="font-bold">{status}</span>
            </div>

            <button
                onClick={handleInitialize}
                disabled={isProcessing}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
            >
                {isProcessing ? 'Processing...' : 'Start Initialization'}
            </button>
        </div>
    );
}
