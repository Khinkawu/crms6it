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

    const thaiMonths = shortMonth
        ? ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
        : ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

    const day = d.getDate();
    const month = thaiMonths[d.getMonth()];
    const year = d.getFullYear() + 543; // Convert to Buddhist Era

    let result = `${day} ${month}`;
    if (includeYear) result += ` ${year}`;

    if (includeTime) {
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        result += ` ${hours}:${minutes}`;
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
