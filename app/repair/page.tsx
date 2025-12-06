"use client";

import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import RepairForm from "../../components/repair/RepairForm";

export default function RepairPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    React.useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    if (authLoading || !user) return null;

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <RepairForm />
        </div>
    );
}
