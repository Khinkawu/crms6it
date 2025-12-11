"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { toast } from "react-hot-toast";
import {
    Calendar, CheckCircle, XCircle, Clock, Trash2,
    Search, MapPin, User, Phone, FileText, ChevronRight, Edit
} from "lucide-react";
import ConfirmationModal from "../../components/ConfirmationModal";
import EditBookingModal from "../../components/EditBookingModal";

interface Booking {
    id: string;
    roomId: string;
    roomName: string;
    title: string;
    description: string;
    requesterName: string;
    position: string;
    department: string;
    phoneNumber: string;
    startTime: Timestamp;
    endTime: Timestamp;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    equipment: string[];
    attendees?: string;
    roomLayout?: string;
    roomLayoutDetails?: string;
    micCount?: string;
    attachments?: string[];
    ownEquipment?: string;
    createdAt: Timestamp;
}

export default function BookingManagement() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

    // Confirmation Modal State
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: 'status' | 'delete', id: string, payload?: any } | null>(null);
    const [confirmMessage, setConfirmMessage] = useState({ title: "", message: "", confirmText: "", isDangerous: false });

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
            return;
        }
        if (!loading && role !== 'admin' && role !== 'moderator') {
            toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
            router.push("/");
            return;
        }

        if (user) {
            const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const loaded: Booking[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Booking[];
                setBookings(loaded);
                setIsLoading(false);
            });
            return () => unsubscribe();
        }
    }, [user, role, loading, router]);

    const handleUpdateStatus = (id: string, newStatus: string) => {
        setConfirmAction({ type: 'status', id, payload: newStatus });
        setConfirmMessage({
            title: `ยืนยันการ${newStatus === 'approved' ? 'อนุมัติ' : newStatus === 'rejected' ? 'ไม่อนุมัติ' : 'เปลี่ยนสถานะ'}`,
            message: `คุณต้องการเปลี่ยนสถานะรายการนี้เป็น "${newStatus === 'approved' ? 'อนุมัติ' : newStatus === 'rejected' ? 'ไม่อนุมัติ' : 'รอพิจารณา'}" ใช่หรือไม่?`,
            confirmText: "ตกลง",
            isDangerous: newStatus === 'rejected'
        });
        setIsConfirmOpen(true);
    };

    const handleDelete = (id: string) => {
        setConfirmAction({ type: 'delete', id });
        setConfirmMessage({
            title: "ยืนยันการลบ",
            message: "คุณแน่ใจหรือไม่ที่จะลบรายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้",
            confirmText: "ลบรายการ",
            isDangerous: true
        });
        setIsConfirmOpen(true);
    };

    const handleEdit = (booking: Booking) => {
        setEditingBooking(booking);
        setIsEditModalOpen(true);
    };

    const executeConfirmAction = async () => {
        if (!confirmAction) return;

        try {
            if (confirmAction.type === 'status') {
                await updateDoc(doc(db, "bookings", confirmAction.id), {
                    status: confirmAction.payload
                });
                toast.success(`อัปเดตสถานะเรียบร้อย`);
            } else if (confirmAction.type === 'delete') {
                await deleteDoc(doc(db, "bookings", confirmAction.id));
                toast.success("ลบรายการจองเรียบร้อย");
            }
        } catch (error) {
            console.error("Error executing action:", error);
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsConfirmOpen(false);
            setConfirmAction(null);
        }
    };

    const filteredBookings = bookings
        .filter(b => {
            // Status Filter Logic
            if (filterStatus === 'rejected') {
                return b.status === 'rejected' || b.status === 'cancelled';
            }
            return b.status === filterStatus;
        })
        .filter(b =>
            b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.roomName.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const formatDate = (ts: Timestamp) => {
        if (!ts) return "";
        return ts.toDate().toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    if (loading || isLoading) {
        return <div className="p-8 text-center">กำลังโหลด...</div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-6 pb-20 animate-fade-in text-gray-900 dark:text-gray-100">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Calendar className="text-blue-600" /> จัดการการจองห้องประชุม
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        ตรวจสอบและจัดการรายการจองห้องประชุมทั้งหมด
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    {[
                        { id: 'pending', label: 'รออนุมัติ', icon: <Clock size={16} /> },
                        { id: 'approved', label: 'อนุมัติแล้ว', icon: <CheckCircle size={16} /> },
                        { id: 'rejected', label: 'ไม่อนุมัติ/ยกเลิก', icon: <XCircle size={16} /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterStatus(tab.id as any)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                                ${filterStatus === tab.id
                                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}
                            `}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="ค้นหา (หัวข้อ, ผู้จอง, ห้อง)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Booking List */}
            <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        <FileText size={48} className="mx-auto mb-3 opacity-20" />
                        <p>ไม่มีรายการจองในสถานะนี้</p>
                    </div>
                ) : (
                    filteredBookings.map(booking => (
                        <div
                            key={booking.id}
                            className={`
                                relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl p-0 shadow-sm border border-gray-100 dark:border-gray-700 
                                group hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300
                                ${booking.status === 'pending' ? 'border-l-4 border-l-yellow-400' :
                                    booking.status === 'approved' ? 'border-l-4 border-l-emerald-500' :
                                        'border-l-4 border-l-red-500'}
                            `}
                        >
                            <div className="p-5 flex flex-col lg:flex-row gap-6">

                                {/* Time & Room */}
                                <div className="lg:w-1/4 space-y-3">
                                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                            <MapPin size={20} />
                                        </div>
                                        <span className="font-bold text-lg">{booking.roomName}</span>
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">เริ่ม:</span>
                                            <span className="font-semibold text-gray-700 dark:text-gray-200">{formatDate(booking.startTime)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">ถึง:</span>
                                            <span className="font-semibold text-gray-700 dark:text-gray-200">{formatDate(booking.endTime)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-tight group-hover:text-blue-600 transition-colors">
                                            {booking.title}
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 leading-relaxed">
                                            {booking.description || "-"}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
                                        <div className="flex items-center gap-2">
                                            <User size={16} className="text-gray-400" />
                                            <span className="font-medium">{booking.requesterName}</span>
                                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">{booking.position}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone size={16} className="text-gray-400" />
                                            <span>{booking.phoneNumber}</span>
                                        </div>
                                    </div>

                                    {/* Equipment & Layout Chips */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {booking.attendees && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                                👥 {booking.attendees} คน
                                            </span>
                                        )}
                                        {booking.roomLayout && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                🪑 {booking.roomLayout === 'u_shape' ? 'ตัว U' :
                                                    booking.roomLayout === 'classroom' ? 'แถวหน้ากระดาน' :
                                                        booking.roomLayout === 'empty' ? 'โล่ง' : 'อื่นๆ'}
                                            </span>
                                        )}
                                        {booking.equipment.filter(eq => !eq.includes('ไมค์')).map((eq, i) => (
                                            <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                🔹 {eq}
                                            </span>
                                        ))}
                                        {/* Handle Mic specially to combine with count */}
                                        {(() => {
                                            const micItem = booking.equipment.find(eq => eq.includes('ไมค์'));
                                            if (micItem || booking.micCount) {
                                                return (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                                        🎤 {micItem || 'ไมค์'} {booking.micCount ? `${booking.micCount} ตัว` : ''}
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="lg:w-48 flex flex-wrap lg:flex-col gap-2 lg:gap-3 justify-start lg:justify-center border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6 mt-2 lg:mt-0">
                                    {booking.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => handleUpdateStatus(booking.id, 'approved')}
                                                className="shrink-0 py-2 px-3 lg:py-2.5 lg:px-4 lg:w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 text-sm lg:text-base transition-all shadow-sm shadow-emerald-200 dark:shadow-none hover:shadow-md hover:scale-[1.02] active:scale-95"
                                            >
                                                <CheckCircle size={16} className="lg:w-[18px] lg:h-[18px]" /> อนุมัติ
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(booking.id, 'rejected')}
                                                className="shrink-0 py-2 px-3 lg:py-2.5 lg:px-4 lg:w-full rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold flex items-center justify-center gap-2 text-sm lg:text-base transition-all hover:shadow-sm active:scale-95"
                                            >
                                                <XCircle size={16} className="lg:w-[18px] lg:h-[18px]" /> ไม่อนุมัติ
                                            </button>
                                        </>
                                    )}

                                    {booking.status === 'approved' && (
                                        <button
                                            onClick={() => handleUpdateStatus(booking.id, 'pending')}
                                            className="shrink-0 py-2 px-3 lg:py-2.5 lg:px-4 lg:w-full rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium flex items-center justify-center gap-2 text-sm lg:text-base transition-colors active:scale-95"
                                        >
                                            <Clock size={16} className="lg:w-[18px] lg:h-[18px]" /> รอพิจารณา
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleEdit(booking)}
                                        className="shrink-0 py-2 px-3 lg:py-2.5 lg:px-4 lg:w-full rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 font-medium flex items-center justify-center gap-2 text-sm lg:text-base transition-colors active:scale-95"
                                    >
                                        <Edit size={16} className="lg:w-[18px] lg:h-[18px]" /> แก้ไข
                                    </button>

                                    <button
                                        onClick={() => handleDelete(booking.id)}
                                        className="shrink-0 p-2 lg:p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors lg:mt-auto"
                                        title="ลบรายการ"
                                    >
                                        <Trash2 size={18} className="lg:w-5 lg:h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={executeConfirmAction}
                title={confirmMessage.title}
                message={confirmMessage.message}
                confirmText={confirmMessage.confirmText}
                isDangerous={confirmMessage.isDangerous}
            />

            {editingBooking && (
                <EditBookingModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    booking={editingBooking}
                    onUpdate={() => {
                        // Refresh logic if needed, usually onSnapshot handles it, but good to close modal
                    }}
                />
            )}
        </div >
    );
}
