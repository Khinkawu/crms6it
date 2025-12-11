/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ConfirmationModal from "../components/ConfirmationModal";
import toast from "react-hot-toast";

function ProfileContent() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [lineUserId, setLineUserId] = useState<string | null>(null);
    const [linkingStatus, setLinkingStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState("");
    const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);

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

    // Handle Linking Callback
    useEffect(() => {
        const action = searchParams.get('action');
        const newLineUserId = searchParams.get('lineUserId');
        const error = searchParams.get('error');

        if (error) {
            setLinkingStatus('error');
            setErrorMessage("Failed to link LINE account. Please try again.");
        }

        if (action === 'link_line' && newLineUserId && user) {
            const linkAccount = async () => {
                setLinkingStatus('linking');
                try {
                    await updateDoc(doc(db, "users", user.uid), {
                        lineUserId: newLineUserId
                    });
                    setLineUserId(newLineUserId);
                    setLinkingStatus('success');
                    // Clean URL
                    router.replace('/profile');
                } catch (err) {
                    console.error("Error linking account:", err);
                    setLinkingStatus('error');
                    setErrorMessage("Failed to save LINE account to your profile.");
                }
            };
            linkAccount();
        }
    }, [searchParams, user, router]);

    const handleConnectLine = () => {
        if (!user) return;
        window.location.href = `/api/line/login?userId=${user.uid}`;
    };

    if (loading || !user) return null;

    return (
        <div className="min-h-[80vh] flex items-center justify-center animate-fade-in">
            <div className="max-w-2xl w-full">
                <div className="card overflow-hidden">

                    {/* Header Banner */}
                    <div className="h-32 bg-brand-gradient relative">
                        <div className="absolute -bottom-12 left-8">
                            <div className="w-24 h-24 rounded-full bg-card p-1 shadow-soft-md">
                                <div className="w-full h-full rounded-full overflow-hidden bg-input-bg">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-3xl">👤</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-16 px-8 pb-8">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-2xl font-bold text-text">{user.displayName || "User"}</h1>
                                <p className="text-text-secondary">{user.email}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' :
                                role === 'technician' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' :
                                    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                                }`}>
                                <span className="capitalize">{role || 'USER'}</span>
                            </span>
                        </div>

                        <div className="space-y-8">
                            {/* Personal Info */}
                            <div>
                                <h2 className="text-lg font-semibold text-text mb-4 border-b border-border pb-2">Personal Information</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-text-secondary uppercase tracking-wider block mb-1">Full Name</label>
                                        <div className="p-3 bg-input-bg rounded-lg text-text border border-border">
                                            {user.displayName || "Not set"}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-text-secondary uppercase tracking-wider block mb-1">Email Address</label>
                                        <div className="p-3 bg-input-bg rounded-lg text-text border border-border">
                                            {user.email}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-text-secondary uppercase tracking-wider block mb-1">User ID</label>
                                        <div className="p-3 bg-input-bg rounded-lg text-text-secondary border border-border font-mono text-sm">
                                            {user.uid}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notification Settings */}
                            <div>
                                <h2 className="text-lg font-semibold text-text mb-4 border-b border-border pb-2">Notification Settings</h2>

                                {linkingStatus === 'linking' && (
                                    <div className="text-primary-start animate-pulse mb-4">Linking LINE Account...</div>
                                )}

                                {linkingStatus === 'success' && (
                                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-sm">
                                        ✅ LINE Account Linked Successfully!
                                    </div>
                                )}

                                {linkingStatus === 'error' && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                                        ⚠️ {errorMessage}
                                    </div>
                                )}

                                <div className="bg-input-bg rounded-xl p-4 border border-border">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#06C755] rounded-lg flex items-center justify-center text-white">
                                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M20.3 10.5c0-4.6-4.6-8.4-10.3-8.4S-.3 5.9-.3 10.5c0 4.2 3.7 7.7 9.1 8.3v4.2l5.5-3c3.7-1 5.7-3.8 5.7-6.5z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-text">LINE Notifications</h3>
                                                <p className="text-xs text-text-secondary">Receive updates about repairs and inventory.</p>
                                            </div>
                                        </div>
                                        {lineUserId ? (
                                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                                                Connected
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold border border-gray-200">
                                                Not Connected
                                            </span>
                                        )}
                                    </div>

                                    {lineUserId ? (
                                        <div className="flex gap-3">
                                            <a
                                                href={`https://line.me/R/ti/p/${process.env.NEXT_PUBLIC_LINE_BOT_BASIC_ID}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 py-2 rounded-lg border-2 border-[#06C755] text-[#06C755] hover:bg-[#06C755]/10 font-bold transition-all text-center text-sm"
                                            >
                                                Open Chat
                                            </a>
                                            <button
                                                onClick={() => setIsDisconnectConfirmOpen(true)}
                                                className="px-4 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-medium text-sm"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleConnectLine}
                                            className="w-full py-2 rounded-lg bg-[#06C755] hover:bg-[#05b34c] text-white font-bold shadow-sm transition-all text-sm"
                                        >
                                            Connect LINE Account
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isDisconnectConfirmOpen}
                onClose={() => setIsDisconnectConfirmOpen(false)}
                onConfirm={async () => {
                    // TODO: Implement actual disconnect logic here when API is ready
                    // For now just show toast as per previous alert
                    toast("Disconnect feature coming soon", {
                        icon: '🚧',
                        style: {
                            borderRadius: '10px',
                            background: '#333',
                            color: '#fff',
                        },
                    });
                    setIsDisconnectConfirmOpen(false);
                }}
                title="Disconnect LINE Account"
                message="Are you sure you want to disconnect your LINE account? You will stop receiving notifications."
                confirmText="Disconnect"
                isDangerous={true}
            />
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-text">Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
