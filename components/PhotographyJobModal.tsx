"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, MapPin, User, Save, Check, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, serverTimestamp, getDocs, getDoc, doc, query, where, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import toast from "react-hot-toast";
import { UserProfile } from "@/types";
import { useBookings } from "@/hooks/useBookings";
import { format, isAfter, startOfDay } from "date-fns";

interface PhotographyJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    requesterId: string;
    photographers?: UserProfile[]; // Made optional - will fetch internally if not provided
}

export default function PhotographyJobModal({ isOpen, onClose, requesterId, photographers: externalPhotographers }: PhotographyJobModalProps) {
    const [title, setTitle] = useState("");
    const [location, setLocation] = useState("");
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [description, setDescription] = useState("");
    const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showInAgenda, setShowInAgenda] = useState(true); // Default: show in calendar
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Internal photographers state for when prop is not provided
    const [internalPhotographers, setInternalPhotographers] = useState<UserProfile[]>([]);
    const [loadingPhotographers, setLoadingPhotographers] = useState(false);

    // Use external photographers if provided, otherwise use internal
    const photographers = externalPhotographers || internalPhotographers;

    // Fetch photographers internally if not provided via props
    useEffect(() => {
        if (!isOpen || externalPhotographers) return;

        const fetchPhotographers = async () => {
            setLoadingPhotographers(true);
            try {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("isPhotographer", "==", true));
                const snapshot = await getDocs(q);
                const users: UserProfile[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.isPhotographer) {
                        users.push({ uid: doc.id, ...data } as UserProfile);
                    }
                });
                setInternalPhotographers(users);
            } catch (error) {
                console.error("Error fetching photographers:", error);
                toast.error("ไม่สามารถโหลดรายชื่อช่างภาพได้");
            } finally {
                setLoadingPhotographers(false);
            }
        };
        fetchPhotographers();
    }, [isOpen, externalPhotographers]);

    const [targetJobId, setTargetJobId] = useState<string | null>(null); // Track if we are updating an existing job

    // Import from Booking - extend range to 6 months to include more bookings
    const { events: bookings, loading: bookingsLoading } = useBookings({ filterApprovedOnly: true, monthsRange: 6 });
    const [selectedSourceId, setSelectedSourceId] = useState("");

    // Track which bookings already have photography jobs (assigned or completed)
    const [existingJobBookingIds, setExistingJobBookingIds] = useState<Set<string>>(new Set());

    // New: Track pending photography jobs (from queue)
    const [pendingQueueJobs, setPendingQueueJobs] = useState<any[]>([]);

    // Fetch existing photography jobs to exclude from booking dropdown AND find pending queue jobs
    useEffect(() => {
        if (!isOpen) return;

        const fetchJobsData = async () => {
            try {
                const jobsRef = collection(db, "photography_jobs");

                const snapshot = await getDocs(jobsRef);

                const usedBookingIds = new Set<string>();
                const pendingQueue: any[] = [];

                snapshot.forEach(doc => {
                    const data = doc.data();

                    // 1. Track used bookings
                    if (data.bookingId) {
                        usedBookingIds.add(data.bookingId);
                    } else if (data.status === 'assigned' || data.status === 'completed') {
                        const dateStr = data.startTime?.toDate ? data.startTime.toDate().toISOString().split('T')[0] : '';
                        usedBookingIds.add(`${data.title}_${dateStr}`);
                    }

                    // 2. Find pending queue jobs
                    if (data.status === 'pending_assign') {
                        pendingQueue.push({ id: doc.id, ...data });
                    }
                });

                setExistingJobBookingIds(usedBookingIds);
                setPendingQueueJobs(pendingQueue);

            } catch (error) {
                console.error("Error fetching jobs data:", error);
            }
        };
        fetchJobsData();
    }, [isOpen]);

    // Filter bookings that don't have jobs yet AND are today or in the future
    const availableBookings = bookings
        .filter(booking => {
            const bookingTitle = booking.title.split(' (')[0];
            const bookingDate = format(booking.start, 'yyyy-MM-dd');
            const bookingKey = `${bookingTitle}_${bookingDate}`;

            // Filter: Must not have existing job AND must have requested a photographer
            // Check both ID and Key to be safe
            return !existingJobBookingIds.has(booking.id) && !existingJobBookingIds.has(bookingKey) && booking.needsPhotographer;
        })
        // Filter: Only show today or future bookings
        .filter(b => isAfter(b.start, startOfDay(new Date())) || format(b.start, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'))
        // Sort by date ascending
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    const handleImportSource = (sourceId: string) => {
        setSelectedSourceId(sourceId);
        setTargetJobId(null); // Reset target job ID (default to create new)

        // Case 1: Check if it's a Pending Queue Job
        const queueJob = pendingQueueJobs.find(j => j.id === sourceId);
        if (queueJob) {
            setTitle(queueJob.title);
            setLocation(queueJob.location);

            const start = queueJob.startTime?.toDate ? queueJob.startTime.toDate() : new Date();
            const end = queueJob.endTime?.toDate ? queueJob.endTime.toDate() : new Date();

            setDate(format(start, 'yyyy-MM-dd'));
            setStartTime(format(start, 'HH:mm'));
            setEndTime(format(end, 'HH:mm'));
            setDescription(queueJob.description || "");

            setTargetJobId(sourceId); // IMPORTANT: We will UPDATE this doc, not create new
            toast.success("ดึงข้อมูลจากคิวจองเรียบร้อย");
            return;
        }

        // Case 2: Check if it's a Room Booking
        const booking = availableBookings.find(b => b.id === sourceId);
        if (booking) {
            setTitle(booking.title.split(' (')[0]);
            setLocation(booking.roomName);
            setDate(format(booking.start, 'yyyy-MM-dd'));
            setStartTime(format(booking.start, 'HH:mm'));
            setEndTime(format(booking.end, 'HH:mm'));
            setDescription(`ผู้จอง: ${booking.requesterName}`);
            toast.success("นำเข้าข้อมูลจากการจองห้องเรียบร้อย");
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
                isManualEntry: !selectedSourceId,
                showInAgenda, // Display in calendar agenda
            };

            // Only add bookingId if it exists (Firebase doesn't accept undefined)
            if (selectedSourceId && !targetJobId) {
                // If it's a new job from a booking source, link it
                jobData.bookingId = selectedSourceId;
            }

            if (targetJobId) {
                // UPDATE existing job (Assigning a pending queue job)
                // Force status to 'assigned' when assigning
                await updateDoc(doc(db, "photography_jobs", targetJobId), { ...jobData, status: 'assigned' });
            } else {
                // CREATE new job (Manual or from Room Booking)
                await addDoc(collection(db, "photography_jobs"), jobData);
            }

            // In-app + FCM + LINE flex push to all assigned photographers
            const formattedDate = new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            const currentUser = auth.currentUser;
            if (currentUser) {
                currentUser.getIdToken().then(idToken => {
                    fetch('/api/notify-photo-assigned', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                        body: JSON.stringify({ assigneeIds, title, location, formattedDate, date, startTime, endTime, description, assigneeNames }),
                    }).catch(() => {});
                }).catch(() => {});
            }

            toast.success(`มอบหมายงานให้ ${assigneeNames.length} คนเรียบร้อยแล้ว`);
            onClose();
            // Reset form - including selectedBookingId and showInAgenda to prevent bugs
            setTitle("");
            setLocation("");
            setDate("");
            setStartTime("");
            setEndTime("");
            setDescription("");
            setAssigneeIds([]);
            setSelectedSourceId(""); // Reset to prevent stale bookingId on next job
            setShowInAgenda(true); // Reset to default
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
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="p-2 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30">📸</span>
                                    มอบหมายงานถ่ายภาพ
                                </h2>
                                <button onClick={onClose} aria-label="ปิด">
                                    <X size={24} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-hidden="true" />
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
                                        นำเข้าข้อมูล (จองห้อง / คิวรอจ่ายงาน)
                                    </label>
                                    <div className="relative z-20">
                                        <button
                                            type="button"
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-left text-sm focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                                        >
                                            <span className="truncate">
                                                {selectedSourceId ? (
                                                    (() => {
                                                        const qItem = pendingQueueJobs.find(j => j.id === selectedSourceId);
                                                        if (qItem) return `📸 ${qItem.title}`;

                                                        const bItem = availableBookings.find(b => b.id === selectedSourceId);
                                                        if (bItem) return `🏢 ${format(bItem.start, 'dd/MM/yy')} | ${bItem.title}`;

                                                        return "เลือกรายการ...";
                                                    })()
                                                ) : "-- เลือกรายการเพื่อเติมข้อมูล --"}
                                            </span>
                                            <Calendar size={16} className="text-gray-400 flex-shrink-0 ml-2" />
                                        </button>

                                        <AnimatePresence>
                                            {isDropdownOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="mt-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 shadow-inner max-h-60 overflow-y-auto">
                                                        {/* Queue Items */}
                                                        {pendingQueueJobs.length > 0 && (
                                                            <div className="py-1">
                                                                <div className="px-3 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                                                                    คิวจองช่างภาพ ({pendingQueueJobs.length})
                                                                </div>
                                                                {pendingQueueJobs.map(job => (
                                                                    <button
                                                                        key={job.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleImportSource(job.id);
                                                                            setIsDropdownOpen(false);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 truncate transition-colors"
                                                                        title={job.title}
                                                                    >
                                                                        📸 {job.title}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Booking Items */}
                                                        {availableBookings.length > 0 && (
                                                            <div className="py-1">
                                                                <div className="px-3 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                                                                    การจองห้อง ({availableBookings.length})
                                                                </div>
                                                                {availableBookings.map(b => (
                                                                    <button
                                                                        key={b.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleImportSource(b.id);
                                                                            setIsDropdownOpen(false);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 truncate transition-colors"
                                                                        title={`${format(b.start, 'dd/MM/yy')} | ${b.title}`}
                                                                    >
                                                                        🏢 <span className="font-medium">{format(b.start, 'dd/MM/yy')}</span> | {b.title}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Loading State */}
                                                        {bookingsLoading && (
                                                            <div className="px-4 py-3 text-sm text-blue-500 text-center flex items-center justify-center gap-2">
                                                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                                                กำลังโหลดรายการจอง...
                                                            </div>
                                                        )}

                                                        {!bookingsLoading && pendingQueueJobs.length === 0 && availableBookings.length === 0 && (
                                                            <div className="px-4 py-3 text-sm text-gray-500 text-center">ไม่มีรายการ</div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
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

                                <div className="space-y-3 sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0">
                                    <div className="min-w-0">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วันที่</label>
                                        <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                                            <input
                                                type="date"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className="w-full max-w-full h-[44px] pl-10 pr-3 bg-transparent text-xs focus:ring-2 focus:ring-amber-500 dark:[color-scheme:dark]"
                                                style={{ minWidth: 0 }}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เวลาเริ่ม</label>
                                        <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                                            <input
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                className="w-full max-w-full h-[44px] pl-10 pr-3 bg-transparent text-xs dark:[color-scheme:dark]"
                                                style={{ minWidth: 0 }}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ถึงเวลา</label>
                                        <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
                                            <input
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                className="w-full max-w-full h-[44px] pl-10 pr-3 bg-transparent text-xs dark:[color-scheme:dark]"
                                                style={{ minWidth: 0 }}
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

                                {/* Show in Agenda Checkbox */}
                                <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800/50">
                                    <input
                                        type="checkbox"
                                        id="showInAgenda"
                                        checked={showInAgenda}
                                        onChange={(e) => setShowInAgenda(e.target.checked)}
                                        className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <label htmlFor="showInAgenda" className="flex-1 cursor-pointer">
                                        <span className="text-sm font-medium text-purple-800 dark:text-purple-300 flex items-center gap-2">
                                            📅 แสดงในปฏิทิน (Agenda)
                                        </span>
                                        <span className="text-xs text-purple-600 dark:text-purple-400 block mt-0.5">
                                            ติ๊กเพื่อให้งานนี้ปรากฏในหน้า Dashboard ปฏิทิน
                                        </span>
                                    </label>
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
                                        className="px-6 py-2 rounded-xl bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-medium flex items-center gap-2 disabled:opacity-50"
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
