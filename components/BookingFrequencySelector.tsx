"use client"

import React from "react"
import { type FrequencyMode } from "@/lib/bookingGroupUtils"
import { CalendarDays, CalendarRange, Repeat2 } from "lucide-react"

interface BookingFrequencySelectorProps {
    value: FrequencyMode
    onChange: (mode: FrequencyMode) => void
}

const OPTIONS: { mode: FrequencyMode; label: string; icon: React.ReactNode }[] = [
    { mode: "once",       label: "ครั้งเดียว",      icon: <CalendarDays size={15} /> },
    { mode: "multi_day",  label: "หลายวัน",          icon: <CalendarRange size={15} /> },
    { mode: "recurring",  label: "ทุกสัปดาห์",       icon: <Repeat2 size={15} /> },
]

export default function BookingFrequencySelector({ value, onChange }: BookingFrequencySelectorProps) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                ความถี่การจอง
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                {OPTIONS.map(({ mode, label, icon }) => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => onChange(mode)}
                        onTouchEnd={(e) => { e.preventDefault(); onChange(mode) }}
                        style={{ WebkitTapHighlightColor: "transparent" }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                            value === mode
                                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        }`}
                    >
                        {icon}
                        {label}
                    </button>
                ))}
            </div>
        </div>
    )
}
