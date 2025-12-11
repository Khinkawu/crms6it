"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "../../../hooks/useLiff";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { signInWithCustomToken } from "firebase/auth";
import { db, auth } from "../../../lib/firebase";
import RepairForm from "../../../components/repair/RepairForm";
import RepairHistory from "../../../components/repair/RepairHistory";
import { LiffSkeleton, LiffError, triggerHaptic } from "../../components/liff/LiffComponents";

export default function RepairLiffPage() {
    const { profile, isLoggedIn, isLoading: liffLoading, error } = useLiff(process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR || "");
    const router = useRouter();
    const [status, setStatus] = useState("กรุณารอสักครู่...");
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const checkBindingAndLogin = async () => {
            if (!isLoggedIn || !profile) return;

            try {
                // Optimize: Fast Path - Check if already logged in via Firebase
                if (auth.currentUser) {
                    setStatus("กำลังตรวจสอบสิทธิ์...");
                    setIsReady(true);
                    return;
                }

                // Optimize: Skip client-side getDoc. Use API to check binding & get token.
                setStatus("กำลังตรวจสอบการผูกบัญชี...");

                const res = await fetch("/api/auth/line-custom-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lineUserId: profile.userId })
                });

                if (res.status === 404) {
                    // Not bound -> Go to Entry
                    const currentLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR || "";
                    router.push(`/liff/entry?returnUrl=${encodeURIComponent("/liff/repair")}&liffId=${currentLiffId}`);
                    return;
                }

                if (!res.ok) throw new Error("Auth Failed");

                // User requested change for Sync step
                setStatus("กำลังอัปเดตข้อมูลผู้ใช้...");

                const { token } = await res.json();

                // Sign In to Firebase (Silent) - With Timeout
                const signInPromise = signInWithCustomToken(auth, token);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Login Timeout")), 10000)
                );

                await Promise.race([signInPromise, timeoutPromise]);

                setIsReady(true);

            } catch (err: any) {
                console.error("LIFF Login Error:", err);
                setStatus("เกิดข้อผิดพลาด: " + (err.message || "Login Failed"));
            }
        };

        checkBindingAndLogin();
    }, [isLoggedIn, profile, router]);

    // State for Tabs
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const initialTab = searchParams?.get('mode') === 'history' ? 'history' : 'new';
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

    // Sync tab with initial load
    useEffect(() => {
        if (initialTab === 'history') {
            setActiveTab('history');
        }
    }, [initialTab]);

    // Handle tab change with haptic feedback
    const handleTabChange = (tab: 'new' | 'history') => {
        triggerHaptic('light');
        setActiveTab(tab);
    };

    if (error) {
        return (
            <LiffError
                error={error}
                liffId={process.env.NEXT_PUBLIC_LINE_LIFF_ID_REPAIR}
                onRetry={() => window.location.reload()}
            />
        );
    }

    if (isReady) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Tab Navigation */}
                <div className="sticky top-0 z-20 bg-white shadow-sm border-b border-gray-100 flex">
                    <button
                        onClick={() => handleTabChange('new')}
                        className={`flex-1 py-3 text-sm font-semibold text-center transition-colors relative ${activeTab === 'new' ? 'text-blue-600' : 'text-gray-400'}`}
                    >
                        แจ้งซ่อม
                        {activeTab === 'new' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />}
                    </button>
                    <button
                        onClick={() => handleTabChange('history')}
                        className={`flex-1 py-3 text-sm font-semibold text-center transition-colors relative ${activeTab === 'history' ? 'text-blue-600' : 'text-gray-400'}`}
                    >
                        ประวัติ
                        {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />}
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'new' ? (
                        <RepairForm />
                    ) : (
                        <RepairHistory />
                    )}
                </div>
            </div>
        );
    }

    return <LiffSkeleton status={status} />;
}
