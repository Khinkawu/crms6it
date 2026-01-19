"use client";

import React, { useState } from "react";
import { LogAction, ActivityLog } from "../../types";
import { Download, Printer, FileSpreadsheet, Search, X } from "lucide-react";
import toast from "react-hot-toast";

interface LogActivity {
    id: string;
    action: LogAction;
    productName: string;
    userName: string;
    details?: string;
    timestamp: any;
    signatureUrl?: string; // Added signatureUrl
}

interface LogTableProps {
    logs: LogActivity[];
    title: string;
    onClose: () => void;
    onGenerateReport?: (startDate: string, endDate: string, action?: string) => void;
    isLoading?: boolean;
}

export default function LogTable({ logs, title, onClose, onGenerateReport, isLoading = false }: LogTableProps) {
    const [filterAction, setFilterAction] = useState<LogAction | 'all'>('all');
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSignature, setSelectedSignature] = useState<string | null>(null);

    // Filter Logic
    const filteredLogs = logs.filter(log => {
        const matchesAction = filterAction === 'all' || log.action === filterAction;
        const matchesSearch =
            (log.productName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.userName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.details || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchesAction && matchesSearch;
    });

    const handleGenerate = () => {
        if (onGenerateReport && startDate && endDate) {
            onGenerateReport(startDate, endDate, filterAction);
        }
    };

    const handleExportPDF = async () => {
        try {
            if (filteredLogs.length === 0) {
                toast.error("No data to export");
                return;
            }
            toast.loading("Generating PDF...", { id: 'pdf-gen' });
            // Import the report generator (already implemented in lib/generateReport.ts)
            const { generateInventoryLogReport } = await import('@/lib/generateReport');
            await generateInventoryLogReport(filteredLogs, 'download');
            toast.success("PDF Generated", { id: 'pdf-gen' });
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate PDF", { id: 'pdf-gen' });
        }
    };

    const handleExportExcel = () => {
        // Placeholder for Excel Export logic - reusing existing logic if compatible or simple CSV
        toast.success("Excel feature coming soon");
    };

    const handlePrint = async () => {
        try {
            if (filteredLogs.length === 0) {
                toast.error("No data to print");
                return;
            }
            toast.loading("Preparing print...", { id: 'print-gen' });
            const { generateInventoryLogReport } = await import('@/lib/generateReport');
            await generateInventoryLogReport(filteredLogs, 'print');
            toast.dismiss('print-gen');
        } catch (error) {
            console.error(error);
            toast.error("Failed to print", { id: 'print-gen' });
        }
    };

    const getActionStyle = (action: LogAction) => {
        switch (action) {
            case 'borrow': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
            case 'return': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
            case 'requisition': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
            case 'repair': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
            case 'add':
            case 'create': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
            case 'update': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
            case 'delete': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const getActionLabel = (action: LogAction) => {
        switch (action) {
            case 'borrow': return 'ยืม';
            case 'return': return 'คืน';
            case 'requisition': return 'เบิก';
            case 'repair': return 'แจ้งซ่อม';
            case 'add': return 'เพิ่ม';
            case 'create': return 'สร้าง';
            case 'update': return 'แก้ไข';
            case 'delete': return 'ลบ';
            default: return action;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-card w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border">
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center bg-background">
                    <div>
                        <h2 className="text-2xl font-bold text-text flex items-center gap-2">
                            <span>📋</span> {title}
                        </h2>
                        <p className="text-text-secondary text-sm">ประวัติการใช้งานระบบและกิจกรรมต่างๆ</p>
                    </div>
                    <button onClick={onClose} aria-label="ปิด" className="p-2 hover:bg-border/50 rounded-full transition-colors text-text-secondary hover:text-text">
                        <X size={24} aria-hidden="true" />
                    </button>
                </div>

                {/* Controls */}
                <div className="p-4 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex flex-col gap-4">

                    {/* Top Row: Date & Filter */}
                    <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
                        <div className="flex flex-wrap gap-4 items-end w-full md:w-auto">
                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block">ประเภทกิจกรรม</label>
                                <select
                                    value={filterAction}
                                    onChange={(e) => setFilterAction(e.target.value as any)}
                                    className="px-3 py-2 rounded-lg border border-border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-start min-w-[140px]"
                                >
                                    <option value="all">ทั้งหมด</option>
                                    <option value="borrow">ยืม</option>
                                    <option value="return">คืน</option>
                                    <option value="requisition">เบิก</option>
                                    <option value="repair">แจ้งซ่อม</option>
                                    <option value="add">เพิ่มข้อมูล</option>
                                    <option value="update">แก้ไขข้อมูล</option>
                                    <option value="delete">ลบข้อมูล</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block">ตั้งแต่วันที่</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-start"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-1 block">ถึงวันที่</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-start"
                                />
                            </div>
                            {onGenerateReport && (
                                <button
                                    onClick={handleGenerate}
                                    disabled={isLoading || !startDate || !endDate}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-[38px]"
                                >
                                    {isLoading ? "กำลังโหลด..." : "ค้นหา"}
                                </button>
                            )}
                        </div>

                        {/* Export Actions */}
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={handleExportPDF}
                                className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                title="Export PDF"
                            >
                                <Download size={16} /> PDF
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                title="Export Excel"
                            >
                                <FileSpreadsheet size={16} /> Excel
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-3 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                title="Print"
                            >
                                <Printer size={16} /> Print
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Search */}
                    <div className="relative w-full">
                        <input
                            type="text"
                            placeholder="ค้นหา (ชื่อสินค้า, ผู้ดำเนินการ, รายละเอียด)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-white dark:bg-gray-700 text-sm focus:outline-none focus:border-primary-start"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <Search size={18} />
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white dark:bg-gray-900">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200">
                                    <th className="px-4 py-3 font-bold w-40">วัน-เวลา</th>
                                    <th className="px-4 py-3 font-bold w-32">กิจกรรม</th>
                                    <th className="px-4 py-3 font-bold">รายการ</th>
                                    <th className="px-4 py-3 font-bold w-40">ผู้ดำเนินการ</th>
                                    <th className="px-4 py-3 font-bold">รายละเอียด</th>
                                    <th className="px-4 py-3 font-bold w-24 text-center">ลายเซ็น</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {log.timestamp?.toDate().toLocaleString('th-TH')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getActionStyle(log.action)}`}>
                                                    {getActionLabel(log.action)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                                                {log.productName}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                                {log.userName}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 italic">
                                                {log.details || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {log.signatureUrl ? (
                                                    <button
                                                        onClick={() => setSelectedSignature(log.signatureUrl!)}
                                                        className="text-cyan-600 hover:text-cyan-800 underline text-xs"
                                                    >
                                                        ดูภาพ
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                                            ไม่พบข้อมูลตามเงื่อนไข
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50">
                            <p>Report Generated by CRMS6 IT System</p>
                            <p>Page 1 of 1</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Signature Preview Modal */}
            {selectedSignature && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedSignature(null)}
                >
                    <div className="bg-white p-2 rounded-xl max-w-lg w-full relative">
                        <button
                            onClick={() => setSelectedSignature(null)}
                            aria-label="ปิด"
                            className="absolute -top-4 -right-4 bg-white rounded-full p-2 text-black shadow-lg hover:bg-gray-100"
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                        <img src={selectedSignature} alt="Signature" className="w-full h-auto rounded-lg border" />
                        <p className="text-center text-gray-500 text-sm mt-2">ลายเซ็นผู้ยืม</p>
                    </div>
                </div>
            )}
        </div>
    );
}
