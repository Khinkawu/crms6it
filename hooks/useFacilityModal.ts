"use client";

import { useState, useEffect } from "react";
import { FacilityTicket, RepairStatus } from "../types";

export interface UseFacilityModalReturn {
    selectedTicket: FacilityTicket | null;
    isModalOpen: boolean;
    openModal: (ticket: FacilityTicket) => void;
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

export function useFacilityModal(): UseFacilityModalReturn {
    const [selectedTicket, setSelectedTicket] = useState<FacilityTicket | null>(null);
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

    const openModal = (ticket: FacilityTicket) => {
        setSelectedTicket(ticket);
        setStatus(ticket.status);
        setTechnicianNote(ticket.solutionNote || "");
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
