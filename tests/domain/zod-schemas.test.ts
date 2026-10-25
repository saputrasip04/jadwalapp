import { describe, it, expect } from 'vitest';
import {
  JurusanSchema,
  MapelSchema,
  GuruSchema,
  KelasSchema,
  JamSlotSchema,
} from '../../src/lib/zod-schemas';

describe('Zod Schemas (Validasi Integritas Data)', () => {
  it('harus memvalidasi Jurusan yang benar termasuk 8 jurusan default', () => {
    const validJurusan = {
      id: 'jur-las',
      kode: 'LAS',
      nama: 'Teknik Pengelasan',
      color: '#3B82F6',
      urutan: 8,
      aktif: 1,
    };
    const res = JurusanSchema.safeParse(validJurusan);
    expect(res.success).toBe(true);
  });

  it('harus menolak Jurusan tanpa kode atau nama', () => {
    const invalid = {
      id: 'jur-x',
      kode: '',
      nama: '',
      color: 'blue',
      urutan: 1,
      aktif: 1,
    };
    const res = JurusanSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it('harus memvalidasi Mapel dengan tipe REGULER / PRODUKTIF', () => {
    const validMapel = {
      id: 'map-1',
      kode: 'MTK',
      nama: 'Matematika',
      kelompok: 'UMUM' as const,
      jenis: 'REGULER' as const,
      is_berat: 1,
      is_pjok: 0,
      maks_jp_sesi: 3,
      butuh_lab: 0,
      aktif: 1,
    };
    expect(MapelSchema.safeParse(validMapel).success).toBe(true);

    const invalidJenis = { ...validMapel, jenis: 'UMUM' };
    expect(MapelSchema.safeParse(invalidJenis).success).toBe(false);
  });

  it('harus memvalidasi Guru dengan batas jam dan beban', () => {
    const validGuru = {
      id: 'guru-1',
      kode: 'SPR',
      nip_nik: '198501012010011001',
      nama: 'Drs. Supriyanto, M.Pd.',
      maks_jp_hari: 6,
      min_hari_bebas: 1,
      maks_gap: 1,
      aktif: 1,
    };
    expect(GuruSchema.safeParse(validGuru).success).toBe(true);
  });

  it('harus memvalidasi JamSlot dengan waktu HH:mm', () => {
    const validSlot = {
      id: 'slot-1',
      template_id: 'tpl-1',
      hari: 1 as const,
      urutan: 1,
      tipe: 'JP' as const,
      jp_ke: 1,
      is_long_break: 0,
      mulai: '07:00',
      selesai: '07:45',
    };
    expect(JamSlotSchema.safeParse(validSlot).success).toBe(true);

    const invalidWaktu = { ...validSlot, mulai: '7:0' };
    expect(JamSlotSchema.safeParse(invalidWaktu).success).toBe(false);
  });
});
