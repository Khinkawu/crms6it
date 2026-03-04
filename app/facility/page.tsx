import React from "react";
import FacilityForm from "@/components/facility/FacilityForm";

export const metadata = {
    title: "แจ้งซ่อมอาคารสถานที่ - CRMS6",
    description: "ระบบแจ้งซ่อมอาคารสถานที่ โรงเรียนเทศบาล 6 นครเชียงราย",
};

export default function FacilityPage() {
    return (
        <div className="min-h-screen py-8 px-4 animate-fade-in">
            <FacilityForm />
        </div>
    );
}
