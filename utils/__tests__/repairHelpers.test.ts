import { describe, it, expect } from 'vitest';
import { getThaiStatus, getStatusColor, getStatusHexColor } from '../repairHelpers';
import type { RepairStatus } from '../../types';

const ALL_STATUSES: RepairStatus[] = ['pending', 'in_progress', 'waiting_parts', 'completed', 'cancelled'];

describe('getThaiStatus', () => {
    it('แปล pending', () => expect(getThaiStatus('pending')).toBe('รอดำเนินการ'));
    it('แปล in_progress', () => expect(getThaiStatus('in_progress')).toBe('กำลังดำเนินการ'));
    it('แปล waiting_parts', () => expect(getThaiStatus('waiting_parts')).toBe('รออะไหล่'));
    it('แปล completed', () => expect(getThaiStatus('completed')).toBe('เสร็จสิ้น'));
    it('แปล cancelled', () => expect(getThaiStatus('cancelled')).toBe('ยกเลิกงาน'));
    it('unknown status → คืน string เดิม', () => {
        expect(getThaiStatus('unknown' as RepairStatus)).toBe('unknown');
    });
});

describe('getStatusColor', () => {
    it('คืน string ที่ไม่ว่างสำหรับทุก status', () => {
        ALL_STATUSES.forEach(s => {
            expect(getStatusColor(s).length).toBeGreaterThan(0);
        });
    });

    it('pending → amber', () => expect(getStatusColor('pending')).toContain('amber'));
    it('completed → emerald', () => expect(getStatusColor('completed')).toContain('emerald'));
    it('in_progress → blue', () => expect(getStatusColor('in_progress')).toContain('blue'));
    it('cancelled → red', () => expect(getStatusColor('cancelled')).toContain('red'));
});

describe('getStatusHexColor', () => {
    it('คืน hex color ที่ valid', () => {
        const hexRegex = /^#[0-9a-f]{6}$/i;
        ['pending', 'in_progress', 'waiting_parts', 'completed', 'unknown'].forEach(s => {
            expect(getStatusHexColor(s)).toMatch(hexRegex);
        });
    });
});
