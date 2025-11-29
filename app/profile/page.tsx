"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

function ProfileContent() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [lineUserId, setLineUserId] = useState<string | null>(null);
    const [linkingStatus, setLinkingStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState("");

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
        <div className="min-h-screen p-4 md:p-8 animate-fade-in md:ml-64 flex items-center justify-center">
            <div className="max-w-md w-full">
                <div className="glass-panel p-8 text-center space-y-6 relative overflow-hidden">

                    {/* Background Decoration */}
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cyan-500/20 to-transparent"></div>

                    {/* Avatar */}
                    <div className="relative z-10">
                        <div className="w-24 h-24 mx-auto rounded-full bg-white/10 border-4 border-white/20 overflow-hidden shadow-xl">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-3xl">👤</div>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-white mt-4">{user.displayName || "User"}</h1>
                        <p className="text-white/60">{user.email}</p>
                        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold border ${role === 'admin' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                            role === 'technician' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}>
                            {role?.toUpperCase() || 'USER'}
                        </span>
                    </div>

                    {/* LINE Connection Section */}
                    <div className="border-t border-white/10 pt-6">
                        <h2 className="text-white font-semibold mb-4">Notification Settings</h2>

                        {linkingStatus === 'linking' && (
                            <div className="text-cyan-400 animate-pulse mb-4">Linking LINE Account...</div>
                        )}

                        {linkingStatus === 'success' && (
                            <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">
                                ✅ LINE Account Linked Successfully!
                            </div>
                        )}

                        {linkingStatus === 'error' && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
                                ⚠️ {errorMessage}
                            </div>
                        )}

                        {lineUserId ? (
                            <div className="space-y-3">
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-2 text-emerald-400">
                                    <span className="text-xl">✅</span>
                                    <span className="font-medium">LINE Connected</span>
                                </div>
                                <a
                                    href={`https://line.me/R/ti/p/${process.env.NEXT_PUBLIC_LINE_BOT_BASIC_ID}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 rounded-xl border-2 border-[#06C755] text-[#06C755] hover:bg-[#06C755]/10 font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M20.3 10.5c0-4.6-4.6-8.4-10.3-8.4S-.3 5.9-.3 10.5c0 4.2 3.7 7.7 9.1 8.3v4.2l5.5-3c3.7-1 5.7-3.8 5.7-6.5z" />
                                    </svg>
                                    Chat with Bot
                                </a>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <button
                                    onClick={handleConnectLine}
                                    className="w-full py-3 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M20.3 10.5c0-4.6-4.6-8.4-10.3-8.4S-.3 5.9-.3 10.5c0 4.2 3.7 7.7 9.1 8.3v4.2l5.5-3c3.7-1 5.7-3.8 5.7-6.5z" />
                                    </svg>
                                    Connect LINE Account
                                </button>
                                <p className="text-xs text-white/40">
                                    Link your account to receive notifications.
                                </p>
                                <a
                                    href={`https://line.me/R/ti/p/${process.env.NEXT_PUBLIC_LINE_BOT_BASIC_ID}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full py-2 text-sm text-[#06C755] hover:text-[#05b34c] hover:underline transition-all"
                                >
                                    Chat with Bot (Manual Add)
                                </a>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
