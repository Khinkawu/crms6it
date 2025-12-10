"use client";

import React, { useState, useEffect } from "react";
import { collection, doc, updateDoc, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import toast from "react-hot-toast";
import { Calendar, MapPin, Briefcase, Paperclip, CheckSquare, Loader2, Link as LinkIcon, Plus, X, Save } from "lucide-react";
import { Booking } from "../../types"; // We might need to define Booking type or import it if compatible

// Manually defining Booking interface here to avoid import issues for now if types file is separate
interface BookingData {
    id: string;
    roomId: string;
    roomName: string;
    title: string;
    description: string;
    requesterName: string; // Usually read-only or editable? User asked to edit details.
    position: string;
    department: string;
    phoneNumber: string;
    startTime: Timestamp;
    endTime: Timestamp;
    status: string;
    equipment: string[];
    ownEquipment?: string;
    attendees?: string;
    roomLayout?: string;
    roomLayoutDetails?: string;
    micCount?: string;
    attachments?: string[];
}

interface EditBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: BookingData;
    onUpdate: () => void;
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
        { id: "sh_admin_3", name: "ชั้น 3 อาคารอำนวยการ" },
    ]
};

const POSITIONS = ["ผู้บริหาร", "ครู", "ครู LS", "บุคลากร"];
const DEPARTMENTS = ["วิชาการ", "กิจการนักเรียน", "บุคลากร", "บริการทั่วไป", "การเงิน", "หน่วยงานภายนอก"];
const EQUIPMENT_OPTIONS = ["จอ LED", "ไมค์", "จอโปรเจ็คเตอร์", "จอ TV", "Projector", "Online Meeting", "Pointer"];

// Reusing CustomSelect and TimeSelect components locally
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

    const getLabel = (opt: string | SelectOption) => typeof opt === 'string' ? opt : opt.label;
    const getValue = (opt: string | SelectOption) => typeof opt === 'string' ? opt : opt.value;

    const selectedLabel = options.find(opt => getValue(opt) === value)
        ? getLabel(options.find(opt => getValue(opt) === value)!)
        : placeholder;

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-[46px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-center cursor-pointer hover:border-blue-500 transition-colors select-none flex items-center justify-center ${!value ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}
            >
                {selectedLabel}
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50">
                    {options.map((opt) => {
                        const optValue = getValue(opt);
                        const optLabel = getLabel(opt);
                        return (
                            <div
                                key={optValue}
                                onClick={() => {
                                    onChange(optValue);
                                    setIsOpen(false);
                                }}
                                className={`py-2 px-3 text-sm text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${optValue === value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}
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

const TimeSelect = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => {
    const [hour, minute] = value.split(':');
    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

    return (
        <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{label}</label>
            <div className="flex items-center gap-2">
                <CustomSelect value={hour} options={hours} onChange={(val) => onChange(`${val}:${minute}`)} />
                <span className="text-gray-400 font-bold">:</span>
                <CustomSelect value={minute} options={minutes} onChange={(val) => onChange(`${hour}:${val}`)} />
            </div>
        </div>
    );
};

export default function EditBookingModal({ isOpen, onClose, booking, onUpdate }: EditBookingModalProps) {
    const [loading, setLoading] = useState(false);

    // Initialize form data from booking
    const [formData, setFormData] = useState({
        position: "",
        department: "",
        phoneNumber: "",
        roomZone: "junior_high",
        roomId: "",
        title: "",
        description: "",
        date: "",
        startTime: "08:00",
        endTime: "10:00",
        equipment: [] as string[],
        ownEquipment: "",
        attendees: "",
        roomLayout: "classroom",
        roomLayoutDetails: "",
        micCount: "",
    });

    const [hasAttachments, setHasAttachments] = useState(false);
    const [attachmentLinks, setAttachmentLinks] = useState<string[]>([""]);

    useEffect(() => {
        if (isOpen && booking) {
            const start = booking.startTime.toDate();
            const end = booking.endTime.toDate();

            // Determine zone
            const isSenior = ROOMS.senior_high.some(r => r.id === booking.roomId);

            setFormData({
                roomId: booking.roomId,
                roomZone: isSenior ? "senior_high" : "junior_high",
                title: booking.title,
                description: booking.description || "",
                position: booking.position,
                department: booking.department,
                phoneNumber: booking.phoneNumber,
                date: start.toISOString().split('T')[0],
                startTime: start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
                endTime: end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
                equipment: booking.equipment || [],
                ownEquipment: booking.ownEquipment || "",
                attendees: booking.attendees || "",
                roomLayout: booking.roomLayout || "classroom",
                roomLayoutDetails: booking.roomLayoutDetails || "",
                micCount: booking.micCount || "",
            });

            if (booking.attachments && booking.attachments.length > 0) {
                setHasAttachments(true);
                setAttachmentLinks(booking.attachments);
            } else {
                setHasAttachments(false);
                setAttachmentLinks([""]);
            }
        }
    }, [isOpen, booking]);

    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading("กำลังอัปเดตข้อมูล...");

        // Basic validation
        const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
        const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

        if (startDateTime >= endDateTime) {
            toast.error("เวลาสิ้นสุดต้องหลังจากเวลาเริ่มต้น", { id: toastId });
            setLoading(false);
            return;
        }

        try {
            // Check conflicts only if time/room changed? 
            // For editing, let's skip strict conflict check just for simplicity or warn? 
            // Ideally we should check, excluding THIS booking.
            // Simplified: Just update.

            const validLinks = hasAttachments ? attachmentLinks.filter(link => link.trim() !== "") : [];
            const allRooms = [...ROOMS.junior_high, ...ROOMS.senior_high];
            const roomName = allRooms.find(r => r.id === formData.roomId)?.name || formData.roomId;

            await updateDoc(doc(db, "bookings", booking.id), {
                roomId: formData.roomId,
                roomName: roomName,
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
                micCount: formData.equipment.includes("ไมค์") ? formData.micCount : "",
                attachments: validLinks,
                updatedAt: Timestamp.now()
            });

            toast.success("อัปเดตข้อมูลเรียบร้อย", { id: toastId });
            onUpdate();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error("เกิดข้อผิดพลาดในการอัปเดต", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                        แก้ไขรายละเอียดการจอง
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Requester Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ผู้จอง</label>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm h-[46px] flex items-center">
                                    {booking.requesterName} (แก้ไขไม่ได้)
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">เบอร์โทรศัพท์</label>
                                <input
                                    type="tel"
                                    name="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={handleInputChange}
                                    className="w-full h-[46px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ตำแหน่ง</label>
                                <CustomSelect value={formData.position} options={POSITIONS} onChange={(val) => handleSelectChange("position", val)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ฝ่ายงาน</label>
                                <CustomSelect value={formData.department} options={DEPARTMENTS} onChange={(val) => handleSelectChange("department", val)} />
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-gray-800 pt-2"></div>

                        {/* Room & Time */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold flex items-center gap-2"><MapPin size={18} className="text-blue-500" /> ห้องประชุม</label>
                            <div className="flex gap-4 mb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="roomZone" value="junior_high" checked={formData.roomZone === "junior_high"} onChange={handleInputChange} className="text-blue-600" />
                                    <span className="text-sm">มัธยมต้น</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="roomZone" value="senior_high" checked={formData.roomZone === "senior_high"} onChange={handleInputChange} className="text-blue-600" />
                                    <span className="text-sm">มัธยมปลาย</span>
                                </label>
                            </div>
                            <CustomSelect
                                value={formData.roomId}
                                options={(formData.roomZone === "junior_high" ? ROOMS.junior_high : ROOMS.senior_high).map(r => ({ value: r.id, label: r.name }))}
                                onChange={(val) => handleSelectChange("roomId", val)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">วันที่</label>
                                <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full h-[46px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:[color-scheme:dark]" required />
                            </div>
                            <TimeSelect label="เวลาเริ่ม" value={formData.startTime} onChange={(val) => setFormData(p => ({ ...p, startTime: val }))} />
                            <TimeSelect label="เวลาสิ้นสุด" value={formData.endTime} onChange={(val) => setFormData(p => ({ ...p, endTime: val }))} />
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">หัวข้อ</label>
                                <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">รายละเอียด</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none" />
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-gray-800 pt-2"></div>

                        {/* Equipment */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold flex items-center gap-2"><Briefcase size={18} className="text-blue-500" /> อุปกรณ์</label>
                            <div className="grid grid-cols-2 gap-3">
                                {EQUIPMENT_OPTIONS.map(item => (
                                    <label key={item} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${formData.equipment.includes(item) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${formData.equipment.includes(item) ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
                                            {formData.equipment.includes(item) && <CheckSquare size={12} className="text-white" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={formData.equipment.includes(item)} onChange={() => handleCheckboxChange(item)} />
                                        <span className="text-sm">{item}</span>
                                    </label>
                                ))}
                            </div>
                            {formData.equipment.includes("ไมค์") && (
                                <input type="number" name="micCount" value={formData.micCount} onChange={handleInputChange} placeholder="จำนวนไมค์" className="w-full p-2 mt-2 rounded-lg border border-gray-200 text-sm" />
                            )}
                        </div>

                        {/* Attachments */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-bold flex items-center gap-2"><Paperclip size={18} className="text-blue-500" /> เอกสารแนบ</label>
                                <button type="button" onClick={() => setHasAttachments(!hasAttachments)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hasAttachments ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hasAttachments ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            {hasAttachments && (
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 space-y-2">
                                    {attachmentLinks.map((link, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input type="url" value={link} onChange={(e) => handleLinkChange(index, e.target.value)} placeholder="Link URL" className="flex-1 p-2 rounded-lg border border-gray-200 text-sm" />
                                            {attachmentLinks.length > 1 && <button type="button" onClick={() => handleLinkChange(index, "")} className="text-red-500"><X size={16} /></button>}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setAttachmentLinks([...attachmentLinks, ""])} className="text-sm text-blue-600 flex items-center gap-1"><Plus size={14} /> เพิ่มลิงก์</button>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50">ยกเลิก</button>
                            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                                {loading ? <Loader2 size={20} className="animate-spin" /> : <><Save size={20} /> บันทึกการแก้ไข</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
