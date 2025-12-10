"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, query, where, orderBy, getDocs, limit, doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Loader2, Wrench, Calendar, MapPin, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

export default function RepairHistory() {
    const { user } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.email) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "repair_tickets"),
            where("requesterEmail", "==", user.email),
            orderBy("createdAt", "desc"),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTickets(data);
            setLoading(false);
        }, (err) => {
            console.error("Firestore Error:", err);
            if (err.message.includes("index")) {
                setError("System requires an index update. Please contact admin.");
            } else {
                setError("Failed to load history: " + err.message);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold flex items-center gap-1"><Clock size={12} /> รอดำเนินการ</span>;
            case 'in_progress': return <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1"><Wrench size={12} /> กำลังซ่อม</span>;
            case 'waiting_parts': return <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold flex items-center gap-1"><AlertCircle size={12} /> รออะไหล่</span>;
            case 'completed': return <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center gap-1"><CheckCircle size={12} /> เสร็จสิ้น</span>;
            default: return <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">ไม่ทราบสถานะ</span>;
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-red-500 text-center">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (tickets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100 mx-4">
                <Wrench className="w-12 h-12 mb-3 opacity-20" />
                <p>ยังไม่มีประวัติการแจ้งซ่อม</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4 pb-24">
            {tickets.map((ticket) => (
                <div
                    key={ticket.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 active:scale-[0.99]"
                    onClick={() => toggleExpand(ticket.id)}
                >
                    <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 font-mono text-xs">#{ticket.id.slice(0, 5)}</span>
                                {getStatusBadge(ticket.status)}
                            </div>
                            <span className="text-xs text-gray-400">
                                {ticket.createdAt?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <h3 className="font-semibold text-gray-800 text-sm mb-1">{ticket.description}</h3>

                        <div className="flex items-center gap-1 text-gray-500 text-xs mb-3">
                            <MapPin size={12} />
                            <span>{ticket.room}</span>
                        </div>

                        {/* Image Preview Thumb (if any) */}
                        {ticket.images?.length > 0 && (
                            <div className="h-24 w-full bg-gray-50 rounded-lg overflow-hidden relative mb-3">
                                <img src={ticket.images[0]} alt="Problem" className="w-full h-full object-cover" />
                                {ticket.images.length > 1 && (
                                    <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md">
                                        +{ticket.images.length - 1}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Expandable Details */}
                        {expandedId === ticket.id && (
                            <div className="pt-3 border-t border-gray-50 mt-2 animate-fade-in space-y-3">
                                {ticket.technicianNote && (
                                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                        <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1">
                                            <Wrench size={12} /> ข้อความจากช่าง
                                        </p>
                                        <p className="text-xs text-emerald-800">{ticket.technicianNote}</p>
                                    </div>
                                )}

                                {ticket.partsUsed?.length > 0 && (
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <p className="text-xs font-bold text-gray-600 mb-1">🛠️ อะไหล่ที่ใช้</p>
                                        <ul className="text-xs text-gray-600 space-y-1">
                                            {ticket.partsUsed.map((part: any, idx: number) => (
                                                <li key={idx} className="flex justify-between">
                                                    <span>- {part.name}</span>
                                                    <span>x{part.quantity}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-center mt-2 group">
                            {expandedId === ticket.id ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
