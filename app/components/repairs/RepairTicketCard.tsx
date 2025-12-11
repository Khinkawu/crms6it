"use client";

import React from "react";
import { RepairTicket, RepairStatus } from "../../../types";
import { Wrench, User, Calendar } from "lucide-react";
import { getThaiStatus, getStatusColor } from "../../../hooks/useRepairAdmin";

interface RepairTicketCardProps {
    ticket: RepairTicket;
    onManage: (ticket: RepairTicket) => void;
    isReadOnly?: boolean;
}

export function RepairTicketCard({ ticket, onManage, isReadOnly = false }: RepairTicketCardProps) {
    return (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-all group stagger-item">
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
                    <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-background border border-border flex items-center justify-center text-text-secondary">
                        <Wrench size={24} />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-text font-medium line-clamp-2 mb-1">{ticket.description}</p>
                    <p className="text-xs text-text-secondary truncate flex items-center gap-1">
                        <User size={12} /> {ticket.requesterName}
                    </p>
                    <p className="text-xs text-text-secondary truncate flex items-center gap-1">
                        <Calendar size={12} /> {ticket.createdAt?.toDate().toLocaleDateString('th-TH')}
                    </p>
                </div>
            </div>

            {!isReadOnly ? (
                <button
                    onClick={() => onManage(ticket)}
                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold transition-colors mt-auto tap-scale"
                >
                    จัดการคำขอซ่อม
                </button>
            ) : (
                <button
                    onClick={() => onManage(ticket)}
                    className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold transition-colors mt-auto"
                >
                    ดูรายละเอียด
                </button>
            )}
        </div>
    );
}

interface RepairTicketListProps {
    tickets: RepairTicket[];
    onManage: (ticket: RepairTicket) => void;
    isReadOnly?: boolean;
}

export function RepairTicketList({ tickets, onManage, isReadOnly = false }: RepairTicketListProps) {
    return (
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
                        {tickets.map((ticket) => (
                            <tr key={ticket.id} className="hover:bg-background/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(ticket.status)}`}>
                                        {getThaiStatus(ticket.status)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-text-secondary whitespace-nowrap">
                                    {ticket.createdAt?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                                </td>
                                <td className="px-6 py-4 font-bold text-text whitespace-nowrap">{ticket.room}</td>
                                <td className="px-6 py-4 text-text max-w-xs truncate">{ticket.description}</td>
                                <td className="px-6 py-4 text-text-secondary whitespace-nowrap">{ticket.requesterName}</td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    {!isReadOnly ? (
                                        <button
                                            onClick={() => onManage(ticket)}
                                            className="text-cyan-600 hover:text-cyan-700 font-medium hover:underline"
                                        >
                                            จัดการ
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => onManage(ticket)}
                                            className="text-slate-500 hover:text-slate-700 font-medium hover:underline"
                                        >
                                            ดูรายละเอียด
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
