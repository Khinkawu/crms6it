"use client";

import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import RepairForm from "../../components/repair/RepairForm";
import { PageSkeleton } from "../components/ui/Skeleton";

export default function RepairPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    React.useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    if (authLoading) {
        return <PageSkeleton />;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <RepairForm />
        </div>
    );
}
