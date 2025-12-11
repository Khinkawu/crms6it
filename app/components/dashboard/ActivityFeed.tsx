"use client";

import React from "react";
import { ActivityLog } from "../../../hooks/useActivityLogs";
import { LogAction } from "../../../types";
import { Clock, FileText } from "lucide-react";

interface ActivityFeedProps {
    activities: ActivityLog[];
}

// Format relative time
const formatTime = (timestamp: any): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "เมื่อสักครู่";
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    if (days === 1) return "เมื่อวาน";
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
};

export default function ActivityFeed({ activities }: ActivityFeedProps) {
    return (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                <h2 className="text-lg font-bold text-text flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" /> กิจกรรมล่าสุด (งานซ่อม)
                </h2>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-input-bg text-text-secondary">
                    {activities.length} รายการ
                </span>
            </div>

            <div className="overflow-y-auto custom-scrollbar p-0">
                {activities.length > 0 ? (
                    <div className="divide-y divide-border">
                        {activities.map((act) => {
                            // 1. Parse Status and Details (Handle Legacy Data)
                            let derivedStatus = act.status;
                            let displayDetails = act.details || "";

                            if (act.action === 'repair_update' && !derivedStatus && displayDetails) {
                                const match = displayDetails.match(/สถานะ:\s*([a-zA-Z_]+)(?:\s*-\s*(.*))?/);
                                if (match) {
                                    derivedStatus = match[1];
                                    displayDetails = match[2] || "";
                                }
                            }

                            // 2. Determine Styling based on Action & Status
                            let iconColor = "bg-gray-400";
                            let actionLabel = "ทำรายการ";

                            if (act.action === 'repair') {
                                iconColor = "bg-red-500";
                                actionLabel = "แจ้งซ่อม";
                            } else if (act.action === 'repair_update') {
                                if (derivedStatus === 'completed') {
                                    iconColor = "bg-emerald-500";
                                } else if (derivedStatus === 'in_progress' || derivedStatus === 'waiting_parts') {
                                    iconColor = "bg-amber-400";
                                } else if (derivedStatus === 'pending') {
                                    iconColor = "bg-red-500";
                                } else {
                                    iconColor = "bg-blue-500";
                                }
                                actionLabel = "อัปเดตงานซ่อม";
                            } else if (act.action === 'borrow') {
                                iconColor = "bg-amber-500";
                                actionLabel = "ยืมอุปกรณ์";
                            } else if (act.action === 'return') {
                                iconColor = "bg-emerald-500";
                                actionLabel = "คืนอุปกรณ์";
                            }

                            // 3. Format Header Text
                            let headerText = act.productName;
                            let statusLabel = "";

                            if (act.action === 'repair') {
                                const rawName = act.productName.replace(/^แจ้งซ่อม: /, '');
                                headerText = `แจ้งซ่อม: ${rawName}`;

                                if (act.zone) {
                                    const zoneLabel = act.zone === 'junior_high' ? 'ม.ต้น' : act.zone === 'senior_high' ? 'ม.ปลาย' : act.zone;
                                    headerText += ` (${zoneLabel})`;
                                }
                            } else if (act.action === 'repair_update') {
                                const rawName = act.productName.replace(/^อัปเดตงานซ่อม: /, '');
                                headerText = `อัปเดตงานซ่อม: ${rawName}`;

                                if (derivedStatus) {
                                    switch (derivedStatus) {
                                        case 'pending': statusLabel = "(รอดำเนินการ)"; break;
                                        case 'in_progress': statusLabel = "(กำลังดำเนินการ)"; break;
                                        case 'waiting_parts': statusLabel = "(รออะไหล่)"; break;
                                        case 'completed': statusLabel = "(เสร็จสิ้น)"; break;
                                        case 'cancelled': statusLabel = "(ยกเลิก)"; break;
                                        default: statusLabel = `(${derivedStatus})`;
                                    }
                                }
                            }

                            return (
                                <div key={act.id} className="stagger-item p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors flex gap-4 items-start group border-b border-gray-100 dark:border-gray-800 last:border-0">
                                    {/* Small Solid Status Dot */}
                                    <div className={`w-3 h-3 rounded-full ${iconColor} flex-shrink-0 shadow-sm mt-1.5 ring-2 ring-white dark:ring-gray-900`}></div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                                                {headerText} <span className={`font-normal ml-1 ${derivedStatus === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>{statusLabel}</span>
                                            </h3>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2">
                                                {formatTime(act.timestamp)}
                                            </span>
                                        </div>

                                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-2">
                                            <span>โดย {act.userName}</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                                            <span className="text-gray-400 dark:text-gray-500">{actionLabel}</span>
                                        </p>

                                        {/* Details Box */}
                                        {(displayDetails) && (
                                            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-lg p-3 shadow-sm text-xs text-gray-600 dark:text-gray-300 leading-relaxed group-hover:border-blue-100 dark:group-hover:border-blue-900/50 transition-colors">
                                                <span>"{displayDetails}"</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Image (Optional) */}
                                    {act.imageUrl && (
                                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                                            <img src={act.imageUrl} alt="Active" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                        <div className="mb-3 opacity-20">
                            <FileText size={48} />
                        </div>
                        <p>ยังไม่มีกิจกรรมล่าสุด</p>
                    </div>
                )}
            </div>
        </div>
    );
}
