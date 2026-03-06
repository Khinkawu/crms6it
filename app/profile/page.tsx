/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import ConfirmationModal from "@/components/ConfirmationModal";
import UserHistoryModal from "@/components/UserHistoryModal";
import toast from "react-hot-toast";
import {
    Wrench, Calendar, Package, ClipboardList, ChevronRight,
    User, Mail, Bell, LinkIcon, ExternalLink, MessageSquare,
    Clock, Camera, Pencil, Check, X, Loader2, Phone
} from "lucide-react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import NotificationToggle from "@/components/NotificationToggle";

type HistoryType = "repair" | "booking" | "borrow" | "requisition";

interface Feedback {
    id: string;
    details: string;
    timestamp: any;
    status: string;
    userAgent?: string;
}

function ProfileContent() {
    const { user, role, isPhotographer, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const photoInputRef = useRef<HTMLInputElement>(null);

    const [lineUserId, setLineUserId] = useState<string | null>(null);
    const [linkingStatus, setLinkingStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState("");
    const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyType, setHistoryType] = useState<HistoryType>("repair");

    // Profile info state (phone, position, department)
    const [phone, setPhone] = useState("");
    const [position, setPosition] = useState("");
    const [department, setDepartment] = useState("");
    const [isSavingInfo, setIsSavingInfo] = useState(false);

    // Edit name state
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState("");
    const [isSavingName, setIsSavingName] = useState(false);

    // Photo upload state
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [displayPhotoURL, setDisplayPhotoURL] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string>("");

    // Admin Feedbacks
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [feedbacksLoading, setFeedbacksLoading] = useState(false);

    useEffect(() => {
        if (role === 'admin') {
            setFeedbacksLoading(true);
            const q = query(collection(db, "feedbacks"), orderBy("timestamp", "desc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const items: Feedback[] = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() } as Feedback);
                });
                setFeedbacks(items);
                setFeedbacksLoading(false);
            });
            return () => unsubscribe();
        }
    }, [role]);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    // Fetch user data from Firestore (custom photo + line status)
    useEffect(() => {
        const fetchUserData = async () => {
            if (user?.uid) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setLineUserId(data.lineUserId || null);
                    // Prefer Firestore photoURL (custom uploaded) over Google OAuth photo
                    setDisplayPhotoURL(data.photoURL || user.photoURL || null);
                    setDisplayName(data.displayName || user.displayName || "");
                    setPhone(data.phone || "");
                    setPosition(data.position || "");
                    setDepartment(data.department || "");
                } else {
                    setDisplayPhotoURL(user.photoURL || null);
                    setDisplayName(user.displayName || "");
                }
            }
        };
        fetchUserData();
    }, [user]);

    // Handle LINE linking callback
    useEffect(() => {
        const action = searchParams.get('action');
        const newLineUserId = searchParams.get('lineUserId');
        const error = searchParams.get('error');

        if (error) {
            setLinkingStatus('error');
            setErrorMessage("ไม่สามารถเชื่อมต่อบัญชี LINE ได้ กรุณาลองใหม่อีกครั้ง");
        }

        if (action === 'link_line' && newLineUserId && user) {
            const newLineDisplayName = searchParams.get('lineDisplayName') || '';
            const linkAccount = async () => {
                setLinkingStatus('linking');
                try {
                    const { setDoc, serverTimestamp } = await import("firebase/firestore");
                    // Use setDoc+merge instead of updateDoc — works even if users/{uid} doc doesn't exist yet
                    // (race condition: syncUserProfile in AuthContext creates the doc non-blocking)
                    await setDoc(doc(db, "users", user.uid), {
                        lineUserId: newLineUserId,
                        lineDisplayName: newLineDisplayName
                    }, { merge: true });
                    await setDoc(doc(db, "line_bindings", newLineUserId), {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        lineDisplayName: newLineDisplayName,
                        photoURL: user.photoURL,
                        linkedAt: serverTimestamp()
                    });
                    setLineUserId(newLineUserId);
                    setLinkingStatus('success');
                    router.replace('/profile');
                } catch (err) {
                    console.error("Error linking account:", err);
                    setLinkingStatus('error');
                    setErrorMessage("ไม่สามารถบันทึกข้อมูล LINE ได้");
                }
            };
            linkAccount();
        }

        const checkLiffStatus = async () => {
            if (!user || lineUserId) return;
            if (typeof navigator !== 'undefined' && !/LINE|Line/i.test(navigator.userAgent)) return;
            try {
                const liffModule = await import('@line/liff');
                const liff = liffModule.default;
                const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR || process.env.NEXT_PUBLIC_LIFF_ID;
                if (!liffId) return;
                await liff.init({ liffId });
                if (liff.isInClient() && liff.isLoggedIn()) {
                    const profile = await liff.getProfile();
                    const currentLineId = profile.userId;
                    if (currentLineId) {
                        setLinkingStatus('linking');
                        await updateDoc(doc(db, "users", user.uid), { lineUserId: currentLineId });
                        const { setDoc, serverTimestamp } = await import("firebase/firestore");
                        await setDoc(doc(db, "line_bindings", currentLineId), {
                            uid: user.uid, email: user.email,
                            displayName: user.displayName, photoURL: user.photoURL,
                            linkedAt: serverTimestamp()
                        });
                        setLineUserId(currentLineId);
                        setLinkingStatus('success');
                        toast.success("เชื่อมต่อกับ LINE ปัจจุบันเรียบร้อยแล้ว");
                    }
                }
            } catch (err) { /* silent */ }
        };

        if (user && !lineUserId) checkLiffStatus();
    }, [searchParams, user, router, lineUserId]);

    // Save display name
    const handleSaveName = async () => {
        if (!user || !editNameValue.trim() || editNameValue.trim() === displayName) {
            setIsEditingName(false);
            return;
        }
        setIsSavingName(true);
        try {
            const trimmed = editNameValue.trim();
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: trimmed });
            }
            await updateDoc(doc(db, "users", user.uid), { displayName: trimmed });
            setDisplayName(trimmed);
            setIsEditingName(false);
            toast.success("อัปเดตชื่อเรียบร้อย");
        } catch (err) {
            console.error(err);
            toast.error("ไม่สามารถอัปเดตชื่อได้");
        } finally {
            setIsSavingName(false);
        }
    };

    // Save phone/position/department
    const handleSaveInfo = async () => {
        if (!user) return;
        setIsSavingInfo(true);
        try {
            await updateDoc(doc(db, "users", user.uid), { phone, position, department });
            toast.success("บันทึกข้อมูลเรียบร้อย");
        } catch (err) {
            console.error(err);
            toast.error("ไม่สามารถบันทึกข้อมูลได้");
        } finally {
            setIsSavingInfo(false);
        }
    };

    // Upload profile photo
    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            toast.error("ไฟล์ต้องมีขนาดไม่เกิน 5MB");
            return;
        }

        setIsUploadingPhoto(true);
        try {
            const storageRef = ref(storage, `profile-photos/${user.uid}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { photoURL: downloadURL });
            }
            await updateDoc(doc(db, "users", user.uid), { photoURL: downloadURL });
            setDisplayPhotoURL(downloadURL);
            toast.success("อัปเดตรูปโปรไฟล์เรียบร้อย");
        } catch (err) {
            console.error(err);
            toast.error("ไม่สามารถอัปโหลดรูปได้");
        } finally {
            setIsUploadingPhoto(false);
            // Reset input so same file can be re-selected
            if (photoInputRef.current) photoInputRef.current.value = "";
        }
    };

    const handleConnectLine = () => {
        if (!user) return;
        window.location.href = `/api/line/login?userId=${user.uid}`;
    };

    const openHistoryModal = (type: HistoryType) => {
        setHistoryType(type);
        setHistoryModalOpen(true);
    };

    const getRoleBadge = (role: string | null) => {
        const roleLabels: Record<string, { label: string; style: string }> = {
            admin: { label: "Admin", style: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800" },
            technician: { label: "Technician", style: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
            facility_technician: { label: "Facility Tech", style: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
            moderator: { label: "Moderator", style: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
            user: { label: "User", style: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700" }
        };
        const config = roleLabels[role || 'user'] || roleLabels.user;
        return (
            <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${config.style}`}>
                    {config.label}
                </span>
                {isPhotographer && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 flex items-center gap-1">
                        <Camera size={11} /> Photographer
                    </span>
                )}
            </div>
        );
    };

    if (loading || !user) return null;

    const POSITIONS = ["ผู้บริหาร", "ครู", "ครู LS", "โสตฯ", "นักการ", "แม่บ้าน", "แม่ครัว"];
    const DEPARTMENTS = ["ฝ่ายบริหารงานทั่วไป", "ฝ่ายวิชาการ", "ฝ่ายบุคลากร", "ฝ่ายกิจการนักเรียน", "ฝ่ายแผนงานและงบประมาณ"];

    const historyButtons = [
        { type: "repair" as HistoryType, label: "ประวัติการแจ้งซ่อม", icon: Wrench },
        { type: "booking" as HistoryType, label: "ประวัติการจองห้องประชุม", icon: Calendar },
        { type: "borrow" as HistoryType, label: "ประวัติการยืม/คืน", icon: Package },
        { type: "requisition" as HistoryType, label: "ประวัติการเบิก", icon: ClipboardList }
    ];

    return (
        <div className="animate-fade-in py-6 px-4 pb-24">
            <div className="w-full max-w-2xl mx-auto space-y-4">

                {/* ── Profile Card ── */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

                    {/* Avatar + Info row */}
                    <div className="p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">

                        {/* Avatar with upload overlay */}
                        <div className="relative shrink-0">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                {displayPhotoURL ? (
                                    <img src={displayPhotoURL} alt={displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <User className="w-8 h-8 text-gray-400" />
                                    </div>
                                )}
                                {/* Upload overlay */}
                                {isUploadingPhoto && (
                                    <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                                        <Loader2 size={20} className="text-white animate-spin" />
                                    </div>
                                )}
                            </div>
                            {/* Camera button */}
                            <button
                                onClick={() => photoInputRef.current?.click()}
                                disabled={isUploadingPhoto}
                                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center shadow-md hover:scale-110 transition-transform disabled:opacity-50"
                                title="เปลี่ยนรูปโปรไฟล์"
                            >
                                <Camera size={13} />
                            </button>
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoChange}
                            />
                        </div>

                        {/* Name + Email + Roles */}
                        <div className="flex-1 min-w-0 space-y-2">
                            {/* Editable name */}
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        value={editNameValue}
                                        onChange={(e) => setEditNameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveName();
                                            if (e.key === 'Escape') setIsEditingName(false);
                                        }}
                                        className="flex-1 text-lg font-semibold bg-transparent border-b-2 border-gray-900 dark:border-white text-gray-900 dark:text-white outline-none pb-0.5 min-w-0"
                                    />
                                    <button
                                        onClick={handleSaveName}
                                        disabled={isSavingName}
                                        className="p-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-80 transition-opacity disabled:opacity-50"
                                    >
                                        {isSavingName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    </button>
                                    <button
                                        onClick={() => setIsEditingName(false)}
                                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 group">
                                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                                        {displayName || "ผู้ใช้งาน"}
                                    </h1>
                                    <button
                                        onClick={() => {
                                            setEditNameValue(displayName);
                                            setIsEditingName(true);
                                        }}
                                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-all"
                                        title="แก้ไขชื่อ"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                </div>
                            )}

                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                <Mail size={13} />
                                {user.email}
                            </p>

                            {getRoleBadge(role)}
                        </div>
                    </div>
                </div>

                {/* ── ข้อมูลสำหรับแบบฟอร์ม ── */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">ข้อมูลสำหรับแบบฟอร์ม</h2>
                        <p className="text-xs text-gray-400 mt-0.5">กรอกอัตโนมัติในฟอร์มแจ้งซ่อมและจองห้องประชุม</p>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                                <Phone size={12} /> เบอร์โทรศัพท์
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="08x-xxx-xxxx"
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-gray-400/30 transition-all placeholder:text-gray-400"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">ตำแหน่ง</label>
                                <select
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-gray-400/30 transition-all"
                                >
                                    <option value="">-- เลือกตำแหน่ง --</option>
                                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">ฝ่ายงาน</label>
                                <select
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-gray-400/30 transition-all"
                                >
                                    <option value="">-- เลือกฝ่ายงาน --</option>
                                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={handleSaveInfo}
                            disabled={isSavingInfo}
                            className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {isSavingInfo ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                            {isSavingInfo ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                        </button>
                    </div>
                </div>

                {/* ── Settings ── */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">การตั้งค่า</h2>
                    </div>
                    <div className="p-4">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500">
                                    <Bell size={16} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">รับแจ้งเตือนเมื่อมีงานใหม่</p>
                                </div>
                            </div>
                            <NotificationToggle showLabel={false} />
                        </div>
                    </div>
                </div>

                {/* ── Activity History ── */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">ประวัติกิจกรรม</h2>
                    </div>
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {historyButtons.map((btn) => {
                            const Icon = btn.icon;
                            return (
                                <button
                                    key={btn.type}
                                    onClick={() => openHistoryModal(btn.type)}
                                    className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                                >
                                    <div className="p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                                        <Icon size={16} />
                                    </div>
                                    <span className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-200">
                                        {btn.label}
                                    </span>
                                    <ChevronRight size={16} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── LINE Notification ── */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                        <Bell size={16} className="text-gray-400" />
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">การแจ้งเตือน LINE</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        {linkingStatus === 'linking' && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" /> กำลังเชื่อมต่อบัญชี LINE...
                            </div>
                        )}
                        {linkingStatus === 'success' && (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm">
                                ✅ เชื่อมต่อบัญชี LINE เรียบร้อยแล้ว!
                            </div>
                        )}
                        {linkingStatus === 'error' && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                                ⚠️ {errorMessage}
                            </div>
                        )}

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0">
                                    <img src="/line_icon.png" alt="LINE" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">LINE</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {lineUserId ? "เชื่อมต่อแล้ว • รับการแจ้งเตือน" : "ยังไม่ได้เชื่อมต่อ"}
                                    </p>
                                </div>
                            </div>
                            {lineUserId ? (
                                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium">
                                    เชื่อมต่อแล้ว
                                </span>
                            ) : (
                                <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full text-xs font-medium">
                                    ยังไม่เชื่อมต่อ
                                </span>
                            )}
                        </div>

                        <div className="flex gap-3">
                            {lineUserId ? (
                                <>
                                    <a
                                        href={`https://line.me/R/ti/p/${process.env.NEXT_PUBLIC_LINE_BOT_BASIC_ID}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-2.5 rounded-xl border-2 border-[#06C755] text-[#06C755] hover:bg-[#06C755]/10 font-medium transition-colors text-center text-sm flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink size={15} /> เปิดแชท
                                    </a>
                                    <button
                                        onClick={() => setIsDisconnectConfirmOpen(true)}
                                        className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium text-sm transition-colors"
                                    >
                                        ยกเลิก
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handleConnectLine}
                                    className="w-full py-2.5 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-medium transition-colors text-sm flex items-center justify-center gap-2"
                                >
                                    <LinkIcon size={15} /> เชื่อมต่อบัญชี LINE
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Admin Feedbacks ── */}
                {role === 'admin' && (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                            <MessageSquare size={16} className="text-gray-400" />
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                ปัญหาการใช้งาน ({feedbacks.length})
                            </h2>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                            {feedbacksLoading ? (
                                <div className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</div>
                            ) : feedbacks.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีการแจ้งปัญหา</div>
                            ) : (
                                feedbacks.map((item) => (
                                    <div key={item.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-2">
                                            {item.details}
                                        </p>
                                        <div className="flex items-center justify-between text-xs text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <Clock size={11} />
                                                <span>{item.timestamp?.toDate().toLocaleString('th-TH')}</span>
                                            </div>
                                            {item.userAgent && (
                                                <span className="opacity-50 truncate max-w-[150px]" title={item.userAgent}>
                                                    {item.userAgent.split(')')[0] + ')'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

            </div>

            <UserHistoryModal
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                historyType={historyType}
            />

            <ConfirmationModal
                isOpen={isDisconnectConfirmOpen}
                onClose={() => setIsDisconnectConfirmOpen(false)}
                onConfirm={async () => {
                    try {
                        if (lineUserId) {
                            const { deleteDoc } = await import("firebase/firestore");
                            await deleteDoc(doc(db, "line_bindings", lineUserId));
                        }
                        await updateDoc(doc(db, "users", user.uid), { lineUserId: null });
                        setLineUserId(null);
                        setIsDisconnectConfirmOpen(false);
                        toast.success("ยกเลิกการเชื่อมต่อ LINE เรียบร้อยแล้ว");
                    } catch (err) {
                        console.error("Error disconnecting LINE:", err);
                        toast.error("ไม่สามารถยกเลิกการเชื่อมต่อได้");
                    }
                }}
                title="ยกเลิกการเชื่อมต่อ LINE"
                message="คุณแน่ใจหรือไม่ที่จะยกเลิกการเชื่อมต่อบัญชี LINE? คุณจะไม่ได้รับการแจ้งเตือนผ่าน LINE อีกต่อไป"
                confirmText="ยกเลิกการเชื่อมต่อ"
                isDangerous={true}
            />
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-gray-400">กำลังโหลด...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
