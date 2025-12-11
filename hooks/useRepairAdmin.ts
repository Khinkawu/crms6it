"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { RepairTicket, RepairStatus, Product } from "../types";
import { logActivity } from "../utils/logger";
import toast from "react-hot-toast";

interface UseRepairAdminOptions {
    userId?: string;
    userName?: string;
}

interface RepairStats {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
}

interface UseRepairAdminReturn {
    tickets: RepairTicket[];
    filteredTickets: RepairTicket[];
    inventory: Product[];
    stats: RepairStats;
    filter: RepairStatus | 'all';
    setFilter: (f: RepairStatus | 'all') => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    dateRange: { start: Date | null; end: Date | null };
    setDateRange: (range: { start: Date | null; end: Date | null }) => void;
    loading: boolean;
    // Modal state
    selectedTicket: RepairTicket | null;
    isModalOpen: boolean;
    openModal: (ticket: RepairTicket) => void;
    closeModal: () => void;
    // Form state
    status: RepairStatus;
    setStatus: (s: RepairStatus) => void;
    technicianNote: string;
    setTechnicianNote: (n: string) => void;
    completionImage: File | null;
    setCompletionImage: (f: File | null) => void;
    // Spare parts
    selectedPartId: string;
    setSelectedPartId: (id: string) => void;
    useQuantity: number;
    setUseQuantity: (q: number) => void;
    // Actions
    handleUpdateTicket: (e: React.FormEvent) => Promise<void>;
    handleUsePart: () => Promise<void>;
    isUpdating: boolean;
    isRequisitioning: boolean;
}

export function useRepairAdmin({ userId, userName }: UseRepairAdminOptions = {}): UseRepairAdminReturn {
    const [tickets, setTickets] = useState<RepairTicket[]>([]);
    const [inventory, setInventory] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter state
    const [filter, setFilter] = useState<RepairStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

    // Modal state
    const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state
    const [status, setStatus] = useState<RepairStatus>('pending');
    const [technicianNote, setTechnicianNote] = useState("");
    const [completionImage, setCompletionImage] = useState<File | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Spare parts state
    const [selectedPartId, setSelectedPartId] = useState("");
    const [useQuantity, setUseQuantity] = useState(1);
    const [isRequisitioning, setIsRequisitioning] = useState(false);

    // Fetch tickets and inventory
    useEffect(() => {
        if (!userId) return;

        const ticketsQuery = query(collection(db, "repair_tickets"), orderBy("createdAt", "desc"));
        const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
            const ticketsList: RepairTicket[] = [];
            snapshot.forEach((doc) => {
                ticketsList.push({ id: doc.id, ...doc.data() } as RepairTicket);
            });
            setTickets(ticketsList);
            setLoading(false);
        });

        const inventoryQuery = query(collection(db, "products"));
        const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
            const items: Product[] = [];
            snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as Product);
            });
            setInventory(items.filter(i => i.type === 'bulk' && (i.quantity || 0) > 0));
        });

        return () => {
            unsubTickets();
            unsubInventory();
        };
    }, [userId]);

    // Body scroll lock
    useEffect(() => {
        if (isModalOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isModalOpen]);

    // Filter logic
    const filteredTickets = tickets.filter(t => {
        const matchesFilter = filter === 'all' || t.status === filter;
        const matchesSearch =
            (t.room || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.requesterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());

        let matchesDate = true;
        if (dateRange.start && dateRange.end && t.createdAt) {
            const ticketDate = t.createdAt.toDate();
            const start = new Date(dateRange.start); start.setHours(0, 0, 0, 0);
            const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999);
            matchesDate = ticketDate >= start && ticketDate <= end;
        }

        return matchesFilter && matchesSearch && matchesDate;
    });

    // Stats
    const stats: RepairStats = {
        total: tickets.length,
        pending: tickets.filter(t => t.status === 'pending').length,
        inProgress: tickets.filter(t => t.status === 'in_progress' || t.status === 'waiting_parts').length,
        completed: tickets.filter(t => t.status === 'completed').length
    };

    // Modal handlers
    const openModal = (ticket: RepairTicket) => {
        setSelectedTicket(ticket);
        setStatus(ticket.status);
        setTechnicianNote(ticket.technicianNote || "");
        setCompletionImage(null);
        setIsModalOpen(true);
        setSelectedPartId("");
        setUseQuantity(1);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedTicket(null);
    };

    // Update ticket
    const handleUpdateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTicket?.id) return;

        if (status === 'completed' && (!technicianNote || (!selectedTicket.completionImage && !completionImage))) {
            toast.error("ต้องกรอกหมายเหตุช่างและแนบรูปภาพเพื่อปิดงาน");
            return;
        }

        setIsUpdating(true);
        try {
            let completionImageUrl = selectedTicket.completionImage;

            if (completionImage) {
                const storageRef = ref(storage, `repair_completion/${Date.now()}_${completionImage.name}`);
                const snapshot = await uploadBytes(storageRef, completionImage);
                completionImageUrl = await getDownloadURL(snapshot.ref);
            }

            const ticketRef = doc(db, "repair_tickets", selectedTicket.id);
            await updateDoc(ticketRef, {
                status,
                technicianNote,
                technicianName: userName || 'Technician',
                completionImage: completionImageUrl || null,
                updatedAt: serverTimestamp()
            });

            await logActivity({
                action: 'repair_update',
                productName: selectedTicket.room,
                userName: userName || "Technician",
                details: technicianNote,
                status: status,
                imageUrl: completionImageUrl || selectedTicket.images?.[0]
            });

            // Send LINE notification if completed
            if (status === 'completed') {
                try {
                    await fetch('/api/notify-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: selectedTicket.requesterEmail,
                            ticketId: selectedTicket.id,
                            room: selectedTicket.room,
                            problem: selectedTicket.description,
                            technicianNote,
                            completionImage: completionImageUrl || selectedTicket.completionImage
                        })
                    });
                } catch (notifyError) {
                    console.error("Failed to send notification:", notifyError);
                }
            }

            toast.success("บันทึกสำเร็จ");
            closeModal();
        } catch (error) {
            console.error("Error updating ticket:", error);
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsUpdating(false);
        }
    };

    // Use spare part
    const handleUsePart = async () => {
        if (!selectedPartId || !selectedTicket?.id) return;

        const part = inventory.find(p => p.id === selectedPartId);
        if (!part) return;

        if (useQuantity <= 0 || useQuantity > (part.quantity || 0)) {
            toast.error(`จำนวนไม่ถูกต้อง คงเหลือ: ${part.quantity}`);
            return;
        }

        setIsRequisitioning(true);
        try {
            const productRef = doc(db, "products", selectedPartId);
            const newQuantity = (part.quantity || 0) - useQuantity;

            await updateDoc(productRef, {
                quantity: newQuantity,
                status: newQuantity === 0 ? 'requisitioned' : 'available'
            });

            const ticketRef = doc(db, "repair_tickets", selectedTicket.id);
            await updateDoc(ticketRef, {
                partsUsed: arrayUnion({
                    name: part.name,
                    quantity: useQuantity,
                    date: new Date()
                }),
                updatedAt: serverTimestamp()
            });

            await logActivity({
                action: 'requisition',
                productName: part.name,
                userName: userName || "Technician",
                details: `เบิก ${useQuantity} ชิ้น สำหรับงานซ่อม #${selectedTicket.id?.slice(0, 5)}`,
                imageUrl: part.imageUrl
            });

            toast.success(`เบิก ${useQuantity} x ${part.name} สำเร็จ`);
            setSelectedPartId("");
            setUseQuantity(1);

        } catch (error) {
            console.error("Error using part:", error);
            toast.error("เกิดข้อผิดพลาดในการเบิกของ");
        } finally {
            setIsRequisitioning(false);
        }
    };

    return {
        tickets,
        filteredTickets,
        inventory,
        stats,
        filter,
        setFilter,
        searchQuery,
        setSearchQuery,
        dateRange,
        setDateRange,
        loading,
        selectedTicket,
        isModalOpen,
        openModal,
        closeModal,
        status,
        setStatus,
        technicianNote,
        setTechnicianNote,
        completionImage,
        setCompletionImage,
        selectedPartId,
        setSelectedPartId,
        useQuantity,
        setUseQuantity,
        handleUpdateTicket,
        handleUsePart,
        isUpdating,
        isRequisitioning
    };
}

// Utility functions
export const getThaiStatus = (s: RepairStatus): string => {
    switch (s) {
        case 'pending': return 'รอดำเนินการ';
        case 'in_progress': return 'กำลังดำเนินการ';
        case 'waiting_parts': return 'รออะไหล่';
        case 'completed': return 'เสร็จสิ้น';
        case 'cancelled': return 'ยกเลิกงาน';
        default: return s;
    }
};

export const getStatusColor = (s: RepairStatus): string => {
    switch (s) {
        case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
        case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
        case 'waiting_parts': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
        case 'completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
        default: return 'bg-slate-500/10 text-slate-600';
    }
};
