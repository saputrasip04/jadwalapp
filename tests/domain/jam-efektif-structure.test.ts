import { describe, it, expect } from 'vitest';
import {
  DEFAULT_JAM_EFEKTIF,
  parseEffectiveScheduleStructure,
  recalculateJamEfektifFromParams,
  JamEfektifData,
} from '../../src/domain/jam-efektif-data';

describe('Integrasi Pengaturan Jam Efektif (Template Jam Efektif -> Jadwal Guru)', () => {
  it('harus memetakan slot pelajaran dan istirahat dari DEFAULT_JAM_EFEKTIF dengan benar', () => {
    const struct = parseEffectiveScheduleStructure(DEFAULT_JAM_EFEKTIF);

    // Senin: 11 JP
    expect(struct.slotsPerDay[0]!.length).toBe(11);
    expect(struct.slotsPerDay[0]![0]!.labelJam).toBe('UPACARA + 1');
    expect(struct.slotsPerDay[0]![0]!.pukul).toBe('06.30 - 07.25');

    // Selasa s/d Kamis: 11 JP
    expect(struct.slotsPerDay[1]!.length).toBe(11);
    expect(struct.slotsPerDay[1]![0]!.labelJam).toBe('1');
    expect(struct.slotsPerDay[1]![0]!.pukul).toBe('07.00 - 07.35');

    // Jumat: 6 JP
    expect(struct.slotsPerDay[4]!.length).toBe(6);
    expect(struct.slotsPerDay[4]![0]!.ket).toBe('EVENT JUMAT');

    // Batas Max JP per hari
    expect(struct.maxJpPerDay).toEqual([11, 11, 11, 11, 6]);
    expect(struct.totalJpRows).toBe(11);

    // Posisi istirahat di jadwal sekolah:
    // Selasa-Kamis istirahat setelah JP 4 dan JP 7
    // Senin istirahat setelah JP 5 dan JP 8
    // Jumat istirahat setelah JP 5
    expect(struct.breakAfterJps).toContain(4);
    expect(struct.breakAfterJps).toContain(5);
    expect(struct.breakAfterJps).toContain(7);
    expect(struct.breakAfterJps).toContain(8);

    // Cek istirahat hari Selasa di posisi JP 4
    const breakSelasaJp4 = struct.getBreakForDay(1, 4);
    expect(breakSelasaJp4).toBeDefined();
    expect(breakSelasaJp4?.label).toContain('ISTIRAHAT 25');
    expect(breakSelasaJp4?.pukul).toBe('09.20 - 09.45');

    // Cek istirahat hari Senin di posisi JP 5
    const breakSeninJp5 = struct.getBreakForDay(0, 5);
    expect(breakSeninJp5).toBeDefined();
    expect(breakSeninJp5?.label).toContain('ISTIRAHAT 15');
    expect(breakSeninJp5?.pukul).toBe('09.45 - 10.00');

    // Cek istirahat Sholat Jumat di posisi JP 5
    const breakJumatJp5 = struct.getBreakForDay(4, 5);
    expect(breakJumatJp5).toBeDefined();
    expect(breakJumatJp5?.label).toContain('ISTIRAHAT 130');
    expect(breakJumatJp5?.pukul).toBe('10.05 - 12.15');
  });

  it('harus reaktif saat parameter jam efektif diubah (misal jam mulai mundur)', () => {
    const customJe: JamEfektifData = JSON.parse(JSON.stringify(DEFAULT_JAM_EFEKTIF));
    customJe.cfgParams.startSelasaKamis = '07:00';
    recalculateJamEfektifFromParams(customJe);

    const struct = parseEffectiveScheduleStructure(customJe);
    // Jam 1 Selasa harus mulai 07.15 (setelah Yasin 15 menit dari 07.00)
    expect(struct.slotsPerDay[1]![0]!.start).toBe('07.15');
  });

  it('harus mengembalikan ID guru (guru.kode) sebagai kode yang muncul di jadwal resmi', async () => {
    const { getTeacherDisplayCode } = await import('../../src/domain/schedule-resolver');
    const mockGuru = {
      id: 'g-12345',
      kode: '4',
      nama: 'SAPUTRA INDRA PURNAMA, S.PD',
      nip_nik: null,
      sk_guru: 'PRODUKTIF PSPT',
      tipe_guru: 'PRODUKTIF' as const,
      setting_jp: 28,
      jp_min: null,
      jp_maks: null,
      maks_jp_hari: null,
      min_hari_bebas: null,
      maks_gap: null,
      aktif: 1,
    };

    // Harus mengembalikan ID '4', bukan 'PST4'
    expect(getTeacherDisplayCode(mockGuru)).toBe('4');

    // Jika guru tidak punya kode, fallback ke id
    const mockGuruNoKode = { ...mockGuru, kode: '' };
    expect(getTeacherDisplayCode(mockGuruNoKode)).toBe('g-12345');
  });
});

