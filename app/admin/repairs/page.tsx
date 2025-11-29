"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { RepairTicket, RepairStatus, Product } from "../../../types";
import { logActivity } from "../../../utils/logger";

export default function RepairDashboard() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [tickets, setTickets] = useState<RepairTicket[]>([]);
    const [filter, setFilter] = useState<RepairStatus | 'all'>('all');
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

        // Fetch Inventory for Spare Parts (Real-time not strictly necessary but good)
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

    const handleUsePart = async () => {
        if (!selectedPartId || !selectedTicket?.id) return;

        const part = inventory.find(p => p.id === selectedPartId);
        if (!part) return;

        if (useQuantity <= 0 || useQuantity > (part.quantity || 0)) {
            alert(`Invalid quantity. Available: ${part.quantity}`);
            return;
        }

        if (confirm(`Confirm usage of ${useQuantity} unit(s) of ${part.name}? This will deduct from inventory.`)) {
            setIsRequisitioning(true);
            try {
                // 1. Decrement Inventory
                const productRef = doc(db, "products", selectedPartId);
                const newQuantity = (part.quantity || 0) - useQuantity;

                await updateDoc(productRef, {
                    quantity: newQuantity,
                    status: newQuantity === 0 ? 'requisitioned' : 'available' // Update status if out of stock
                });

                // 2. Update Ticket (Add to partsUsed array)
                const ticketRef = doc(db, "repair_tickets", selectedTicket.id);

                await updateDoc(ticketRef, {
                    partsUsed: arrayUnion({
                        name: part.name,
                        quantity: useQuantity,
                        date: new Date() // Will be converted to Timestamp by Firestore if passed as Date, or use Timestamp.now()
                    }),
                    updatedAt: serverTimestamp()
                });

                // 3. Log Activity
                await logActivity({
                    action: 'requisition',
                    productName: part.name,
                    userName: user?.displayName || "Technician",
                    details: `Used ${useQuantity} for Ticket #${selectedTicket.id?.slice(0, 5)}`,
                    imageUrl: part.imageUrl
                });

                alert(`Successfully used ${useQuantity} x ${part.name}.`);
                setSelectedPartId("");
                setUseQuantity(1);

            } catch (error) {
                console.error("Error using part:", error);
                alert("Failed to process requisition.");
            } finally {
                setIsRequisitioning(false);
            }
        }
    };

    const handleUpdateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTicket?.id) return;

        if (status === 'completed' && (!technicianNote || (!selectedTicket.completionImage && !completionImage))) {
            alert("Technician Note and Completion Image are required to complete a ticket.");
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
                completionImage: completionImageUrl || null,
                updatedAt: serverTimestamp()
            });

            // Trigger Notification if Completed
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
                    // Don't block the UI update even if notification fails
                }
            }

            setIsModalOpen(false);
        } catch (error) {
            console.error("Error updating ticket:", error);
            alert("Failed to update ticket.");
        } finally {
            setIsUpdating(false);
        }
    };

    const filteredTickets = filter === 'all'
        ? tickets
        : tickets.filter(t => t.status === filter);

    const getStatusColor = (s: RepairStatus) => {
        switch (s) {
            case 'pending': return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30';
            case 'in_progress': return 'bg-blue-500/20 text-blue-200 border-blue-500/30';
            case 'waiting_parts': return 'bg-orange-500/20 text-orange-200 border-orange-500/30';
            case 'completed': return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30';
            case 'cancelled': return 'bg-red-500/20 text-red-200 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-200';
        }
    };

    if (loading || !user || (role !== 'admin' && role !== 'technician')) return null;

    return (
        <div className="animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-text mb-2">Repair Dashboard</h1>
                        <p className="text-text-secondary">Manage and track repair requests.</p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-2">
                    {['all', 'pending', 'in_progress', 'waiting_parts', 'completed', 'cancelled'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === f
                                ? 'bg-primary-start text-white shadow-lg scale-105'
                                : 'bg-card border border-border text-text-secondary hover:bg-border/50 hover:text-text'
                                }`}
                        >
                            {f.replace('_', ' ').toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Ticket Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTickets.map((ticket) => (
                        <div key={ticket.id} className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 group hover:shadow-md transition-all">

                            {/* Header: Status & Room */}
                            <div className="flex justify-between items-start">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(ticket.status)}`}>
                                    {ticket.status.replace('_', ' ').toUpperCase()}
                                </span>
                                <span className="text-text font-semibold">{ticket.room}</span>
                            </div>

                            {/* Thumbnail */}
                            {ticket.images && ticket.images.length > 0 && (
                                <div className="h-40 rounded-lg overflow-hidden bg-background">
                                    <img src={ticket.images[0]} alt="Problem" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                </div>
                            )}

                            {/* Details */}
                            <div className="flex-1">
                                <p className="text-text font-medium line-clamp-2 mb-2">{ticket.description}</p>
                                <div className="text-xs text-text-secondary space-y-1">
                                    <p>👤 {ticket.requesterName}</p>
                                    <p>📅 {ticket.createdAt?.toDate().toLocaleDateString()} {ticket.createdAt?.toDate().toLocaleTimeString()}</p>
                                </div>
                            </div>

                            {/* Action */}
                            <button
                                onClick={() => handleOpenModal(ticket)}
                                className="w-full py-2 rounded-lg bg-background border border-border text-text hover:bg-border/50 transition-all text-sm font-medium"
                            >
                                Manage Ticket
                            </button>
                        </div>
                    ))}
                </div>

                {filteredTickets.length === 0 && (
                    <div className="text-center py-20 text-text-secondary">
                        No tickets found.
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isModalOpen && selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 space-y-6">
                            <div className="flex justify-between items-start">
                                <h2 className="text-2xl font-bold text-text">Manage Ticket</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-text-secondary hover:text-text">✕</button>
                            </div>

                            {/* Ticket Info */}
                            <div className="grid grid-cols-2 gap-4 text-sm text-text-secondary bg-background p-4 rounded-xl">
                                <div>
                                    <p className="text-text-secondary/70">Requester</p>
                                    <p className="text-text">{selectedTicket.requesterName}</p>
                                </div>
                                <div>
                                    <p className="text-text-secondary/70">Room</p>
                                    <p className="text-text">{selectedTicket.room}</p>
                                </div>
                                <div>
                                    <p className="text-text-secondary/70">Phone</p>
                                    <p className="text-text">{selectedTicket.phone}</p>
                                </div>
                                <div>
                                    <p className="text-text-secondary/70">Date</p>
                                    <p className="text-text">{selectedTicket.createdAt?.toDate().toLocaleString()}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-text-secondary/70">Description</p>
                                    <p className="text-text">{selectedTicket.description}</p>
                                </div>
                            </div>

                            {/* Images Carousel */}
                            {selectedTicket.images && selectedTicket.images.length > 0 && (
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
                                <h3 className="text-sm font-bold text-text mb-2">Spare Parts / Materials Used</h3>

                                {/* List of Used Parts */}
                                {selectedTicket.partsUsed && selectedTicket.partsUsed.length > 0 && (
                                    <div className="mb-4 space-y-2">
                                        {selectedTicket.partsUsed.map((part, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-background px-3 py-2 rounded-lg text-sm">
                                                <span className="text-text">{part.name}</span>
                                                <span className="text-text-secondary">Qty: {part.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <label className="text-xs text-text-secondary mb-1 block">Select Part</label>
                                        <select
                                            value={selectedPartId}
                                            onChange={(e) => setSelectedPartId(e.target.value)}
                                            className="w-full px-4 py-2 rounded-xl bg-background border border-border text-text text-sm focus:outline-none focus:border-cyan-500/50"
                                        >
                                            <option value="" className="bg-card">Select...</option>
                                            {inventory.map(item => (
                                                <option key={item.id} value={item.id} className="bg-card">
                                                    {item.name} (Avail: {item.quantity})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-24">
                                        <label className="text-xs text-text-secondary mb-1 block">Quantity</label>
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
                                        onClick={handleUsePart}
                                        disabled={!selectedPartId || isRequisitioning}
                                        className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all text-sm font-medium disabled:opacity-50 h-[38px]"
                                    >
                                        {isRequisitioning ? "..." : "Use Part"}
                                    </button>
                                </div>
                            </div>

                            {/* Technician Actions */}
                            <form onSubmit={handleUpdateTicket} className="space-y-4 border-t border-border pt-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Update Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as RepairStatus)}
                                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-text focus:outline-none focus:border-cyan-500/50"
                                    >
                                        <option value="pending" className="bg-card">Pending</option>
                                        <option value="in_progress" className="bg-card">In Progress</option>
                                        <option value="waiting_parts" className="bg-card">Waiting Parts</option>
                                        <option value="completed" className="bg-card">Completed</option>
                                        <option value="cancelled" className="bg-card">Cancelled</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Technician Note {status === 'completed' && <span className="text-red-400">*</span>}
                                    </label>
                                    <textarea
                                        value={technicianNote}
                                        onChange={(e) => setTechnicianNote(e.target.value)}
                                        rows={3}
                                        placeholder="Details about the repair..."
                                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-text focus:outline-none focus:border-cyan-500/50 resize-none"
                                        required={status === 'completed'}
                                    />
                                </div>

                                {status === 'completed' && !selectedTicket.completionImage && (
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-1">
                                            Completion Photo <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={(e) => setCompletionImage(e.target.files?.[0] || null)}
                                            accept="image/*"
                                            className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-600 dark:file:text-cyan-400 hover:file:bg-cyan-500/20"
                                            required={!selectedTicket.completionImage}
                                        />
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isUpdating}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50"
                                    >
                                        {isUpdating ? "Updating..." : "Save Changes"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
