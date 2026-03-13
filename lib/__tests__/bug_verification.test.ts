import { describe, it, expect } from 'vitest';
import { formatThaiDate } from '../dateUtils';

describe('Bug Fix: Timezone Formatting', () => {
  it('should format date in Bangkok timezone (UTC+7) even if server is UTC', () => {
    // 2026-03-13T10:00:00Z is 17:00:00 in Bangkok
    const date = new Date('2026-03-13T10:00:00Z');
    
    // We expect 17:00
    const result = formatThaiDate(date, { includeTime: true, includeYear: true });
    expect(result).toContain('17:00');
    expect(result).toContain('13 มี.ค. 2569');
  });

  it('should handle late night UTC (early morning BKK)', () => {
    // 2026-03-13T20:00:00Z is 03:00:00 on March 14 in Bangkok
    const date = new Date('2026-03-13T20:00:00Z');
    
    const result = formatThaiDate(date, { includeTime: true, includeYear: true });
    expect(result).toContain('14 มี.ค. 2569');
    expect(result).toContain('03:00');
  });
});
