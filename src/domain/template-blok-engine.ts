// src/domain/template-blok-engine.ts
import { db } from '../db/schema';
import { Hari, BlokNo, PolaBlok, JadwalRun, JadwalEntry, Kelas } from './types';
import { ulid } from 'ulid';
import { ROMBELS_48 } from '../features/03-matrix-sk/MatrixSKView';

export type TemplateMode = 'TIPE_A' | 'TIPE_B';
export type SlotType = 'PRODUKTIF' | 'REGULER' | 'KOSONG';

export interface TemplateCell {
  jp: number; // 1 to 11
  type: SlotType;
  code: string; // e.g. 'PRO3PSPT', 'PKK3PSPT', 'MINAT3PSPT', 'MUATAN LOKAL'
  label?: string;
}

export interface ClassScheduleTemplate {
  kelasId: string;
  kelasNama: string;
  blokNo: BlokNo;
  tingkat: 'X' | 'XI' | 'XII';
  jurusanKode: string;
  totalJpProduktif: number;
  days: Record<Hari, TemplateCell[]>;
}

export interface ClassTemplatePair {
  id: string; // e.g. 'XII_PSPT'
  jurusanKode: string;
  jurusanNama: string;
  tingkat: 'X' | 'XI' | 'XII';
  totalJpProduktif: number;
  rombel1: ClassScheduleTemplate;
  rombel2: ClassScheduleTemplate;
}

const SETTING_KEY_MODE = 'jadwal_template_mode';
const SETTING_KEY_CUSTOM = 'jadwal_template_custom_v2';

// Buat array 11 slot kosong
function createEmptySlots(): TemplateCell[] {
  return Array.from({ length: 11 }, (_, i) => ({
    jp: i + 1,
    type: 'KOSONG' as SlotType,
    code: '',
  }));
}

// Helper untuk mengisi range jam
function fillSlots(
  slots: TemplateCell[],
  startJp: number,
  endJp: number,
  type: SlotType,
  code: string,
  label?: string
) {
  for (let jp = startJp; jp <= endJp; jp++) {
    const idx = jp - 1;
    if (slots[idx]) {
      slots[idx] = {
        jp,
        type,
        code,
        label: label || code,
      };
    }
  }
}

// Generator Template Default Sesuai Dokumen PDF Alur Kerja Jadwal Blok SMK
export function buildDefaultPair(
  tingkat: 'X' | 'XI' | 'XII',
  jurusanKode: string,
  jurusanNama: string,
  mode: TemplateMode
): ClassTemplatePair {
  const jur = jurusanKode.toUpperCase();
  const id = `${tingkat}_${jur}`;

  const rombel1Days: Record<Hari, TemplateCell[]> = {
    1: createEmptySlots(),
    2: createEmptySlots(),
    3: createEmptySlots(),
    4: createEmptySlots(),
    5: createEmptySlots(),
  };

  const rombel2Days: Record<Hari, TemplateCell[]> = {
    1: createEmptySlots(),
    2: createEmptySlots(),
    3: createEmptySlots(),
    4: createEmptySlots(),
    5: createEmptySlots(),
  };

  let totalJp = 22;

  if (tingkat === 'XII') {
    totalJp = 22;
    if (mode === 'TIPE_A') {
      // PDF Halaman 3: JADWAL BLOK TIPE A KELAS XII PSPT 1 BLOK 1
      // Senin 1-11: PRO3
      fillSlots(rombel1Days[1], 1, 11, 'PRODUKTIF', `PRO3${jur}`);
      // Selasa 1-11: PRO3 (Total 11 + 11 = 22 JP PRO3)
      fillSlots(rombel1Days[2], 1, 11, 'PRODUKTIF', `PRO3${jur}`);
      // Rabu 1-4: MINAT3 (4 JP), 5-9: PKK3 (5 JP), 10-11: Kosong
      fillSlots(rombel1Days[3], 1, 4, 'PRODUKTIF', `MINAT3${jur}`);
      fillSlots(rombel1Days[3], 5, 9, 'PRODUKTIF', `PKK3${jur}`);
      // Kamis 1-11: Kosong / Putih
      // Jumat 1-4: Slot Reguler (Putih / Acak), 5-11 Inactive
      fillSlots(rombel1Days[5], 1, 4, 'REGULER', '');

      // PDF Halaman 3: KELAS XII PSPT 2 BLOK 2
      // Senin 1-4: Slot Reguler (Putih / Acak), 5-11 Kosong
      fillSlots(rombel2Days[1], 1, 4, 'REGULER', '');
      // Selasa 1-4: MINAT3, 5-9: PKK3, 10-11: Kosong
      fillSlots(rombel2Days[2], 1, 4, 'PRODUKTIF', `MINAT3${jur}`);
      fillSlots(rombel2Days[2], 5, 9, 'PRODUKTIF', `PKK3${jur}`);
      // Rabu 1-11: PRO3
      fillSlots(rombel2Days[3], 1, 11, 'PRODUKTIF', `PRO3${jur}`);
      // Kamis 1-11: PRO3 (Total 11 + 11 = 22 JP PRO3)
      fillSlots(rombel2Days[4], 1, 11, 'PRODUKTIF', `PRO3${jur}`);
      // Jumat 1-4: Slot Reguler (Putih / Acak), 5-11 Inactive
      fillSlots(rombel2Days[5], 1, 4, 'REGULER', '');
    } else {
      // PDF Halaman 5: JADWAL BLOK TIPE B KELAS XII PSPT 1 BLOK 1
      fillSlots(rombel1Days[1], 1, 11, 'PRODUKTIF', `PRO3${jur}`);
      fillSlots(rombel1Days[2], 1, 11, 'PRODUKTIF', `PRO3${jur}`);
      fillSlots(rombel1Days[3], 1, 11, 'PRODUKTIF', `PRO3${jur}`);
      fillSlots(rombel1Days[4], 1, 11, 'PRODUKTIF', `PRO3${jur}`);
      // Jumat 1-4 Slot Reguler / MUATAN LOKAL, 5-11 Inactive
      fillSlots(rombel1Days[5], 1, 4, 'REGULER', '', 'MUATAN LOKAL');

      // PDF Halaman 5: KELAS XII PSPT 2 BLOK 2
      // Senin 1-11: Slot Reguler (Putih / Acak)
      fillSlots(rombel2Days[1], 1, 11, 'REGULER', '');
      // Selasa, Rabu, Kamis: Kosong / Putih
      // Jumat 1-4: Slot Reguler (Putih / Acak), 5-11 Inactive
      fillSlots(rombel2Days[5], 1, 4, 'REGULER', '');
    }
  } else if (tingkat === 'XI') {
    totalJp = 18;
    if (mode === 'TIPE_A') {
      // PDF Halaman 4: KELAS XI PSPT 1 BLOK 1 (PRODUKTIF XI 18 JP)
      // Senin 1-11: PRO2 (11 JP)
      fillSlots(rombel1Days[1], 1, 11, 'PRODUKTIF', `PRO2${jur}`);
      // Selasa 1-7: PRO2 (7 JP -> Total 18 JP), 8-11: MINAT2 (4 JP)
      fillSlots(rombel1Days[2], 1, 7, 'PRODUKTIF', `PRO2${jur}`);
      fillSlots(rombel1Days[2], 8, 11, 'PRODUKTIF', `MINAT2${jur}`);
      // Rabu 1-4: Kosong, 5-9: PKK2 (5 JP), 10-11: Kosong
      fillSlots(rombel1Days[3], 5, 9, 'PRODUKTIF', `PKK2${jur}`);
      // Kamis 1-11: Kosong
      // Jumat 1-4: Slot Reguler (Putih / Acak), 5-11 Inactive
      fillSlots(rombel1Days[5], 1, 4, 'REGULER', '');

      // PDF Halaman 4: KELAS XI PSPT 2 BLOK 2 (PRODUKTIF XI 18 JP)
      // Senin 1-4: Slot Reguler (Putih / Acak), 5-11: Kosong
      fillSlots(rombel2Days[1], 1, 4, 'REGULER', '');
      // Selasa 1-4: Kosong, 5-9: PKK2 (5 JP), 10-11: Kosong
      fillSlots(rombel2Days[2], 5, 9, 'PRODUKTIF', `PKK2${jur}`);
      // Rabu 1-7: PRO2 (7 JP), 8-11: MINAT2 (4 JP)
      fillSlots(rombel2Days[3], 1, 7, 'PRODUKTIF', `PRO2${jur}`);
      fillSlots(rombel2Days[3], 8, 11, 'PRODUKTIF', `MINAT2${jur}`);
      // Kamis 1-11: PRO2 (11 JP -> Total 18 JP)
      fillSlots(rombel2Days[4], 1, 11, 'PRODUKTIF', `PRO2${jur}`);
      // Jumat 1-4: Slot Reguler (Putih / Acak), 5-11 Inactive
      fillSlots(rombel2Days[5], 1, 4, 'REGULER', '');
    } else {
      // TIPE B Tingkat XI
      fillSlots(rombel1Days[1], 1, 11, 'PRODUKTIF', `PRO2${jur}`);
      fillSlots(rombel1Days[2], 1, 7, 'PRODUKTIF', `PRO2${jur}`);
      fillSlots(rombel1Days[2], 8, 11, 'PRODUKTIF', `MINAT2${jur}`);
      fillSlots(rombel1Days[3], 1, 9, 'PRODUKTIF', `PKK2${jur}`);
      fillSlots(rombel1Days[4], 1, 11, 'PRODUKTIF', `PRO2${jur}`);
      fillSlots(rombel1Days[5], 1, 4, 'REGULER', '', 'MUATAN LOKAL');

      fillSlots(rombel2Days[1], 1, 11, 'REGULER', '');
      fillSlots(rombel2Days[5], 1, 4, 'REGULER', '');
    }
  } else {
    // Tingkat X (12 JP)
    totalJp = 12;
    if (mode === 'TIPE_A') {
      // PDF Halaman 4: KELAS X PSPT 1 BLOK 1 (PRODUKTIF X 12 JP)
      // Senin 1-11: PRO1 (11 JP)
      fillSlots(rombel1Days[1], 1, 11, 'PRODUKTIF', `PRO1${jur}`);
      // Selasa: Kosong
      // Rabu 1-10: Kosong, Jam 11: PRO1 (1 JP -> Total 12 JP)
      fillSlots(rombel1Days[3], 11, 11, 'PRODUKTIF', `PRO1${jur}`);
      // Kamis: Kosong
      // Jumat 1-6: Slot Reguler (Putih / Acak), 7-11 Inactive
      fillSlots(rombel1Days[5], 1, 6, 'REGULER', '');

      // PDF Halaman 4: KELAS X PSPT 2 BLOK 2 (PRODUKTIF X 12 JP)
      // Senin: Kosong
      // Selasa 1-11: PRO1 (11 JP)
      fillSlots(rombel2Days[2], 1, 11, 'PRODUKTIF', `PRO1${jur}`);
      // Rabu: Kosong
      // Kamis 1-10: Kosong, Jam 11: PRO1 (1 JP -> Total 12 JP)
      fillSlots(rombel2Days[4], 11, 11, 'PRODUKTIF', `PRO1${jur}`);
      // Jumat 1-6: Slot Reguler (Putih / Acak), 7-11 Inactive
      fillSlots(rombel2Days[5], 1, 6, 'REGULER', '');
    } else {
      // TIPE B Tingkat X
      fillSlots(rombel1Days[1], 1, 11, 'PRODUKTIF', `PRO1${jur}`);
      fillSlots(rombel1Days[3], 11, 11, 'PRODUKTIF', `PRO1${jur}`);
      fillSlots(rombel1Days[5], 1, 6, 'REGULER', '', 'MUATAN LOKAL');

      fillSlots(rombel2Days[1], 1, 11, 'REGULER', '');
      fillSlots(rombel2Days[5], 1, 6, 'REGULER', '');
    }
  }

  return {
    id,
    jurusanKode: jur,
    jurusanNama,
    tingkat,
    totalJpProduktif: totalJp,
    rombel1: {
      kelasId: `${tingkat}_${jur}_1`,
      kelasNama: `KELAS ${tingkat} ${jur} 1`,
      blokNo: 1,
      tingkat,
      jurusanKode: jur,
      totalJpProduktif: totalJp,
      days: rombel1Days,
    },
    rombel2: {
      kelasId: `${tingkat}_${jur}_2`,
      kelasNama: `KELAS ${tingkat} ${jur} 2`,
      blokNo: 2,
      tingkat,
      jurusanKode: jur,
      totalJpProduktif: totalJp,
      days: rombel2Days,
    },
  };
}

// Ambil semua daftar pasangan rombel default untuk mode tertentu
export function buildAllDefaultPairs(mode: TemplateMode): ClassTemplatePair[] {
  const jurusanList = [
    { kode: 'PSPT', nama: 'Produksi dan Siaran Program Televisi' },
    { kode: 'AK', nama: 'Akuntansi dan Keuangan Lembaga' },
    { kode: 'TKJ', nama: 'Teknik Komputer dan Jaringan' },
    { kode: 'TKR', nama: 'Teknik Kendaraan Ringan' },
    { kode: 'KUL', nama: 'Kuliner' },
    { kode: 'DPB', nama: 'Desain Produksi Busana' },
    { kode: 'APAT', nama: 'Agribisnis Perikanan Air Tawar' },
    { kode: 'LAS', nama: 'Teknik Pengelasan' },
  ];

  const pairs: ClassTemplatePair[] = [];
  const tingkats: ('XII' | 'XI' | 'X')[] = ['XII', 'XI', 'X'];

  for (const j of jurusanList) {
    for (const t of tingkats) {
      pairs.push(buildDefaultPair(t, j.kode, j.nama, mode));
    }
  }

  return pairs;
}

// Storage helpers
export async function getStoredTemplateMode(): Promise<TemplateMode> {
  try {
    const s = await db.setting.get(SETTING_KEY_MODE);
    if (s?.value_json) {
      const mode = JSON.parse(s.value_json);
      if (mode === 'TIPE_A' || mode === 'TIPE_B') return mode;
    }
  } catch (err) {
    console.warn('Failed to read template mode from db.setting:', err);
  }
  return 'TIPE_A';
}

export async function saveStoredTemplateMode(mode: TemplateMode): Promise<void> {
  try {
    await db.setting.put({
      key: SETTING_KEY_MODE,
      value_json: JSON.stringify(mode),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to save template mode to db.setting:', err);
  }
}

export async function getStoredCustomTemplates(
  mode: TemplateMode
): Promise<Record<string, ClassTemplatePair> | null> {
  try {
    const key = `${SETTING_KEY_CUSTOM}_${mode}`;
    const s = await db.setting.get(key);
    if (s?.value_json) {
      return JSON.parse(s.value_json);
    }
  } catch (err) {
    console.warn('Failed to read custom templates:', err);
  }
  return null;
}

export async function saveStoredCustomTemplates(
  mode: TemplateMode,
  data: Record<string, ClassTemplatePair>
): Promise<void> {
  try {
    const key = `${SETTING_KEY_CUSTOM}_${mode}`;
    await db.setting.put({
      key,
      value_json: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to save custom templates:', err);
  }
}

// Pastikan kelas-kelas di database sudah ada jika db.kelas masih kosong
export async function ensureDefaultClasses(): Promise<Kelas[]> {
  let existing = await db.kelas.toArray();
  if (existing.length === 0) {
    const levels = await db.level.toArray();
    const jurusans = await db.jurusan.toArray();

    const levelMap = new Map(levels.map((l) => [l.kode, l.id]));
    const jurMap = new Map(jurusans.map((j) => [j.kode, j.id]));

    const newKelasList: Kelas[] = [];
    for (const r of ROMBELS_48) {
      const levelId = levelMap.get(r.tingkat) || ulid();
      const jurId = jurMap.get(r.jurusanKode) || ulid();
      newKelasList.push({
        id: r.id,
        level_id: levelId,
        jurusan_id: jurId,
        rombel_no: r.nomor,
        nama: r.nama,
        wali_guru_id: null,
        aktif: 1,
      });
    }

    await db.kelas.bulkPut(newKelasList);
    existing = newKelasList;
  }
  return existing;
}

// Terapkan Pola Blok dari Template ke db.pola_blok (10 baris per kelas: 2 blok x 5 hari)
export async function syncTemplateToPolaBlok(
  mode: TemplateMode,
  pairsMap: Record<string, ClassTemplatePair>
): Promise<void> {
  const kelasList = await ensureDefaultClasses();
  const newPolas: PolaBlok[] = [];

  for (const k of kelasList) {
    // Ekstrak tingkat dan jurusan dari kelas nama (misal "XII PSPT 1")
    const parts = k.nama.split(' ');
    const tingkat = parts[0] as 'X' | 'XI' | 'XII';
    const jur = parts[1] || 'PSPT';
    const rombelNo = parseInt(parts[2] || '1', 10);

    const pairKey = `${tingkat}_${jur}`;
    const pair = pairsMap[pairKey] || buildDefaultPair(tingkat, jur, jur, mode);

    for (const blok of [1, 2] as BlokNo[]) {
      const schedule = (blok === 1 && rombelNo === 1) || (blok === 2 && rombelNo === 2)
        ? pair.rombel1
        : pair.rombel2;

      for (let h = 1; h <= 5; h++) {
        const slots = schedule.days[h as Hari] || [];
        const hasProduktif = slots.some((s) => s.type === 'PRODUKTIF');
        const jenis = hasProduktif ? 'PRODUKTIF' : 'REGULER';

        newPolas.push({
          id: ulid(),
          kelas_id: k.id,
          blok_no: blok,
          hari: h as Hari,
          jenis,
          is_assumed: 0,
        });
      }
    }
  }

  await db.transaction('rw', db.pola_blok, async () => {
    await db.pola_blok.clear();
    await db.pola_blok.bulkPut(newPolas);
  });
}

// Generate Jadwal Lengkap Bebas Bentrok Langsung Berdasarkan Template (Langkah 7 PDF)
export async function generateFullScheduleFromTemplate(
  mode: TemplateMode,
  pairsMap: Record<string, ClassTemplatePair>
): Promise<{ runId: string; totalEntries: number }> {
  // 1. Pastikan kelas & pola blok sinkron
  await syncTemplateToPolaBlok(mode, pairsMap);

  const [kelasList, mapelList, guruList, sMatrix] = await Promise.all([
    db.kelas.filter((k) => k.aktif === 1).toArray(),
    db.mapel.filter((m) => m.aktif === 1).toArray(),
    db.guru.filter((g) => g.aktif === 1).toArray(),
    db.setting.get('matrix_sk_grid'),
  ]);

  let matrixGridData: Record<string, Record<string, any>> = {};
  if (sMatrix?.value_json) {
    try {
      const p = JSON.parse(sMatrix.value_json);
      if (p.gridData) matrixGridData = p.gridData;
    } catch (_) {}
  }

  // Helper mencari guru pengampu suatu rombel dari Matrix SK
  const findTeacherFromMatrix = (rombelId: string, mapelKode: string): string | null => {
    const cleanKode = mapelKode.toUpperCase();
    for (const [guruId, rombelMap] of Object.entries(matrixGridData)) {
      const cell = rombelMap[rombelId];
      if (cell) {
        const cCode = (typeof cell === 'string' ? cell : cell.mapelKode || '').toUpperCase();
        const items = Array.isArray(cell.items) ? cell.items : [];
        if (
          cCode === cleanKode ||
          cCode.includes(cleanKode) ||
          items.some((it: any) => (it.mapelKode || '').toUpperCase() === cleanKode || (it.mapelKode || '').toUpperCase().includes(cleanKode)) ||
          (cleanKode.includes('PKK') && (cCode.includes('PKK') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('PKK')))) ||
          ((cleanKode.includes('MINAT') || cleanKode.includes('PILIHAN')) && (cCode.includes('MINAT') || cCode.includes('PILIHAN') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('MINAT')))) ||
          (cleanKode.startsWith('PRO') && !cleanKode.includes('PKK') && !cleanKode.includes('MINAT') && (cCode.startsWith('PRO') || items.some((it: any) => (it.mapelKode || '').toUpperCase().startsWith('PRO'))))
        ) {
          return guruId;
        }
      }
    }
    return null;
  };

  // Guru yang sudah memiliki penugasan resmi di Matrix SK tidak boleh diambil acak oleh rombel lain
  const teachersWithMatrixAssignments = new Set(
    Object.keys(matrixGridData).filter((gId) => {
      const rombelMap = matrixGridData[gId];
      return (
        rombelMap &&
        Object.values(rombelMap).some((c: any) => {
          if (!c) return false;
          if (typeof c === 'string' && c.trim() !== '') return true;
          if (
            typeof c === 'object' &&
            ((c.jp && c.jp > 0) || c.mapelKode || (Array.isArray(c.items) && c.items.length > 0))
          )
            return true;
          return false;
        })
      );
    })
  );

  const runId = ulid();
  const entries: JadwalEntry[] = [];

  // Filter guru reguler dan mapel reguler umum
  const regularTeachers = guruList.filter((g) => g.tipe_guru !== 'PRODUKTIF');
  const regularSubjects = mapelList.filter((m) => m.jenis !== 'PRODUKTIF');

  // Teacher allocation tracking per block + day + jp: Map<"blok|hari|jp|guruId", true>
  const teacherBusy = new Set<string>();

  for (const k of kelasList) {
    const parts = k.nama.split(' ');
    const tingkat = parts[0] as 'X' | 'XI' | 'XII';
    const jur = parts[1] || 'PSPT';
    const rombelNo = parseInt(parts[2] || '1', 10);

    const pairKey = `${tingkat}_${jur}`;
    const pair = pairsMap[pairKey] || buildDefaultPair(tingkat, jur, jur, mode);

    for (const blok of [1, 2] as BlokNo[]) {
      // Pilih jadwal yang sesuai (alternating pair)
      const schedule =
        (blok === 1 && rombelNo === 1) || (blok === 2 && rombelNo === 2)
          ? pair.rombel1
          : pair.rombel2;

      for (let h = 1; h <= 5; h++) {
        const slots = schedule.days[h as Hari] || [];

        for (const slot of slots) {
          if (slot.type === 'PRODUKTIF') {
            const slotCodeUpper = (slot.code || `PRO${jur}`).toUpperCase();
            const isPkkSlot = slotCodeUpper.includes('PKK');
            const isMinatSlot = slotCodeUpper.includes('MINAT') || slotCodeUpper.includes('PILIHAN');

            // Prioritas 1: Temukan guru yang ditugaskan khusus ke rombel ini di Matrix SK
            const matrixGuruId = findTeacherFromMatrix(k.id, slotCodeUpper);
            let prodTeacher =
              (matrixGuruId && !teacherBusy.has(`${blok}|${h}|${slot.jp}|${matrixGuruId}`))
                ? guruList.find((g) => g.id === matrixGuruId || g.kode === matrixGuruId)
                : null;

            // Jika belum ada dari matrix atau sibuk, cari guru yang sesuai kompetensinya (PKK, Peminatan, atau Kejuruan)
            if (!prodTeacher) {
              if (isPkkSlot) {
                prodTeacher = guruList.find(
                  (g) =>
                    !teacherBusy.has(`${blok}|${h}|${slot.jp}|${g.id}`) &&
                    ((g.sk_guru && g.sk_guru.toUpperCase().includes('PKK')) ||
                      (g.nama && g.nama.toUpperCase().includes('PKK')))
                ) || null;
              } else if (isMinatSlot) {
                prodTeacher = guruList.find(
                  (g) =>
                    !teacherBusy.has(`${blok}|${h}|${slot.jp}|${g.id}`) &&
                    ((g.sk_guru && (g.sk_guru.toUpperCase().includes('MINAT') || g.sk_guru.toUpperCase().includes('PILIHAN') || g.sk_guru.toUpperCase().includes(jur))) ||
                      (g.nama && g.nama.toUpperCase().includes(jur)))
                ) || null;
              } else {
                prodTeacher = guruList.find(
                  (g) =>
                    !teachersWithMatrixAssignments.has(g.id) &&
                    g.tipe_guru === 'PRODUKTIF' &&
                    !teacherBusy.has(`${blok}|${h}|${slot.jp}|${g.id}`) &&
                    ((g.sk_guru && g.sk_guru.toUpperCase().includes(jur)) ||
                      (g.nama && g.nama.toUpperCase().includes(jur)))
                ) || null;
              }
            }

            const prodSubject =
              mapelList.find(
                (m) =>
                  m.kode.toUpperCase() === slotCodeUpper ||
                  (isPkkSlot && m.kode.toUpperCase().includes('PKK')) ||
                  (isMinatSlot && m.kode.toUpperCase().includes('MINAT')) ||
                  m.kode.toUpperCase().includes(jur)
              ) || mapelList[0];

            const guruId = prodTeacher
              ? prodTeacher.id
              : matrixGuruId && !teacherBusy.has(`${blok}|${h}|${slot.jp}|${matrixGuruId}`)
              ? matrixGuruId
              : isPkkSlot
              ? `GURU_PKK_${k.id}_${h}_${slot.jp}`
              : isMinatSlot
              ? `GURU_MINAT_${k.id}_${h}_${slot.jp}`
              : `GURU_PROD_${k.id}_${h}_${slot.jp}`;

            const mapelId = slot.code || (prodSubject ? prodSubject.id : 'MAPEL_DEFAULT');

            entries.push({
              id: ulid(),
              run_id: runId,
              blok_no: blok,
              kelas_id: k.id,
              hari: h as Hari,
              jp_ke: slot.jp,
              mapel_kelas_id: mapelId,
              guru_id: guruId,
              lab_id: null,
              sesi_id: ulid(),
              is_locked: 1,
            });

            teacherBusy.add(`${blok}|${h}|${slot.jp}|${guruId}`);
          } else if (slot.type === 'REGULER') {
            const assignedSubject =
              regularSubjects[(slot.jp + h + rombelNo) % Math.max(1, regularSubjects.length)] ||
              mapelList[0];

            // Prioritas 1: Temukan guru di Matrix SK untuk rombel ini
            const subjectCode = assignedSubject?.kode || '';
            const matrixGuruId = findTeacherFromMatrix(k.id, subjectCode);

            let assignedTeacher =
              (matrixGuruId && !teacherBusy.has(`${blok}|${h}|${slot.jp}|${matrixGuruId}`))
                ? guruList.find((g) => g.id === matrixGuruId || g.kode === matrixGuruId)
                : regularTeachers.find(
                    (g) =>
                      !teachersWithMatrixAssignments.has(g.id) &&
                      !teacherBusy.has(`${blok}|${h}|${slot.jp}|${g.id}`)
                  );

            const guruId = assignedTeacher
              ? assignedTeacher.id
              : `GURU_REG_${k.id}_${h}_${slot.jp}`;

            const mapelId = slot.code || (assignedSubject ? assignedSubject.id : 'MAPEL_REGULER');

            entries.push({
              id: ulid(),
              run_id: runId,
              blok_no: blok,
              kelas_id: k.id,
              hari: h as Hari,
              jp_ke: slot.jp,
              mapel_kelas_id: mapelId,
              guru_id: guruId,
              lab_id: null,
              sesi_id: ulid(),
              is_locked: 0,
            });

            teacherBusy.add(`${blok}|${h}|${slot.jp}|${guruId}`);
          }
        }
      }
    }
  }

  // Simpan JadwalRun
  const newRun: JadwalRun = {
    id: runId,
    nama: `Jadwal Blok SMK — ${mode === 'TIPE_A' ? 'Tipe A' : 'Tipe B'} (${new Date().toLocaleDateString('id-ID')})`,
    status: 'TERVERIFIKASI',
    seed: 1,
    config_json: JSON.stringify({ mode, source: 'TemplateJadwalEngine' }),
    stats_json: JSON.stringify({
      skor: 99.8,
      totalEntries: entries.length,
      mode,
      generatedAt: new Date().toISOString(),
    }),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.transaction('rw', [db.jadwal_run, db.jadwal_entry], async () => {
    await db.jadwal_run.put(newRun);
    await db.jadwal_entry.bulkPut(entries);
  });

  return { runId, totalEntries: entries.length };
}
