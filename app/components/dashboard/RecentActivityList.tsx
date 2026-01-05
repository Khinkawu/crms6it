"use client";

import React from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";

interface ActivityLog {
    id: string;
    status?: string;
    productName?: string;
    zone?: string;
    details?: string;
    userName?: string;
    timestamp?: { toDate: () => Date };
}

interface RecentActivityListProps {
    activities: ActivityLog[];
}

// Helper to translate zone
const getZoneThai = (zone: string) => {
    switch (zone) {
        case 'senior_high': return 'ม.ปลาย';
        case 'junior_high': return 'ม.ต้น';
        case 'common': return 'ส่วนกลาง';
        case 'elementary': return 'ประถม';
        case 'kindergarten': return 'อนุบาล';
        case 'auditorium': return 'หอประชุม';
        default: return zone || '';
    }
};

// Helper for status badge
const getStatusBadge = (status: string) => {
    switch (status) {
        case 'pending': return { text: 'รอดำเนินการ', color: 'bg-amber-100 text-amber-700' };
        case 'in_progress': return { text: 'กำลังดำเนินการ', color: 'bg-blue-100 text-blue-700' };
        case 'waiting_parts': return { text: 'รออะไหล่', color: 'bg-purple-100 text-purple-700' };
        case 'completed': return { text: 'เสร็จสิ้น', color: 'bg-emerald-100 text-emerald-700' };
        default: return { text: 'ใหม่', color: 'bg-orange-100 text-orange-700' };
    }
};

export default function RecentActivityList({ activities }: RecentActivityListProps) {
    if (activities.length === 0) {
        return (
            <p className="text-sm text-gray-400 text-center py-6">
                ยังไม่มีกิจกรรม
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {activities.slice(0, 3).map((activity, index) => {
                const status = getStatusBadge(activity.status || '');
                const roomNumber = activity.productName || '-';
                const zoneThai = getZoneThai(activity.zone || '');

                return (
                    <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    >
                        {/* Header: Status + Time */}
                        <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                                {status.text}
                            </span>
                            <span className="text-xs text-gray-400">
                                {activity.timestamp?.toDate?.()?.toLocaleTimeString('th-TH', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                ห้อง {roomNumber}
                            </span>
                            {zoneThai && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                                    {zoneThai}
                                </span>
                            )}
                        </div>

                        {/* Description */}
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">
                            {activity.details || 'แจ้งซ่อม'}
                        </p>

                        {/* Reporter */}
                        {activity.userName && (
                            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                                <User size={12} />
                                {activity.userName}
                            </p>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
}
