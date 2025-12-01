"use client";

import React, { useState } from "react";
import { LogAction } from "../../utils/logger";

interface LogActivity {
    id: string;
    action: LogAction;
    productName: string;
    userName: string;
    details?: string;
    timestamp: any;
}

interface LogTableProps {
    logs: LogActivity[];
    title: string;
    onClose: () => void;
    onGenerateReport?: (startDate: string, endDate: string) => void;
    isLoading?: boolean;
}

export default function LogTable({ logs, title, onClose, onGenerateReport, isLoading = false }: LogTableProps) {
    const [filterAction, setFilterAction] = useState<LogAction | 'all'>('all');
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const filteredLogs = logs.filter(log => {
        const matchesAction = filterAction === 'all' || log.action === filterAction;
        // Date filtering is now handled server-side, but we keep this for safety if logs are pre-loaded
        // or if we want to filter within the fetched result set. 
        // However, if we fetch based on date, this might be redundant or restrictive if the user changes dates without fetching.
        // For now, let's assume the passed 'logs' are already the relevant ones, so we only filter by action.
        return matchesAction;
    });

    const handleGenerate = () => {
        if (onGenerateReport && startDate && endDate) {
            onGenerateReport(startDate, endDate);
        }
    };

    const getActionStyle = (action: LogAction) => {
        switch (action) {
            case 'borrow': return 'bg-orange-100 text-orange-700';
            case 'return': return 'bg-emerald-100 text-emerald-700';
            case 'requisition': return 'bg-purple-100 text-purple-700';
            case 'repair': return 'bg-red-100 text-red-700';
            case 'add':
            case 'create': return 'bg-blue-100 text-blue-700';
            case 'update': return 'bg-amber-100 text-amber-700';
            case 'delete': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-700';
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
            <div className="bg-card w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center bg-background">
                    <div>
                        <h2 className="text-2xl font-bold text-text flex items-center gap-2">
                            <span>📋</span> {title}
                        </h2>
                        <p className="text-text-secondary text-sm">ประวัติการใช้งานระบบและกิจกรรมต่างๆ</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-border/50 rounded-full transition-colors">
                        ✕
                    </button>
                </div>

                {/* Controls */}
                <div className="p-4 border-b border-border bg-gray-50/50 flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="text-xs font-bold text-text-secondary mb-1 block">ประเภทกิจกรรม</label>
                        <select
                            value={filterAction}
                            onChange={(e) => setFilterAction(e.target.value as any)}
                            className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary-start"
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
                        <label className="text-xs font-bold text-text-secondary mb-1 block">ตั้งแต่วันที่</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary-start"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-text-secondary mb-1 block">ถึงวันที่</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary-start"
                        />
                    </div>
                    {onGenerateReport && (
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !startDate || !endDate}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    กำลังโหลด...
                                </>
                            ) : (
                                <>
                                    ค้นหา
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                    <div className="bg-white p-4 min-w-[800px]">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-b-2 border-gray-200 text-gray-600">
                                    <th className="px-4 py-3 font-bold w-40">วัน-เวลา</th>
                                    <th className="px-4 py-3 font-bold w-32">กิจกรรม</th>
                                    <th className="px-4 py-3 font-bold">รายการ</th>
                                    <th className="px-4 py-3 font-bold w-40">ผู้ดำเนินการ</th>
                                    <th className="px-4 py-3 font-bold">รายละเอียด</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                                {log.timestamp?.toDate().toLocaleString('th-TH')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getActionStyle(log.action)}`}>
                                                    {getActionLabel(log.action)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                {log.productName}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {log.userName}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 italic">
                                                {log.details || "-"}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                                            ไม่พบข้อมูลตามเงื่อนไข
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between text-xs text-gray-400">
                            <p>Report Generated by CRMS6 IT System</p>
                            <p>Page 1 of 1</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
