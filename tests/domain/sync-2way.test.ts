// tests/domain/sync-2way.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/schema';
import {
  assignTeacherToMapelAutoSync,
  removeTeacherFromMapelAutoSync,
  assignMapelToGuruAutoSync,
  removeMapelFromGuruAutoSync,
  applyTeamTeachingSplitAutoSync,
  isMapelProduktif,
  isSameTeacher,
  getCellItems,
  cellContainsMapel,
  getCellMapelJp,
  isTeacherCompatibleWithMapel,
} from '../../src/domain/sync-mapel-matrix';

describe('Logika Aliran Otomatis 2 Arah (Daftar Mapel & Matrix SK)', () => {
  const sampleTeacher = {
    id: 'guru_3',
    nama: 'Dadang Hendra Kusuma, S.Pd.I.',
    kode: '3',
  };

  beforeEach(async () => {
    await db.guru.clear();
    await db.guru.put({
      id: sampleTeacher.id,
      nama: sampleTeacher.nama,
      kode: sampleTeacher.kode,
      nip_nik: null,
      sk_guru: 'PAI',
      tipe_guru: 'REGULER',
      setting_jp: 28,
      jp_min: null,
      jp_maks: null,
      maks_jp_hari: null,
      min_hari_bebas: null,
      maks_gap: null,
      aktif: 1,
    });
    await db.setting.clear();
  });

  it('mencocokkan nama guru dengan berbagai variasi gelar (isSameTeacher)', () => {
    expect(isSameTeacher('Dadang Hendra Kusuma, S.Pd.I.', 'DADANG HENDRA KUSUMA, S.PDI')).toBe(true);
    expect(isSameTeacher('Mashuri, S.Pd.I.', 'MASHURI, S.PDI')).toBe(true);
    expect(isSameTeacher('Imam Hambali, S.Pd.', 'IMAM HAMBALI, S.PD')).toBe(true);
    expect(isSameTeacher('Dadang Hendra Kusuma', 'Hartono')).toBe(false);
  });

  it('Arah 1: Menambah guru di Daftar Mapel OTOMATIS mengisi mapel di Matrix SK', async () => {
    // 1. Dadang ditugaskan ke PAI 1 di Menu Daftar Mapel
    const res = await assignTeacherToMapelAutoSync('PAI1', sampleTeacher, 3);

    // Verifikasi di Daftar Mapel
    const pai1 = res.updatedMapelList.find((m) => m.kode === 'PAI1');
    expect(pai1).toBeDefined();
    expect(pai1?.guru).toContain(sampleTeacher.nama);
    expect(pai1?.guruJp?.[sampleTeacher.nama]).toBe(3);

    // Verifikasi OTOMATIS masuk ke Matrix SK untuk Dadang
    const dadangBadges = res.updatedMatrixGrid.teacherMapels[sampleTeacher.id];
    expect(dadangBadges).toBeDefined();
    expect(dadangBadges?.some((b) => b.kode === 'PAI1')).toBe(true);
    expect(dadangBadges?.find((b) => b.kode === 'PAI1')?.jp).toBe(3);
  });

  it('Arah 1: Melepas guru di Daftar Mapel OTOMATIS melepaskan mapel di Matrix SK', async () => {
    // Siapkan guru mengampu PAI 1
    await assignTeacherToMapelAutoSync('PAI1', sampleTeacher, 3);

    // Lepas Dadang dari PAI 1
    const res = await removeTeacherFromMapelAutoSync('PAI1', sampleTeacher.nama);

    // Verifikasi di Daftar Mapel
    const pai1 = res.updatedMapelList.find((m) => m.kode === 'PAI1');
    expect(pai1?.guruJp?.[sampleTeacher.nama]).toBeUndefined();

    // Verifikasi OTOMATIS lepas dari Matrix SK
    const dadangBadges = res.updatedMatrixGrid.teacherMapels[sampleTeacher.id];
    expect(dadangBadges?.some((b) => b.kode === 'PAI1')).toBe(false);
  });

  it('Arah 2: Menambah Mapel di Matrix SK OTOMATIS mengisi guru di Daftar Mapel', async () => {
    // Di Matrix SK, Dadang diberi mapel MTK1 (4 JP)
    const res = await assignMapelToGuruAutoSync(sampleTeacher, {
      kode: 'MTK1',
      mapel: 'MATEMATIKA 1',
      jp: 4,
      tingkat: 'X',
      kategori: 'UMUM',
    });

    // Verifikasi di Matrix SK
    const dadangBadges = res.updatedMatrixGrid.teacherMapels[sampleTeacher.id];
    expect(dadangBadges?.some((b) => b.kode === 'MTK1')).toBe(true);

    // Verifikasi OTOMATIS terdaftar di Daftar Mapel
    const mtk1 = res.updatedMapelList.find((m) => m.kode === 'MTK1');
    expect(mtk1).toBeDefined();
    expect(mtk1?.guru).toContain(sampleTeacher.nama);
    expect(mtk1?.guruJp?.[sampleTeacher.nama]).toBe(4);
  });

  it('Arah 2: Melepas Mapel di Matrix SK OTOMATIS melepaskan guru di Daftar Mapel', async () => {
    // Siapkan penugasan MTK1 di Matrix SK
    await assignMapelToGuruAutoSync(sampleTeacher, {
      kode: 'MTK1',
      mapel: 'MATEMATIKA 1',
      jp: 4,
      tingkat: 'X',
      kategori: 'UMUM',
    });

    // Lepas MTK1 dari Dadang di Matrix SK
    const res = await removeMapelFromGuruAutoSync(sampleTeacher, 'MTK1');

    // Verifikasi di Matrix SK
    const dadangBadges = res.updatedMatrixGrid.teacherMapels[sampleTeacher.id];
    expect(dadangBadges?.some((b) => b.kode === 'MTK1')).toBe(false);

    // Verifikasi OTOMATIS terlepas di Daftar Mapel
    const mtk1 = res.updatedMapelList.find((m) => m.kode === 'MTK1');
    expect(mtk1?.guruJp?.[sampleTeacher.nama]).toBeUndefined();
  });

  it('Guru Serombel: Mencocokkan guru serombel dari data SK GURU untuk PAI dan PSPT', async () => {
    const { findMatchingTeachersForMapel } = await import('../../src/domain/curriculum-data');

    const teachersList = [
      { id: 'g2', kode: '2', nama: 'MASHURI, S.PDI', sk_guru: 'PENDIDIKAN AGAMA ISLAM' },
      { id: 'g3', kode: '3', nama: 'DADANG HENDRA KUSUMA, S.PDI', sk_guru: 'PENDIDIKAN AGAMA ISLAM' },
      { id: 'g4', kode: '4', nama: 'IMAM HAMBALI, S.PD', sk_guru: 'PENDIDIKAN AGAMA ISLAM' },
      { id: 'g76', kode: '82', nama: 'MOHAMMAD APRI SASTRIYONO', sk_guru: 'PRODUKTIF PSPT' },
      { id: 'g77', kode: '83', nama: 'LATIFAH ARDIANA', sk_guru: 'PRODUKTIF PSPT' },
      { id: 'g78', kode: '84', nama: 'VERY KURNIAWAN', sk_guru: 'PRODUKTIF PSPT' },
      { id: 'g10', kode: '10', nama: 'BUDI SANTOSO', sk_guru: 'MATEMATIKA' },
    ];

    // Mapel PAI 1
    const paiMapel = {
      no: 1,
      kode: 'PAI1',
      mapel: 'PENDIDIKAN AGAMA ISLAM 1',
      jp: 3,
      kategori: 'UMUM',
      tingkat: 'X' as const,
    };
    const paiMatched = findMatchingTeachersForMapel(paiMapel, teachersList);
    expect(paiMatched.length).toBe(3);
    expect(paiMatched.map((g) => g.kode)).toEqual(['2', '3', '4']);

    // Mapel Produktif 1 PSPT
    const psptMapel = {
      no: 36,
      kode: 'PRO1PSPT',
      mapel: 'PRODUKTIF 1 FASE E PSPT',
      jp: 12,
      kategori: 'PSPT',
      tingkat: 'X' as const,
    };
    const psptMatched = findMatchingTeachersForMapel(psptMapel, teachersList);
    expect(psptMatched.length).toBe(3);
    expect(psptMatched.map((g) => g.kode)).toEqual(['82', '83', '84']);
  });

  it('Guru Serombel: Mencocokkan guru serombel IPAS (ILMU PENGETAHUAN ALAM DAN SOSIAL) dari kolom SK GURU', async () => {
    const { findMatchingTeachersForMapel } = await import('../../src/domain/curriculum-data');

    const teachersList = [
      { id: 'g32', kode: '32', nama: 'MOH ALI, S.T', sk_guru: 'ILMU PENGETAHUAN ALAM DAN SOSIAL' },
      { id: 'g33', kode: '33', nama: 'HADI PRIYO UTOMO, S.Si S.Pd', sk_guru: 'ILMU PENGETAHUAN ALAM DAN SOSIAL' },
      { id: 'g34', kode: '34', nama: 'ENI KURNIASIH, S.Pd', sk_guru: 'PROJEK IPAS' },
      { id: 'g10', kode: '10', nama: 'BUDI SANTOSO', sk_guru: 'MATEMATIKA' },
    ];

    const ipasMapel = {
      no: 17,
      kode: 'IPAS',
      mapel: 'ILMU PENGETAHUAN ALAM DAN SOSIAL',
      jp: 6,
      kategori: 'UMUM',
      tingkat: 'X' as const,
    };

    const ipasMatched = findMatchingTeachersForMapel(ipasMapel, teachersList);
    expect(ipasMatched.length).toBe(3);
    expect(ipasMatched.map((g) => g.kode)).toEqual(['32', '33', '34']);

    // Test juga jika guru di sk_guru kosong tapi ada di SK_TEACHERS_DEFAULT
    const teachersWithoutSk = [
      { id: 'g32', kode: '36', nama: 'MOH ALI, S.T', sk_guru: '' },
      { id: 'g33', kode: '37', nama: 'HADI PRIYO UTOMO, S.Si S.Pd', sk_guru: null },
      { id: 'g34', kode: '38', nama: 'ENI KURNIASIH, S.Pd' },
      { id: 'g10', kode: '10', nama: 'BUDI SANTOSO', sk_guru: 'MATEMATIKA' },
    ];
    const ipasMatchedDefault = findMatchingTeachersForMapel(ipasMapel, teachersWithoutSk);
    expect(ipasMatchedDefault.length).toBe(3);
    expect(ipasMatchedDefault.map((g) => g.nama)).toEqual([
      'MOH ALI, S.T',
      'HADI PRIYO UTOMO, S.Si S.Pd',
      'ENI KURNIASIH, S.Pd',
    ]);
  });

  it('Guru Serombel: Tombol cepat menugaskan sekaligus semua guru serombel dan mengalirkan 2 arah ke Matrix SK', async () => {
    const { assignBatchTeachersToMapelAutoSync } = await import('../../src/domain/sync-mapel-matrix');

    const paiTeachers = [
      { id: 'g2', kode: '2', nama: 'MASHURI, S.PDI' },
      { id: 'g3', kode: '3', nama: 'DADANG HENDRA KUSUMA, S.PDI' },
      { id: 'g4', kode: '4', nama: 'IMAM HAMBALI, S.PD' },
    ];

    const res = await assignBatchTeachersToMapelAutoSync('PAI1', paiTeachers, 3);

    // Verifikasi di Daftar Mapel: PAI1 memiliki ketiga guru
    const pai1 = res.updatedMapelList.find((m) => m.kode === 'PAI1');
    expect(pai1).toBeDefined();
    expect(pai1?.guruJp?.['MASHURI, S.PDI']).toBe(3);
    expect(pai1?.guruJp?.['DADANG HENDRA KUSUMA, S.PDI']).toBe(3);
    expect(pai1?.guruJp?.['IMAM HAMBALI, S.PD']).toBe(3);

    // Verifikasi di Matrix SK: Setiap guru otomatis memiliki badge PAI1
    for (const t of paiTeachers) {
      const badges = res.updatedMatrixGrid.teacherMapels[t.id];
      expect(badges).toBeDefined();
      expect(badges?.some((b) => b.kode === 'PAI1')).toBe(true);
      expect(badges?.find((b) => b.kode === 'PAI1')?.jp).toBe(3);
    }
  });

  it('Aliran BEBAN JP: data kolom BEBAN JP mengalir dari setting_jp (Setting Utama Guru & JP)', async () => {
    // Bersihkan data guru agar bebas constraint
    await db.guru.clear();

    // Siapkan beberapa guru dengan setting_jp berbeda sesuai data di Setting Utama Guru & JP
    const teachersData = [
      { id: 'g_1', kode: '1', nama: 'Drs. Hartono, M.M.', setting_jp: 0, aktif: 1 },
      { id: 'g_2', kode: '2', nama: 'Mashuri, S.Pd.I.', setting_jp: 28, aktif: 1 },
      { id: 'g_3', kode: '3', nama: 'Dadang Hendra Kusuma, S.Pd.I.', setting_jp: 28, aktif: 1 },
      { id: 'g_4', kode: '4', nama: 'Imam Hambali, S.Pd.', setting_jp: 28, aktif: 1 },
    ];

    for (const t of teachersData) {
      await db.guru.put({
        id: t.id,
        kode: t.kode,
        nama: t.nama,
        nip_nik: null,
        sk_guru: 'PAI',
        tipe_guru: 'REGULER',
        setting_jp: t.setting_jp,
        jp_min: null,
        jp_maks: null,
        maks_jp_hari: null,
        min_hari_bebas: null,
        maks_gap: null,
        aktif: t.aktif,
      });
    }

    // Ambil data guru dari db.guru seperti yang dilakukan useLiveQuery di MatrixSKView
    const loadedGurus = await db.guru.toArray();
    const sortedGurus = loadedGurus.sort((a, b) => parseInt(a.kode, 10) - parseInt(b.kode, 10));

    // Verifikasi per baris guru BEBAN JP persis sama dengan setting_jp dari Menu 1
    expect(sortedGurus[0]?.setting_jp).toBe(0);
    expect(sortedGurus[1]?.setting_jp).toBe(28);
    expect(sortedGurus[2]?.setting_jp).toBe(28);
    expect(sortedGurus[3]?.setting_jp).toBe(28);

    // Verifikasi total akumulasi Beban SK di footer tabel
    const totalBebanJp = sortedGurus.reduce((acc, g) => acc + (g.setting_jp ?? 0), 0);
    expect(totalBebanJp).toBe(84); // 0 + 28 + 28 + 28 = 84 JP
  });

  it('Aliran data tabel kiri -> tabel kanan: jika PAI 1 terisi pengampu Pak Mashuri, kolom Mata Pelajaran otomatis terisi PENDIDIKAN AGAMA ISLAM 1', async () => {
    await db.guru.clear();
    const mashuri = {
      id: 'guru_2',
      kode: '2',
      nama: 'Mashuri, S.Pd.I.',
      aktif: 1,
      setting_jp: 28,
    };
    await db.guru.put({
      id: mashuri.id,
      kode: mashuri.kode,
      nama: mashuri.nama,
      nip_nik: null,
      sk_guru: 'PAI',
      tipe_guru: 'REGULER',
      setting_jp: mashuri.setting_jp,
      jp_min: null,
      jp_maks: null,
      maks_jp_hari: null,
      min_hari_bebas: null,
      maks_gap: null,
      aktif: 1,
    });

    // Tugaskan Pak Mashuri ke PAI1 di tabel kiri
    const res = await assignTeacherToMapelAutoSync('PAI1', mashuri, 3);
    const pai1 = res.updatedMapelList.find((m) => m.kode === 'PAI1');
    expect(pai1).toBeDefined();
    expect(pai1?.mapel).toBe('PENDIDIKAN AGAMA ISLAM 1');
    expect(isSameTeacher(pai1?.guru || '', 'Pak MASHURI')).toBe(true);

    // Di Matrix SK / tabel kanan guru Mashuri otomatis terisi mapel PENDIDIKAN AGAMA ISLAM 1
    const mashuriBadges = res.updatedMatrixGrid.teacherMapels[mashuri.id];
    expect(mashuriBadges).toBeDefined();
    const badge = mashuriBadges?.find((b) => b.kode === 'PAI1');
    expect(badge).toBeDefined();
    expect(badge?.mapel).toBe('PENDIDIKAN AGAMA ISLAM 1');
  });

  it('memvalidasi isDegreeOnly dan membersihkan token gelar dari data guru', async () => {
    const { isDegreeOnly, sanitizeMapelGuruData } = await import('../../src/domain/curriculum-data');

    // Gelar akademik murni harus return true
    expect(isDegreeOnly('S.PDI')).toBe(true);
    expect(isDegreeOnly('M.PD')).toBe(true);
    expect(isDegreeOnly('S.PD')).toBe(true);
    expect(isDegreeOnly('S.PdI')).toBe(true);
    expect(isDegreeOnly('S.Si')).toBe(true);
    expect(isDegreeOnly('Gr.')).toBe(true);
    expect(isDegreeOnly('S.Pd, M.Pd')).toBe(true);

    // Nama guru asli harus return false
    expect(isDegreeOnly('MASHURI, S.Pdi')).toBe(false);
    expect(isDegreeOnly('GUS WUL WAFA, S.PdI, M.Pd')).toBe(false);
    expect(isDegreeOnly('FRIDA ARI SUGIANTI')).toBe(false);

    // Sanitasi data mapel dari key gelar yang corrupt
    const dirtyMapel = {
      no: 1,
      kode: 'PAI1',
      mapel: 'PENDIDIKAN AGAMA ISLAM 1',
      jp: 3,
      kategori: 'UMUM',
      tingkat: 'X' as const,
      guru: 'FRIDA ARI SUGIANTI, S.PdI; GUS WUL WAFA, S.PdI, M.Pd; S.PDI; M.PD; S.PD',
      guruJp: {
        'FRIDA ARI SUGIANTI, S.PdI': 3,
        'GUS WUL WAFA, S.PdI, M.Pd': 3,
        'S.PDI': 3,
        'M.PD': 3,
        'S.PD': 3,
      },
    };

    const cleaned = sanitizeMapelGuruData(dirtyMapel);
    expect(cleaned.guru).toBe('FRIDA ARI SUGIANTI, S.PdI; GUS WUL WAFA, S.PdI, M.Pd');
    expect(cleaned.guruJp).toBeDefined();
    expect(Object.keys(cleaned.guruJp!)).toEqual([
      'FRIDA ARI SUGIANTI, S.PdI',
      'GUS WUL WAFA, S.PdI, M.Pd',
    ]);
    expect(cleaned.guruJp!['S.PDI']).toBeUndefined();
    expect(cleaned.guruJp!['M.PD']).toBeUndefined();
    expect(cleaned.guruJp!['S.PD']).toBeUndefined();
  });

  it('Multi-Mapel per Cell: Satu guru mengampu 2 mapel berbeda di cell yang sama (misal 5+4)', async () => {
    // 1. Uji helper getCellItems
    const legacyCell = { mapelKode: 'PKK2PSPT', jp: 5 };
    expect(getCellItems(legacyCell)).toEqual([{ mapelKode: 'PKK2PSPT', jp: 5 }]);

    const multiCell = {
      mapelKode: 'PKK3PSPT + MINAT3PSPT',
      jp: 9,
      items: [
        { mapelKode: 'PKK3PSPT', jp: 5 },
        { mapelKode: 'MINAT3PSPT', jp: 4 },
      ],
    };
    const items = getCellItems(multiCell);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ mapelKode: 'PKK3PSPT', jp: 5 });
    expect(items[1]).toEqual({ mapelKode: 'MINAT3PSPT', jp: 4 });

    // 2. Uji formula tampilan 5+4
    const formulaText = items.map((it) => it.jp).join('+');
    expect(formulaText).toBe('5+4');
    expect(multiCell.jp).toBe(9);

    // 3. Uji helper cellContainsMapel
    expect(cellContainsMapel(multiCell, 'PKK3PSPT')).toBe(true);
    expect(cellContainsMapel(multiCell, 'minat3pspt')).toBe(true);
    expect(cellContainsMapel(multiCell, 'PAI1')).toBe(false);

    // 4. Uji helper getCellMapelJp
    expect(getCellMapelJp(multiCell, 'PKK3PSPT')).toBe(5);
    expect(getCellMapelJp(multiCell, 'MINAT3PSPT')).toBe(4);
    expect(getCellMapelJp(multiCell, 'PAI1')).toBe(0);

    // 5. Uji pelepasan satu mapel dari cell multi-mapel (removeMapelFromGuruAutoSync)
    const saputraGuru = {
      id: 'guru_77',
      nama: 'SAPUTRA INDRA PURNAMA, S.T.',
      kode: '77',
    };
    await db.guru.put({
      id: saputraGuru.id,
      nama: saputraGuru.nama,
      kode: saputraGuru.kode,
      nip_nik: null,
      sk_guru: 'PRO',
      tipe_guru: 'PRODUKTIF',
      setting_jp: 28,
      jp_min: null,
      jp_maks: null,
      maks_jp_hari: null,
      min_hari_bebas: null,
      maks_gap: null,
      aktif: 1,
    });

    // Pasang gridData awal untuk Saputra Indra: cell XII_PSPT_1 memuat 5+4 (PKK3PSPT & MINAT3PSPT)
    await db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify({
        gridData: {
          [saputraGuru.id]: {
            XII_PSPT_1: multiCell,
          },
        },
        teacherMapels: {
          [saputraGuru.id]: [
            { kode: 'PKK3PSPT', mapel: 'PRODUKTIF KREATIF 3', jp: 5, tingkat: 'XII', kategori: 'PRO' },
            { kode: 'MINAT3PSPT', mapel: 'MAPEL PILIHAN PSPT', jp: 4, tingkat: 'XII', kategori: 'PRO' },
          ],
        },
        updated_at: new Date().toISOString(),
      }),
      updated_at: new Date().toISOString(),
    });

    // Lepaskan MINAT3PSPT saja
    const removeRes = await removeMapelFromGuruAutoSync(saputraGuru, 'MINAT3PSPT');
    const remainingCell = removeRes.updatedMatrixGrid.gridData[saputraGuru.id]?.['XII_PSPT_1'];
    expect(remainingCell).toBeDefined();
    // PKK3PSPT (5 JP) HARUS tetap ada!
    expect(cellContainsMapel(remainingCell, 'PKK3PSPT')).toBe(true);
    expect(cellContainsMapel(remainingCell, 'MINAT3PSPT')).toBe(false);
    expect(remainingCell?.jp).toBe(5);
  });

  it('Verifikasi status Beban SK terpenuhi sesuai Beban JP (setting_jp) dari Matrix SK', async () => {
    await db.guru.clear();

    // 1. Guru dengan target 28 JP yang terpenuhi (28 JP)
    const guruLengkap = {
      id: 'guru_lengkap',
      kode: '2',
      nama: 'Guru Lengkap',
      aktif: 1,
      setting_jp: 28,
    };

    // 2. Guru dengan target 28 JP yang belum terpenuhi (14 JP)
    const guruKurang = {
      id: 'guru_kurang',
      kode: '3',
      nama: 'Guru Kurang',
      aktif: 1,
      setting_jp: 28,
    };

    // 3. Guru target 0 JP (Kepala Sekolah)
    const guruNol = {
      id: 'guru_nol',
      kode: '1',
      nama: 'Kepala UPT',
      aktif: 1,
      setting_jp: 0,
    };

    await db.guru.bulkPut([
      { ...guruLengkap, nip_nik: null, sk_guru: 'UMUM', tipe_guru: 'REGULER', jp_min: null, jp_maks: null, maks_jp_hari: null, min_hari_bebas: null, maks_gap: null },
      { ...guruKurang, nip_nik: null, sk_guru: 'UMUM', tipe_guru: 'REGULER', jp_min: null, jp_maks: null, maks_jp_hari: null, min_hari_bebas: null, maks_gap: null },
      { ...guruNol, nip_nik: null, sk_guru: 'UMUM', tipe_guru: 'REGULER', jp_min: null, jp_maks: null, maks_jp_hari: null, min_hari_bebas: null, maks_gap: null },
    ]);

    const loaded = await db.guru.toArray();
    expect(loaded.find(g => g.id === 'guru_lengkap')?.setting_jp).toBe(28);
    expect(loaded.find(g => g.id === 'guru_kurang')?.setting_jp).toBe(28);
    expect(loaded.find(g => g.id === 'guru_nol')?.setting_jp).toBe(0);

    // Mock teacherMapels
    const mockTeacherMapels: Record<string, { jp: number }[]> = {
      guru_lengkap: [{ jp: 14 }, { jp: 14 }], // Total 28 JP
      guru_kurang: [{ jp: 14 }],              // Total 14 JP
      guru_nol: [],                            // Total 0 JP
    };

    const isGuruFulfilled = (gId: string, settingJp: number) => {
      const items = mockTeacherMapels[gId] || [];
      const totalJp = items.reduce((acc, cur) => acc + cur.jp, 0);
      return settingJp > 0 && totalJp >= settingJp;
    };

    expect(isGuruFulfilled('guru_lengkap', 28)).toBe(true);  // 28 >= 28 -> Terpenuhi (Hijau + Checklist)
    expect(isGuruFulfilled('guru_kurang', 28)).toBe(false);  // 14 < 28 -> Belum terpenuhi (Biru)
    expect(isGuruFulfilled('guru_nol', 0)).toBe(false);       // Target 0 JP -> Strip (-)
  });

  describe('Team Teaching Mapel Produktif (Pembagian Jam Antar Guru Serombel)', () => {
    it('mengenali mata pelajaran produktif dengan benar via isMapelProduktif', () => {
      expect(isMapelProduktif('PRO1PSPT', 'PRODUKTIF')).toBe(true);
      expect(isMapelProduktif('PRO2TKJ', 'PRODUKTIF')).toBe(true);
      expect(isMapelProduktif('PKK3PSPT', 'PKK')).toBe(true);
      expect(isMapelProduktif('MINAT3PSPT', 'KEJURUAN')).toBe(true);
      expect(isMapelProduktif('MTK1', 'UMUM')).toBe(false);
      expect(isMapelProduktif('PAI1', 'UMUM')).toBe(false);
      expect(isMapelProduktif('PJOK1', 'UMUM')).toBe(false);
    });

    it('Menerapkan pembagian jam 1 Rombel (contoh: 12 JP dibagi 9 JP Bu Latifah & 3 JP Pak Nanda)', async () => {
      const guru1 = { id: 'guru_latifah', nama: 'Latifah Ardiana, S.Kom' };
      const guru2 = { id: 'guru_nanda', nama: 'Nanda Eka, S.Kom' };

      // Terapkan pembagian team teaching pada rombel X_PSPT_1
      const res = await applyTeamTeachingSplitAutoSync({
        mapelKode: 'PRO1PSPT',
        rombelIds: ['X_PSPT_1'],
        allocations: [
          { guruId: guru1.id, guruNama: guru1.nama, jpPerRombel: 9 },
          { guruId: guru2.id, guruNama: guru2.nama, jpPerRombel: 3 },
        ],
      });

      // 1. Verifikasi sel Matrix SK untuk Bu Latifah pada X_PSPT_1 = 9 JP
      const cellLatifah = res.updatedMatrixGrid.gridData[guru1.id]?.['X_PSPT_1'];
      expect(cellLatifah).toBeDefined();
      expect(cellLatifah?.jp).toBe(9);
      expect(cellContainsMapel(cellLatifah, 'PRO1PSPT')).toBe(true);

      // 2. Verifikasi sel Matrix SK untuk Pak Nanda pada X_PSPT_1 = 3 JP
      const cellNanda = res.updatedMatrixGrid.gridData[guru2.id]?.['X_PSPT_1'];
      expect(cellNanda).toBeDefined();
      expect(cellNanda?.jp).toBe(3);
      expect(cellContainsMapel(cellNanda, 'PRO1PSPT')).toBe(true);

      // Total beban dalam 1 rombel = 9 + 3 = 12 JP (tidak melebihi beban mapel)
      expect((cellLatifah?.jp ?? 0) + (cellNanda?.jp ?? 0)).toBe(12);

      // 3. Verifikasi badge guru
      const badgeLatifah = res.updatedMatrixGrid.teacherMapels[guru1.id]?.find((b) => b.kode === 'PRO1PSPT');
      expect(badgeLatifah?.jp).toBe(9);

      const badgeNanda = res.updatedMatrixGrid.teacherMapels[guru2.id]?.find((b) => b.kode === 'PRO1PSPT');
      expect(badgeNanda?.jp).toBe(3);

      // 4. Verifikasi sinkronisasi ke Daftar Mapel
      const pro1 = res.updatedMapelList.find((m) => m.kode === 'PRO1PSPT');
      expect(pro1).toBeDefined();
      expect(pro1?.guruJp?.[guru1.nama]).toBe(9);
      expect(pro1?.guruJp?.[guru2.nama]).toBe(3);
    });

    it('Menerapkan pembagian jam 2 Rombel (contoh: 18 JP Bu Latifah & 6 JP Pak Nanda untuk 2 rombel)', async () => {
      const guru1 = { id: 'guru_latifah', nama: 'Latifah Ardiana, S.Kom' };
      const guru2 = { id: 'guru_nanda', nama: 'Nanda Eka, S.Kom' };

      // Terapkan pembagian team teaching pada 2 rombel: X_PSPT_1 dan X_PSPT_2
      const res = await applyTeamTeachingSplitAutoSync({
        mapelKode: 'PRO1PSPT',
        rombelIds: ['X_PSPT_1', 'X_PSPT_2'],
        allocations: [
          { guruId: guru1.id, guruNama: guru1.nama, jpPerRombel: 9 },
          { guruId: guru2.id, guruNama: guru2.nama, jpPerRombel: 3 },
        ],
      });

      // Verifikasi kedua rombel terisi untuk Bu Latifah (masing-masing 9 JP)
      const latifahR1 = res.updatedMatrixGrid.gridData[guru1.id]?.['X_PSPT_1'];
      const latifahR2 = res.updatedMatrixGrid.gridData[guru1.id]?.['X_PSPT_2'];
      expect(latifahR1?.jp).toBe(9);
      expect(latifahR2?.jp).toBe(9);
      // Total Bu Latifah untuk 2 rombel = 9 * 2 = 18 JP
      const totalLatifah = (latifahR1?.jp ?? 0) + (latifahR2?.jp ?? 0);
      expect(totalLatifah).toBe(18);

      // Verifikasi kedua rombel terisi untuk Pak Nanda (masing-masing 3 JP)
      const nandaR1 = res.updatedMatrixGrid.gridData[guru2.id]?.['X_PSPT_1'];
      const nandaR2 = res.updatedMatrixGrid.gridData[guru2.id]?.['X_PSPT_2'];
      expect(nandaR1?.jp).toBe(3);
      expect(nandaR2?.jp).toBe(3);
      // Total Pak Nanda untuk 2 rombel = 3 * 2 = 6 JP
      const totalNanda = (nandaR1?.jp ?? 0) + (nandaR2?.jp ?? 0);
      expect(totalNanda).toBe(6);

      // Total akumulasi kedua rombel = 18 + 6 = 24 JP (beban 2 rombel)
      expect(totalLatifah + totalNanda).toBe(24);
    });

    it('Anti-Bug Guru Tertukar: Guru Produktif AK (Nurul Lailiyah) TIDAK kompatibel dengan mapel Produktif PSPT (PRO3PSPT), sedangkan Nanda Irvan Sodikin kompatibel', () => {
      // 1. Nurul Lailiyah adalah guru Produktif Akuntansi
      const nurulLailiyah = {
        nama: 'NURUL LAILIYAH, S.Pd',
        sk_guru: 'PRODUKTIF AK',
        tipe_guru: 'PRODUKTIF',
      };
      // Mapel PRO3PSPT adalah Produktif PSPT
      expect(isTeacherCompatibleWithMapel(nurulLailiyah, 'PRO3PSPT')).toBe(false);

      // 2. Nanda Irvan Sodikin adalah guru Produktif PSPT resmi
      const nandaIrvan = {
        nama: 'NANDA IRVAN SODIKIN, S.T',
        sk_guru: 'PRODUKTIF PSPT',
        tipe_guru: 'PRODUKTIF',
      };
      expect(isTeacherCompatibleWithMapel(nandaIrvan, 'PRO3PSPT')).toBe(true);

      // 3. Apri dan Very adalah guru Produktif PSPT resmi
      const apri = {
        nama: 'MOHAMMAD APRI SASTRIYONO, S.Tr.K.M',
        sk_guru: 'PRODUKTIF PSPT',
        tipe_guru: 'PRODUKTIF',
      };
      const very = {
        nama: 'VERY KURNIAWAN, S.Kom',
        sk_guru: 'PRODUKTIF PSPT',
        tipe_guru: 'PRODUKTIF',
      };
      expect(isTeacherCompatibleWithMapel(apri, 'PRO3PSPT')).toBe(true);
      expect(isTeacherCompatibleWithMapel(very, 'PRO3PSPT')).toBe(true);
    });
  });
});


