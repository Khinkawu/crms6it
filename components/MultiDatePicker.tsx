"use client"

import React from "react"
import { Plus, X, Calendar } from "lucide-react"
import { formatThaiShortDate, formatThaiDayName } from "@/lib/bookingGroupUtils"
import { getTodayBangkok } from "@/lib/dateUtils"

interface MultiDatePickerProps {
    dates: string[]           // YYYY-MM-DD[]
    onChange: (dates: string[]) => void
}

export default function MultiDatePicker({ dates, onChange }: MultiDatePickerProps) {
    const today = getTodayBangkok()

    const addDate = () => {
        // Default to next day after last selected date, or today
        const lastDate = dates.length > 0 ? dates[dates.length - 1] : today
        const next = new Date(`${lastDate}T12:00:00Z`)
        next.setUTCDate(next.getUTCDate() + 1)
        const nextStr = next.toISOString().split("T")[0]
        onChange([...dates, nextStr])
    }

    const updateDate = (index: number, value: string) => {
        const updated = [...dates]
        updated[index] = value
        onChange(updated)
    }

    const removeDate = (index: number) => {
        onChange(dates.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-3">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                วันที่จอง
            </label>

            {dates.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    กดปุ่มด้านล่างเพื่อเพิ่มวัน
                </div>
            )}

            <div className="space-y-2">
                {dates.map((date, index) => (
                    <div key={index} className="flex items-center gap-2">
                        {/* Day label */}
                        <div className="flex-none w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                {index + 1}
                            </span>
                        </div>

                        {/* Date input */}
                        <div className="flex-1 relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                <Calendar size={14} className="text-gray-400" />
                            </div>
                            <input
                                type="date"
                                value={date}
                                min={today}
                                onChange={(e) => updateDate(index, e.target.value)}
                                className="w-full h-[42px] pl-9 pr-3 bg-transparent text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:[color-scheme:dark]"
                                required
                            />
                        </div>

                        {/* Thai date label */}
                        {date && (
                            <div className="hidden sm:block flex-none text-xs text-gray-500 dark:text-gray-400 text-right min-w-[80px]">
                                <div>{formatThaiShortDate(date)}</div>
                                <div className="text-gray-400">{formatThaiDayName(date)}</div>
                            </div>
                        )}

                        {/* Remove button */}
                        <button
                            type="button"
                            onClick={() => removeDate(index)}
                            className="flex-none p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={addDate}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
                <Plus size={16} />
                เพิ่มวัน
            </button>

            {dates.length > 1 && (
                <p className="text-xs text-gray-400 text-center">
                    รวม {dates.length} วัน
                </p>
            )}
        </div>
    )
}
