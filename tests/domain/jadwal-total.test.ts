// tests/domain/jadwal-total.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/schema';
import { ROMBELS_48 } from '../../src/features/03-matrix-sk/MatrixSKView';
import { generateFullScheduleFromTemplate, buildAllDefaultPairs } from '../../src/domain/template-blok-engine';

describe('Aliran Data Jadwal Total (Menu 9)', () => {
  beforeEach(async () => {
    await db.guru.clear();
    await db.kelas.clear();
    await db.mapel.clear();
    await db.setting.clear();
    await db.jadwal_run.clear();
    await db.jadwal_entry.clear();
  });

  it('memastikan ROMBELS_48 memiliki 48 kelas lengkap dengan ID yang valid', () => {
    expect(ROMBELS_48).toHaveLength(48);
    const xAk1 = ROMBELS_48.find((r) => r.id === 'X_AK_1');
    expect(xAk1).toBeDefined();
    expect(xAk1?.nama).toBe('X AK 1');
    expect(xAk1?.tingkat).toBe('X');
    expect(xAk1?.jurusanKode).toBe('AK');
  });

  it('generateFullScheduleFromTemplate membaca data guru dari matrix_sk_grid jika tersedia', async () => {
    // 1. Setup guru di db.guru
    await db.guru.bulkPut([
      {
        id: 'guru_latifah',
        nama: 'Latifah Ardian, S.Pd',
        kode: '10',
        nip_nik: null,
        sk_guru: 'PRODUKTIF PSPT',
        tipe_guru: 'PRODUKTIF',
        setting_jp: 28,
        jp_min: null,
        jp_maks: null,
        maks_jp_hari: null,
        min_hari_bebas: null,
        maks_gap: null,
        aktif: 1,
      },
    ]);

    // 2. Setup mapel di db.mapel
    await db.mapel.bulkPut([
      {
        id: 'mapel_pro_pspt',
        kode: 'PRO1PSPT',
        nama: 'Dasar-Dasar PSPT',
        kelompok: 'C2',
        jenis: 'PRODUKTIF',
        is_berat: 0,
        is_pjok: 0,
        butuh_lab: 1,
        lab_default_id: null,
        maks_jp_sesi: null,
        aktif: 1,
      },
    ]);

    // 3. Simpan penugasan guru_latifah ke rombel X_PSPT_1 di matrix_sk_grid
    await db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify({
        gridData: {
          guru_latifah: {
            X_PSPT_1: {
              mapelKode: 'PRO1PSPT',
              jp: 12,
              items: [{ mapelKode: 'PRO1PSPT', jp: 12 }],
            },
          },
        },
        teacherMapels: {},
      }),
      updated_at: new Date().toISOString(),
    });

    const pairs = buildAllDefaultPairs('TIPE_A');
    const pairsMap: Record<string, any> = {};
    pairs.forEach((p) => {
      pairsMap[p.id] = p;
    });

    const result = await generateFullScheduleFromTemplate('TIPE_A', pairsMap);
    expect(result.runId).toBeDefined();
    expect(result.totalEntries).toBeGreaterThan(0);

    // Cek bahwa entri jadwal untuk X_PSPT_1 menggunakan guru_latifah
    const entries = await db.jadwal_entry
      .where('[run_id+blok_no+kelas_id]')
      .equals([result.runId, 1, 'X_PSPT_1'])
      .toArray();

    const prodEntry = entries.find((e) => e.hari === 1);
    expect(prodEntry).toBeDefined();
    expect(prodEntry?.guru_id).toBe('guru_latifah');
  });
});
