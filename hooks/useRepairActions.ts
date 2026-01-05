"use client";

import { useState } from "react";
import { doc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { RepairTicket, RepairStatus, Product } from "../types";
import { logActivity } from "../utils/logger";
import { compressImage } from "../utils/imageCompression";
import toast from "react-hot-toast";

interface UseRepairActionsOptions {
    userId?: string;
    userName?: string;
}

interface UseRepairActionsReturn {
    handleUpdateTicket: (
        ticket: RepairTicket | null,
        status: RepairStatus,
        technicianNote: string,
        completionImage: File | null,
        onSuccess: () => void
    ) => Promise<void>;
    handleUsePart: (
        ticket: RepairTicket | null,
        part: Product | undefined,
        useQuantity: number,
        signatureDataUrl?: string
    ) => Promise<boolean>;
    isUpdating: boolean;
    isRequisitioning: boolean;
}

export function useRepairActions({ userId, userName }: UseRepairActionsOptions): UseRepairActionsReturn {
    const [isUpdating, setIsUpdating] = useState(false);
    const [isRequisitioning, setIsRequisitioning] = useState(false);

    const handleUpdateTicket = async (
        ticket: RepairTicket | null,
        status: RepairStatus,
        technicianNote: string,
        completionImage: File | null,
        onSuccess: () => void
    ) => {
        if (!ticket?.id) return;

        if (status === 'completed' && (!technicianNote || (!ticket.completionImage && !completionImage))) {
            toast.error("ต้องกรอกหมายเหตุช่างและแนบรูปภาพเพื่อปิดงาน");
            return;
        }

        setIsUpdating(true);
        try {
            let completionImageUrl = ticket.completionImage;

            if (completionImage) {
                const compressedImage = await compressImage(completionImage, {
                    maxWidth: 1920,
                    maxHeight: 1080,
                    quality: 0.8,
                    maxSizeMB: 1
                });

                const storageRef = ref(storage, `repair_completion/${Date.now()}_${compressedImage.name}`);
                const snapshot = await uploadBytes(storageRef, compressedImage);
                completionImageUrl = await getDownloadURL(snapshot.ref);
            }

            const ticketRef = doc(db, "repair_tickets", ticket.id);
            await updateDoc(ticketRef, {
                status,
                technicianNote,
                technicianId: userId || null,
                technicianName: userName || 'Technician',
                completionImage: completionImageUrl || null,
                updatedAt: serverTimestamp()
            });

            await logActivity({
                action: 'repair_update',
                productName: ticket.room,
                userName: userName || "Technician",
                details: technicianNote,
                status: status,
                imageUrl: completionImageUrl || ticket.images?.[0],
                zone: ticket.zone
            });

            if (status === 'completed') {
                try {
                    await fetch('/api/notify-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: ticket.requesterEmail,
                            ticketId: ticket.id,
                            room: ticket.room,
                            problem: ticket.description,
                            technicianNote,
                            completionImage: completionImageUrl || ticket.completionImage
                        })
                    });
                } catch (notifyError) {
                    console.error("Failed to send notification:", notifyError);
                }
            }

            toast.success("บันทึกสำเร็จ");
            onSuccess();
        } catch (error) {
            console.error("Error updating ticket:", error);
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUsePart = async (
        ticket: RepairTicket | null,
        part: Product | undefined,
        useQuantity: number,
        signatureDataUrl?: string
    ): Promise<boolean> => {
        if (!part || !ticket?.id) return false;

        if (useQuantity <= 0 || useQuantity > (part.quantity || 0)) {
            toast.error(`จำนวนไม่ถูกต้อง คงเหลือ: ${part.quantity}`);
            return false;
        }

        setIsRequisitioning(true);
        try {
            let signatureUrl = '';

            if (signatureDataUrl) {
                const signatureBlob = await (await fetch(signatureDataUrl)).blob();
                const storageRef = ref(storage, `repair_signatures/${Date.now()}_sig.png`);
                const snapshot = await uploadBytes(storageRef, signatureBlob);
                signatureUrl = await getDownloadURL(snapshot.ref);
            }

            const productRef = doc(db, "products", part.id!);
            const newQuantity = (part.quantity || 0) - useQuantity;

            await updateDoc(productRef, {
                quantity: newQuantity,
                status: newQuantity === 0 ? 'requisitioned' : 'available',
                updatedAt: serverTimestamp()
            });

            const ticketRef = doc(db, "repair_tickets", ticket.id);
            await updateDoc(ticketRef, {
                partsUsed: arrayUnion({
                    name: part.name,
                    quantity: useQuantity,
                    date: new Date(),
                    signatureUrl: signatureUrl || null
                }),
                updatedAt: serverTimestamp()
            });

            await logActivity({
                action: 'requisition',
                productName: part.name,
                userName: userName || "Technician",
                details: `เบิกจากงานซ่อมห้อง ${ticket.room} จำนวน ${useQuantity} ชิ้น`,
                zone: ticket.zone || 'unknown',
                status: 'completed',
                signatureUrl: signatureUrl || undefined
            });

            toast.success(`เบิก ${useQuantity} x ${part.name} สำเร็จ`);
            return true;
        } catch (error) {
            console.error("Error using part:", error);
            toast.error("เกิดข้อผิดพลาดในการเบิกของ");
            return false;
        } finally {
            setIsRequisitioning(false);
        }
    };

    return {
        handleUpdateTicket,
        handleUsePart,
        isUpdating,
        isRequisitioning
    };
}
