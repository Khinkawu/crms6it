"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Loader2, Calendar, MapPin, Users, Phone, FileText, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";
import { Booking } from "@/types";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

interface EditBookingSheetProps {
    booking: Booking | null;
    onClose: () => void;
    onUpdated: () => void;
}

const ROOMS = [
    { id: "jh_phaya", name: "ห้องพญาสัตบรรณ", zone: "junior_high" },
    { id: "jh_gym", name: "โรงยิม", zone: "junior_high" },
    { id: "jh_chamchuri", name: "ห้องจามจุรี", zone: "junior_high" },
    { id: "sh_leelawadee", name: "ห้องลีลาวดี", zone: "senior_high" },
    { id: "sh_auditorium", name: "หอประชุม", zone: "senior_high" },
    { id: "sh_king_science", name: "ห้องศาสตร์พระราชา", zone: "senior_high" },
    { id: "sh_language_center", name: "ห้องศูนย์ภาษา", zone: "senior_high" },
    { id: "sh_admin_3", name: "ชั้น 3 อาคารอำนวยการ", zone: "senior_high" },
];

const ROOM_EQUIPMENT: Record<string, string[]> = {
    jh_phaya: ["จอ LED", "ไมค์ลอย", "Pointer"],
    jh_gym: ["จอ Projector", "Projector", "ไมค์ลอย", "Pointer"],
    jh_chamchuri: ["จอ TV", "ไมค์ลอย", "Pointer"],
    sh_leelawadee: ["จอ LED", "จอ TV", "ไมค์ก้าน", "ไมค์ลอย", "Pointer"],
    sh_auditorium: ["จอ LED", "ไมค์ลอย", "Pointer"],
    sh_king_science: ["จอ TV", "ไมค์ลอย", "ไมค์ก้าน", "Pointer"],
    sh_language_center: ["จอ TV", "ไมค์ลอย", "ไมค์ก้าน", "Pointer"],
    sh_admin_3: ["จอ Projector", "Projector", "ไมค์สาย", "Pointer"],
};

function toDate(val: unknown): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof (val as Timestamp).toDate === 'function') return (val as Timestamp).toDate();
    return null;
}

export default function EditBookingSheet({ booking, onClose, onUpdated }: EditBookingSheetProps) {
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);

    // Form state
    const [description, setDescription] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [equipment, setEquipment] = useState<string[]>([]);
    const [ownEquipment, setOwnEquipment] = useState("");
    // Core (pending only)
    const [title, setTitle] = useState("");
    const [roomId, setRoomId] = useState("");
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [attendees, setAttendees] = useState("");

    useEffect(() => {
        if (!booking) return;
        setDescription(booking.description || "");
        setPhoneNumber(booking.phoneNumber || "");
        setEquipment(booking.equipment || []);
        setOwnEquipment(booking.ownEquipment || "");
        setTitle(booking.title || "");
        setRoomId(booking.roomId || "");

        const start = toDate(booking.startTime);
        const end = toDate(booking.endTime);
        if (start) {
            setDate(format(start, 'yyyy-MM-dd'));
            setStartTime(format(start, 'HH:mm'));
        }
        if (end) setEndTime(format(end, 'HH:mm'));
        setAttendees(String(booking.attendees || ""));
    }, [booking]);

    if (!booking) return null;

    const isPending = booking.status === 'pending';
    const availableEquipment = ROOM_EQUIPMENT[roomId] || [];

    const toggleEquipment = (item: string) => {
        setEquipment(prev =>
            prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item]
        );
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const token = await user.getIdToken();
            const body: Record<string, unknown> = {
                bookingId: booking.id,
                description,
                phoneNumber,
                equipment,
                ownEquipment,
            };
            if (isPending) {
                body.title = title;
                body.roomId = roomId;
                body.roomName = ROOMS.find(r => r.id === roomId)?.name || roomId;
                body.date = date;
                body.startTime = startTime;
                body.endTime = endTime;
                body.attendees = Number(attendees) || undefined;
            }

            const res = await fetch('/api/edit-booking', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'แก้ไขไม่สำเร็จ');
                return;
            }

            toast.success('บันทึกเรียบร้อย');
            onUpdated();
            onClose();
        } catch {
            toast.error('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl max-h-[90vh] flex flex-col">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">แก้ไขการจอง</h2>
                        <p className="text-xs text-gray-500">
                            {isPending ? 'แก้ไขได้ทุกฟิลด์' : 'อนุมัติแล้ว — แก้ได้เฉพาะรายละเอียด'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">

                    {/* Core fields — pending only */}
                    {isPending && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <FileText size={12} /> ชื่อกิจกรรม
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <MapPin size={12} /> ห้อง
                                </label>
                                <select
                                    value={roomId}
                                    onChange={e => { setRoomId(e.target.value); setEquipment([]); }}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">เลือกห้อง</option>
                                    <optgroup label="ม.ต้น">
                                        {ROOMS.filter(r => r.zone === 'junior_high').map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="ม.ปลาย">
                                        {ROOMS.filter(r => r.zone === 'senior_high').map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-3 space-y-1.5">
                                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Calendar size={12} /> วันที่
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500">เริ่ม</label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={e => setStartTime(e.target.value)}
                                        className="w-full px-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500">สิ้นสุด</label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={e => setEndTime(e.target.value)}
                                        className="w-full px-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                        <Users size={10} /> คน
                                    </label>
                                    <input
                                        type="number"
                                        value={attendees}
                                        onChange={e => setAttendees(e.target.value)}
                                        min="1"
                                        className="w-full px-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Equipment */}
                            {availableEquipment.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <CheckSquare size={12} /> อุปกรณ์
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {availableEquipment.map(item => (
                                            <button
                                                key={item}
                                                onClick={() => toggleEquipment(item)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${equipment.includes(item)
                                                    ? 'bg-blue-500 text-white border-blue-500'
                                                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                                    }`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Safe fields — always editable */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <FileText size={12} /> รายละเอียดเพิ่มเติม
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Phone size={12} /> เบอร์ติดต่อ
                        </label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={e => setPhoneNumber(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {!isPending && equipment.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <CheckSquare size={12} /> อุปกรณ์ที่ขอ
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {equipment.map(item => (
                                    <span key={item} className="px-3 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </>
    );
}
