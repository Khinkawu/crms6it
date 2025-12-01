import { doc, updateDoc, increment, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ProductStatus } from "../types";

const STATS_DOC_REF = doc(db, "stats", "inventory");

export const incrementStats = async (status: ProductStatus | 'total') => {
    try {
        const updatePayload: any = {};
        updatePayload[status] = increment(1);

        // If adding a specific status (e.g. 'available'), also increment total if not explicitly handled
        // But usually we handle total separately or together. 
        // Let's keep it simple: caller decides what to increment.

        await updateDoc(STATS_DOC_REF, updatePayload);
    } catch (error) {
        // If doc doesn't exist, create it
        const docSnap = await getDoc(STATS_DOC_REF);
        if (!docSnap.exists()) {
            await setDoc(STATS_DOC_REF, {
                total: 0,
                available: 0,
                borrowed: 0,
                maintenance: 0,
                [status]: 1
            });
        }
    }
};

export const decrementStats = async (status: ProductStatus | 'total') => {
    try {
        const updatePayload: any = {};
        updatePayload[status] = increment(-1);
        await updateDoc(STATS_DOC_REF, updatePayload);
    } catch (error) {
        console.error("Error decrementing stats:", error);
    }
};

export const updateStatsOnStatusChange = async (oldStatus: ProductStatus, newStatus: ProductStatus) => {
    if (oldStatus === newStatus) return;

    try {
        const updatePayload: any = {};
        updatePayload[oldStatus] = increment(-1);
        updatePayload[newStatus] = increment(1);
        await updateDoc(STATS_DOC_REF, updatePayload);
    } catch (error) {
        console.error("Error updating stats status:", error);
    }
};
