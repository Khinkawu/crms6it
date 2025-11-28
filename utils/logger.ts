import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface LogActivityParams {
    action: 'borrow' | 'return' | 'requisition';
    productName: string;
    userName: string;
    imageUrl?: string;
}

export const logActivity = async ({ action, productName, userName, imageUrl }: LogActivityParams) => {
    try {
        await addDoc(collection(db, "activities"), {
            action,
            productName,
            userName,
            imageUrl: imageUrl || "",
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};
