import { describe, expect, it } from 'vitest';
import { formatTaskDurationHours } from '@/modules/study/domain/disciplineStudyStats';

describe('formatTaskDurationHours', () => {
  it('formats zero and negative as 0h', () => {
    expect(formatTaskDurationHours(0)).toBe('0h');
    expect(formatTaskDurationHours(-5)).toBe('0h');
  });

  it('formats whole hours without decimal', () => {
    expect(formatTaskDurationHours(60)).toBe('1h');
    expect(formatTaskDurationHours(120)).toBe('2h');
  });

  it('formats fractional hours with one decimal', () => {
    expect(formatTaskDurationHours(90)).toBe('1.5h');
    expect(formatTaskDurationHours(45)).toBe('0.8h');
  });
});
