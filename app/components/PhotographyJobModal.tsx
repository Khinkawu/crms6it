"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, MapPin, User, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import toast from "react-hot-toast";
import { UserProfile } from "../../types";
import { useBookings, BookingEvent } from "../../hooks/useBookings";
import moment from "moment";

interface PhotographyJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    requesterId: string;
}

export default function PhotographyJobModal({ isOpen, onClose, requesterId }: PhotographyJobModalProps) {
    const [title, setTitle] = useState("");
    const [location, setLocation] = useState("");
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [description, setDescription] = useState("");
    const [assigneeId, setAssigneeId] = useState("");

    const [photographers, setPhotographers] = useState<UserProfile[]>([]);
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
    // Debug: log all bookings to check if they are loaded
    console.log('📌 All bookings:', bookings.length, bookings.map(b => ({ id: b.id, title: b.title, date: moment(b.start).format('YYYY-MM-DD') })));
    console.log('📌 Existing job booking IDs:', Array.from(existingJobBookingIds));

    const availableBookings = bookings.filter(booking => {
        // Match by booking title (without room name) and date
        const bookingTitle = booking.title.split(' (')[0];
        const bookingDate = moment(booking.start).format('YYYY-MM-DD');
        const bookingKey = `${bookingTitle}_${bookingDate}`;
        const isExcluded = existingJobBookingIds.has(bookingKey);
        console.log(`📌 Booking: ${bookingTitle} on ${bookingDate} - Excluded: ${isExcluded}`);
        return !isExcluded;
    });

    const handleImportBooking = (bookingId: string) => {
        setSelectedBookingId(bookingId);
        const booking = availableBookings.find(b => b.id === bookingId);
        if (booking) {
            setTitle(booking.title.split(' (')[0]); // Remove room name if appended in hook
            setLocation(booking.roomName);
            setDate(moment(booking.start).format('YYYY-MM-DD'));
            setStartTime(moment(booking.start).format('HH:mm'));
            setEndTime(moment(booking.end).format('HH:mm'));
            setDescription(`ผู้จอง: ${booking.requesterName}`);
            toast.success("นำเข้าข้อมูลเรียบร้อย");
        }
    };

    // Fetch potential photographers (Technicians, Admins, Moderators)
    // Ideally we filter by isPhotographer, but for now we fetch likely candidates
    useEffect(() => {
        if (isOpen) {
            const fetchUsers = async () => {
                try {
                    // Fetch all users and filter client-side for flexibility (or simplified query)
                    const usersRef = collection(db, "users");
                    const snapshot = await getDocs(usersRef);
                    const users: UserProfile[] = [];
                    snapshot.forEach(doc => {
                        const data = doc.data() as UserProfile;
                        // Filter: MUST be isPhotographer
                        if (data.isPhotographer) {
                            users.push({ ...data, uid: doc.id });
                        }
                    });
                    setPhotographers(users);
                } catch (error) {
                    console.error("Error fetching users:", error);
                }
            };
            fetchUsers();
        }
    }, [isOpen]);

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
        if (!title || !location || !date || !startTime || !endTime || !assigneeId) {
            toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
            return;
        }

        setIsSubmitting(true);
        try {
            // Constuct timestamps
            const startDateTime = new Date(`${date}T${startTime}`);
            const endDateTime = new Date(`${date}T${endTime}`);

            const assignee = photographers.find(u => u.uid === assigneeId);

            const jobData = {
                title,
                location,
                description,
                startTime: startDateTime,
                endTime: endDateTime,
                assigneeId,
                assigneeName: assignee?.displayName || 'Unknown',
                requesterId,
                status: 'assigned',
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, "photography_jobs"), jobData);

            // Trigger Notification (Mock or Real)
            // TODO: Call API to send LINE notification if assignee has lineUserId
            if (assignee?.lineUserId) {
                await fetch('/api/line/push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: assignee.lineUserId,
                        messages: [
                            {
                                type: "flex",
                                altText: "📸 มีงานถ่ายภาพใหม่",
                                contents: {
                                    type: "bubble",
                                    header: {
                                        type: "box",
                                        layout: "vertical",
                                        contents: [
                                            { type: "text", text: "📸 งานถ่ายภาพใหม่", weight: "bold", color: "#EAB308", size: "lg" }
                                        ]
                                    },
                                    body: {
                                        type: "box",
                                        layout: "vertical",
                                        contents: [
                                            { type: "text", text: title, weight: "bold", size: "xl", wrap: true },
                                            { type: "text", text: `📍 ${location}`, size: "sm", margin: "md" },
                                            { type: "text", text: `🗓 ${date} | ${startTime} - ${endTime}`, size: "sm" },
                                            { type: "text", text: description || "-", size: "sm", color: "#aaaaaa", wrap: true, margin: "md" }
                                        ]
                                    }
                                }
                            }
                        ]
                    })
                }).catch(e => console.error("LINE Notify Error", e));
            }

            toast.success("มอบหมายงานเรียบร้อยแล้ว");
            onClose();
            // Reset form
            setTitle("");
            setLocation("");
            setDate("");
            setStartTime("");
            setEndTime("");
            setDescription("");
            setAssigneeId("");
        } catch (error) {
            console.error("Error creating job:", error);
            toast.error("เกิดข้อผิดพลาดในการสร้างงาน");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

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
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ช่างภาพ</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <select
                                            value={assigneeId}
                                            onChange={(e) => setAssigneeId(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-amber-500"
                                            required
                                        >
                                            <option value="">เลือกช่างภาพ...</option>
                                            {photographers.map(p => (
                                                <option key={p.uid} value={p.uid}>{p.displayName} ({p.role})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Import Booking Section */}
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                                    <label className="block text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                                        <Calendar size={16} />
                                        นำเข้าข้อมูลจากการจองห้อง (อุปกรณ์เสริม)
                                    </label>
                                    <select
                                        value={selectedBookingId}
                                        onChange={(e) => handleImportBooking(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- เลือกรายการจองเพื่อเติมข้อมูลอัตโนมัติ --</option>
                                        {availableBookings
                                            .filter(b => moment(b.start).isSameOrAfter(moment(), 'day')) // Only future/today bookings
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
