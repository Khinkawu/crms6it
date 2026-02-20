import type { RepairStatus } from '../types';

/**
 * Shared repair status helpers
 * Used by: useRepairTickets, line-webhook, RepairModal, RepairTicketCard, etc.
 */

export const getThaiStatus = (s: RepairStatus): string => {
    switch (s) {
        case 'pending': return 'รอดำเนินการ';
        case 'in_progress': return 'กำลังดำเนินการ';
        case 'waiting_parts': return 'รออะไหล่';
        case 'completed': return 'เสร็จสิ้น';
        case 'cancelled': return 'ยกเลิกงาน';
        default: return s;
    }
};

/** Returns Tailwind CSS badge classes */
export const getStatusColor = (s: RepairStatus): string => {
    switch (s) {
        case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
        case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
        case 'waiting_parts': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
        case 'completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
        default: return 'bg-slate-500/10 text-slate-600';
    }
};

/** Returns hex color string (for LINE Flex Messages) */
export const getStatusHexColor = (s: string): string => {
    switch (s) {
        case 'pending': return '#f59e0b';
        case 'in_progress': return '#3b82f6';
        case 'waiting_parts': return '#f97316';
        case 'completed': return '#10b981';
        default: return '#64748b';
    }
};
