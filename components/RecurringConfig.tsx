"use client"

import React, { useMemo } from "react"
import { Calendar } from "lucide-react"
import {
    ALL_DAYS,
    DAY_LABELS,
    generateOccurrences,
    describeRecurrence,
    type DayOfWeek,
} from "@/lib/bookingGroupUtils"
import { getTodayBangkok } from "@/lib/dateUtils"

export interface RecurringConfigValue {
    days: DayOfWeek[]
    startDate: string   // YYYY-MM-DD
    endDate: string     // YYYY-MM-DD — empty string = auto (18 weeks)
}

interface RecurringConfigProps {
    value: RecurringConfigValue
    onChange: (v: RecurringConfigValue) => void
}

export default function RecurringConfig({ value, onChange }: RecurringConfigProps) {
    const today = getTodayBangkok()

    const toggleDay = (day: DayOfWeek) => {
        const days = value.days.includes(day)
            ? value.days.filter(d => d !== day)
            : [...value.days, day]
        onChange({ ...value, days })
    }

    const preview = useMemo(() => {
        if (value.days.length === 0 || !value.startDate) return null
        const dates = generateOccurrences({
            days: value.days,
            startDate: value.startDate,
            endDate: value.endDate || undefined,
        })
        return { count: dates.length, label: describeRecurrence(value.days, dates.length) }
    }, [value.days, value.startDate, value.endDate])

    return (
        <div className="space-y-4">
            {/* Day-of-week selector */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                    วันในสัปดาห์
                </label>
                <div className="flex gap-1.5 flex-wrap">
                    {ALL_DAYS.map(day => (
                        <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            onTouchEnd={(e) => { e.preventDefault(); toggleDay(day) }}
                            style={{ WebkitTapHighlightColor: "transparent" }}
                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                                value.days.includes(day)
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                        >
                            {DAY_LABELS[day]}
                        </button>
                    ))}
                </div>
                {value.days.length === 0 && (
                    <p className="text-xs text-red-400">กรุณาเลือกอย่างน้อย 1 วัน</p>
                )}
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                        ตั้งแต่วันที่
                    </label>
                    <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                            <Calendar size={14} className="text-gray-400" />
                        </div>
                        <input
                            type="date"
                            value={value.startDate}
                            min={today}
                            onChange={e => onChange({ ...value, startDate: e.target.value })}
                            className="w-full h-[42px] pl-9 pr-2 bg-transparent text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none dark:[color-scheme:dark]"
                            required
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                        ถึงวันที่ <span className="text-gray-400 font-normal">(ไม่บังคับ)</span>
                    </label>
                    <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                            <Calendar size={14} className="text-gray-400" />
                        </div>
                        <input
                            type="date"
                            value={value.endDate}
                            min={value.startDate || today}
                            onChange={e => onChange({ ...value, endDate: e.target.value })}
                            className="w-full h-[42px] pl-9 pr-2 bg-transparent text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none dark:[color-scheme:dark]"
                        />
                    </div>
                </div>
            </div>

            {/* Preview */}
            {preview && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-none" />
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        จะสร้าง <span className="font-bold">{preview.count} ครั้ง</span>
                        {!value.endDate && ` (${18} สัปดาห์)`}
                        {" · "}{preview.label}
                    </p>
                </div>
            )}
        </div>
    )
}
