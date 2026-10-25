import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  formatMinutesToTime,
  addMinutesToTime,
  calculateDurationMinutes,
} from '../../src/domain/time';

describe('Time utilities', () => {
  it('harus mem-parsing jam ke menit dengan benar', () => {
    expect(parseTimeToMinutes('07:00')).toBe(420);
    expect(parseTimeToMinutes('07:45')).toBe(465);
    expect(parseTimeToMinutes('12:30')).toBe(750);
  });

  it('harus memformat menit ke format jam HH:MM', () => {
    expect(formatMinutesToTime(420)).toBe('07:00');
    expect(formatMinutesToTime(465)).toBe('07:45');
  });

  it('harus menambahkan menit ke jam', () => {
    expect(addMinutesToTime('07:00', 45)).toBe('07:45');
    expect(addMinutesToTime('10:00', 15)).toBe('10:15');
  });

  it('harus menghitung durasi antara dua jam', () => {
    expect(calculateDurationMinutes('07:00', '07:45')).toBe(45);
    expect(calculateDurationMinutes('10:00', '10:15')).toBe(15);
  });
});
