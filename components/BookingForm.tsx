"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { collection, addDoc, query, where, getDocs, Timestamp, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import toast from "react-hot-toast";
import { Calendar, MapPin, Briefcase, Paperclip, CheckSquare, Loader2, Link as LinkIcon, Plus, X, Camera } from "lucide-react";
import { getTodayBangkok, getBangkokDateString } from "@/lib/dateUtils";

// Extracted components and config
import CustomSelect from "./ui/CustomSelect";
import TimeSelect from "./ui/TimeSelect";
import {
    ROOMS,
    ROOM_EQUIPMENT,
    POSITIONS,
    DEPARTMENTS,
    ROOM_LAYOUTS,
    getRoomById,
    getEquipmentForRoom
} from "@/config/bookingConfig";

interface BookingFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    initialDate?: Date;
    className?: string;
}


export default function BookingForm({ onSuccess, onCancel, initialDate, className = "" }: BookingFormProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [bookingType, setBookingType] = useState<'room' | 'photo'>('room');

    const [formData, setFormData] = useState({
        position: "",
        department: "",
        phoneNumber: "",
        roomZone: "junior_high",
        roomId: "",
        title: "",
        description: "",
        location: "", // Added for photo job
        date: initialDate ? getBangkokDateString(initialDate) : getTodayBangkok(),
        startTime: "08:00",
        endTime: "10:00",
        equipment: [] as string[],
        ownEquipment: "",
        attendees: "",
        roomLayout: "u_shape", // Default to classroom
        roomLayoutDetails: "",
        micCount: "",
        needsPhotographer: false,
    });

    // Attachment State
    const [hasAttachments, setHasAttachments] = useState(false);
    const [attachmentLinks, setAttachmentLinks] = useState<string[]>([""]);

    // Dynamic Equipment Options State
    const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);

    useEffect(() => {
        setAvailableEquipment(getEquipmentForRoom(formData.roomId));
    }, [formData.roomId]);

    // Auto-fill from user profile
    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.uid) return;
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setFormData(prev => ({
                        ...prev,
                        phoneNumber: data.phone || prev.phoneNumber,
                        position: data.position || prev.position,
                        department: data.department || prev.department,
                    }));
                }
            } catch { /* silent */ }
        };
        fetchProfile();
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Helper for CustomSelect updates
    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => {
            const updates: any = { [name]: value };

            // If changing room, reset equipment and mic count
            if (name === 'roomId') {
                updates.equipment = [];
                updates.micCount = "";
            }

            return { ...prev, ...updates };
        });
    };

    const handleCheckboxChange = (option: string) => {
        setFormData(prev => {
            const newEquipment = prev.equipment.includes(option)
                ? prev.equipment.filter(item => item !== option)
                : [...prev.equipment, option];

            // If removing all mics, clear mic count
            const hasMic = newEquipment.some(e => e.includes('ไมค์'));
            const micCount = hasMic ? prev.micCount : "";

            return { ...prev, equipment: newEquipment, micCount };
        });
    };

    const handleLinkChange = (index: number, value: string) => {
        const newLinks = [...attachmentLinks];
        newLinks[index] = value;
        setAttachmentLinks(newLinks);
    };

    const addLinkField = () => {
        setAttachmentLinks([...attachmentLinks, ""]);
    };

    const removeLinkField = (index: number) => {
        if (attachmentLinks.length > 1) {
            const newLinks = attachmentLinks.filter((_, i) => i !== index);
            setAttachmentLinks(newLinks);
        }
    };

    const checkTimeConflict = async (roomId: string, start: Date, end: Date) => {
        // Ultra-simplified query to completely avoid index requirements
        // We ONLY filter by roomId (equality), which uses default indexes.
        // All time and status filtering happens in memory.
        const q = query(
            collection(db, "bookings"),
            where("roomId", "==", roomId)
        );

        const snapshot = await getDocs(q);
        const conflicts = snapshot.docs.filter(doc => {
            const data = doc.data();
            const existingStart = data.startTime.toDate();
            const existingEnd = data.endTime.toDate();

            // Check status (only count active bookings)
            if (!['approved', 'pending'].includes(data.status)) return false;

            // Check time overlap: (StartA < EndB) and (EndA > StartB)
            return existingStart < end && existingEnd > start;
        });

        return conflicts.length > 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Common Validations
        if (!formData.position) {
            toast.error("กรุณาเลือกตำแหน่ง");
            return;
        }
        if (!formData.department) {
            toast.error("กรุณาเลือกฝ่ายงาน");
            return;
        }

        const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
        const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

        if (startDateTime >= endDateTime) {
            toast.error("เวลาสิ้นสุดต้องหลังจากเวลาเริ่มต้น");
            return;
        }

        setLoading(true);
        const toastId = toast.loading("กำลังตรวจสอบข้อมูล...");

        try {
            // 2. Prepare Links (Filter empty)
            const validLinks = hasAttachments ? attachmentLinks.filter(link => link.trim() !== "") : [];

            if (bookingType === 'room') {
                /* ================= SUBMIT ROOM BOOKING ================= */
                if (!formData.roomId) {
                    toast.error("กรุณาเลือกห้องประชุม");
                    setLoading(false);
                    return;
                }

                // Check Conflicts
                const hasConflict = await checkTimeConflict(formData.roomId, startDateTime, endDateTime);
                if (hasConflict) {
                    toast.error("ช่วงเวลานี้มีการจองแล้ว กรุณาเลือกเวลาใหม่", { id: toastId });
                    setLoading(false);
                    return;
                }

                toast.loading("กำลังบันทึกการจอง...", { id: toastId });

                const room = getRoomById(formData.roomId);
                const roomName = room?.name || formData.roomId;

                const bookingRef = await addDoc(collection(db, "bookings"), {
                    roomId: formData.roomId,
                    roomName: roomName,
                    requesterName: user?.displayName || user?.email || "Unknown",
                    requesterId: user?.uid,
                    requesterEmail: user?.email, // Added email for reference
                    position: formData.position,
                    department: formData.department,
                    phoneNumber: formData.phoneNumber,
                    title: formData.title,
                    description: formData.description,
                    startTime: Timestamp.fromDate(startDateTime),
                    endTime: Timestamp.fromDate(endDateTime),
                    equipment: formData.equipment,
                    ownEquipment: formData.ownEquipment,
                    attendees: formData.attendees,
                    roomLayout: formData.roomLayout,
                    roomLayoutDetails: formData.roomLayout === 'other' ? formData.roomLayoutDetails : '',
                    micCount: formData.equipment.some(e => e.includes("ไมค์")) ? formData.micCount : "",
                    attachments: validLinks,
                    needsPhotographer: formData.needsPhotographer,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                });

                // Notify admin/mod in-app
                const startLabel = startDateTime.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                user?.getIdToken().then(idToken => {
                    fetch('/api/notify-booking', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                        body: JSON.stringify({
                            bookingId: bookingRef.id,
                            title: formData.title,
                            roomName,
                            requesterName: user?.displayName || user?.email || 'Unknown',
                            startTime: startLabel,
                        }),
                    }).catch(() => {});
                }).catch(() => {});

                toast.success("จองห้องประชุมสำเร็จ!", { id: toastId });
            } else {
                /* ================= SUBMIT PHOTO JOB ================= */
                if (!formData.title) {
                    toast.error("กรุณาระบุชื่อกิจกรรม");
                    setLoading(false);
                    return;
                }
                if (!formData.location) {
                    toast.error("กรุณาระบุสถานที่");
                    setLoading(false);
                    return;
                }

                toast.loading("กำลังบันทึกการจองคิว...", { id: toastId });

                // Construct location string with Zone prefix
                const zonePrefix = formData.roomZone === 'junior_high' ? '[ม.ต้น] ' : formData.roomZone === 'senior_high' ? '[ม.ปลาย] ' : '[นอกสถานที่] ';
                const fullLocation = zonePrefix + formData.location;

                await addDoc(collection(db, "photography_jobs"), {
                    title: formData.title,
                    description: formData.description,
                    location: fullLocation,
                    startTime: Timestamp.fromDate(startDateTime),
                    endTime: Timestamp.fromDate(endDateTime),
                    assigneeIds: [], // Empty initially, Admin assigns later
                    status: 'pending_assign', // New Status: Pending Assignment
                    bookingId: `web-form-${Date.now()}`, // Flag to identify source from booking form

                    // Requester Info
                    requesterName: user?.displayName || user?.email || "Unknown",
                    requesterId: user?.uid,
                    requesterEmail: user?.email,
                    position: formData.position,
                    department: formData.department,
                    phoneNumber: formData.phoneNumber,

                    attachments: validLinks, // Optional links
                    createdAt: serverTimestamp(),
                });

                toast.success("จองคิวช่างภาพสำเร็จ!", { id: toastId });
            }

            if (onSuccess) onSuccess();

        } catch (error: any) {
            console.error("Booking Error:", error);
            toast.error(`เกิดข้อผิดพลาด: ${error.message}`, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="text-blue-600" /> จองห้องประชุม / จองคิวช่างภาพ
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">กรอกรายละเอียดเพื่อขอใช้บริการ</p>
            </div>

            {/* Form Content */}
            <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Booking Type Tabs */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6">
                        <button
                            type="button"
                            onClick={() => setBookingType('room')}
                            className={`py-2 px-4 rounded-lg text-sm font-bold transition-all ${bookingType === 'room'
                                ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                        >
                            🏢 จองห้องประชุม
                        </button>
                        <button
                            type="button"
                            onClick={() => setBookingType('photo')}
                            className={`py-2 px-4 rounded-lg text-sm font-bold transition-all ${bookingType === 'photo'
                                ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                        >
                            📸 จองคิวช่างภาพ
                        </button>
                    </div>

                    {/* Common Fields: Requester Info & Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ผู้จอง</label>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium h-[46px] flex items-center">
                                {user?.displayName || user?.email}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">เบอร์โทรศัพท์</label>
                            <input
                                type="tel"
                                name="phoneNumber"
                                value={formData.phoneNumber}
                                onChange={handleInputChange}
                                placeholder="0xx-xxx-xxxx"
                                className="w-full h-[46px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Common Fields: Position & Department */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ตำแหน่ง</label>
                            <CustomSelect
                                value={formData.position}
                                options={POSITIONS}
                                onChange={(val) => handleSelectChange("position", val)}
                                placeholder="กรุณาเลือก"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ฝ่ายงาน</label>
                            <CustomSelect
                                value={formData.department}
                                options={DEPARTMENTS}
                                onChange={(val) => handleSelectChange("department", val)}
                                placeholder="กรุณาเลือก"
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4"></div>

                    {bookingType === 'room' ? (
                        /* ================= ROOM BOOKING FORM ================= */
                        <div className="space-y-6 animate-fade-in">
                            {/* Room Selection */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <MapPin size={18} className="text-blue-500" /> เลือกห้องประชุม
                                </label>
                                <div className="flex gap-4 mb-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="roomZone"
                                            value="junior_high"
                                            checked={formData.roomZone === "junior_high"}
                                            onChange={handleInputChange}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">มัธยมต้น</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="roomZone"
                                            value="senior_high"
                                            checked={formData.roomZone === "senior_high"}
                                            onChange={handleInputChange}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">มัธยมปลาย</span>
                                    </label>
                                </div>
                                <CustomSelect
                                    value={formData.roomId}
                                    options={(formData.roomZone === "junior_high" ? ROOMS.junior_high : ROOMS.senior_high).map(r => ({ value: r.id, label: r.name }))}
                                    onChange={(val) => handleSelectChange("roomId", val)}
                                    placeholder="-- กรุณาเลือกห้อง --"
                                />
                            </div>

                            {/* Date & Time Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1 min-w-0">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">วันที่</label>
                                    <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                            <Calendar size={16} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleInputChange}
                                            className="w-full max-w-full h-[46px] pl-10 pr-3 bg-transparent text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none dark:[color-scheme:dark]"
                                            style={{ minWidth: 0 }}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Start Time */}
                                <TimeSelect
                                    label="เวลาเริ่ม"
                                    value={formData.startTime}
                                    onChange={(val) => setFormData(p => ({ ...p, startTime: val }))}
                                />

                                {/* End Time */}
                                <TimeSelect
                                    label="เวลาสิ้นสุด"
                                    value={formData.endTime}
                                    onChange={(val) => setFormData(p => ({ ...p, endTime: val }))}
                                />
                            </div>

                            {/* Topic & Description */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">หัวข้อการประชุม</label>
                                    <input
                                        type="text"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleInputChange}
                                        placeholder="เช่น ประชุมประจำเดือน , อบรม Generative Ai"
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">รายละเอียด / วิทยากร</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        rows={3}
                                        placeholder="รายละเอียดเพิ่มเติม , ความต้องการอื่น ๆ"
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 dark:border-gray-800 pt-4"></div>

                            {/* Equipment */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Briefcase size={18} className="text-blue-500" /> อุปกรณ์ที่ต้องการ
                                </label>

                                {!formData.roomId ? (
                                    <div className="text-gray-400 text-sm text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                                        กรุณาเลือกห้องประชุมเพื่อดูรายการอุปกรณ์
                                    </div>
                                ) : availableEquipment.length === 0 ? (
                                    <div className="text-gray-400 text-sm text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                                        ไม่มีอุปกรณ์ให้เลือกสำหรับห้องนี้
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {availableEquipment.map(item => (
                                            <label
                                                key={item}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleCheckboxChange(item);
                                                }}
                                                onTouchEnd={(e) => {
                                                    e.preventDefault();
                                                    handleCheckboxChange(item);
                                                }}
                                                className={`
                                            flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all
                                            ${formData.equipment.includes(item)
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100'}
                                        `}
                                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${formData.equipment.includes(item) ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
                                                    {formData.equipment.includes(item) && <CheckSquare size={14} className="text-white" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={formData.equipment.includes(item)}
                                                    readOnly
                                                />
                                                <span className="text-sm font-medium">{item}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}


                                {formData.equipment.some(e => e.includes("ไมค์")) && (
                                    <div className="mt-2 animate-fade-in">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">จำนวนไมค์ที่ต้องการ</label>
                                        <input
                                            type="number"
                                            name="micCount"
                                            value={formData.micCount}
                                            onChange={handleInputChange}
                                            placeholder="ระบุจำนวน"
                                            min="1"
                                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="mt-2">
                                <input
                                    type="text"
                                    name="ownEquipment"
                                    value={formData.ownEquipment}
                                    onChange={handleInputChange}
                                    placeholder="อื่น ๆ (ถ้ามี)"
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="border-t border-gray-100 dark:border-gray-800 pt-4"></div>

                            {/* Attendees & Room Layout */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">จำนวนผู้เข้าร่วม (คน)</label>
                                    <input
                                        type="number"
                                        name="attendees"
                                        value={formData.attendees}
                                        onChange={handleInputChange}
                                        placeholder="ระบุจำนวน"
                                        min="1"
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-900 dark:text-white">รูปแบบการจัดห้องประชุม</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {ROOM_LAYOUTS.map((layout) => (
                                            <label
                                                key={layout.id}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setFormData(prev => ({ ...prev, roomLayout: layout.id }));
                                                }}
                                                onTouchEnd={(e) => {
                                                    e.preventDefault();
                                                    setFormData(prev => ({ ...prev, roomLayout: layout.id }));
                                                }}
                                                className={`
                                            flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                                            ${formData.roomLayout === layout.id
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100'}
                                        `}
                                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                            >
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.roomLayout === layout.id ? 'border-blue-500' : 'border-gray-300'}`}>
                                                    {formData.roomLayout === layout.id && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="roomLayout"
                                                    value={layout.id}
                                                    checked={formData.roomLayout === layout.id}
                                                    readOnly
                                                    className="hidden"
                                                />
                                                <span className="text-sm font-medium">{layout.label}</span>
                                            </label>
                                        ))}
                                    </div>

                                    {formData.roomLayout === 'other' && (
                                        <div className="mt-2 animate-fade-in">
                                            <input
                                                type="text"
                                                name="roomLayoutDetails"
                                                value={formData.roomLayoutDetails}
                                                onChange={handleInputChange}
                                                placeholder="ระบุรายละเอียดรูปแบบห้องที่ต้องการ"
                                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Needs Photographer Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                <div className="flex items-center gap-3">
                                    <Camera size={20} className="text-purple-500" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">ต้องการช่างภาพ</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">สำหรับถ่ายภาพ/วิดีโอในกิจกรรม</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setFormData(prev => ({ ...prev, needsPhotographer: !prev.needsPhotographer }));
                                    }}
                                    onTouchEnd={(e) => {
                                        e.preventDefault();
                                        setFormData(prev => ({ ...prev, needsPhotographer: !prev.needsPhotographer }));
                                    }}
                                    className={`
                                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                                        ${formData.needsPhotographer ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'}
                                    `}
                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                >
                                    <span
                                        className={`
                                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                            ${formData.needsPhotographer ? 'translate-x-6' : 'translate-x-1'}
                                        `}
                                    />
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* ================= PHOTO JOB FORM ================= */
                        <div className="space-y-6 animate-fade-in">
                            {/* Photo Job Info Header */}
                            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 flex items-start gap-3">
                                <Camera className="text-purple-600 dark:text-purple-400 shrink-0 mt-1" size={20} />
                                <div>
                                    <h3 className="font-bold text-purple-800 dark:text-purple-300 text-sm">จองคิวช่างภาพ (ไม่ต้องรออนุมัติ)</h3>
                                    <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                                        ระบบจะบันทึกการจอง และแจ้งเตือนไปยัง Admin เพื่อมอบหมายงานต่อไป
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ชื่อกิจกรรม <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleInputChange}
                                        placeholder="เช่น นิเทศการสอน , กิจกรรมการเรียนการสอน"
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        required
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">สถานที่จัดกิจกรรม <span className="text-red-500">*</span></label>
                                    <div className="flex gap-4 mb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="roomZone"
                                                value="junior_high"
                                                checked={formData.roomZone === "junior_high"}
                                                onChange={handleInputChange}
                                                className="text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">ฝั่ง ม.ต้น</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="roomZone"
                                                value="senior_high"
                                                checked={formData.roomZone === "senior_high"}
                                                onChange={handleInputChange}
                                                className="text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">ฝั่ง ม.ปลาย</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="roomZone"
                                                value="offsite"
                                                checked={formData.roomZone === "offsite"}
                                                onChange={handleInputChange}
                                                className="text-purple-600 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">นอกสถานที่</span>
                                        </label>
                                    </div>
                                    <input
                                        type="text"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleInputChange}
                                        placeholder="ระบุห้องหรือสถานที่ (เช่น ห้อง 126, ห้องคอมพิวเตอร์ 138)"
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        required
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">รายละเอียดเพิ่มเติม</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        rows={4}
                                        placeholder="รายละเอียดงาน"
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                    />
                                </div>
                            </div>

                            {/* Date & Time Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1 min-w-0">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">วันที่</label>
                                    <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                            <Calendar size={16} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleInputChange}
                                            className="w-full max-w-full h-[46px] pl-10 pr-3 bg-transparent text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 outline-none dark:[color-scheme:dark]"
                                            style={{ minWidth: 0 }}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Start Time */}
                                <TimeSelect
                                    label="เวลาเริ่ม"
                                    value={formData.startTime}
                                    onChange={(val) => setFormData(p => ({ ...p, startTime: val }))}
                                />

                                {/* End Time */}
                                <TimeSelect
                                    label="เวลาสิ้นสุด"
                                    value={formData.endTime}
                                    onChange={(val) => setFormData(p => ({ ...p, endTime: val }))}
                                />
                            </div>
                        </div>
                    )}

                    {/* Attachments (Link Toggle) - Only for Room Booking */}
                    {bookingType === 'room' && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Paperclip size={18} className="text-blue-500" /> เอกสารแนบ
                                    </label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">สำหรับให้เจ้าหน้าที่โสตเปิดในการประชุม/อบรม/กิจกรรม</p>
                                </div>

                                {/* iOS Toggle Switch */}
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">มีไฟล์ที่ต้องใช้ไหม?</span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setHasAttachments(!hasAttachments);
                                        }}
                                        onTouchEnd={(e) => {
                                            e.preventDefault();
                                            setHasAttachments(!hasAttachments);
                                        }}
                                        className={`
                                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                                        ${hasAttachments ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'}
                                    `}
                                        style={{ WebkitTapHighlightColor: 'transparent' }}
                                    >
                                        <span
                                            className={`
                                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                            ${hasAttachments ? 'translate-x-6' : 'translate-x-1'}
                                        `}
                                        />
                                    </button>
                                </div>
                            </div>

                            {hasAttachments && (
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3 animate-fade-in">
                                    <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-xs">
                                        <div className="mt-0.5"><LinkIcon size={14} /></div>
                                        <p>หากมีไฟล์ที่ต้องการใช้กรุณาอัปโหลดไฟล์ลง Google Drive และแนบเป็น Link  (เปิดแชร์สาธารณะ) หรือ Canva</p>
                                    </div>

                                    {attachmentLinks.map((link, index) => (
                                        <div key={index} className="flex gap-2">
                                            <div className="relative flex-1">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                                    <LinkIcon size={16} />
                                                </div>
                                                <input
                                                    type="url"
                                                    value={link}
                                                    onChange={(e) => handleLinkChange(index, e.target.value)}
                                                    onBlur={(e) => {
                                                        const val = e.target.value.trim();
                                                        if (val && !/^https?:\/\//i.test(val)) {
                                                            handleLinkChange(index, `https://${val}`);
                                                        }
                                                    }}
                                                    placeholder="วางลิงก์ที่นี่ (https://...)"
                                                    className="w-full pl-10 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                            {attachmentLinks.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeLinkField(index)}
                                                    className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                                >
                                                    <X size={20} />
                                                </button>
                                            )}
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={addLinkField}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                        <Plus size={16} /> เพิ่มลิงก์อีก
                                    </button>
                                </div>
                            )}
                        </div>
                    )}



                    {/* Footer Actions */}
                    <div className="pt-4 flex gap-3">
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                ยกเลิก
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:bg-gray-700 dark:hover:bg-gray-100 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" /> กำลังบันทึก...
                                </>
                            ) : (
                                bookingType === 'room' ? "ยืนยันการจองห้อง" : "ยืนยันการจองคิว"
                            )}
                        </button>
                    </div>

                </form>
            </div >
        </div >
    );
}
