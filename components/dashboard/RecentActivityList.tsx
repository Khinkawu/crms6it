"use client";

import React from "react";
import { motion } from "framer-motion";
import { User, MapPin, Clock, Wrench } from "lucide-react";

interface ActivityLog {
    id: string;
    action?: string;
    productName?: string;
    zone?: string;
    details?: string;
    userName?: string;
    status?: string;
    timestamp?: { toDate: () => Date };
}

interface RecentActivityListProps {
    activities: ActivityLog[];
}

const getZoneThai = (zone: string) => {
    switch (zone) {
        case 'senior_high': return 'ม.ปลาย';
        case 'junior_high': return 'ม.ต้น';
        case 'common': return 'ส่วนกลาง';
        case 'elementary': return 'ประถม';
        case 'kindergarten': return 'อนุบาล';
        case 'auditorium': return 'หอประชุม';
        default: return zone || '-';
    }
};

const getStatusInfo = (status: string) => {
    switch (status) {
        case 'pending': return { text: 'รอดำเนินการ', dot: 'bg-amber-400', label: 'text-amber-600 dark:text-amber-400' };
        case 'in_progress': return { text: 'กำลังดำเนินการ', dot: 'bg-blue-500', label: 'text-blue-600 dark:text-blue-400' };
        case 'waiting_parts': return { text: 'รออะไหล่', dot: 'bg-purple-500', label: 'text-purple-600 dark:text-purple-400' };
        case 'completed': return { text: 'เสร็จสิ้น', dot: 'bg-emerald-500', label: 'text-emerald-600 dark:text-emerald-400' };
        default: return { text: 'ใหม่', dot: 'bg-orange-400', label: 'text-orange-600 dark:text-orange-400' };
    }
};

export default function RecentActivityList({ activities }: RecentActivityListProps) {
    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Wrench size={28} className="mb-2 opacity-30" />
                <p className="text-xs">ยังไม่มีการแจ้งซ่อมล่าสุด</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {activities.slice(0, 5).map((activity, index) => {
                const statusInfo = getStatusInfo(activity.status || '');
                const zoneThai = getZoneThai(activity.zone || '');

                let roomNumber = activity.productName || '-';
                let department = 'โสตฯ';
                let deptColor = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';

                if (roomNumber.startsWith('ซ่อมอาคาร:')) {
                    roomNumber = roomNumber.replace('ซ่อมอาคาร:', '').trim();
                    department = 'อาคาร';
                    deptColor = 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
                }

                const isCompletionNote = activity.action === 'repair_update' && activity.status === 'completed';
                const detailsText = activity.details || '-';
                const timeStr = activity.timestamp?.toDate?.()?.toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return (
                    <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.06, duration: 0.3 }}
                        className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                    >
                        {/* Status dot */}
                        <div className="mt-1.5 flex-shrink-0">
                            <span className={`block w-2 h-2 rounded-full ${statusInfo.dot}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            {/* Row 1: Room + dept + status */}
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                        ห้อง {roomNumber}
                                    </span>
                                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${deptColor}`}>
                                        {department}
                                    </span>
                                </div>
                                <span className={`shrink-0 text-[11px] font-medium ${statusInfo.label}`}>
                                    {statusInfo.text}
                                </span>
                            </div>

                            {/* Row 2: Symptom */}
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-1">
                                <span className="text-gray-400 dark:text-gray-500 mr-1">
                                    {isCompletionNote ? '📝' : '⚠️'}
                                </span>
                                {detailsText}
                            </p>

                            {/* Row 3: Meta */}
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
                                <span className="flex items-center gap-1 min-w-0">
                                    <User size={10} />
                                    <span className="truncate max-w-[80px]">{activity.userName || 'ไม่ระบุ'}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <MapPin size={10} />
                                    {zoneThai}
                                </span>
                                {timeStr && (
                                    <span className="flex items-center gap-1 ml-auto">
                                        <Clock size={10} />
                                        {timeStr}
                                    </span>
                                )}
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
