/**
 * bookingGroupUtils.ts — Pure utilities for recurring/multi-day booking groups
 * No Firebase imports — safe to use on both client and server.
 */

export type FrequencyMode = 'once' | 'multi_day' | 'recurring'
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const WEEKS_AHEAD = 18

const DAY_OF_WEEK: Record<DayOfWeek, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

export const DAY_LABELS: Record<DayOfWeek, string> = {
    mon: 'จ', tue: 'อ', wed: 'พ', thu: 'พฤ', fri: 'ศ', sat: 'ส', sun: 'อา',
}

export const ALL_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * Generate all dates matching the given weekday pattern.
 * Uses plain date arithmetic — no timezone issues since we work in YYYY-MM-DD strings.
 */
export function generateOccurrences(config: {
    days: DayOfWeek[]
    startDate: string    // YYYY-MM-DD
    endDate?: string     // YYYY-MM-DD — if omitted, defaults to startDate + 18 weeks
}): string[] {
    const { days, startDate, endDate } = config
    const targetDays = new Set(days.map(d => DAY_OF_WEEK[d]))

    // Work with plain UTC midnight dates to avoid DST issues
    const start = new Date(`${startDate}T00:00:00Z`)
    const end = endDate
        ? new Date(`${endDate}T00:00:00Z`)
        : new Date(start.getTime() + WEEKS_AHEAD * 7 * 24 * 60 * 60 * 1000)

    const dates: string[] = []
    const cursor = new Date(start)

    while (cursor <= end) {
        if (targetDays.has(cursor.getUTCDay())) {
            const y = cursor.getUTCFullYear()
            const m = String(cursor.getUTCMonth() + 1).padStart(2, '0')
            const d = String(cursor.getUTCDate()).padStart(2, '0')
            dates.push(`${y}-${m}-${d}`)
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    return dates
}

/**
 * Format YYYY-MM-DD to Thai short date: "23 มี.ค. 2569"
 */
export function formatThaiShortDate(dateStr: string): string {
    const d = new Date(`${dateStr}T12:00:00Z`) // noon to avoid edge cases
    return d.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Bangkok',
    })
}

/**
 * Format YYYY-MM-DD to Thai day name: "วันจันทร์"
 */
export function formatThaiDayName(dateStr: string): string {
    const d = new Date(`${dateStr}T12:00:00Z`)
    return d.toLocaleDateString('th-TH', {
        weekday: 'long',
        timeZone: 'Asia/Bangkok',
    })
}

/**
 * Describe a recurring pattern in Thai
 * e.g. "จ/พ/ศ × 18 สัปดาห์"
 */
export function describeRecurrence(days: DayOfWeek[], count: number): string {
    const dayStr = days.map(d => DAY_LABELS[d]).join('/')
    return `${dayStr} × ${count} ครั้ง`
}
