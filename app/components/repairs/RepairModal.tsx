"use client";

import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { RepairTicket, RepairStatus, Product } from "../../../types";
import { X, User, MapPin, Phone, Calendar, FileText, Package, Wrench, Camera, Save, Eraser, PenTool, Bot } from "lucide-react";
import { getThaiStatus, getStatusColor } from "../../../hooks/useRepairAdmin";

interface RepairModalProps {
    isOpen: boolean;
    ticket: RepairTicket | null;
    onClose: () => void;
    status: RepairStatus;
    setStatus: (s: RepairStatus) => void;
    technicianNote: string;
    setTechnicianNote: (n: string) => void;
    completionImage: File | null;
    setCompletionImage: (f: File | null) => void;
    inventory: Product[];
    selectedPartId: string;
    setSelectedPartId: (id: string) => void;
    useQuantity: number;
    setUseQuantity: (q: number) => void;
    onUsePart: (signatureDataUrl: string) => void;
    isRequisitioning: boolean;
    onSubmit: (e: React.FormEvent) => void;
    isUpdating: boolean;
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
    const partsSigPad = useRef<SignatureCanvas>(null);
    const [showSignature, setShowSignature] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Handler for parts requisition with signature
    const handleUsePartWithSignature = () => {
        if (!partsSigPad.current || partsSigPad.current.isEmpty()) {
            alert("กรุณาเซ็นลายมือชื่อก่อนเบิกอะไหล่");
            return;
        }
        const signatureDataUrl = partsSigPad.current.toDataURL("image/png");
        onUsePart(signatureDataUrl);
        // Clear signature after submit
        partsSigPad.current.clear();
        setShowSignature(false);
    };

    if (!isOpen || !ticket) return null;

    const statusOptions = [
        { value: 'pending', label: 'รอดำเนินการ', color: 'from-amber-500 to-orange-500' },
        { value: 'in_progress', label: 'กำลังดำเนินการ', color: 'from-blue-500 to-cyan-500' },
        { value: 'waiting_parts', label: 'รออะไหล่', color: 'from-purple-500 to-indigo-500' },
        { value: 'completed', label: 'เสร็จสิ้น', color: 'from-emerald-500 to-teal-500' },
        { value: 'cancelled', label: 'ยกเลิกงาน', color: 'from-gray-500 to-slate-500' },
    ];

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl overscroll-contain">

                    {/* Header */}
                    <div className="sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex justify-between items-center z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30">
                                <Wrench size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">จัดการใบแจ้งซ่อม</h2>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(ticket.status)}`}>
                                    {getThaiStatus(ticket.status)}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Ticket Info */}
                        <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-700/30 p-4 rounded-2xl">
                            <div className="flex items-start gap-2">
                                <User size={14} className="text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-medium text-gray-400 uppercase">ผู้แจ้ง</p>
                                    <p className="text-gray-900 dark:text-white font-medium">{ticket.requesterName}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <MapPin size={14} className="text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-medium text-gray-400 uppercase">ห้อง/สถานที่</p>
                                    <p className="text-gray-900 dark:text-white font-medium">{ticket.room}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <Phone size={14} className="text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-medium text-gray-400 uppercase">เบอร์โทร</p>
                                    <p className="text-gray-900 dark:text-white font-medium">{ticket.phone}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <Calendar size={14} className="text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-medium text-gray-400 uppercase">วันที่แจ้ง</p>
                                    <p className="text-gray-900 dark:text-white font-medium">{ticket.createdAt?.toDate().toLocaleString('th-TH')}</p>
                                </div>
                            </div>
                            {ticket.aiDiagnosis && (
                                <div className="col-span-2 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/10 p-2 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <div className="mt-0.5">
                                        <Bot size={14} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-blue-500 uppercase mb-0.5">ผลวิเคราะห์จาก AI</p>
                                        <p className="text-gray-700 dark:text-blue-100 text-sm">{ticket.aiDiagnosis}</p>
                                    </div>
                                </div>
                            )}
                            <div className="col-span-2 flex items-start gap-2">
                                <FileText size={14} className="text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-medium text-gray-400 uppercase">อาการเสีย (จากผู้แจ้ง)</p>
                                    <p className="text-gray-900 dark:text-white">{ticket.description}</p>
                                </div>
                            </div>
                        </div>

                        {/* Images */}
                        {ticket.images && ticket.images.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">รูปภาพประกอบ</p>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {ticket.images.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedImage(img)}
                                            className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 transition-all hover:scale-105 active:scale-95"
                                        >
                                            <img src={img} alt={`Evidence ${idx}`} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Spare Parts Section */}
                        {!isReadOnly && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800">
                                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-sm mb-3">
                                    <Package size={16} />
                                    เบิกใช้อะไหล่
                                </div>

                                {ticket.partsUsed && ticket.partsUsed.length > 0 && (
                                    <div className="mb-3 space-y-2">
                                        {ticket.partsUsed.map((part, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800 px-3 py-2 rounded-xl text-sm border border-emerald-100 dark:border-emerald-800">
                                                <span className="text-gray-900 dark:text-white font-medium">{part.name}</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">x{part.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <select
                                            value={selectedPartId}
                                            onChange={(e) => {
                                                setSelectedPartId(e.target.value);
                                                if (e.target.value) setShowSignature(true);
                                                else setShowSignature(false);
                                            }}
                                            className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                        >
                                            <option value="">เลือกอะไหล่...</option>
                                            {inventory.map(item => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name} (คงเหลือ: {item.quantity})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-20">
                                        <input
                                            type="number"
                                            min="1"
                                            value={useQuantity}
                                            onChange={(e) => setUseQuantity(parseInt(e.target.value))}
                                            className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-center"
                                        />
                                    </div>
                                </div>

                                {/* Signature Section */}
                                {showSignature && selectedPartId && (
                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                                <PenTool size={14} /> ลงลายมือชื่อผู้เบิก <span className="text-red-500">*</span>
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => partsSigPad.current?.clear()}
                                                className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
                                            >
                                                <Eraser size={12} /> ล้าง
                                            </button>
                                        </div>
                                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-white">
                                            <SignatureCanvas
                                                ref={partsSigPad}
                                                penColor="black"
                                                canvasProps={{
                                                    className: "w-full h-28"
                                                }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleUsePartWithSignature}
                                            disabled={!selectedPartId || isRequisitioning}
                                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all hover:shadow-xl tap-scale flex items-center justify-center gap-2"
                                        >
                                            {isRequisitioning ? "กำลังเบิก..." : `ยืนยันเบิก ${useQuantity} ชิ้น`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Technician Actions */}
                        {!isReadOnly && (
                            <form onSubmit={onSubmit} className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-5">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">อัปเดตสถานะ</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {statusOptions.map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setStatus(opt.value as RepairStatus)}
                                                className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all tap-scale ${status === opt.value
                                                    ? `bg-gradient-to-r ${opt.color} text-white shadow-lg`
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                        หมายเหตุช่าง {status === 'completed' && <span className="text-red-400">*</span>}
                                    </label>
                                    <textarea
                                        value={technicianNote}
                                        onChange={(e) => setTechnicianNote(e.target.value)}
                                        rows={3}
                                        placeholder="รายละเอียดการซ่อม..."
                                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none text-sm"
                                        required={status === 'completed'}
                                    />
                                </div>

                                {status === 'completed' && !ticket.completionImage && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                            รูปภาพหลังซ่อมเสร็จ <span className="text-red-400">*</span>
                                        </label>
                                        <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors cursor-pointer">
                                            <Camera size={18} />
                                            <span className="text-sm font-medium">{completionImage ? completionImage.name : 'เลือกรูปภาพ'}</span>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={(e) => setCompletionImage(e.target.files?.[0] || null)}
                                                accept="image/*"
                                                className="hidden"
                                                required={!ticket.completionImage}
                                            />
                                        </label>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isUpdating}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 tap-scale"
                                >
                                    <Save size={18} />
                                    {isUpdating ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Lightbox */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Full Preview"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}
        </>
    );
}
