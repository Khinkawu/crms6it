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
    status?: string;
    signatureUrl?: string;
    targetCollection?: string;
}

export const logActivity = async ({
    action,
    productName,
    userName,
    imageUrl,
    details,
    zone,
    status,
    signatureUrl,
    targetCollection = "activities"
}: LogActivityParams) => {
    try {
        await addDoc(collection(db, targetCollection), {
            action,
            productName,
            userName,
            imageUrl: imageUrl || "",
            details: details || null,
            zone: zone || null,
            status: status || null,
            signatureUrl: signatureUrl || null,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};
