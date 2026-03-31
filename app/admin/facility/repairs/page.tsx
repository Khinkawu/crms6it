"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FacilityRepairRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/manage/repairs?tab=facility");
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-transparent">
            <div className="animate-pulse text-amber-500 font-medium">
                กำลังเปลี่ยนเส้นทางไปยังหน้าจัดการงานซ่อมอาคาร...
            </div>
        </div>
    );
}
