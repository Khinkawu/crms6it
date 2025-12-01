"use client";
// Force HMR Update

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion, Timestamp, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { RepairTicket, RepairStatus, Product } from "../../../types";
import { logActivity } from "../../../utils/logger";
import ConfirmationModal from "../../components/ConfirmationModal";
import toast from "react-hot-toast";

export default function RepairDashboard() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [tickets, setTickets] = useState<RepairTicket[]>([]);
    const [filter, setFilter] = useState<RepairStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Modal State
    const [status, setStatus] = useState<RepairStatus>('pending');
    const [technicianNote, setTechnicianNote] = useState("");
    const [completionImage, setCompletionImage] = useState<File | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inventory State for Spare Parts
    const [inventory, setInventory] = useState<Product[]>([]);
    const [selectedPartId, setSelectedPartId] = useState("");
    const [useQuantity, setUseQuantity] = useState(1);
    const [isRequisitioning, setIsRequisitioning] = useState(false);
    const [isUsePartConfirmOpen, setIsUsePartConfirmOpen] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user || (role !== 'admin' && role !== 'technician')) {
                router.push("/");
            }
        }
    }, [user, role, loading, router]);

    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, "repair_tickets"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ticketsList: RepairTicket[] = [];
            snapshot.forEach((doc) => {
                ticketsList.push({ id: doc.id, ...doc.data() } as RepairTicket);
            });
            setTickets(ticketsList);
        });

        // Fetch Inventory for Spare Parts
        const inventoryQ = query(collection(db, "products"));
        const unsubInventory = onSnapshot(inventoryQ, (snapshot) => {
            const items: Product[] = [];
            snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as Product);
            });
            setInventory(items.filter(i => i.type === 'bulk' && (i.quantity || 0) > 0));
        });

        return () => {
            unsubscribe();
            unsubInventory();
        };
    }, [user]);

    const handleOpenModal = (ticket: RepairTicket) => {
        setSelectedTicket(ticket);
        setStatus(ticket.status);
        setTechnicianNote(ticket.technicianNote || "");
        setCompletionImage(null);
        setIsModalOpen(true);
        setSelectedPartId("");
        setUseQuantity(1);
    };

    const handleUsePartClick = () => {
        if (!selectedPartId || !selectedTicket?.id) return;
        const part = inventory.find(p => p.id === selectedPartId);
        if (!part) return;

        if (useQuantity <= 0 || useQuantity > (part.quantity || 0)) {
            toast.error(`Invalid quantity. Available: ${part.quantity}`);
            return;
        }
        setIsUsePartConfirmOpen(true);
    };

    const confirmUsePart = async () => {
        if (!selectedPartId || !selectedTicket?.id) return;

        const part = inventory.find(p => p.id === selectedPartId);
        if (!part) return;

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
                userName: user?.displayName || "Technician",
                details: `Used ${useQuantity} for Ticket #${selectedTicket.id?.slice(0, 5)}`,
                imageUrl: part.imageUrl
            });

            toast.success(`Successfully used ${useQuantity} x ${part.name}.`);
            setSelectedPartId("");
            setUseQuantity(1);

        } catch (error) {
            console.error("Error using part:", error);
            toast.error("Failed to process requisition.");
        } finally {
            setIsRequisitioning(false);
        }
    };

    const handleUpdateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTicket?.id) return;

        if (status === 'completed' && (!technicianNote || (!selectedTicket.completionImage && !completionImage))) {
            toast.error("Technician Note and Completion Image are required to complete a ticket.");
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
                technicianName: user?.displayName || 'Technician',
                completionImage: completionImageUrl || null,
                updatedAt: serverTimestamp()
            });

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

            toast.success("Ticket updated successfully");
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error updating ticket:", error);
            toast.error("Failed to update ticket.");
        } finally {
            setIsUpdating(false);
        }
    };

    // Filter Logic
    const filteredTickets = tickets.filter(t => {
        const matchesFilter = filter === 'all' || t.status === filter;
        const matchesSearch =
            (t.room || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.requesterName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Stats Calculation
    const stats = {
        total: tickets.length,
        pending: tickets.filter(t => t.status === 'pending').length,
        inProgress: tickets.filter(t => t.status === 'in_progress' || t.status === 'waiting_parts').length,
        completed: tickets.filter(t => t.status === 'completed').length
    };

    // Localization Helpers
    const getThaiStatus = (s: RepairStatus) => {
        switch (s) {
            case 'pending': return 'รอดำเนินการ';
            case 'in_progress': return 'กำลังดำเนินการ';
            case 'waiting_parts': return 'รออะไหล่';
            case 'completed': return 'เสร็จสิ้น';
            case 'cancelled': return 'ยกเลิกงาน';
            default: return s;
        }
    };

    const getStatusColor = (s: RepairStatus) => {
        switch (s) {
            case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
            case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'waiting_parts': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
            case 'completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
            default: return 'bg-slate-500/10 text-slate-600';
        }
    };

    if (loading || !user || (role !== 'admin' && role !== 'technician')) return null;

    return (
        <div className="animate-fade-in pb-20">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header & Stats */}
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-text mb-1">ระบบงานซ่อม</h1>
                            <p className="text-text-secondary">จัดการและติดตามรายการแจ้งซ่อม</p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center text-2xl shadow-sm text-gray-500">
                            📋
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary">ทั้งหมด</p>
                            <p className="text-3xl font-bold text-text">{stats.total}</p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-2xl shadow-sm text-amber-500">
                            ⏳
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary">รอดำเนินการ</p>
                            <p className="text-3xl font-bold text-text">{stats.pending}</p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-2xl shadow-sm text-blue-500">
                            ⚙️
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary">กำลังดำเนินการ</p>
                            <p className="text-3xl font-bold text-text">{stats.inProgress}</p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-2xl shadow-sm text-emerald-500">
                            ✅
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-secondary">เสร็จสิ้น</p>
                            <p className="text-3xl font-bold text-text">{stats.completed}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-sm max-w-7xl mx-auto mt-8">
                {/* Search */}
                <div className="relative w-full lg:w-96">
                    <input
                        type="text"
                        placeholder="ค้นหา (ห้อง, ผู้แจ้ง, อาการ)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-text focus:outline-none focus:border-cyan-500/50 transition-all"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">🔍</div>
                </div>

                {/* Filters & Toggle */}
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
                    <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
                        {[
                            { id: 'all', label: 'ทั้งหมด' },
                            { id: 'pending', label: 'รอดำเนินการ' },
                            { id: 'in_progress', label: 'กำลังดำเนินการ' },
                            { id: 'waiting_parts', label: 'รออะไหล่' },
                            { id: 'completed', label: 'เสร็จสิ้น' },
                            { id: 'cancelled', label: 'ยกเลิก' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filter === tab.id
                                    ? 'bg-cyan-500 text-white shadow-md'
                                    : 'bg-background border border-border text-text-secondary hover:bg-border/50'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex bg-background border border-border rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-card shadow-sm text-cyan-600' : 'text-text-secondary hover:text-text'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-card shadow-sm text-cyan-600' : 'text-text-secondary hover:text-text'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-7xl mx-auto mt-8">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredTickets.map((ticket) => (
                            <div key={ticket.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-lg text-text">{ticket.room}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(ticket.status)}`}>
                                        {getThaiStatus(ticket.status)}
                                    </span>
                                </div>

                                <div className="flex gap-3">
                                    {ticket.images && ticket.images.length > 0 ? (
                                        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-background border border-border">
                                            <img src={ticket.images[0]} alt="Thumbnail" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-background border border-border flex items-center justify-center text-2xl">🔧</div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-text font-medium line-clamp-2 mb-1">{ticket.description}</p>
                                        <p className="text-xs text-text-secondary truncate">👤 {ticket.requesterName}</p>
                                        <p className="text-xs text-text-secondary truncate">📅 {ticket.createdAt?.toDate().toLocaleDateString('th-TH')}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOpenModal(ticket)}
                                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold transition-colors mt-auto"
                                >
                                    จัดการคำขอซ่อม
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-background border-b border-border text-text-secondary font-medium">
                                    <tr>
                                        <th className="px-6 py-4">สถานะ</th>
                                        <th className="px-6 py-4">วันที่แจ้ง</th>
                                        <th className="px-6 py-4">ห้อง/สถานที่</th>
                                        <th className="px-6 py-4">อาการเสีย</th>
                                        <th className="px-6 py-4">ผู้แจ้ง</th>
                                        <th className="px-6 py-4 text-right">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredTickets.map((ticket) => (
                                        <tr key={ticket.id} className="hover:bg-background/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(ticket.status)}`}>
                                                    {getThaiStatus(ticket.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-text-secondary">
                                                {ticket.createdAt?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-text">{ticket.room}</td>
                                            <td className="px-6 py-4 text-text max-w-xs truncate">{ticket.description}</td>
                                            <td className="px-6 py-4 text-text-secondary">{ticket.requesterName}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleOpenModal(ticket)}
                                                    className="text-cyan-600 hover:text-cyan-700 font-medium hover:underline"
                                                >
                                                    จัดการ
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {filteredTickets.length === 0 && (
                    <div className="text-center py-20 text-text-secondary">
                        ไม่พบรายการแจ้งซ่อม
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isModalOpen && selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 space-y-6">
                            <div className="flex justify-between items-start">
                                <h2 className="text-2xl font-bold text-text">จัดการใบแจ้งซ่อม</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-text-secondary hover:text-text">✕</button>
                            </div>

                            {/* Ticket Info */}
                            <div className="grid grid-cols-2 gap-4 text-sm text-text-secondary bg-background p-4 rounded-xl">
                                <div>
                                    <p className="text-text-secondary/70">ผู้แจ้ง</p>
                                    <p className="text-text">{selectedTicket?.requesterName}</p>
                                </div>
                                <div>
                                    <p className="text-text-secondary/70">ห้อง/สถานที่</p>
                                    <p className="text-text">{selectedTicket?.room}</p>
                                </div>
                                <div>
                                    <p className="text-text-secondary/70">เบอร์โทร</p>
                                    <p className="text-text">{selectedTicket?.phone}</p>
                                </div>
                                <div>
                                    <p className="text-text-secondary/70">วันที่แจ้ง</p>
                                    <p className="text-text">{selectedTicket?.createdAt?.toDate().toLocaleString('th-TH')}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-text-secondary/70">อาการเสีย</p>
                                    <p className="text-text">{selectedTicket?.description}</p>
                                </div>
                            </div>

                            {/* Images Carousel */}
                            {selectedTicket?.images && selectedTicket.images.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {selectedTicket.images.map((img, idx) => (
                                        <a key={idx} href={img} target="_blank" rel="noreferrer" className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden border border-border">
                                            <img src={img} alt={`Evidence ${idx}`} className="w-full h-full object-cover" />
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* Spare Parts / Requisition Section */}
                            <div className="border-t border-border pt-4">
                                <h3 className="text-sm font-bold text-text mb-2">เบิกใช้อะไหล่ (Spare Parts)</h3>

                                {selectedTicket?.partsUsed && selectedTicket.partsUsed.length > 0 && (
                                    <div className="mb-4 space-y-2">
                                        {selectedTicket.partsUsed.map((part, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-background px-3 py-2 rounded-lg text-sm">
                                                <span className="text-text">{part.name}</span>
                                                <span className="text-text-secondary">จำนวน: {part.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <label className="text-xs text-text-secondary mb-1 block">เลือกอะไหล่</label>
                                        <select
                                            value={selectedPartId}
                                            onChange={(e) => setSelectedPartId(e.target.value)}
                                            className="w-full px-4 py-2 rounded-xl bg-background border border-border text-text text-sm focus:outline-none focus:border-cyan-500/50"
                                        >
                                            <option value="" className="bg-card">เลือกรายการ...</option>
                                            {inventory.map(item => (
                                                <option key={item.id} value={item.id} className="bg-card">
                                                    {item.name} (คงเหลือ: {item.quantity})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-24">
                                        <label className="text-xs text-text-secondary mb-1 block">จำนวน</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={useQuantity}
                                            onChange={(e) => setUseQuantity(parseInt(e.target.value))}
                                            className="w-full px-4 py-2 rounded-xl bg-background border border-border text-text text-sm focus:outline-none focus:border-cyan-500/50"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleUsePartClick}
                                        disabled={!selectedPartId || isRequisitioning}
                                        className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all text-sm font-medium disabled:opacity-50 h-[38px]"
                                    >
                                        {isRequisitioning ? "..." : "เบิกของ"}
                                    </button>
                                </div>
                            </div>

                            {/* Technician Actions */}
                            <form onSubmit={handleUpdateTicket} className="space-y-4 border-t border-border pt-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">อัปเดตสถานะ</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as RepairStatus)}
                                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-text focus:outline-none focus:border-cyan-500/50"
                                    >
                                        <option value="pending" className="bg-card">รอดำเนินการ</option>
                                        <option value="in_progress" className="bg-card">กำลังดำเนินการ</option>
                                        <option value="waiting_parts" className="bg-card">รออะไหล่</option>
                                        <option value="completed" className="bg-card">เสร็จสิ้น</option>
                                        <option value="cancelled" className="bg-card">ยกเลิกงาน</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        หมายเหตุช่าง {status === 'completed' && <span className="text-red-400">*</span>}
                                    </label>
                                    <textarea
                                        value={technicianNote}
                                        onChange={(e) => setTechnicianNote(e.target.value)}
                                        rows={3}
                                        placeholder="รายละเอียดการซ่อม..."
                                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-text focus:outline-none focus:border-cyan-500/50 resize-none"
                                        required={status === 'completed'}
                                    />
                                </div>

                                {status === 'completed' && !selectedTicket?.completionImage && (
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1">
                                            รูปภาพหลังซ่อมเสร็จ <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={(e) => setCompletionImage(e.target.files?.[0] || null)}
                                            accept="image/*"
                                            className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-600 dark:file:text-cyan-400 hover:file:bg-cyan-500/20"
                                            required={!selectedTicket?.completionImage}
                                        />
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isUpdating}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50"
                                    >
                                        {isUpdating ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={isUsePartConfirmOpen}
                onClose={() => setIsUsePartConfirmOpen(false)}
                onConfirm={confirmUsePart}
                title="ยืนยันการเบิกอะไหล่"
                message={`คุณแน่ใจหรือไม่ที่จะเบิก ${useQuantity} ชิ้น ของ ${inventory.find(p => p.id === selectedPartId)?.name}?`}
                confirmText="ยืนยันเบิก"
            />
        </div>
    );
}
