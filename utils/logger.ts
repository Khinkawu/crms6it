import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { LogAction } from "../types";

interface LogActivityParams {
    action: LogAction;
    productName: string;
    userName: string;
    imageUrl?: string;
    details?: string;
    zone?: string;
}

export const logActivity = async ({ action, productName, userName, imageUrl, details, zone }: LogActivityParams) => {
    try {
        await addDoc(collection(db, "activities"), {
            action,
            productName,
            userName,
            imageUrl: imageUrl || "",
            details: details || null,
            zone: zone || null,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};
