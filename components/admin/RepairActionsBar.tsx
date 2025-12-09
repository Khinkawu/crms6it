"use client";

import React, { useState } from 'react';
import { Download, Printer, FileSpreadsheet, Filter, X, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RepairTicket } from '../../types';
import { generateStockReport } from '@/lib/generateReport';
import { exportToExcel } from '../../utils/excelExport';
import toast from 'react-hot-toast';
import moment from 'moment';
import 'moment/locale/th'; // Import locale เพื่อให้แสดงวันที่เป็นภาษาไทย

interface RepairActionsBarProps {
    data: RepairTicket[];
    onFilterChange: (startDate: Date | null, endDate: Date | null) => void;
}

// ... (helpers remain unchanged)

// Helper: แปลง Zone เป็นภาษาไทย
const getZoneThai = (zone: string) => {
    switch (zone) {
        case 'senior_high': return 'ม.ปลาย';
        case 'junior_high': return 'ม.ต้น';
        case 'common': return 'ส่วนกลาง';
        case 'elementary': return 'ประถม';
        case 'kindergarten': return 'อนุบาล';
        case 'auditorium': return 'หอประชุม';
        default: return zone; // ถ้าไม่ตรงเคสไหนเลย ให้คืนค่าเดิม
    }
};

// Helper: แปลง Status เป็นภาษาไทย
const getThaiStatus = (s: string) => {
    switch (s) {
        case 'pending': return 'รอดำเนินการ';
        case 'in_progress': return 'กำลังดำเนินการ';
        case 'waiting_parts': return 'รออะไหล่';
        case 'completed': return 'เสร็จสิ้น';
        case 'cancelled': return 'ยกเลิกงาน';
        default: return s;
    }
};

export default function RepairActionsBar({ data, onFilterChange }: RepairActionsBarProps) {
    const { role } = useAuth();
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    if (!role || !['admin', 'technician', 'reporter', 'moderator'].includes(role)) return null;

    const handleFilter = () => {
        if (startDate && endDate) {
            onFilterChange(new Date(startDate), new Date(endDate));
        } else {
            toast.error("Please select both start and end dates.");
        }
    };

    const handleReset = () => {
        setStartDate("");
        setEndDate("");
        onFilterChange(null, null);
    };

    // ... (prepareReportData remains unchanged)
    // Helper to format data for the report (Updated Logic)
    const prepareReportData = (tickets: RepairTicket[]) => {
        return {
            ticketId: "SUMMARY",
            // ใช้ปี พ.ศ. แบบไทย
            reportDate: moment().add(543, 'years').format('D MMMM YYYY'),
            requester: "Admin System",
            items: tickets.map(t => {
                // 1. แปลงโซน
                const zoneThai = getZoneThai(t.zone || '');

                // 2. รวมเลขห้องกับโซน (ถ้ามีเลขห้อง)
                // ตรวจสอบว่าใน Interface RepairTicket มี field 'room' หรือไม่ (ถ้าไม่มีให้แก้เป็น t.location หรือ field ที่เก็บเลขห้อง)
                const locationDisplay = t.room
                    ? `${t.room} (${zoneThai})`
                    : zoneThai;

                // 3. จัดการวันที่ (รองรับทั้ง Firebase Timestamp และ Date object)
                let dateObj: Date;
                if (t.createdAt && typeof (t.createdAt as any).toDate === 'function') {
                    dateObj = (t.createdAt as any).toDate();
                } else {
                    dateObj = new Date(t.createdAt as any);
                }

                return {
                    code: t.id?.slice(0, 8) || '-', // ใช้ id แทน ticketId ที่ไม่มีอยู่จริง
                    name: t.description || '-',
                    zone: locationDisplay, // ✅ ใช้ค่าที่รวมห้องแล้ว
                    status: getThaiStatus(t.status),
                    requestDate: moment(dateObj).add(543, 'years').format('DD/MM/YY HH:mm'), // วันที่แจ้ง (พ.ศ.)
                    requesterName: t.requesterName || '-'
                };
            })
        };
    };

    const handleExportPDF = async () => {
        try {
            if (data.length === 0) {
                toast.error("No data to export");
                return;
            }
            toast.loading("Generating PDF...", { id: 'pdf-gen' });

            const reportData = prepareReportData(data);
            await generateStockReport(reportData, 'download');

            toast.success("PDF Generated", { id: 'pdf-gen' });
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate PDF", { id: 'pdf-gen' });
        }
    };

    const handleExportExcel = () => {
        try {
            if (data.length === 0) {
                toast.error("No data to export");
                return;
            }
            const dateStr = startDate ? `${startDate}_to_${endDate}` : 'All_Time';
            exportToExcel(data, `Repair_Report_${dateStr}`);
            toast.success("Excel exported successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to export Excel");
        }
    };

    const handlePrint = async () => {
        try {
            if (data.length === 0) {
                toast.error("No data to print");
                return;
            }
            toast.loading("Preparing print...", { id: 'print-gen' });

            const reportData = prepareReportData(data);
            await generateStockReport(reportData, 'print');

            toast.dismiss('print-gen');
        } catch (error) {
            console.error(error);
            toast.error("Failed to print", { id: 'print-gen' });
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm mb-6 flex flex-col xl:flex-row gap-4 justify-between items-center transition-colors">
            {/* Left: Date Filters */}
            <div className="flex flex-col sm:flex-row gap-2 items-center w-full xl:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={`px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm focus:border-blue-500 dark:focus:border-blue-400 outline-none w-full sm:w-40 transition-colors dark:[color-scheme:dark] appearance-none min-h-[38px] ${!startDate ? 'text-transparent' : ''
                                }`}
                        />
                        {!startDate && (
                            <div className="absolute inset-0 flex items-center px-3 pointer-events-none text-slate-400 dark:text-slate-500 text-sm gap-2">
                                <Calendar size={16} />
                                <span>Start Date</span>
                            </div>
                        )}
                    </div>
                    <span className="text-slate-400 dark:text-slate-500">-</span>
                    <div className="relative w-full sm:w-auto">
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className={`px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm focus:border-blue-500 dark:focus:border-blue-400 outline-none w-full sm:w-40 transition-colors dark:[color-scheme:dark] appearance-none min-h-[38px] ${!endDate ? 'text-transparent' : ''
                                }`}
                        />
                        {!endDate && (
                            <div className="absolute inset-0 flex items-center px-3 pointer-events-none text-slate-400 dark:text-slate-500 text-sm gap-2">
                                <Calendar size={16} />
                                <span>End Date</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleFilter}
                        className="flex-1 sm:flex-none px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Filter size={16} /> Filter
                    </button>
                    {(startDate || endDate) && (
                        <button
                            onClick={handleReset}
                            className="px-3 py-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Right: Actions */}
            <div className="grid grid-cols-3 sm:flex gap-2 w-full xl:w-auto">
                <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    title="Export as PDF"
                >
                    <Download size={18} /> <span className="hidden sm:inline">PDF</span><span className="sm:hidden">PDF</span>
                </button>
                <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    title="Export to Excel"
                >
                    <FileSpreadsheet size={18} /> <span className="hidden sm:inline">Excel</span><span className="sm:hidden">XLS</span>
                </button>
                <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    title="Print"
                >
                    <Printer size={18} /> <span className="hidden sm:inline">Print</span><span className="sm:hidden">Print</span>
                </button>
            </div>
        </div>
    );
}