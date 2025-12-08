"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, addDoc, query, where, getDocs, Timestamp, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import toast from "react-hot-toast";
import { X, Upload, Calendar, Clock, MapPin, Users, Briefcase, Paperclip, CheckSquare, Loader2 } from "lucide-react";

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialDate?: Date;
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
const DEPARTMENTS = ["วิชาการ", "กิจการนักเรียน", "บุคลากร", "บริการทั่วไป", "การเงิน"];
const EQUIPMENT_OPTIONS = ["จอ LED", "ไมค์", "จอโปรเจ็คเตอร์", "Projector", "Online Meeting"];

export default function BookingModal({ isOpen, onClose, onSuccess, initialDate }: BookingModalProps) {
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        position: "ครู",
        department: "วิชาการ",
        roomZone: "junior_high",
        roomId: "",
        title: "",
        description: "",
        date: initialDate ? initialDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        startTime: "08:00",
        endTime: "10:00",
        equipment: [] as string[],
        ownEquipment: "",
        meetingLink: "",
    });

    const [files, setFiles] = useState<File[]>([]);

    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
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

            // 2. Upload Files
            const attachmentUrls: string[] = [];
            if (files.length > 0) {
                toast.loading("กำลังอัปโหลดไฟล์...", { id: toastId });
                for (const file of files) {
                    const storageRef = ref(storage, `booking_files/${Date.now()}_${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(snapshot.ref);
                    attachmentUrls.push(url);
                }
            }

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
                title: formData.title,
                description: formData.description,
                startTime: Timestamp.fromDate(startDateTime),
                endTime: Timestamp.fromDate(endDateTime),
                equipment: formData.equipment,
                ownEquipment: formData.ownEquipment,
                attachments: attachmentUrls,
                meetingLink: formData.meetingLink, // Added meeting link
                status: 'approved', // Auto-approve
                createdAt: serverTimestamp(),
            });

            toast.success("จองห้องประชุมสำเร็จ!", { id: toastId });
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error("Booking Error:", error);
            toast.error(`เกิดข้อผิดพลาด: ${error.message}`, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Calendar className="text-blue-600" /> จองห้องประชุม
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">กรอกรายละเอียดเพื่อขอใช้ห้องประชุม</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Requester Info (Read-only) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ผู้จอง</label>
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium">
                                    {user?.displayName || user?.email}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ตำแหน่ง</label>
                                <select
                                    name="position"
                                    value={formData.position}
                                    onChange={handleInputChange}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ฝ่าย / กลุ่มสาระ</label>
                            <select
                                name="department"
                                value={formData.department}
                                onChange={handleInputChange}
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            >
                                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
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
                            <select
                                name="roomId"
                                value={formData.roomId}
                                onChange={handleInputChange}
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            >
                                <option value="">-- กรุณาเลือกห้อง --</option>
                                {(formData.roomZone === "junior_high" ? ROOMS.junior_high : ROOMS.senior_high).map(room => (
                                    <option key={room.id} value={room.id}>{room.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date & Time */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">วันที่</label>
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:[color-scheme:dark]"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">เวลาเริ่ม</label>
                                <input
                                    type="time"
                                    name="startTime"
                                    value={formData.startTime}
                                    onChange={handleInputChange}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:[color-scheme:dark]"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">เวลาสิ้นสุด</label>
                                <input
                                    type="time"
                                    name="endTime"
                                    value={formData.endTime}
                                    onChange={handleInputChange}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:[color-scheme:dark]"
                                    required
                                />
                            </div>
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
                                    placeholder="เช่น ประชุมวางแผนงานประจำปี"
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
                                    placeholder="รายละเอียดเพิ่มเติม..."
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ลิ้งก์การประชุม (ถ้ามี)</label>
                                <input
                                    type="text"
                                    name="meetingLink"
                                    value={formData.meetingLink}
                                    onChange={handleInputChange}
                                    placeholder="https://meet.google.com/..."
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
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
                                    placeholder="อุปกรณ์ที่นำมาเอง (ถ้ามี)..."
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Attachments */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Paperclip size={18} className="text-blue-500" /> เอกสารแนบ
                            </label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
                            >
                                <Upload size={32} className="text-gray-400 group-hover:text-blue-500 mb-2" />
                                <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600">คลิกเพื่ออัปโหลดไฟล์ (รูปภาพ / PDF)</p>
                                {files.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {files.map((f, i) => (
                                            <span key={i} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md">
                                                {f.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                multiple
                                className="hidden"
                            />
                        </div>

                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleSubmit}
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
            </div>
        </div>
    );
}
