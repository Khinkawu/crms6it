"use client";

import React from 'react';
import { X, Calendar, Clock, User, MapPin, FileText } from 'lucide-react';
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative h-32 bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <div className="text-center px-6">
                        <h2 className="text-white text-2xl font-bold drop-shadow-md line-clamp-2">
                            {event.title.split('(')[0]}
                        </h2>
                    </div>

                    {/* Decorative circles */}
                    <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-xl"></div>
                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-black/10 rounded-full translate-x-1/3 translate-y-1/3 blur-xl"></div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">

                    {/* Details Grid */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">วันที่</p>
                                <p className="text-gray-800 dark:text-gray-200 font-semibold">
                                    {moment(event.start).format('D MMMM YYYY')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 dark:text-purple-400">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">เวลา</p>
                                <p className="text-gray-800 dark:text-gray-200 font-semibold">
                                    {moment(event.start).format('HH:mm')} - {moment(event.end).format('HH:mm')} น.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-600 dark:text-orange-400">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">สถานที่</p>
                                <p className="text-gray-800 dark:text-gray-200 font-semibold">
                                    {event.roomName}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                                <User size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">ผู้จอง</p>
                                <p className="text-gray-800 dark:text-gray-200 font-semibold">
                                    {event.requesterName}
                                </p>
                            </div>
                        </div>

                        {event.resource?.details && (
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-400">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">รายละเอียดเพิ่มเติม</p>
                                    <p className="text-gray-800 dark:text-gray-200 text-sm mt-1 leading-relaxed">
                                        {event.resource.details}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                    >
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
}
