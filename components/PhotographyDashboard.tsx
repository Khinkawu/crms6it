"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PhotographyJob } from "@/types";
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter
} from "recharts";
import { Calendar, TrendingUp, Users, Clock, MapPin, Activity } from "lucide-react";
import { format, startOfDay, eachDayOfInterval, isSameDay, getHours } from "date-fns";
import { th } from "date-fns/locale";

interface PhotographyDashboardProps {
    jobs: PhotographyJob[];
    allUsers: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function PhotographyDashboard({ jobs, allUsers }: PhotographyDashboardProps) {
    const [activeTab, setActiveTab] = useState<'timeline' | 'workload' | 'status' | 'heatmap' | 'location'>('timeline');

    // ====== 1. TIMELINE VIEW ======
    const timelineData = useMemo(() => {
        if (jobs.length === 0) return [];

        // Get date range
        const dates = jobs
            .map(j => j.startTime?.toDate?.() || new Date())
            .filter(d => d instanceof Date);

        if (dates.length === 0) return [];

        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

        // Create day-by-day timeline
        const days = eachDayOfInterval({ start: minDate, end: maxDate });

        return days.map(day => {
            const dayJobs = jobs.filter(j => {
                const jobDate = j.startTime?.toDate?.() || new Date();
                return isSameDay(jobDate, day);
            });

            return {
                date: format(day, 'dd MMM', { locale: th }),
                count: dayJobs.length,
                completed: dayJobs.filter(j => j.status === 'completed').length,
                assigned: dayJobs.filter(j => j.status === 'assigned').length,
                cancelled: dayJobs.filter(j => j.status === 'cancelled').length,
            };
        });
    }, [jobs]);

    // ====== 2. PHOTOGRAPHER WORKLOAD ======
    const workloadData = useMemo(() => {
        const workload: { [key: string]: { name: string; jobs: number; completed: number; pending: number } } = {};

        jobs.forEach(job => {
            (job.assigneeIds || []).forEach(id => {
                if (!workload[id]) {
                    const user = allUsers.find(u => u.uid === id);
                    workload[id] = {
                        name: user?.displayName || 'Unknown',
                        jobs: 0,
                        completed: 0,
                        pending: 0,
                    };
                }
                workload[id].jobs += 1;
                if (job.status === 'completed') workload[id].completed += 1;
                else if (job.status === 'assigned') workload[id].pending += 1;
            });
        });

        return Object.values(workload).sort((a, b) => b.jobs - a.jobs);
    }, [jobs, allUsers]);

    // ====== 3. JOB STATUS BREAKDOWN ======
    const statusData = useMemo(() => {
        const counts = {
            assigned: jobs.filter(j => j.status === 'assigned').length,
            completed: jobs.filter(j => j.status === 'completed').length,
            cancelled: jobs.filter(j => j.status === 'cancelled').length,
        };

        return [
            { name: 'รอส่งงาน', value: counts.assigned, color: '#f59e0b' },
            { name: 'ส่งงานแล้ว', value: counts.completed, color: '#10b981' },
            { name: 'ยกเลิก', value: counts.cancelled, color: '#ef4444' },
        ].filter(d => d.value > 0);
    }, [jobs]);

    // ====== 4. BUSY HOURS HEATMAP ======
    const heatmapData = useMemo(() => {
        const hourCounts = Array(24).fill(0);
        const dayHours: { [key: string]: number[] } = {};

        jobs.forEach(job => {
            const startDate = job.startTime?.toDate?.() || new Date();
            const hour = getHours(startDate);
            hourCounts[hour] += 1;

            const dayKey = format(startDate, 'EEEE', { locale: th });
            if (!dayHours[dayKey]) dayHours[dayKey] = Array(24).fill(0);
            dayHours[dayKey][hour] += 1;
        });

        return Array.from({ length: 24 }, (_, i) => ({
            hour: `${i.toString().padStart(2, '0')}:00`,
            count: hourCounts[i],
            intensity: hourCounts[i] / Math.max(...hourCounts, 1),
        }));
    }, [jobs]);

    // ====== 5. JOB LOCATION CLUSTER ======
    const locationData = useMemo(() => {
        const locations: { [key: string]: { name: string; count: number; completed: number } } = {};

        jobs.forEach(job => {
            const loc = job.location || 'Unknown';
            if (!locations[loc]) {
                locations[loc] = { name: loc, count: 0, completed: 0 };
            }
            locations[loc].count += 1;
            if (job.status === 'completed') locations[loc].completed += 1;
        });

        return Object.values(locations).sort((a, b) => b.count - a.count);
    }, [jobs]);

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
                {[
                    { id: 'timeline', label: '📅 Timeline', icon: Calendar },
                    { id: 'workload', label: '👥 Photographer Workload', icon: Users },
                    { id: 'status', label: '📊 Job Status', icon: Activity },
                    { id: 'heatmap', label: '🔥 Busy Hours', icon: Clock },
                    { id: 'location', label: '📍 Location Cluster', icon: MapPin },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                {/* 1. TIMELINE VIEW */}
                {activeTab === 'timeline' && (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Timeline — งานตากล้องตามวัน</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">ดูจำนวนงานในแต่ละวัน แยกตามสถานะ</p>
                        </div>
                        {timelineData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={timelineData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="assigned" stackId="a" fill="#f59e0b" name="รอส่งงาน" />
                                    <Bar dataKey="completed" stackId="a" fill="#10b981" name="ส่งงานแล้ว" />
                                    <Bar dataKey="cancelled" stackId="a" fill="#ef4444" name="ยกเลิก" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-80 flex items-center justify-center text-gray-500">ไม่มีข้อมูล</div>
                        )}
                    </div>
                )}

                {/* 2. PHOTOGRAPHER WORKLOAD */}
                {activeTab === 'workload' && (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Photographer Workload — ภาระงานต่อช่างภาพ</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">จำนวนงานและสถานะความสำเร็จต่อช่างภาพ</p>
                        </div>
                        {workloadData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={workloadData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={150} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="รอส่งงาน" />
                                    <Bar dataKey="completed" stackId="a" fill="#10b981" name="ส่งงานแล้ว" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-80 flex items-center justify-center text-gray-500">ไม่มีข้อมูล</div>
                        )}
                    </div>
                )}

                {/* 3. JOB STATUS BREAKDOWN */}
                {activeTab === 'status' && (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Job Status Breakdown — สัดส่วนสถานะงาน</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">ร้อยละของงานแต่ละสถานะ</p>
                        </div>
                        {statusData.length > 0 ? (
                            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                                <ResponsiveContainer width="100%" height={350}>
                                    <PieChart>
                                        <Pie
                                            data={statusData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, value }) => `${name}: ${value}`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {statusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="space-y-3">
                                    {statusData.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                                {item.name}: {item.value} งาน
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-80 flex items-center justify-center text-gray-500">ไม่มีข้อมูล</div>
                        )}
                    </div>
                )}

                {/* 4. BUSY HOURS HEATMAP */}
                {activeTab === 'heatmap' && (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Busy Hours Heatmap — ช่วงเวลาที่มีงานเยอะ</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">จำนวนงานตามชั่วโมงของวัน</p>
                        </div>
                        {heatmapData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={heatmapData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="hour" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#8b5cf6" name="จำนวนงาน" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-80 flex items-center justify-center text-gray-500">ไม่มีข้อมูล</div>
                        )}
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {heatmapData.slice(0, 8).map((hour, idx) => (
                                <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{hour.hour}</p>
                                    <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{hour.count}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">งาน</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 5. JOB LOCATION CLUSTER */}
                {activeTab === 'location' && (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Location Cluster — ตำแหน่งที่มีงานเยอะ</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">จำนวนงานแต่ละสถานที่</p>
                        </div>
                        {locationData.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={locationData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={150} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="count" fill="#14b8a6" name="รวมทั้งหมด" />
                                        <Bar dataKey="completed" fill="#10b981" name="เสร็จสิ้น" />
                                    </BarChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                                    {locationData.map((loc, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{loc.name}</span>
                                            <div className="flex gap-3">
                                                <span className="text-sm text-teal-600 dark:text-teal-400 font-semibold">{loc.count}</span>
                                                <span className="text-sm text-green-600 dark:text-green-400 font-semibold">({loc.completed} เสร็จ)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-80 flex items-center justify-center text-gray-500">ไม่มีข้อมูล</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
