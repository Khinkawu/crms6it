"use client";

import React, { useRef } from "react";
import { RepairTicket, RepairStatus, Product } from "../../../types";
import { X } from "lucide-react";
import { getThaiStatus, getStatusColor } from "../../../hooks/useRepairAdmin";

interface RepairModalProps {
    isOpen: boolean;
    ticket: RepairTicket | null;
    onClose: () => void;
    // Form state
    status: RepairStatus;
    setStatus: (s: RepairStatus) => void;
    technicianNote: string;
    setTechnicianNote: (n: string) => void;
    completionImage: File | null;
    setCompletionImage: (f: File | null) => void;
    // Spare parts
    inventory: Product[];
    selectedPartId: string;
    setSelectedPartId: (id: string) => void;
    useQuantity: number;
    setUseQuantity: (q: number) => void;
    onUsePart: () => void;
    isRequisitioning: boolean;
    // Actions
    onSubmit: (e: React.FormEvent) => void;
    isUpdating: boolean;
    // Role
    isReadOnly?: boolean;
}

export default function RepairModal({
    isOpen,
    ticket,
    onClose,
    status,
    setStatus,
    technicianNote,
    setTechnicianNote,
    completionImage,
    setCompletionImage,
    inventory,
    selectedPartId,
    setSelectedPartId,
    useQuantity,
    setUseQuantity,
    onUsePart,
    isRequisitioning,
    onSubmit,
    isUpdating,
    isReadOnly = false
}: RepairModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen || !ticket) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl overscroll-contain">
                <div className="p-6 space-y-6">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                        <h2 className="text-2xl font-bold text-text">จัดการใบแจ้งซ่อม</h2>
                        <button onClick={onClose} className="text-text-secondary hover:text-text">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Ticket Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm text-text-secondary bg-background p-4 rounded-xl">
                        <div>
                            <p className="text-text-secondary/70">ผู้แจ้ง</p>
                            <p className="text-text">{ticket.requesterName}</p>
                        </div>
                        <div>
                            <p className="text-text-secondary/70">ห้อง/สถานที่</p>
                            <p className="text-text">{ticket.room}</p>
                        </div>
                        <div>
                            <p className="text-text-secondary/70">เบอร์โทร</p>
                            <p className="text-text">{ticket.phone}</p>
                        </div>
                        <div>
                            <p className="text-text-secondary/70">วันที่แจ้ง</p>
                            <p className="text-text">{ticket.createdAt?.toDate().toLocaleString('th-TH')}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-text-secondary/70">อาการเสีย</p>
                            <p className="text-text">{ticket.description}</p>
                        </div>
                    </div>

                    {/* Images */}
                    {ticket.images && ticket.images.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {ticket.images.map((img, idx) => (
                                <a key={idx} href={img} target="_blank" rel="noreferrer" className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden border border-border">
                                    <img src={img} alt={`Evidence ${idx}`} className="w-full h-full object-cover" />
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Spare Parts Section */}
                    {!isReadOnly && (
                        <div className="border-t border-border pt-4">
                            <h3 className="text-sm font-bold text-text mb-2">เบิกใช้อะไหล่</h3>

                            {ticket.partsUsed && ticket.partsUsed.length > 0 && (
                                <div className="mb-4 space-y-2">
                                    {ticket.partsUsed.map((part, idx) => (
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
                                    onClick={onUsePart}
                                    disabled={!selectedPartId || isRequisitioning}
                                    className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all text-sm font-medium disabled:opacity-50 h-[38px]"
                                >
                                    {isRequisitioning ? "..." : "เบิกของ"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Technician Actions */}
                    {!isReadOnly && (
                        <form onSubmit={onSubmit} className="space-y-4 border-t border-border pt-4">
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

                            {status === 'completed' && !ticket.completionImage && (
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
                                        required={!ticket.completionImage}
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
                    )}
                </div>
            </div>
        </div>
    );
}
