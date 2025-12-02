"use client";

import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import BookingForm from "../components/BookingForm";

export default function BookingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    if (authLoading) return null;
    if (!user) {
        router.push("/login");
        return null;
    }

    return (
        <div className="animate-fade-in pb-20 min-h-screen bg-gray-50/50 dark:bg-gray-900">
            <div className="max-w-3xl mx-auto p-4 md:p-8">
                <BookingForm
                    onSuccess={() => {
                        // Optional: Redirect to dashboard or show success message
                        // toast is already handled in BookingForm
                        router.push("/");
                    }}
                    onCancel={() => router.push("/")}
                />
            </div>
        </div>
    );
}
