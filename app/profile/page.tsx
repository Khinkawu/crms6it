/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ConfirmationModal from "../components/ConfirmationModal";
import UserHistoryModal from "../components/UserHistoryModal";
import toast from "react-hot-toast";
import {
    Wrench,
    Calendar,
    Package,
    ClipboardList,
    ChevronRight,
    User,
    Mail,
    Bell,
    LinkIcon,
    ExternalLink,
    MessageSquare,
    Clock,
    Camera
} from "lucide-react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

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

    const [lineUserId, setLineUserId] = useState<string | null>(null);
    const [linkingStatus, setLinkingStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState("");
    const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyType, setHistoryType] = useState<HistoryType>("repair");

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

    // Fetch current LINE status
    useEffect(() => {
        const fetchUserData = async () => {
            if (user?.uid) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    setLineUserId(userDoc.data().lineUserId || null);
                }
            }
        };
        fetchUserData();
    }, [user]);

    // Handle Linking Callback or LIFF Auto-Link
    useEffect(() => {
        const action = searchParams.get('action');
        const newLineUserId = searchParams.get('lineUserId');
        const error = searchParams.get('error');

        // 1. Handle Web Redirect Callback
        if (error) {
            setLinkingStatus('error');
            setErrorMessage("ไม่สามารถเชื่อมต่อบัญชี LINE ได้ กรุณาลองใหม่อีกครั้ง");
        }

        if (action === 'link_line' && newLineUserId && user) {
            const newLineDisplayName = searchParams.get('lineDisplayName') || '';

            const linkAccount = async () => {
                setLinkingStatus('linking');
                try {
                    // Save to users collection (include LINE display name)
                    await updateDoc(doc(db, "users", user.uid), {
                        lineUserId: newLineUserId,
                        lineDisplayName: newLineDisplayName
                    });

                    // Also save to line_bindings for LIFF login compatibility
                    const { setDoc, serverTimestamp } = await import("firebase/firestore");
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

        // 2. Handle LIFF Auto-Link (only if not already bound)
        const checkLiffStatus = async () => {
            if (!user || lineUserId) return; // Skip if no user or already bound

            // Check if running in LINE App (Basic check to avoid LIFF init warnings on Web)
            if (typeof navigator !== 'undefined' && !/LINE|Line/i.test(navigator.userAgent)) {
                return;
            }

            try {
                // Dynamically import LIFF to avoid SSR issues
                const liffModule = await import('@line/liff');
                const liff = liffModule.default;

                // Use an available LIFF ID (prefer REPAIR as it's likely main)
                const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR || process.env.NEXT_PUBLIC_LIFF_ID;
                if (!liffId) return;

                // Only init if we are likely in LINE environment to avoid "path mismatch" warnings on localhost/web
                await liff.init({ liffId });

                // Only proceed if running inside LINE App
                if (liff.isInClient() && liff.isLoggedIn()) {
                    const profile = await liff.getProfile();
                    const currentLineId = profile.userId;

                    if (currentLineId) {
                        setLinkingStatus('linking');

                        // Save to users collection
                        await updateDoc(doc(db, "users", user.uid), {
                            lineUserId: currentLineId
                        });

                        // Also save to line_bindings for LIFF login compatibility
                        const { setDoc, serverTimestamp } = await import("firebase/firestore");
                        await setDoc(doc(db, "line_bindings", currentLineId), {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            linkedAt: serverTimestamp()
                        });

                        setLineUserId(currentLineId);
                        setLinkingStatus('success');
                        toast.success("เชื่อมต่อกับ LINE ปัจจุบันเรียบร้อยแล้ว");
                    }
                }
            } catch (err) {
                // Silent fail for LIFF init errors in normal web
                console.log("LIFF Auto-bind skipped:", err);
            }
        };

        if (user && !lineUserId) {
            checkLiffStatus();
        }

    }, [searchParams, user, router, lineUserId]);

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
            moderator: { label: "Moderator", style: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
            user: { label: "User", style: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" }
        };
        const config = roleLabels[role || 'user'] || roleLabels.user;
        return (
            <div className="flex flex-row gap-2 items-center mt-2 sm:mt-0">
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${config.style}`}>
                    {config.label}
                </span>
                {isPhotographer && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium border bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 flex items-center gap-1">
                        <Camera size={12} />
                        Photographer
                    </span>
                )}
            </div>
        );
    };

    if (loading || !user) return null;

    const historyButtons = [
        { type: "repair" as HistoryType, label: "ประวัติการแจ้งซ่อม", icon: Wrench },
        { type: "booking" as HistoryType, label: "ประวัติการจองห้องประชุม", icon: Calendar },
        { type: "borrow" as HistoryType, label: "ประวัติการยืม/คืน", icon: Package },
        { type: "requisition" as HistoryType, label: "ประวัติการเบิก", icon: ClipboardList }
    ];

    return (
        <div className="min-h-[80vh] flex items-start justify-center animate-fade-in py-6 px-4">
            <div className="w-full max-w-2xl space-y-6">

                {/* Profile Card */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {/* Header with Avatar */}
                    <div className="relative h-28 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600">
                        <div className="absolute -bottom-10 left-6">
                            <div className="w-20 h-20 rounded-2xl bg-white dark:bg-gray-800 p-1 shadow-lg">
                                <div className="w-full h-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <User className="w-8 h-8 text-gray-400" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="pt-14 px-6 pb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    {user.displayName || "ผู้ใช้งาน"}
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1">
                                    <Mail size={14} />
                                    {user.email}
                                </p>
                            </div>
                            {getRoleBadge(role)}
                        </div>
                    </div>
                </div>

                {/* System Feedback (Admin Only) */}
                {role === 'admin' && (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <MessageSquare size={18} className="text-gray-500" />
                                <h2 className="text-base font-semibold text-gray-900 dark:text-white">ปัญหาการใช้งาน ({feedbacks.length})</h2>
                            </div>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                            {feedbacksLoading ? (
                                <div className="text-center py-8 text-gray-400">Loading...</div>
                            ) : feedbacks.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">ยังไม่มีการแจ้งปัญหา</div>
                            ) : (
                                feedbacks.map((item) => (
                                    <div key={item.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50">
                                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-2">
                                            {item.details}
                                        </p>
                                        <div className="flex items-center justify-between text-xs text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <Clock size={12} />
                                                <span>
                                                    {item.timestamp?.toDate().toLocaleString('th-TH')}
                                                </span>
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

                {/* Activity History Section */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">ประวัติกิจกรรม</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ดูประวัติรายการต่างๆ ของคุณ</p>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {historyButtons.map((btn) => {
                            const Icon = btn.icon;
                            return (
                                <button
                                    key={btn.type}
                                    onClick={() => openHistoryModal(btn.type)}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all group"
                                >
                                    <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 shadow-sm text-gray-500 dark:text-gray-400">
                                        <Icon size={20} />
                                    </div>
                                    <span className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-200">
                                        {btn.label}
                                    </span>
                                    <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* LINE Notification Section */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <Bell size={18} className="text-gray-500" />
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">การแจ้งเตือน</h2>
                        </div>
                    </div>
                    <div className="p-4">
                        {linkingStatus === 'linking' && (
                            <div className="text-blue-600 animate-pulse mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm">
                                กำลังเชื่อมต่อบัญชี LINE...
                            </div>
                        )}

                        {linkingStatus === 'success' && (
                            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm">
                                ✅ เชื่อมต่อบัญชี LINE เรียบร้อยแล้ว!
                            </div>
                        )}

                        {linkingStatus === 'error' && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                                ⚠️ {errorMessage}
                            </div>
                        )}

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm">
                                    <img src="/line_icon.png" alt="LINE" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">LINE</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {lineUserId ? "เชื่อมต่อแล้ว • รับการแจ้งเตือน" : "ยังไม่ได้เชื่อมต่อ"}
                                    </p>
                                </div>
                            </div>
                            {lineUserId ? (
                                <span className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium">
                                    เชื่อมต่อแล้ว
                                </span>
                            ) : (
                                <span className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium">
                                    ยังไม่เชื่อมต่อ
                                </span>
                            )}
                        </div>

                        <div className="mt-4 flex gap-3">
                            {lineUserId ? (
                                <>
                                    <a
                                        href={`https://line.me/R/ti/p/${process.env.NEXT_PUBLIC_LINE_BOT_BASIC_ID}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-2.5 rounded-xl border-2 border-[#06C755] text-[#06C755] hover:bg-[#06C755]/10 font-medium transition-all text-center text-sm flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink size={16} />
                                        เปิดแชท
                                    </a>
                                    <button
                                        onClick={() => setIsDisconnectConfirmOpen(true)}
                                        className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium text-sm transition-all"
                                    >
                                        ยกเลิกการเชื่อมต่อ
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handleConnectLine}
                                    className="w-full py-2.5 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-medium shadow-sm transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    <LinkIcon size={16} />
                                    เชื่อมต่อบัญชี LINE
                                </button>
                            )}
                        </div>
                    </div>
                </div>


            </div>

            {/* History Modal */}
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
                        // Delete from line_bindings if lineUserId exists
                        if (lineUserId) {
                            const { deleteDoc } = await import("firebase/firestore");
                            await deleteDoc(doc(db, "line_bindings", lineUserId));
                        }

                        // Clear from users collection
                        await updateDoc(doc(db, "users", user.uid), {
                            lineUserId: null
                        });

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
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-text">กำลังโหลด...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
