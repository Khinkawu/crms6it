import { doc, updateDoc, increment, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ProductStatus } from "../types";

// ============================================================================
// Inventory Stats (เดิม)
// ============================================================================
const INVENTORY_STATS_REF = doc(db, "stats", "inventory");

export const incrementStats = async (status: ProductStatus | 'total') => {
    try {
        const updatePayload: any = {};
        updatePayload[status] = increment(1);
        await updateDoc(INVENTORY_STATS_REF, updatePayload);
    } catch (error) {
        const docSnap = await getDoc(INVENTORY_STATS_REF);
        if (!docSnap.exists()) {
            await setDoc(INVENTORY_STATS_REF, {
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
        await updateDoc(INVENTORY_STATS_REF, updatePayload);
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
        await updateDoc(INVENTORY_STATS_REF, updatePayload);
    } catch (error) {
        console.error("Error updating stats status:", error);
    }
};

// ============================================================================
// Repair Stats (ใหม่ — pre-computed สำหรับ Dashboard)
// ============================================================================
const REPAIR_STATS_REF = doc(db, "stats", "repairs");

export interface RepairStatsDoc {
    pending: number;
    in_progress: number;
    waiting_parts: number;
    completed: number;
    cancelled: number;
    total: number;
    perTechnician: Record<string, { name: string; pending: number; in_progress: number; completed: number; total: number }>;
    updatedAt: Timestamp;
}

export const incrementRepairStats = async (
    status: string,
    technicianId?: string,
    technicianName?: string
) => {
    try {
        const payload: any = {
            [status]: increment(1),
            total: increment(1),
            updatedAt: Timestamp.now()
        };
        if (technicianId) {
            payload[`perTechnician.${technicianId}.${status}`] = increment(1);
            payload[`perTechnician.${technicianId}.total`] = increment(1);
            if (technicianName) {
                payload[`perTechnician.${technicianId}.name`] = technicianName;
            }
        }
        await updateDoc(REPAIR_STATS_REF, payload);
    } catch {
        // Create doc if it doesn't exist
        const snap = await getDoc(REPAIR_STATS_REF);
        if (!snap.exists()) {
            const initial: any = {
                pending: 0, in_progress: 0, waiting_parts: 0,
                completed: 0, cancelled: 0, total: 0,
                perTechnician: {},
                updatedAt: Timestamp.now()
            };
            initial[status] = 1;
            initial.total = 1;
            await setDoc(REPAIR_STATS_REF, initial);
        }
    }
};

export const updateRepairStatsOnStatusChange = async (
    oldStatus: string,
    newStatus: string,
    technicianId?: string,
    technicianName?: string
) => {
    if (oldStatus === newStatus) return;
    try {
        const payload: any = {
            [oldStatus]: increment(-1),
            [newStatus]: increment(1),
            updatedAt: Timestamp.now()
        };
        if (technicianId) {
            payload[`perTechnician.${technicianId}.${oldStatus}`] = increment(-1);
            payload[`perTechnician.${technicianId}.${newStatus}`] = increment(1);
            if (technicianName) {
                payload[`perTechnician.${technicianId}.name`] = technicianName;
            }
        }
        await updateDoc(REPAIR_STATS_REF, payload);
    } catch (error) {
        console.error("Error updating repair stats:", error);
    }
};

// ============================================================================
// Booking Stats (ใหม่)
// ============================================================================
const BOOKING_STATS_REF = doc(db, "stats", "bookings");

export const incrementBookingStats = async (status: string) => {
    try {
        await updateDoc(BOOKING_STATS_REF, {
            [status]: increment(1),
            total: increment(1),
            updatedAt: Timestamp.now()
        });
    } catch {
        const snap = await getDoc(BOOKING_STATS_REF);
        if (!snap.exists()) {
            const initial: any = {
                pending: 0, approved: 0, rejected: 0, cancelled: 0, total: 0,
                updatedAt: Timestamp.now()
            };
            initial[status] = 1;
            initial.total = 1;
            await setDoc(BOOKING_STATS_REF, initial);
        }
    }
};

export const updateBookingStatsOnStatusChange = async (oldStatus: string, newStatus: string) => {
    if (oldStatus === newStatus) return;
    try {
        await updateDoc(BOOKING_STATS_REF, {
            [oldStatus]: increment(-1),
            [newStatus]: increment(1),
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Error updating booking stats:", error);
    }
};

// ============================================================================
// Photography Stats (ใหม่)
// ============================================================================
const PHOTOGRAPHY_STATS_REF = doc(db, "stats", "photography");

export const incrementPhotographyStats = async (
    status: string,
    photographerId?: string,
    photographerName?: string
) => {
    try {
        const payload: any = {
            [status]: increment(1),
            total: increment(1),
            updatedAt: Timestamp.now()
        };
        if (photographerId) {
            payload[`perPhotographer.${photographerId}.${status}`] = increment(1);
            payload[`perPhotographer.${photographerId}.total`] = increment(1);
            if (photographerName) {
                payload[`perPhotographer.${photographerId}.name`] = photographerName;
            }
        }
        await updateDoc(PHOTOGRAPHY_STATS_REF, payload);
    } catch {
        const snap = await getDoc(PHOTOGRAPHY_STATS_REF);
        if (!snap.exists()) {
            const initial: any = {
                pending_assign: 0, assigned: 0, completed: 0, cancelled: 0, total: 0,
                perPhotographer: {},
                updatedAt: Timestamp.now()
            };
            initial[status] = 1;
            initial.total = 1;
            await setDoc(PHOTOGRAPHY_STATS_REF, initial);
        }
    }
};
