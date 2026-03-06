"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RepairRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/admin/repairs");
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-transparent">
            <div className="animate-pulse text-gray-500 font-medium">
                กำลังเปลี่ยนเส้นทาง...
            </div>
        </div>
    );
}
