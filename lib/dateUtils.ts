/**
 * Date utilities for Bangkok Timezone (UTC+7)
 * Ensures consistent date handling across the application
 */

/**
 * Get current date in Bangkok timezone as YYYY-MM-DD string
 * This is the correct format for HTML date inputs
 */
export function getBangkokDateString(date?: Date): string {
    const d = date || new Date();
    // Shift to Bangkok time (UTC+7)
    const bkkDate = new Date(d.getTime() + (7 * 60 * 60 * 1000));
    return bkkDate.toISOString().split('T')[0];
}

/**
 * Get today's date in Bangkok timezone as YYYY-MM-DD string
 */
export function getTodayBangkok(): string {
    return getBangkokDateString(new Date());
}

/**
 * Format a Date or Timestamp to Thai display format
 * Example: "21 ธ.ค. 2568" or "21 ธ.ค. 2568 14:30"
 */
export function formatThaiDate(
    date: Date | { toDate: () => Date } | string | number,
    options?: {
        includeTime?: boolean;
        includeYear?: boolean;
        shortMonth?: boolean;
    }
): string {
    const { includeTime = false, includeYear = true, shortMonth = true } = options || {};

    let d: Date;
    if (date instanceof Date) {
        d = date;
    } else if (typeof date === 'object' && 'toDate' in date) {
        d = date.toDate();
    } else {
        d = new Date(date);
    }

    if (isNaN(d.getTime())) return '-';

    // Use Intl.DateTimeFormat to force Bangkok timezone (UTC+7)
    // This ensures consistent time regardless of server environment
    const formatter = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: shortMonth ? 'short' : 'long',
        year: 'numeric',
        hour: includeTime ? '2-digit' : undefined,
        minute: includeTime ? '2-digit' : undefined,
        hour12: false,
    });

    const parts = formatter.formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const yearValue = parts.find(p => p.type === 'year')?.value || '';

    let result = `${day} ${month}`;
    if (includeYear) result += ` ${yearValue}`;

    if (includeTime) {
        const hour = parts.find(p => p.type === 'hour')?.value || '00';
        const minute = parts.find(p => p.type === 'minute')?.value || '00';
        result += ` ${hour}:${minute}`;
    }

    return result;
}

/**
 * Format time from Date or Timestamp to HH:MM
 */
export function formatThaiTime(date: Date | { toDate: () => Date }): string {
    const d = date instanceof Date ? date : date.toDate();
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}
