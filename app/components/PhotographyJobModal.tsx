"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, MapPin, User, Save, Check, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";
import { UserProfile } from "@/types";
import { useBookings } from "@/hooks/useBookings";
import moment from "moment";
import { createPhotographyFlexMessage } from "@/utils/flexMessageTemplates";

interface PhotographyJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    requesterId: string;
    photographers: UserProfile[];
}

export default function PhotographyJobModal({ isOpen, onClose, requesterId, photographers }: PhotographyJobModalProps) {
    const [title, setTitle] = useState("");
    const [location, setLocation] = useState("");
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [description, setDescription] = useState("");
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Import from Booking - extend range to 6 months to include more bookings
    const { events: bookings, loading: bookingsLoading } = useBookings({ filterApprovedOnly: true, monthsRange: 6 });
    const [selectedBookingId, setSelectedBookingId] = useState("");

    // Track which bookings already have photography jobs (assigned or completed)
    const [existingJobBookingIds, setExistingJobBookingIds] = useState<Set<string>>(new Set());

    // Fetch existing photography jobs to exclude from booking dropdown
    useEffect(() => {
        if (!isOpen) return;

        const fetchExistingJobs = async () => {
            try {
                const jobsRef = collection(db, "photography_jobs");
                // Fetch all jobs that are assigned or completed
                const snapshot = await getDocs(jobsRef);
                const usedBookingIds = new Set<string>();
                snapshot.forEach(doc => {
                    const data = doc.data();
                    // If job was created from a booking, we can track by title+date combo or a bookingId field
                    // For now, we'll exclude based on title matching
                    if (data.status === 'assigned' || data.status === 'completed') {
                        // Store a unique key: title + date
                        const dateStr = data.startTime?.toDate ? data.startTime.toDate().toISOString().split('T')[0] : '';
                        usedBookingIds.add(`${data.title}_${dateStr}`);
                    }
                });
                setExistingJobBookingIds(usedBookingIds);
            } catch (error) {
                console.error("Error fetching existing jobs:", error);
            }
        };
        fetchExistingJobs();
    }, [isOpen]);

    // Filter bookings that don't have jobs yet
    const availableBookings = bookings.filter(booking => {
        const bookingTitle = booking.title.split(' (')[0];
        const bookingDate = moment(booking.start).format('YYYY-MM-DD');
        const bookingKey = `${bookingTitle}_${bookingDate}`;
        // Filter: Must not have existing job AND must have requested a photographer
        return !existingJobBookingIds.has(bookingKey) && booking.needsPhotographer;
    });

    const handleImportBooking = (bookingId: string) => {
        setSelectedBookingId(bookingId);
        const booking = availableBookings.find(b => b.id === bookingId);
        if (booking) {
            setTitle(booking.title.split(' (')[0]);; // Remove room name if appended in hook
            setLocation(booking.roomName);
            setDate(moment(booking.start).format('YYYY-MM-DD'));
            setStartTime(moment(booking.start).format('HH:mm'));
            setEndTime(moment(booking.end).format('HH:mm'));
            setDescription(`ผู้จอง: ${booking.requesterName}`);
            toast.success("นำเข้าข้อมูลเรียบร้อย");
        }
    };

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !location || !date || !startTime || !endTime || assigneeIds.length === 0) {
            toast.error("กรุณากรอกข้อมูลให้ครบถ้วน และเลือกช่างภาพอย่างน้อย 1 คน");
            return;
        }

        setIsSubmitting(true);
        try {
            // Construct timestamps
            const startDateTime = new Date(`${date}T${startTime}`);
            const endDateTime = new Date(`${date}T${endTime}`);

            // Get assignee details
            const selectedPhotographers = photographers.filter(p => assigneeIds.includes(p.uid));
            const assigneeNames = selectedPhotographers.map(p => p.displayName);

            const jobData: Record<string, any> = {
                title,
                location,
                description,
                startTime: startDateTime,
                endTime: endDateTime,
                assigneeIds,
                assigneeNames,
                requesterId,
                status: 'assigned',
                createdAt: serverTimestamp(),
                isManualEntry: !selectedBookingId
            };

            // Only add bookingId if it exists (Firebase doesn't accept undefined)
            if (selectedBookingId) {
                jobData.bookingId = selectedBookingId;
            }

            await addDoc(collection(db, "photography_jobs"), jobData);

            // Send LINE notifications to all assigned photographers
            for (const photographer of selectedPhotographers) {
                if (photographer.lineUserId) {
                    // Use new professional Flex Message template
                    const flexMessage = createPhotographyFlexMessage({
                        title,
                        location,
                        date,
                        startTime,
                        endTime,
                        teamMembers: assigneeNames,
                        description,
                        appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://crms6it.vercel.app"
                    });

                    await fetch('/api/line/push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: photographer.lineUserId,
                            messages: [flexMessage]
                        })
                    }).catch(e => console.error("LINE Notify Error", e));
                }
            }

            toast.success(`มอบหมายงานให้ ${assigneeNames.length} คนเรียบร้อยแล้ว`);
            onClose();
            // Reset form
            setTitle("");
            setLocation("");
            setDate("");
            setStartTime("");
            setEndTime("");
            setDescription("");
            setAssigneeIds([]);
        } catch (error) {
            console.error("Error creating job:", error);
            toast.error("เกิดข้อผิดพลาดในการสร้างงาน");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
                        onClick={onClose}
                    />
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="p-2 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30">📸</span>
                                    มอบหมายงานถ่ายภาพ
                                </h2>
                                <button onClick={onClose}>
                                    <X size={24} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">

                                {/* Photographer Multi-Select */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                        <User size={16} />
                                        เลือกช่างภาพ (เลือกได้หลายคน)
                                        {assigneeIds.length > 0 && (
                                            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 rounded-full">
                                                เลือก {assigneeIds.length} คน
                                            </span>
                                        )}
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700">
                                        {photographers.length === 0 ? (
                                            <p className="text-sm text-gray-400 col-span-2 text-center py-4">ไม่พบช่างภาพในระบบ</p>
                                        ) : (
                                            photographers.map(p => (
                                                <label
                                                    key={p.uid}
                                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${assigneeIds.includes(p.uid)
                                                        ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                        } border`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={assigneeIds.includes(p.uid)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setAssigneeIds([...assigneeIds, p.uid]);
                                                            } else {
                                                                setAssigneeIds(assigneeIds.filter(id => id !== p.uid));
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                                    />
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {p.photoURL ? (
                                                            <img src={p.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                                                <User size={14} className="text-gray-500" />
                                                            </div>
                                                        )}
                                                        <div className="truncate">
                                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{p.displayName}</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({p.role})</span>
                                                        </div>
                                                    </div>
                                                    {assigneeIds.includes(p.uid) && (
                                                        <Check size={16} className="text-amber-600 dark:text-amber-400" />
                                                    )}
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Import Booking Section */}
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                                    <label className="block text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                        <Calendar size={16} />
                                        นำเข้าข้อมูลจากการจองห้อง (ถ้ามี)
                                    </label>
                                    <select
                                        value={selectedBookingId}
                                        onChange={(e) => handleImportBooking(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- เลือกรายการจองเพื่อเติมข้อมูลอัตโนมัติ --</option>
                                        {availableBookings
                                            .filter(b => moment(b.start).isSameOrAfter(moment(), 'day'))
                                            .sort((a, b) => a.start.getTime() - b.start.getTime())
                                            .map(b => (
                                                <option key={b.id} value={b.id}>
                                                    {moment(b.start).format('DD/MM/YY')} | {b.title}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่องาน/กิจกรรม</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-amber-500"
                                        placeholder="เช่น งานกีฬาสี, ประชุมผู้ปกครอง"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">สถานที่</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-amber-500"
                                            placeholder="ห้องประชุม, โดม"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วันที่</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="date"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-amber-500"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เวลาเริ่ม</label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ถึงเวลา</label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รายละเอียดเพิ่มเติม</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-amber-500 h-24 resize-none"
                                        placeholder="สิ่งที่ต้องเน้น, การแต่งกาย ฯลฯ"
                                    />
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                    >
                                        <Save size={18} />
                                        {isSubmitting ? 'กำลังบันทึก...' : 'มอบหมายงาน'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
