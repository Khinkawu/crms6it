import React from "react";
import RepairForm from "../../components/repair/RepairForm";

export const metadata = {
    title: "แจ้งซ่อม - CRMS6 IT",
    description: "ระบบแจ้งซ่อมอุปกรณ์ IT โรงเรียนเทศบาล 6 นครเชียงราย",
};

export default function RepairPage() {
    return (
        <div className="min-h-screen py-8 px-4 animate-fade-in">
            <RepairForm />
        </div>
    );
}
