"use client";

import React from "react";
import { RepairTicket } from "../../../types";
import { Wrench, User, Calendar, MapPin, ChevronRight, Clock } from "lucide-react";
import { getThaiStatus, getStatusColor } from "../../../hooks/useRepairAdmin";

interface RepairTicketCardProps {
    ticket: RepairTicket;
    onManage: (ticket: RepairTicket) => void;
    isReadOnly?: boolean;
}

export function RepairTicketCard({ ticket, onManage, isReadOnly = false }: RepairTicketCardProps) {
    // Get time since creation
    const getTimeAgo = () => {
        if (!ticket.createdAt?.toDate) return '';
        const now = new Date();
        const created = ticket.createdAt.toDate();
        const diffMs = now.getTime() - created.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'วันนี้';
        if (diffDays === 1) return 'เมื่อวาน';
        if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
        return ticket.createdAt.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    };

    return (
        <div
            onClick={() => onManage(ticket)}
            className="group relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-none transition-all duration-300 cursor-pointer"
        >
            {/* Status accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${ticket.status === 'pending' ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
                ticket.status === 'in_progress' ? 'bg-gradient-to-r from-blue-400 to-cyan-400' :
                    ticket.status === 'completed' ? 'bg-gradient-to-r from-emerald-400 to-teal-400' :
                        ticket.status === 'waiting_parts' ? 'bg-gradient-to-r from-purple-400 to-indigo-400' :
                            'bg-gradient-to-r from-gray-400 to-slate-400'
                }`}></div>

            <div className="p-4 pt-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                            <MapPin size={16} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{ticket.room}</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ticket.zone === 'senior_high' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                                    ticket.zone === 'junior_high' ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400' :
                                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                    }`}>
                                    {ticket.zone === 'senior_high' ? 'ม.ปลาย' : ticket.zone === 'junior_high' ? 'ม.ต้น' : 'ส่วนกลาง'}
                                </span>
                                <Clock size={10} />
                                <span>{getTimeAgo()}</span>
                            </div>
                        </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${getStatusColor(ticket.status)}`}>
                        {getThaiStatus(ticket.status)}
                    </span>
                </div>

                {/* Content */}
                <div className="flex gap-3">
                    {ticket.images && ticket.images.length > 0 ? (
                        <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                            <img src={ticket.images[0]} alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 flex-shrink-0 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400">
                            <Wrench size={20} />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-200 font-medium line-clamp-2 mb-2">{ticket.description}</p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <User size={12} />
                            <span className="truncate">{ticket.requesterName}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                        {ticket.createdAt?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                    <div className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                        {isReadOnly ? 'ดูรายละเอียด' : 'จัดการ'}
                        <ChevronRight size={14} />
                    </div>
                </div>
            </div>
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
        <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                            <th className="px-5 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">สถานะ</th>
                            <th className="px-5 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">วันที่แจ้ง</th>
                            <th className="px-5 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ห้อง/สถานที่</th>
                            <th className="px-5 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ฝั่ง</th>
                            <th className="px-5 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">อาการเสีย</th>
                            <th className="px-5 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ผู้แจ้ง</th>
                            <th className="px-5 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {tickets.map((ticket) => (
                            <tr
                                key={ticket.id}
                                onClick={() => onManage(ticket)}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer group"
                            >
                                <td className="px-5 py-4 whitespace-nowrap">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${getStatusColor(ticket.status)}`}>
                                        {getThaiStatus(ticket.status)}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap text-sm">
                                    {ticket.createdAt?.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                                </td>
                                <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{ticket.room}</td>
                                <td className="px-5 py-4 whitespace-nowrap">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ticket.zone === 'senior_high' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                                            ticket.zone === 'junior_high' ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400' :
                                                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                        }`}>
                                        {ticket.zone === 'senior_high' ? 'ม.ปลาย' : ticket.zone === 'junior_high' ? 'ม.ต้น' : 'ส่วนกลาง'}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-gray-700 dark:text-gray-200 max-w-xs truncate">{ticket.description}</td>
                                <td className="px-5 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{ticket.requesterName}</td>
                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                                        {isReadOnly ? 'ดูรายละเอียด' : 'จัดการ'}
                                        <ChevronRight size={14} />
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
