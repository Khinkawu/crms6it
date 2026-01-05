"use client";

import { useState, useEffect } from "react";
import { RepairTicket, RepairStatus } from "../types";

interface UseRepairModalReturn {
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
    // Spare parts selection state
    selectedPartId: string;
    setSelectedPartId: (id: string) => void;
    useQuantity: number;
    setUseQuantity: (q: number) => void;
}

export function useRepairModal(): UseRepairModalReturn {
    const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state
    const [status, setStatus] = useState<RepairStatus>('pending');
    const [technicianNote, setTechnicianNote] = useState("");
    const [completionImage, setCompletionImage] = useState<File | null>(null);

    // Spare parts state
    const [selectedPartId, setSelectedPartId] = useState("");
    const [useQuantity, setUseQuantity] = useState(1);

    // Body scroll lock
    useEffect(() => {
        if (isModalOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isModalOpen]);

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

    return {
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
        setUseQuantity
    };
}
