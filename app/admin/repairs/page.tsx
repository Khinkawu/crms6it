"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { RepairTicket, RepairStatus } from "../../../types";

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

        return () => unsubscribe();
    }, [user]);

    const handleOpenModal = (ticket: RepairTicket) => {
        setSelectedTicket(ticket);
        setStatus(ticket.status);
        setTechnicianNote(ticket.technicianNote || "");
        setCompletionImage(null);
        setIsModalOpen(true);
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
        <div className="min-h-screen p-4 md:p-8 animate-fade-in md:ml-64">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Repair Dashboard</h1>
                        <p className="text-white/60">Manage and track repair requests.</p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-2">
                    {['all', 'pending', 'in_progress', 'waiting_parts', 'completed', 'cancelled'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === f
                                ? 'bg-white text-blue-900 shadow-lg scale-105'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {f.replace('_', ' ').toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Ticket Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTickets.map((ticket) => (
                        <div key={ticket.id} className="glass-panel p-6 flex flex-col gap-4 group hover:bg-white/10 transition-all">

                            {/* Header: Status & Room */}
                            <div className="flex justify-between items-start">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(ticket.status)}`}>
                                    {ticket.status.replace('_', ' ').toUpperCase()}
                                </span>
                                <span className="text-white/80 font-semibold">{ticket.room}</span>
                            </div>

                            {/* Thumbnail */}
                            {ticket.images && ticket.images.length > 0 && (
                                <div className="h-40 rounded-lg overflow-hidden bg-black/20">
                                    <img src={ticket.images[0]} alt="Problem" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                </div>
                            )}

                            {/* Details */}
                            <div className="flex-1">
                                <p className="text-white font-medium line-clamp-2 mb-2">{ticket.description}</p>
                                <div className="text-xs text-white/40 space-y-1">
                                    <p>👤 {ticket.requesterName}</p>
                                    <p>📅 {ticket.createdAt?.toDate().toLocaleDateString()} {ticket.createdAt?.toDate().toLocaleTimeString()}</p>
                                </div>
                            </div>

                            {/* Action */}
                            <button
                                onClick={() => handleOpenModal(ticket)}
                                className="w-full py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/20 transition-all text-sm font-medium"
                            >
                                Manage Ticket
                            </button>
                        </div>
                    ))}
                </div>

                {filteredTickets.length === 0 && (
                    <div className="text-center py-20 text-white/30">
                        No tickets found.
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isModalOpen && selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 space-y-6">
                            <div className="flex justify-between items-start">
                                <h2 className="text-2xl font-bold text-white">Manage Ticket</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-white">✕</button>
                            </div>

                            {/* Ticket Info */}
                            <div className="grid grid-cols-2 gap-4 text-sm text-white/70 bg-white/5 p-4 rounded-xl">
                                <div>
                                    <p className="text-white/40">Requester</p>
                                    <p className="text-white">{selectedTicket.requesterName}</p>
                                </div>
                                <div>
                                    <p className="text-white/40">Room</p>
                                    <p className="text-white">{selectedTicket.room}</p>
                                </div>
                                <div>
                                    <p className="text-white/40">Phone</p>
                                    <p className="text-white">{selectedTicket.phone}</p>
                                </div>
                                <div>
                                    <p className="text-white/40">Date</p>
                                    <p className="text-white">{selectedTicket.createdAt?.toDate().toLocaleString()}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-white/40">Description</p>
                                    <p className="text-white">{selectedTicket.description}</p>
                                </div>
                            </div>

                            {/* Images Carousel */}
                            {selectedTicket.images && selectedTicket.images.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {selectedTicket.images.map((img, idx) => (
                                        <a key={idx} href={img} target="_blank" rel="noreferrer" className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden border border-white/10">
                                            <img src={img} alt={`Evidence ${idx}`} className="w-full h-full object-cover" />
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* Technician Actions */}
                            <form onSubmit={handleUpdateTicket} className="space-y-4 border-t border-white/10 pt-4">
                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-1">Update Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as RepairStatus)}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50"
                                    >
                                        <option value="pending" className="bg-slate-900">Pending</option>
                                        <option value="in_progress" className="bg-slate-900">In Progress</option>
                                        <option value="waiting_parts" className="bg-slate-900">Waiting Parts</option>
                                        <option value="completed" className="bg-slate-900">Completed</option>
                                        <option value="cancelled" className="bg-slate-900">Cancelled</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-1">
                                        Technician Note {status === 'completed' && <span className="text-red-400">*</span>}
                                    </label>
                                    <textarea
                                        value={technicianNote}
                                        onChange={(e) => setTechnicianNote(e.target.value)}
                                        rows={3}
                                        placeholder="Details about the repair..."
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cyan-500/50 resize-none"
                                        required={status === 'completed'}
                                    />
                                </div>

                                {status === 'completed' && !selectedTicket.completionImage && (
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-1">
                                            Completion Photo <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={(e) => setCompletionImage(e.target.files?.[0] || null)}
                                            accept="image/*"
                                            className="w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20"
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
