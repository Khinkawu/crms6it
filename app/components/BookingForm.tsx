"use client";

import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, addDoc, query, where, getDocs, Timestamp, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import toast from "react-hot-toast";
import { Calendar, MapPin, Briefcase, Paperclip, CheckSquare, Loader2, Link as LinkIcon, Plus, X } from "lucide-react";

interface BookingFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    initialDate?: Date;
    className?: string;
}

const ROOMS = {
    junior_high: [
        { id: "jh_phaya", name: "ห้องพญาสตบรรณ" },
        { id: "jh_gym", name: "โรงยิม" },
        { id: "jh_chamchuri", name: "ห้องจามจุรี" },
    ],
    senior_high: [
        { id: "sh_leelawadee", name: "ห้องลีลาวดี" },
        { id: "sh_auditorium", name: "หอประชุม" },
        { id: "sh_king_science", name: "ห้องศาสตร์พระราชา" },
        { id: "sh_language_center", name: "ห้องศูนย์ภาษา" },
    ]
};

const POSITIONS = ["ผู้บริหาร", "ครู", "ครู LS", "บุคลากร"];
const DEPARTMENTS = ["วิชาการ", "กิจการนักเรียน", "บุคลากร", "บริการทั่วไป", "การเงิน", "หน่วยงานภายนอก"];
const EQUIPMENT_OPTIONS = ["จอ LED", "ไมค์", "จอโปรเจ็คเตอร์", "จอ TV", "Projector", "Online Meeting"];

// --- Custom Scrollable Select Component ---
interface SelectOption {
    value: string;
    label: string;
}

const CustomSelect = ({
    value,
    options,
    onChange,
    placeholder = "เลือกรายการ"
}: {
    value: string,
    options: (string | SelectOption)[],
    onChange: (val: string) => void,
    placeholder?: string
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Helper to get label
    const getLabel = (opt: string | SelectOption) => typeof opt === 'string' ? opt : opt.label;
    const getValue = (opt: string | SelectOption) => typeof opt === 'string' ? opt : opt.value;

    const selectedLabel = options.find(opt => getValue(opt) === value)
        ? getLabel(options.find(opt => getValue(opt) === value)!)
        : placeholder;

    // Close on click outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Scroll to selected item when opening
    React.useEffect(() => {
        if (isOpen && containerRef.current) {
            const selectedEl = containerRef.current.querySelector(`[data-value="${value}"]`);
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: "center" });
            }
        }
    }, [isOpen, value]);

    return (
        <div className="relative w-full" ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-[46px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center cursor-pointer hover:border-blue-500 transition-colors select-none flex items-center justify-center ${!value ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}
            >
                {selectedLabel}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 no-scrollbar">
                    {options.map((opt) => {
                        const optValue = getValue(opt);
                        const optLabel = getLabel(opt);
                        return (
                            <div
                                key={optValue}
                                data-value={optValue}
                                onClick={() => {
                                    onChange(optValue);
                                    setIsOpen(false);
                                }}
                                className={`
                                    py-2 px-3 text-sm text-center cursor-pointer transition-colors
                                    ${optValue === value
                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}
                                `}
                            >
                                {optLabel}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- Time Picker Helper (Split Select) ---
const TimeSelect = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => {
    const [hour, minute] = value.split(':');

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

    return (
        <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{label}</label>
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <CustomSelect
                        value={hour}
                        options={hours}
                        onChange={(val) => onChange(`${val}:${minute}`)}
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-xs opacity-0">
                        น.
                    </div>
                </div>
                <span className="text-gray-400 font-bold">:</span>
                <div className="relative flex-1">
                    <CustomSelect
                        value={minute}
                        options={minutes}
                        onChange={(val) => onChange(`${hour}:${val}`)}
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-xs opacity-0">
                        น.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function BookingForm({ onSuccess, onCancel, initialDate, className = "" }: BookingFormProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        position: "ครู",
        department: "วิชาการ",
        phoneNumber: "",
        roomZone: "junior_high",
        roomId: "",
        title: "",
        description: "",
        date: initialDate ? initialDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        startTime: "08:00",
        endTime: "10:00",
        equipment: [] as string[],
        ownEquipment: "",
    });

    // Attachment State
    const [hasAttachments, setHasAttachments] = useState(false);
    const [attachmentLinks, setAttachmentLinks] = useState<string[]>([""]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Helper for CustomSelect updates
    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (option: string) => {
        setFormData(prev => {
            const newEquipment = prev.equipment.includes(option)
                ? prev.equipment.filter(item => item !== option)
                : [...prev.equipment, option];
            return { ...prev, equipment: newEquipment };
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

        if (!formData.roomId) {
            toast.error("กรุณาเลือกห้องประชุม");
            return;
        }

        const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
        const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

        if (startDateTime >= endDateTime) {
            toast.error("เวลาสิ้นสุดต้องหลังจากเวลาเริ่มต้น");
            return;
        }

        setLoading(true);
        const toastId = toast.loading("กำลังตรวจสอบตารางเวลา...");

        try {
            // 1. Check Conflicts
            const hasConflict = await checkTimeConflict(formData.roomId, startDateTime, endDateTime);
            if (hasConflict) {
                toast.error("ช่วงเวลานี้มีการจองแล้ว กรุณาเลือกเวลาใหม่", { id: toastId });
                setLoading(false);
                return;
            }

            // 2. Prepare Links (Filter empty)
            const validLinks = hasAttachments ? attachmentLinks.filter(link => link.trim() !== "") : [];

            // 3. Save Booking
            toast.loading("กำลังบันทึกการจอง...", { id: toastId });

            // Find room name
            const allRooms = [...ROOMS.junior_high, ...ROOMS.senior_high];
            const roomName = allRooms.find(r => r.id === formData.roomId)?.name || formData.roomId;

            await addDoc(collection(db, "bookings"), {
                roomId: formData.roomId,
                roomName: roomName,
                requesterName: user?.displayName || user?.email || "Unknown",
                requesterId: user?.uid,
                position: formData.position,
                department: formData.department,
                phoneNumber: formData.phoneNumber,
                title: formData.title,
                description: formData.description,
                startTime: Timestamp.fromDate(startDateTime),
                endTime: Timestamp.fromDate(endDateTime),
                equipment: formData.equipment,
                ownEquipment: formData.ownEquipment,
                attachments: validLinks, // Save links instead of file URLs
                status: 'pending', // Default to pending
                createdAt: serverTimestamp(),
            });

            toast.success("จองห้องประชุมสำเร็จ!", { id: toastId });
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
                    <Calendar className="text-blue-600" /> จองห้องประชุม
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">กรอกรายละเอียดเพื่อขอใช้ห้องประชุม</p>
            </div>

            {/* Form Content */}
            <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Row 1: Requester Info & Phone */}
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

                    {/* Row 2: Position & Department */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ตำแหน่ง</label>
                            <CustomSelect
                                value={formData.position}
                                options={POSITIONS}
                                onChange={(val) => handleSelectChange("position", val)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ฝ่ายงาน</label>
                            <CustomSelect
                                value={formData.department}
                                options={DEPARTMENTS}
                                onChange={(val) => handleSelectChange("department", val)}
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-800 pt-4"></div>

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
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">วันที่</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Calendar size={16} className="text-gray-400" />
                                </div>
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    className="w-full h-[46px] pl-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:[color-scheme:dark]"
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
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {EQUIPMENT_OPTIONS.map(item => (
                                <label key={item} className={`
                                    flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all
                                    ${formData.equipment.includes(item)
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}
                                `}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${formData.equipment.includes(item) ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
                                        {formData.equipment.includes(item) && <CheckSquare size={14} className="text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={formData.equipment.includes(item)}
                                        onChange={() => handleCheckboxChange(item)}
                                    />
                                    <span className="text-sm font-medium">{item}</span>
                                </label>
                            ))}
                        </div>
                        <div className="mt-2">
                            <input
                                type="text"
                                name="ownEquipment"
                                value={formData.ownEquipment}
                                onChange={handleInputChange}
                                placeholder="อื่น ๆ (ถ้ามี) , หรืออุปกรณ์ที่นำมาเอง"
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Attachments (Link Toggle) */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Paperclip size={18} className="text-blue-500" /> เอกสารแนบ
                            </label>

                            {/* iOS Toggle Switch */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600 dark:text-gray-400">มีไฟล์ที่ต้องใช้ไหม?</span>
                                <button
                                    type="button"
                                    onClick={() => setHasAttachments(!hasAttachments)}
                                    className={`
                                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                        ${hasAttachments ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                                    `}
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
                                    <p>หากมีไฟล์ที่ต้องใช้กรุณาแนบเป็น Link Google Drive (เปิดแชร์) หรือ Canva</p>
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
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" /> กำลังบันทึก...
                                </>
                            ) : (
                                "ยืนยันการจอง"
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
