import { describe, it, expect } from 'vitest';
import { getThaiAcademicYear, getThaiMonthNumber } from '../academicYear';

describe('getThaiAcademicYear', () => {
    it('Term 1: May → ปีการศึกษาปัจจุบัน semester 1', () => {
        const { academicYear, semester } = getThaiAcademicYear(new Date(2024, 4, 1)); // May 2024
        expect(academicYear).toBe(2567);
        expect(semester).toBe(1);
    });

    it('Term 1: October → ปีการศึกษาปัจจุบัน semester 1', () => {
        const { academicYear, semester } = getThaiAcademicYear(new Date(2024, 9, 31)); // Oct 2024
        expect(academicYear).toBe(2567);
        expect(semester).toBe(1);
    });

    it('Term 2: November → ปีการศึกษาปัจจุบัน semester 2', () => {
        const { academicYear, semester } = getThaiAcademicYear(new Date(2024, 10, 1)); // Nov 2024
        expect(academicYear).toBe(2567);
        expect(semester).toBe(2);
    });

    it('Term 2: December → ปีการศึกษาปัจจุบัน semester 2', () => {
        const { academicYear, semester } = getThaiAcademicYear(new Date(2024, 11, 31)); // Dec 2024
        expect(academicYear).toBe(2567);
        expect(semester).toBe(2);
    });

    it('Jan-Apr นับเป็นปีการศึกษาก่อนหน้า semester 2', () => {
        // Jan 2025 → ยังอยู่ใน ปีการศึกษา 2567 (เริ่ม May 2024)
        const { academicYear, semester } = getThaiAcademicYear(new Date(2025, 0, 1)); // Jan 2025
        expect(academicYear).toBe(2567);
        expect(semester).toBe(2);
    });

    it('April 2025 → ยังอยู่ใน ปีการศึกษา 2567', () => {
        const { academicYear, semester } = getThaiAcademicYear(new Date(2025, 3, 30)); // Apr 2025
        expect(academicYear).toBe(2567);
        expect(semester).toBe(2);
    });

    it('May 2025 → เริ่ม ปีการศึกษา 2568', () => {
        const { academicYear, semester } = getThaiAcademicYear(new Date(2025, 4, 1)); // May 2025
        expect(academicYear).toBe(2568);
        expect(semester).toBe(1);
    });
});

describe('getThaiMonthNumber', () => {
    it('January → "01"', () => {
        expect(getThaiMonthNumber(new Date(2024, 0, 15))).toBe('01');
    });

    it('December → "12"', () => {
        expect(getThaiMonthNumber(new Date(2024, 11, 15))).toBe('12');
    });
});
