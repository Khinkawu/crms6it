"use client";

import React from 'react';
import {
    X, Calendar, Clock, User, MapPin, FileText,
    Briefcase, Paperclip, GraduationCap, Box as BoxIcon, Link as LinkIcon, ExternalLink,
    Users, Armchair
} from 'lucide-react';
import moment from 'moment';
import 'moment/locale/th';

interface BookingEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resource?: any;
    roomName: string;
    requesterName: string;
    status: string;
}

interface BookingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: BookingEvent | null;
}

export default function BookingDetailsModal({ isOpen, onClose, event }: BookingDetailsModalProps) {
    if (!isOpen || !event) return null;

    const data = event.resource || {};

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:h-auto animate-zoom-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left Side: Header & Primary Info */}
                <div className="w-full md:w-2/5 bg-gradient-to-br from-blue-600 to-cyan-600 p-8 text-white relative overflow-hidden flex flex-col justify-between shrink-0">

                    {/* Decorative Elements */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                    <div className="absolute bottom-0 right-0 w-48 h-48 bg-black/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl"></div>

                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold mb-2 break-words leading-tight">
                            {event.title.split('(')[0]}
                        </h2>
                        <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                            <MapPin size={14} />
                            <span>{event.roomName}</span>
                        </div>
                    </div>

                    <div className="relative z-10 space-y-6 mt-8">
                        <div>
                            <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-1">วันและเวลา</p>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-lg">{moment(event.start).format('D MMMM YYYY')}</p>
                                    <p className="text-white/90">{moment(event.start).format('HH:mm')} - {moment(event.end).format('HH:mm')} น.</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-1">ผู้จอง</p>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                    <User size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-lg">{event.requesterName}</p>
                                    {(data.position || data.department) && (
                                        <p className="text-white/80 text-sm">
                                            {data.position} {data.department && `• ${data.department}`}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Details & Content */}
                <div className="flex-1 bg-white dark:bg-gray-800 flex flex-col relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full transition-colors z-10"
                    >
                        <X size={24} />
                    </button>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            รายละเอียดการจอง
                        </h3>

                        <div className="space-y-6">

                            {/* Meeting Link */}
                            {data.meetingLink && (
                                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                                        <LinkIcon size={14} /> ลิงก์การประชุม
                                    </p>
                                    <a
                                        href={data.meetingLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium hover:underline break-all"
                                    >
                                        {data.meetingLink} <ExternalLink size={14} />
                                    </a>
                                </div>
                            )}

                            {/* Description */}
                            {(data.description || data.details) && (
                                <div>
                                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <FileText size={16} /> รายละเอียดเพิ่มเติม
                                    </p>
                                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                        {data.description || data.details}
                                    </p>
                                </div>
                            )}

                            {/* Attendees & Room Layout */}
                            {(data.attendees || data.roomLayout) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {data.attendees && (
                                        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-xl p-4">
                                            <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                <Users size={14} /> จำนวนผู้เข้าร่วม
                                            </p>
                                            <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
                                                {data.attendees} คน
                                            </p>
                                        </div>
                                    )}
                                    {data.roomLayout && (
                                        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800 rounded-xl p-4">
                                            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                <BoxIcon size={14} /> การจัดห้อง
                                            </p>
                                            <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
                                                {data.roomLayout === 'u_shape' && 'รูปแบบตัว U'}
                                                {data.roomLayout === 'classroom' && 'แถวหน้ากระดาน'}
                                                {data.roomLayout === 'empty' && 'ไม่ต้องการโต๊ะ - เก้าอี้'}
                                                {data.roomLayout === 'other' && (
                                                    <span>
                                                        รูปแบบอื่น ๆ
                                                        {data.roomLayoutDetails && <span className="font-normal text-base text-gray-600 dark:text-gray-400 ml-2">({data.roomLayoutDetails})</span>}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Equipment */}
                            {(data.equipment?.length > 0 || data.ownEquipment) && (
                                <div>
                                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <Briefcase size={16} /> อุปกรณ์
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {data.equipment?.map((item: string, i: number) => {
                                            const isMic = item.includes("ไมค์") || item.toLowerCase().includes("mic");
                                            const micCountDisplay = isMic && data.micCount ? ` (${data.micCount} ตัว)` : '';
                                            return (
                                                <span key={i} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 font-medium">
                                                    {item}{micCountDisplay}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {data.ownEquipment && (
                                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                            <span className="font-semibold">※ นำมาเอง:</span> {data.ownEquipment}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Attachments */}
                            {data.attachments && data.attachments.length > 0 && (
                                <div>
                                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <Paperclip size={16} /> เอกสารแนบ
                                    </p>
                                    <div className="space-y-2">
                                        {data.attachments.map((url: string, index: number) => (
                                            <div key={index} className="flex items-center gap-2 overflow-hidden bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                                <ExternalLink size={14} className="text-blue-500 shrink-0" />
                                                <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                                                >
                                                    {url}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>


                    <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-8 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white rounded-xl font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                        >
                            ปิดหน้าต่าง
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
