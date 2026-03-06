"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, getDocs, where, Timestamp, getCountFromServer, limit } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { toast } from "react-hot-toast";
import {
    Calendar, CheckCircle, XCircle, Clock, Trash2,
    Search, MapPin, User, Phone, FileText, Edit, ChevronRight, Users as UsersIcon, Camera
} from "lucide-react";
import { Booking } from "../../../types";
import ConfirmationModal from "@/components/ConfirmationModal";
import EditBookingModal from "@/components/EditBookingModal";

// Local definition removed in favor of global type

export default function BookingManagement() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

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
            // ดึงเฉพาะ status ที่กำลังดูอยู่ + limit 50
            const statusFilter = filterStatus === 'rejected'
                ? where("status", "in", ["rejected", "cancelled"])
                : where("status", "==", filterStatus);

            const q = query(
                collection(db, "bookings"),
                statusFilter,
                orderBy("createdAt", "desc"),
                limit(50)
            );
            setIsLoading(true);
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
    }, [user, role, loading, router, filterStatus]);

    // ดึงยอดนับแต่ละ status จาก Firestore โดยไม่ต้องโหลด documents ทั้งหมด
    const fetchCounts = async () => {
        if (!user) return;
        const [pending, approved, rejected] = await Promise.all([
            getCountFromServer(query(collection(db, "bookings"), where("status", "==", "pending"))),
            getCountFromServer(query(collection(db, "bookings"), where("status", "==", "approved"))),
            getCountFromServer(query(collection(db, "bookings"), where("status", "in", ["rejected", "cancelled"]))),
        ]);
        setCounts({
            pending: pending.data().count,
            approved: approved.data().count,
            rejected: rejected.data().count,
        });
    };

    useEffect(() => {
        if (user) fetchCounts();
    }, [user]);

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
                // Check for conflicts before approving
                if (confirmAction.payload === 'approved') {
                    const booking = bookings.find(b => b.id === confirmAction.id);
                    if (booking?.startTime && booking?.endTime && booking?.roomId) {
                        // Firestore ไม่รองรับ range filter บน 2 fields ต่างกัน
                        // ใช้ startTime < endTime เดียว แล้ว filter endTime ที่ client
                        const conflictQuery = query(
                            collection(db, "bookings"),
                            where("roomId", "==", booking.roomId),
                            where("status", "==", "approved"),
                            where("startTime", "<", booking.endTime)
                        );
                        const conflicts = await getDocs(conflictQuery);
                        const bookingStartMs = (booking.startTime as Timestamp).toMillis();
                        const realConflicts = conflicts.docs.filter(d =>
                            d.id !== confirmAction.id &&
                            (d.data().endTime as Timestamp).toMillis() > bookingStartMs
                        );
                        if (realConflicts.length > 0) {
                            toast.error("ไม่สามารถอนุมัติได้ — ห้องนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว");
                            setIsConfirmOpen(false);
                            setConfirmAction(null);
                            return;
                        }
                    }
                }
                await updateDoc(doc(db, "bookings", confirmAction.id), {
                    status: confirmAction.payload
                });
                toast.success(`อัปเดตสถานะเรียบร้อย`);
            } else if (confirmAction.type === 'delete') {
                await deleteDoc(doc(db, "bookings", confirmAction.id));
                toast.success("ลบรายการจองเรียบร้อย");
            }
            fetchCounts();
        } catch (error) {
            console.error("Error executing action:", error);
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsConfirmOpen(false);
            setConfirmAction(null);
        }
    };

    // bookings ถูก filter ที่ Firestore แล้ว เหลือแค่ search filter ฝั่ง client
    const filteredBookings = bookings.filter(b =>
        b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.roomName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (ts: Timestamp) => {
        if (!ts) return "";
        return ts.toDate().toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const formatTime = (ts: Timestamp) => {
        if (!ts) return "";
        return ts.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    if (loading || isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-white rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {/* Header - Modern Style */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">จัดการการจอง</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">ตรวจสอบและจัดการรายการจองห้องประชุม</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Tabs - Wrap on mobile */}
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'pending', label: 'รออนุมัติ', icon: <Clock size={16} />, count: counts.pending },
                    { id: 'approved', label: 'อนุมัติแล้ว', icon: <CheckCircle size={16} />, count: counts.approved },
                    { id: 'rejected', label: 'ไม่อนุมัติ', icon: <XCircle size={16} />, count: counts.rejected },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilterStatus(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all tap-scale ${filterStatus === tab.id
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                            : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        {tab.icon}
                        {tab.label}
                        <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${filterStatus === tab.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-600'
                            }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="ค้นหา (หัวข้อ, ผู้จอง, ห้อง)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-gray-400/30 outline-none transition-all"
                />
            </div>

            {/* Booking List - Card Layout */}
            <div className="space-y-4">
                {filteredBookings.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                            <FileText size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">ไม่มีรายการจอง</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ไม่มีรายการจองในสถานะนี้</p>
                    </div>
                ) : (
                    filteredBookings.map(booking => (
                        <div
                            key={booking.id}
                            className="group relative overflow-hidden bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200"
                        >
                            {/* Status accent bar */}
                            <div className={`absolute top-0 left-0 right-0 h-0.5 ${booking.status === 'pending' ? 'bg-amber-400' :
                                booking.status === 'approved' ? 'bg-emerald-400' : 'bg-red-400'
                                }`}></div>

                            <div className="p-5 pt-6">
                                <div className="flex flex-col lg:flex-row gap-5">

                                    {/* Left: Room & Time */}
                                    <div className="lg:w-56 space-y-3 flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                                <MapPin size={18} />
                                            </div>
                                            <span className="font-bold text-gray-900 dark:text-white">{booking.roomName}</span>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-2 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500 dark:text-gray-400">เริ่ม</span>
                                                <span className="font-medium text-gray-900 dark:text-white">{formatDate(booking.startTime)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500 dark:text-gray-400">ถึง</span>
                                                <span className="font-medium text-gray-900 dark:text-white">{formatTime(booking.endTime)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Center: Details */}
                                    <div className="flex-1 min-w-0 space-y-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors truncate">
                                                {booking.title}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                                {booking.description || "-"}
                                            </p>
                                        </div>

                                        {/* Requester */}
                                        <div className="flex flex-wrap items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                <User size={14} className="text-gray-400" />
                                                <span className="font-medium">{booking.requesterName}</span>
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">{booking.position}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                                <Phone size={14} />
                                                <span>{booking.phoneNumber}</span>
                                            </div>
                                        </div>

                                        {/* Chips */}
                                        <div className="flex flex-wrap gap-2">
                                            {booking.attendees && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                                                    <UsersIcon size={12} />
                                                    {booking.attendees} คน
                                                </span>
                                            )}
                                            {booking.roomLayout && (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                                    🪑 {booking.roomLayout === 'u_shape' ? 'ตัว U' :
                                                        booking.roomLayout === 'classroom' ? 'แถวหน้ากระดาน' :
                                                            booking.roomLayout === 'empty' ? 'โล่ง' : 'อื่นๆ'}
                                                </span>
                                            )}
                                            {booking.equipment?.filter(eq => !eq.includes('ไมค์')).slice(0, 3).map((eq, i) => (
                                                <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                                    {eq}
                                                </span>
                                            ))}

                                            {/* Photographer Toggle Badge */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateDoc(doc(db, "bookings", booking.id), {
                                                        needsPhotographer: !booking.needsPhotographer
                                                    })
                                                    .then(() => toast.success(booking.needsPhotographer ? "Removed Photographer Request" : "Requested Photographer"))
                                                    .catch(() => toast.error("บันทึกไม่สำเร็จ"));
                                                }}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${booking.needsPhotographer
                                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100 hover:text-gray-700'
                                                    }`}
                                            >
                                                <Camera size={12} />
                                                {booking.needsPhotographer ? 'Needs Photographer' : 'No Photographer'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="lg:w-40 flex flex-row lg:flex-col flex-wrap gap-2 lg:justify-center pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 lg:pl-5">
                                        {booking.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateStatus(booking.id, 'approved')}
                                                    className="flex-1 lg:w-full py-2 px-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors tap-scale"
                                                >
                                                    <CheckCircle size={16} /> อนุมัติ
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(booking.id, 'rejected')}
                                                    className="flex-1 lg:w-full py-2 px-3 rounded-xl bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all tap-scale"
                                                >
                                                    <XCircle size={16} /> ไม่อนุมัติ
                                                </button>
                                            </>
                                        )}

                                        {booking.status === 'approved' && (
                                            <button
                                                onClick={() => handleUpdateStatus(booking.id, 'pending')}
                                                className="flex-1 lg:w-full py-2 px-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all tap-scale"
                                            >
                                                <Clock size={16} /> รอพิจารณา
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleEdit(booking)}
                                            className="flex-1 lg:w-full py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all tap-scale"
                                        >
                                            <Edit size={16} /> แก้ไข
                                        </button>

                                        <button
                                            onClick={() => handleDelete(booking.id)}
                                            className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            title="ลบรายการ"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
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
                    booking={{
                        ...editingBooking,
                        roomId: editingBooking.roomId || editingBooking.room || '', // Ensure string
                        id: editingBooking.id, // Explicitly pass required fields
                        title: editingBooking.title,
                        requesterName: editingBooking.requesterName,
                        department: editingBooking.department,
                        startTime: editingBooking.startTime,
                        endTime: editingBooking.endTime,
                        roomName: editingBooking.roomName || '',
                        description: editingBooking.description || '',
                        phoneNumber: editingBooking.phoneNumber || '',
                        status: editingBooking.status,
                        equipment: editingBooking.equipment || []
                    } as any}
                    onUpdate={() => { }}
                />
            )}
        </div>
    );
}
