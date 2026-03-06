"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import BookingForm from "@/components/BookingForm";
import { PageSkeleton } from "@/components/ui/Skeleton";

export default function BookingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    if (authLoading) {
        return <PageSkeleton />;
    }

    if (!user) {
        router.push("/login");
        return null;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">จองห้อง / คิว</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">จองห้องประชุม อุปกรณ์โสตฯ หรือคิวช่างภาพ</p>
            </div>
            <BookingForm
                onSuccess={() => router.push("/")}
                onCancel={() => router.push("/")}
            />
        </div>
    );
}
