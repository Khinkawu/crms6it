import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { LogAction } from "../types";

interface LogActivityParams {
    action: LogAction;
    productName: string;
    userName: string;
    imageUrl?: string;
    details?: string;
}

export const logActivity = async ({ action, productName, userName, imageUrl, details }: LogActivityParams) => {
    try {
        await addDoc(collection(db, "activities"), {
            action,
            productName,
            userName,
            imageUrl: imageUrl || "",
            details: details || null,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};
