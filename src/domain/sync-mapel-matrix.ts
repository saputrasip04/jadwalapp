// src/domain/sync-mapel-matrix.ts
import { db } from '../db/schema';
import {
  DAFTAR_MAPEL_KODE_DEFAULT,
  DaftarMapelKodeItem,
  normTeacherName,
  cleanTeacherName,
  splitTeacherNameAndDegree,
  findMatchingTeachersForMapel,
  isDegreeOnly,
  sanitizeMapelGuruData,
  SK_TEACHERS_DEFAULT,
  isSameTeacher,
} from './curriculum-data';

export { isSameTeacher, DAFTAR_MAPEL_KODE_DEFAULT };
export type { DaftarMapelKodeItem };

export interface MapelBadgeItem {
  kode: string;
  mapel: string;
  jp: number;
  tingkat: 'X' | 'XI' | 'XII';
  kategori: string;
}

export interface MatrixCellItem {
  mapelKode: string;
  jp: number;
}

export interface MatrixCellData {
  mapelKode: string;
  jp: number;
  items?: MatrixCellItem[];
}

export interface MatrixGridStorage {
  gridData: Record<string, Record<string, MatrixCellData>>;
  teacherMapels: Record<string, MapelBadgeItem[]>;
  updated_at: string;
}

/**
 * Helper untuk mengambil list mapel item dari sebuah cell matriks.
 * Mendukung format single-mapel lama maupun multi-mapel baru.
 */
export function getCellItems(cell: MatrixCellData | undefined | null): MatrixCellItem[] {
  if (!cell) return [];
  if (Array.isArray(cell.items) && cell.items.length > 0) {
    return cell.items;
  }
  if (cell.mapelKode) {
    return [{ mapelKode: cell.mapelKode, jp: Number(cell.jp) || 0 }];
  }
  return [];
}

/**
 * Cek apakah sebuah cell memuat suatu kode mapel tertentu
 */
export function cellContainsMapel(cell: MatrixCellData | undefined | null, kode: string): boolean {
  if (!cell || !kode) return false;
  const items = getCellItems(cell);
  const clean = kode.trim().toUpperCase();
  return items.some((it) => it.mapelKode.toUpperCase() === clean);
}

/**
 * Hitung JP sebuah mapel spesifik di dalam sebuah cell
 */
export function getCellMapelJp(cell: MatrixCellData | undefined | null, kode: string): number {
  if (!cell || !kode) return 0;
  const items = getCellItems(cell);
  const clean = kode.trim().toUpperCase();
  const found = items.find((it) => it.mapelKode.toUpperCase() === clean);
  return found ? found.jp : 0;
}

/**
 * Memeriksa apakah seorang guru kompatibel mengajar mata pelajaran tertentu.
 * Untuk mapel kejuruan/produktif (misal PSPT, TKJ, AK, TKR, dll):
 * Guru produktif jurusan lain (misal guru AK mengajar PSPT) DITOLAK.
 * Guru resmi di SK kurikulum untuk mapel tsb SELALU DITERIMA.
 */
export function isTeacherCompatibleWithMapel(
  guru: { nama: string; sk_guru?: string | null; tipe_guru?: string },
  mapelKode: string
): boolean {
  if (!guru || !guru.nama || !mapelKode) return true;
  const cleanKode = mapelKode.toUpperCase().trim();

  // 1. Cek jika guru resmi terdaftar di kurikulum SK untuk mapel ini
  const isOfficial = SK_TEACHERS_DEFAULT.some(
    (skT) =>
      isSameTeacher(skT.nama, guru.nama) &&
      skT.items &&
      skT.items.some((it) => it.mapel.toUpperCase() === cleanKode)
  );
  if (isOfficial) return true;

  // 2. Deteksi jurusan mapel
  const jurusans = ['PSPT', 'TKJ', 'TKR', 'AK', 'KULINER', 'KUL', 'DPB', 'FASHION', 'LAS', 'APAT'];
  const matchedJurusan = jurusans.find((j) => cleanKode.includes(j));
  if (!matchedJurusan) {
    // Mapel umum atau non-produktif
    return true;
  }

  // 3. Jika mapel adalah mapel produktif berjurusan (misal PSPT):
  // Cek apakah guru adalah guru produktif dari jurusan yang BERBEDA
  const skStr = (guru.sk_guru || '').toLowerCase();

  // Deteksi jurusan yang diemban oleh guru ini dari profil db.guru
  const skJurusan = (() => {
    if (skStr.includes('pspt') || skStr.includes('siaran') || skStr.includes('televisi')) return 'PSPT';
    if (skStr.includes('tkj') || skStr.includes('jaringan') || skStr.includes('komputer')) return 'TKJ';
    if (skStr.includes('tkr') || skStr.includes('otomotif') || skStr.includes('kendaraan')) return 'TKR';
    if (skStr.includes('akuntansi') || skStr.includes(' ak') || skStr.endsWith('ak') || skStr.includes('keuangan')) return 'AK';
    if (skStr.includes('kuliner') || skStr.includes('boga')) return 'KUL';
    if (skStr.includes('busana') || skStr.includes('fashion') || skStr.includes('dpb')) return 'DPB';
    if (skStr.includes('las') || skStr.includes('pengelasan')) return 'LAS';
    if (skStr.includes('perikanan') || skStr.includes('air tawar') || skStr.includes('apat')) return 'APAT';
    return null;
  })();

  // Cek juga dari SK_TEACHERS_DEFAULT jika guru ada di sana
  const skTeacherObj = SK_TEACHERS_DEFAULT.find((skT) => isSameTeacher(skT.nama, guru.nama));
  const officialJurusan = (() => {
    if (!skTeacherObj) return null;
    const mu = (skTeacherObj.mapelUtama || '').toLowerCase();
    if (mu.includes('pspt')) return 'PSPT';
    if (mu.includes('tkj')) return 'TKJ';
    if (mu.includes('tkr')) return 'TKR';
    if (mu.includes('ak')) return 'AK';
    if (mu.includes('kul')) return 'KUL';
    if (mu.includes('dpb') || mu.includes('fashion')) return 'DPB';
    if (mu.includes('las')) return 'LAS';
    if (mu.includes('apat')) return 'APAT';
    return null;
  })();

  const guruJurusan = officialJurusan || skJurusan;
  const targetJurusanNorm =
    matchedJurusan === 'KULINER' ? 'KUL' : matchedJurusan === 'FASHION' ? 'DPB' : matchedJurusan;

  // Jika guru jelas-jelas guru produktif jurusan lain, tolak!
  if (guruJurusan && guruJurusan !== targetJurusanNorm) {
    return false;
  }

  return true;
}

/**
 * Helper memuat daftar mapel dari db.setting (daftar_mapel_kode)
 */
export async function getStoredMapelList(): Promise<DaftarMapelKodeItem[]> {
  try {
    const s = await db.setting.get('daftar_mapel_kode');
    if (s && s.value_json) {
      const parsed = JSON.parse(s.value_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(sanitizeMapelGuruData);
      }
    }
  } catch (err) {
    console.error('Error getStoredMapelList:', err);
  }
  return JSON.parse(JSON.stringify(DAFTAR_MAPEL_KODE_DEFAULT));
}

/**
 * Helper memuat grid & teacherMapels dari db.setting (matrix_sk_grid)
 */
export async function getStoredMatrixGrid(): Promise<MatrixGridStorage> {
  try {
    const s = await db.setting.get('matrix_sk_grid');
    if (s && s.value_json) {
      const parsed = JSON.parse(s.value_json);
      return {
        gridData: parsed.gridData || {},
        teacherMapels: parsed.teacherMapels || {},
        updated_at: parsed.updated_at || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error('Error getStoredMatrixGrid:', err);
  }
  return {
    gridData: {},
    teacherMapels: {},
    updated_at: new Date().toISOString(),
  };
}

/**
 * 1. Menambahkan seorang Guru ke Rencana Pengampu di Daftar Mapel (Menu 2)
 *    DAN OTOMATIS mengalirkan Mapel tersebut ke Matrix SK (Menu 3) untuk Guru tersebut!
 */
export async function assignTeacherToMapelAutoSync(
  kodeMapel: string,
  targetGuru: { id: string; nama: string; kode?: string },
  jpOverride?: number
): Promise<{ updatedMapelList: DaftarMapelKodeItem[]; updatedMatrixGrid: MatrixGridStorage }> {
  const currentMapels = await getStoredMapelList();
  const currentMatrix = await getStoredMatrixGrid();
  const cleanKode = kodeMapel.trim().toUpperCase();

  let targetMapelItem: DaftarMapelKodeItem | undefined;

  // 1. Update di Daftar Mapel & Kode
  const nextMapelList = currentMapels.map((m) => {
    if (m.kode.toUpperCase() !== cleanKode) return m;
    targetMapelItem = m;
    const nextGuruJp = { ...(m.guruJp || {}) };
    const assignJp = jpOverride || m.jp;
    if (!isDegreeOnly(targetGuru.nama)) {
      nextGuruJp[cleanTeacherName(targetGuru.nama)] = assignJp;
    }
    for (const k of Object.keys(nextGuruJp)) {
      if (isDegreeOnly(k)) delete nextGuruJp[k];
    }
    const namesList = Object.keys(nextGuruJp).join('; ');
    return {
      ...m,
      guru: namesList,
      guruJp: nextGuruJp,
    };
  });

  // 2. Otomatis alirkan ke Matrix SK (teacherMapels guru ini)
  const nextTeacherMapels = { ...currentMatrix.teacherMapels };
  const currentGuruBadges = [...(nextTeacherMapels[targetGuru.id] || [])];

  if (!currentGuruBadges.some((b) => b.kode.toUpperCase() === cleanKode)) {
    const mapelRef = targetMapelItem || DAFTAR_MAPEL_KODE_DEFAULT.find((x) => x.kode === cleanKode);
    currentGuruBadges.push({
      kode: cleanKode,
      mapel: mapelRef ? mapelRef.mapel : cleanKode,
      jp: jpOverride || (mapelRef ? mapelRef.jp : 2),
      tingkat: mapelRef ? mapelRef.tingkat : 'X',
      kategori: mapelRef ? mapelRef.kategori : 'UMUM',
    });
    nextTeacherMapels[targetGuru.id] = currentGuruBadges;
  }

  const nextMatrix: MatrixGridStorage = {
    gridData: currentMatrix.gridData,
    teacherMapels: nextTeacherMapels,
    updated_at: new Date().toISOString(),
  };

  // Simpan keduanya ke Dexie
  await Promise.all([
    db.setting.put({
      key: 'daftar_mapel_kode',
      value_json: JSON.stringify(nextMapelList),
      updated_at: new Date().toISOString(),
    }),
    db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify(nextMatrix),
      updated_at: new Date().toISOString(),
    }),
  ]);

  return { updatedMapelList: nextMapelList, updatedMatrixGrid: nextMatrix };
}

/**
 * 2. Melepas seorang Guru dari Rencana Pengampu di Daftar Mapel (Menu 2)
 *    DAN OTOMATIS melepaskan Mapel tersebut dari Matrix SK (Menu 3) untuk Guru tersebut!
 */
export async function removeTeacherFromMapelAutoSync(
  kodeMapel: string,
  teacherName: string
): Promise<{ updatedMapelList: DaftarMapelKodeItem[]; updatedMatrixGrid: MatrixGridStorage }> {
  const currentMapels = await getStoredMapelList();
  const currentMatrix = await getStoredMatrixGrid();
  const cleanKode = kodeMapel.trim().toUpperCase();

  // 1. Update di Daftar Mapel
  const nextMapelList = currentMapels.map((m) => {
    if (m.kode.toUpperCase() !== cleanKode) return m;
    const nextGuruJp = { ...(m.guruJp || {}) };
    const foundKey = Object.keys(nextGuruJp).find((k) => isSameTeacher(k, teacherName) || k === teacherName);
    if (foundKey) delete nextGuruJp[foundKey];
    for (const k of Object.keys(nextGuruJp)) {
      if (isDegreeOnly(k)) delete nextGuruJp[k];
    }
    const namesList = Object.keys(nextGuruJp).join('; ');
    return {
      ...m,
      guru: namesList,
      guruJp: nextGuruJp,
    };
  });

  // Cari ID guru dari database
  const allGurus = await db.guru.toArray();
  const matchedGuru = allGurus.find((g) => isSameTeacher(g.nama, teacherName));
  const guruId = matchedGuru ? matchedGuru.id : null;

  const nextTeacherMapels = { ...currentMatrix.teacherMapels };
  const nextGridData = { ...currentMatrix.gridData };

  // 2. Otomatis lepas badge di Matrix SK jika ditemukan
  if (guruId && nextTeacherMapels[guruId]) {
    nextTeacherMapels[guruId] = nextTeacherMapels[guruId].filter(
      (b) => b.kode.toUpperCase() !== cleanKode
    );
    // Bersihkan juga cell penugasan di rombel untuk mapel tersebut jika ada
    if (nextGridData[guruId]) {
      const gGrid = { ...nextGridData[guruId] };
      let changed = false;
      Object.entries(gGrid).forEach(([rId, cell]) => {
        if (cell && cellContainsMapel(cell, cleanKode)) {
          const remaining = getCellItems(cell).filter((it) => it.mapelKode.toUpperCase() !== cleanKode);
          if (remaining.length === 0) {
            delete gGrid[rId];
          } else {
            gGrid[rId] = {
              mapelKode: remaining.map((it) => it.mapelKode).join(' + '),
              jp: remaining.reduce((sum, it) => sum + it.jp, 0),
              items: remaining,
            };
          }
          changed = true;
        }
      });
      if (changed) nextGridData[guruId] = gGrid;
    }
  }

  const nextMatrix: MatrixGridStorage = {
    gridData: nextGridData,
    teacherMapels: nextTeacherMapels,
    updated_at: new Date().toISOString(),
  };

  await Promise.all([
    db.setting.put({
      key: 'daftar_mapel_kode',
      value_json: JSON.stringify(nextMapelList),
      updated_at: new Date().toISOString(),
    }),
    db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify(nextMatrix),
      updated_at: new Date().toISOString(),
    }),
  ]);

  return { updatedMapelList: nextMapelList, updatedMatrixGrid: nextMatrix };
}

/**
 * 3. Reset seluruh guru pengampu di satu baris mapel (Menu 2)
 *    DAN OTOMATIS bersihkan mapel ini dari semua guru di Matrix SK (Menu 3)!
 */
export async function resetSingleMapelGuruAutoSync(
  kodeMapel: string
): Promise<{ updatedMapelList: DaftarMapelKodeItem[]; updatedMatrixGrid: MatrixGridStorage }> {
  const currentMapels = await getStoredMapelList();
  const currentMatrix = await getStoredMatrixGrid();
  const cleanKode = kodeMapel.trim().toUpperCase();

  const nextMapelList = currentMapels.map((m) => {
    if (m.kode.toUpperCase() !== cleanKode) return m;
    return {
      ...m,
      guru: '',
      guruJp: {},
    };
  });

  const nextTeacherMapels = { ...currentMatrix.teacherMapels };
  const nextGridData = { ...currentMatrix.gridData };

  Object.keys(nextTeacherMapels).forEach((gId) => {
    nextTeacherMapels[gId] = (nextTeacherMapels[gId] || []).filter(
      (b) => b.kode.toUpperCase() !== cleanKode
    );
    if (nextGridData[gId]) {
      const gGrid = { ...nextGridData[gId] };
      let changed = false;
      Object.entries(gGrid).forEach(([rId, cell]) => {
        if (cell && cellContainsMapel(cell, cleanKode)) {
          const remaining = getCellItems(cell).filter((it) => it.mapelKode.toUpperCase() !== cleanKode);
          if (remaining.length === 0) {
            delete gGrid[rId];
          } else {
            gGrid[rId] = {
              mapelKode: remaining.map((it) => it.mapelKode).join(' + '),
              jp: remaining.reduce((sum, it) => sum + it.jp, 0),
              items: remaining,
            };
          }
          changed = true;
        }
      });
      if (changed) nextGridData[gId] = gGrid;
    }
  });

  const nextMatrix: MatrixGridStorage = {
    gridData: nextGridData,
    teacherMapels: nextTeacherMapels,
    updated_at: new Date().toISOString(),
  };

  await Promise.all([
    db.setting.put({
      key: 'daftar_mapel_kode',
      value_json: JSON.stringify(nextMapelList),
      updated_at: new Date().toISOString(),
    }),
    db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify(nextMatrix),
      updated_at: new Date().toISOString(),
    }),
  ]);

  return { updatedMapelList: nextMapelList, updatedMatrixGrid: nextMatrix };
}

/**
 * 4. Menambahkan Mapel ke Guru di Matrix SK (Menu 3)
 *    DAN OTOMATIS memasukkan Guru tersebut ke kolom Rencana Guru Pengampu di Daftar Mapel (Menu 2)!
 */
export async function assignMapelToGuruAutoSync(
  guru: { id: string; nama: string; kode?: string },
  targetMapel: { kode: string; mapel: string; jp: number; tingkat: 'X' | 'XI' | 'XII'; kategori: string }
): Promise<{ updatedMatrixGrid: MatrixGridStorage; updatedMapelList: DaftarMapelKodeItem[] }> {
  const currentMatrix = await getStoredMatrixGrid();
  const currentMapels = await getStoredMapelList();
  const cleanKode = targetMapel.kode.trim().toUpperCase();

  // 1. Update di Matrix SK
  const nextTeacherMapels = { ...currentMatrix.teacherMapels };
  const currentBadges = [...(nextTeacherMapels[guru.id] || [])];

  if (!currentBadges.some((b) => b.kode.toUpperCase() === cleanKode)) {
    currentBadges.push({
      kode: cleanKode,
      mapel: targetMapel.mapel,
      jp: targetMapel.jp,
      tingkat: targetMapel.tingkat,
      kategori: targetMapel.kategori,
    });
    nextTeacherMapels[guru.id] = currentBadges;
  }

  const nextMatrix: MatrixGridStorage = {
    gridData: currentMatrix.gridData,
    teacherMapels: nextTeacherMapels,
    updated_at: new Date().toISOString(),
  };

  // 2. Otomatis alirkan ke Daftar Mapel & Kode
  const nextMapelList = currentMapels.map((m) => {
    if (m.kode.toUpperCase() !== cleanKode) return m;
    const nextGuruJp = { ...(m.guruJp || {}) };
    nextGuruJp[cleanTeacherName(guru.nama)] = targetMapel.jp || m.jp;
    const namesList = Object.keys(nextGuruJp).join('; ');
    return {
      ...m,
      guru: namesList,
      guruJp: nextGuruJp,
    };
  });

  await Promise.all([
    db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify(nextMatrix),
      updated_at: new Date().toISOString(),
    }),
    db.setting.put({
      key: 'daftar_mapel_kode',
      value_json: JSON.stringify(nextMapelList),
      updated_at: new Date().toISOString(),
    }),
  ]);

  return { updatedMatrixGrid: nextMatrix, updatedMapelList: nextMapelList };
}

/**
 * 5. Menghapus Badge Mapel dari Guru di Matrix SK (Menu 3)
 *    DAN OTOMATIS melepaskan Guru tersebut dari Rencana Guru Pengampu di Daftar Mapel (Menu 2)!
 */
export async function removeMapelFromGuruAutoSync(
  guru: { id: string; nama: string; kode?: string },
  kodeMapel: string
): Promise<{ updatedMatrixGrid: MatrixGridStorage; updatedMapelList: DaftarMapelKodeItem[] }> {
  const currentMatrix = await getStoredMatrixGrid();
  const currentMapels = await getStoredMapelList();
  const cleanKode = kodeMapel.trim().toUpperCase();

  // 1. Update di Matrix SK
  const nextTeacherMapels = { ...currentMatrix.teacherMapels };
  const currentBadges = nextTeacherMapels[guru.id];
  if (currentBadges) {
    nextTeacherMapels[guru.id] = currentBadges.filter(
      (b) => b.kode.toUpperCase() !== cleanKode
    );
  }

  const nextGridData = { ...currentMatrix.gridData };
  if (nextGridData[guru.id]) {
    const gGrid = { ...nextGridData[guru.id] };
    let changed = false;
    Object.entries(gGrid).forEach(([rId, cell]) => {
      if (cell && cellContainsMapel(cell, cleanKode)) {
        const remaining = getCellItems(cell).filter((it) => it.mapelKode.toUpperCase() !== cleanKode);
        if (remaining.length === 0) {
          delete gGrid[rId];
        } else {
          gGrid[rId] = {
            mapelKode: remaining.map((it) => it.mapelKode).join(' + '),
            jp: remaining.reduce((sum, it) => sum + it.jp, 0),
            items: remaining,
          };
        }
        changed = true;
      }
    });
    if (changed) nextGridData[guru.id] = gGrid;
  }

  const nextMatrix: MatrixGridStorage = {
    gridData: nextGridData,
    teacherMapels: nextTeacherMapels,
    updated_at: new Date().toISOString(),
  };

  // 2. Otomatis lepaskan guru dari baris mapel di Daftar Mapel & Kode
  const nextMapelList = currentMapels.map((m) => {
    if (m.kode.toUpperCase() !== cleanKode) return m;
    const nextGuruJp = { ...(m.guruJp || {}) };
    const foundKey = Object.keys(nextGuruJp).find((k) => isSameTeacher(k, guru.nama));
    if (foundKey) delete nextGuruJp[foundKey];
    const namesList = Object.keys(nextGuruJp).join('; ');
    return {
      ...m,
      guru: namesList,
      guruJp: nextGuruJp,
    };
  });

  await Promise.all([
    db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify(nextMatrix),
      updated_at: new Date().toISOString(),
    }),
    db.setting.put({
      key: 'daftar_mapel_kode',
      value_json: JSON.stringify(nextMapelList),
      updated_at: new Date().toISOString(),
    }),
  ]);

  return { updatedMatrixGrid: nextMatrix, updatedMapelList: nextMapelList };
}

/**
 * 6. Sinkronisasi penuh 2 arah saat inisialisasi atau perubahan batch
 */
export async function performFullTwoWaySync(
  source: 'MAPEL_TO_MATRIX' | 'MATRIX_TO_MAPEL'
): Promise<{ mapelList: DaftarMapelKodeItem[]; matrixGrid: MatrixGridStorage }> {
  const currentMapels = await getStoredMapelList();
  const currentMatrix = await getStoredMatrixGrid();
  const allGurus = await db.guru.toArray();

  if (source === 'MAPEL_TO_MATRIX') {
    const nextTeacherMapels: Record<string, MapelBadgeItem[]> = {};

    allGurus.forEach((guru) => {
      const gNama = guru.nama;
      const badges: MapelBadgeItem[] = [];

      currentMapels.forEach((m) => {
        let match = false;
        if (m.guruJp && typeof m.guruJp === 'object') {
          for (const tName of Object.keys(m.guruJp)) {
            if (isSameTeacher(tName, gNama)) {
              match = true;
              break;
            }
          }
        }
        if (!match && m.guru) {
          const parts = m.guru.split(';').map((x) => x.trim());
          if (parts.some((p) => isSameTeacher(p, gNama))) {
            match = true;
          }
        }

        if (match) {
          badges.push({
            kode: m.kode,
            mapel: m.mapel,
            jp: m.jp,
            tingkat: m.tingkat,
            kategori: m.kategori,
          });
        }
      });

      if (badges.length > 0) {
        nextTeacherMapels[guru.id] = badges;
      }
    });

    const nextMatrix: MatrixGridStorage = {
      gridData: currentMatrix.gridData,
      teacherMapels: nextTeacherMapels,
      updated_at: new Date().toISOString(),
    };

    await db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify(nextMatrix),
      updated_at: new Date().toISOString(),
    });

    return { mapelList: currentMapels, matrixGrid: nextMatrix };
  } else {
    // MATRIX_TO_MAPEL
    const nextMapelList = currentMapels.map((m) => {
      const mKode = m.kode.toUpperCase();
      const guruJp: Record<string, number> = {};

      allGurus.forEach((guru) => {
        const badges = currentMatrix.teacherMapels[guru.id] || [];
        const badgeMatch = badges.find((b) => b.kode.toUpperCase() === mKode);
        if (badgeMatch) {
          guruJp[cleanTeacherName(guru.nama)] = badgeMatch.jp || m.jp;
        }
      });

      const names = Object.keys(guruJp).join('; ');
      return {
        ...m,
        guru: names,
        guruJp: guruJp,
      };
    });

    await db.setting.put({
      key: 'daftar_mapel_kode',
      value_json: JSON.stringify(nextMapelList),
      updated_at: new Date().toISOString(),
    });

    return { mapelList: nextMapelList, matrixGrid: currentMatrix };
  }
}

/**
 * 4. Menambahkan Sekaligus Sekelompok Guru (Guru Serombel) ke Rencana Pengampu di Daftar Mapel (Menu 2)
 *    DAN OTOMATIS mengalirkan Mapel tersebut ke Matrix SK (Menu 3) untuk semua Guru tersebut!
 */
export async function assignBatchTeachersToMapelAutoSync(
  kodeMapel: string,
  teachers: { id: string; nama: string; kode?: string; jp?: number }[],
  defaultJp?: number
): Promise<{ updatedMapelList: DaftarMapelKodeItem[]; updatedMatrixGrid: MatrixGridStorage }> {
  const currentMapels = await getStoredMapelList();
  const currentMatrix = await getStoredMatrixGrid();
  const cleanKode = kodeMapel.trim().toUpperCase();

  let targetMapelItem: DaftarMapelKodeItem | undefined;

  // 1. Update di Daftar Mapel & Kode
  const nextMapelList = currentMapels.map((m) => {
    if (m.kode.toUpperCase() !== cleanKode) return m;
    targetMapelItem = m;
    const nextGuruJp = { ...(m.guruJp || {}) };
    const baseJp = defaultJp || m.jp;

    for (const t of teachers) {
      if (!t.nama || isDegreeOnly(t.nama)) continue;
      const teacherJp = t.jp || baseJp;
      nextGuruJp[cleanTeacherName(t.nama)] = teacherJp;
    }

    for (const k of Object.keys(nextGuruJp)) {
      if (isDegreeOnly(k)) delete nextGuruJp[k];
    }

    const namesList = Object.keys(nextGuruJp).join('; ');
    return {
      ...m,
      guru: namesList,
      guruJp: nextGuruJp,
    };
  });

  // 2. Otomatis alirkan ke Matrix SK untuk setiap guru
  const nextTeacherMapels = { ...currentMatrix.teacherMapels };
  const mapelRef = targetMapelItem || DAFTAR_MAPEL_KODE_DEFAULT.find((x) => x.kode === cleanKode);

  for (const t of teachers) {
    if (!t.id) continue;
    const currentGuruBadges = [...(nextTeacherMapels[t.id] || [])];
    if (!currentGuruBadges.some((b) => b.kode.toUpperCase() === cleanKode)) {
      currentGuruBadges.push({
        kode: cleanKode,
        mapel: mapelRef ? mapelRef.mapel : cleanKode,
        jp: t.jp || defaultJp || (mapelRef ? mapelRef.jp : 2),
        tingkat: mapelRef ? mapelRef.tingkat : 'X',
        kategori: mapelRef ? mapelRef.kategori : 'UMUM',
      });
      nextTeacherMapels[t.id] = currentGuruBadges;
    }
  }

  const nextMatrix: MatrixGridStorage = {
    gridData: currentMatrix.gridData,
    teacherMapels: nextTeacherMapels,
    updated_at: new Date().toISOString(),
  };

  await Promise.all([
    db.setting.put({
      key: 'daftar_mapel_kode',
      value_json: JSON.stringify(nextMapelList),
      updated_at: new Date().toISOString(),
    }),
    db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify(nextMatrix),
      updated_at: new Date().toISOString(),
    }),
  ]);

  return { updatedMapelList: nextMapelList, updatedMatrixGrid: nextMatrix };
}

/**
 * 5. Auto-assign guru serombel untuk SEMUA mata pelajaran secara serentak berdasarkan SK GURU
 */
export async function autoAssignAllSerombelTeachers(
  allTeachers: { id: string; kode: string; nama: string; sk_guru?: string | null }[]
): Promise<{ updatedMapelList: DaftarMapelKodeItem[]; updatedMatrixGrid: MatrixGridStorage; totalAssignedCount: number; affectedMapelCount: number }> {
  const currentMapels = await getStoredMapelList();
  const currentMatrix = await getStoredMatrixGrid();

  const nextTeacherMapels = { ...currentMatrix.teacherMapels };
  let totalAssignedCount = 0;
  let affectedMapelCount = 0;

  const nextMapelList = currentMapels.map((m) => {
    const matchingTeachers = findMatchingTeachersForMapel(m, allTeachers);
    if (matchingTeachers.length === 0) return m;

    const nextGuruJp = { ...(m.guruJp || {}) };
    let hasNew = false;

    matchingTeachers.forEach((t) => {
      const cleanName = cleanTeacherName(t.nama);
      if (!nextGuruJp[cleanName]) {
        nextGuruJp[cleanName] = m.jp;
        hasNew = true;
        totalAssignedCount++;
      }

      // Alirkan ke Matrix SK jika ID ada
      if (t.id) {
        const curBadges = [...(nextTeacherMapels[t.id] || [])];
        if (!curBadges.some((b) => b.kode.toUpperCase() === m.kode.toUpperCase())) {
          curBadges.push({
            kode: m.kode.toUpperCase(),
            mapel: m.mapel,
            jp: m.jp,
            tingkat: m.tingkat,
            kategori: m.kategori,
          });
          nextTeacherMapels[t.id] = curBadges;
        }
      }
    });

    if (!hasNew) return m;

    affectedMapelCount++;
    return {
      ...m,
      guru: Object.keys(nextGuruJp).join('; '),
      guruJp: nextGuruJp,
    };
  });

  const nextMatrix: MatrixGridStorage = {
    gridData: currentMatrix.gridData,
    teacherMapels: nextTeacherMapels,
    updated_at: new Date().toISOString(),
  };

  await Promise.all([
    db.setting.put({
      key: 'daftar_mapel_kode',
      value_json: JSON.stringify(nextMapelList),
      updated_at: new Date().toISOString(),
    }),
    db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify(nextMatrix),
      updated_at: new Date().toISOString(),
    }),
  ]);

  return { updatedMapelList: nextMapelList, updatedMatrixGrid: nextMatrix, totalAssignedCount, affectedMapelCount };
}

/**
 * Cek apakah mata pelajaran adalah kategori Produktif (mendukung Team Teaching)
 */
export function isMapelProduktif(kode: string, kategori?: string): boolean {
  const c = (kode || '').toUpperCase().trim();
  const k = (kategori || '').toUpperCase().trim();
  if (k === 'PRODUKTIF' || (k && k !== 'UMUM')) return true;
  if (c.startsWith('PRO') || c.startsWith('PKK') || c.startsWith('MINAT')) return true;
  return false;
}

/**
 * Peraturan Standar Beban JP Mata Pelajaran Produktif SMK:
 * - Kelas X  = 12 JP
 * - Kelas XI = 18 JP
 * - Kelas XII = 22 JP
 */
export function getProductiveStandardJp(jenjang: 'X' | 'XI' | 'XII' | string, kode?: string): number {
  const t = (jenjang || '').toUpperCase().trim();
  const c = (kode || '').toUpperCase().trim();
  if (t === 'X' || c.startsWith('PRO1') || c.includes('FASE E') || c.includes('X')) return 12;
  if (t === 'XI' || c.startsWith('PRO2') || (c.includes('FASE F') && (c.includes('XI') || c.includes('2')))) return 18;
  if (t === 'XII' || c.startsWith('PRO3') || c.includes('XII') || c.includes('3')) return 22;
  if (t === 'XI') return 18;
  if (t === 'XII') return 22;
  return 12;
}

/**
 * 7. Terapkan Pembagian Jam Team Teaching untuk Mapel Produktif
 *    Menugaskan pembagian jam antara guru-guru pengampu pada rombel terpilih,
 *    mengupdate cell di Matrix SK, mengupdate badge guru, dan sinkron ke Daftar Mapel & Kode!
 */
export async function applyTeamTeachingSplitAutoSync(params: {
  mapelKode: string;
  rombelIds: string[];
  unassignRombelIds?: string[];
  removedGuruIds?: string[];
  standardJp?: number;
  allocations: {
    guruId: string;
    guruNama: string;
    guruKode?: string;
    jpPerRombel: number;
    rombelIds?: string[];
  }[];
}): Promise<{ updatedMatrixGrid: MatrixGridStorage; updatedMapelList: DaftarMapelKodeItem[] }> {
  const currentMatrix = await getStoredMatrixGrid();
  const currentMapels = await getStoredMapelList();
  const cleanKode = params.mapelKode.trim().toUpperCase();

  const nextGridData = { ...currentMatrix.gridData };
  const nextTeacherMapels = { ...currentMatrix.teacherMapels };

  // Cari data mapel referensi
  const mapelRef =
    currentMapels.find((m) => m.kode.toUpperCase() === cleanKode) ||
    DAFTAR_MAPEL_KODE_DEFAULT.find((m) => m.kode.toUpperCase() === cleanKode);

  // Bersihkan guru yang dihapus dari penugasan mapel ini
  if (params.removedGuruIds && params.removedGuruIds.length > 0) {
    params.removedGuruIds.forEach((remGId) => {
      // Hapus badge
      const badges = [...(nextTeacherMapels[remGId] || [])];
      nextTeacherMapels[remGId] = badges.filter((b) => b.kode.toUpperCase() !== cleanKode);

      // Hapus cell
      const gGrid = { ...(nextGridData[remGId] || {}) };
      Object.keys(gGrid).forEach((rId) => {
        const curCell = gGrid[rId];
        if (!curCell) return;
        const curItems = getCellItems(curCell);
        const remaining = curItems.filter((it) => it.mapelKode.toUpperCase() !== cleanKode);
        if (remaining.length === 0) {
          delete gGrid[rId];
        } else {
          gGrid[rId] = {
            mapelKode: remaining.map((it) => it.mapelKode).join(' + '),
            jp: remaining.reduce((acc, curr) => acc + curr.jp, 0),
            items: remaining,
          };
        }
      });
      nextGridData[remGId] = gGrid;
    });
  }

  // 1. Update Grid dan Badge untuk setiap guru dalam alokasi
  params.allocations.forEach((alloc) => {
    if (!alloc.guruId) return;

    // Pastikan guru memiliki badge mapel dengan JP yang sesuai
    const currentBadges = [...(nextTeacherMapels[alloc.guruId] || [])];
    const badgeIdx = currentBadges.findIndex((b) => b.kode.toUpperCase() === cleanKode);

    const existingBadge = currentBadges[badgeIdx];
    if (badgeIdx >= 0 && existingBadge) {
      currentBadges[badgeIdx] = {
        kode: existingBadge.kode,
        mapel: existingBadge.mapel,
        tingkat: existingBadge.tingkat,
        kategori: existingBadge.kategori,
        jp: alloc.jpPerRombel,
      };
    } else if (alloc.jpPerRombel > 0) {
      currentBadges.push({
        kode: cleanKode,
        mapel: mapelRef ? mapelRef.mapel : cleanKode,
        jp: alloc.jpPerRombel,
        tingkat: mapelRef ? mapelRef.tingkat : 'X',
        kategori: mapelRef ? mapelRef.kategori : 'PRODUKTIF',
      });
    }
    nextTeacherMapels[alloc.guruId] = currentBadges;

    // Rombel yang ditugaskan khusus untuk guru ini
    const assignedRombels = alloc.rombelIds || params.rombelIds;
    const gGrid = { ...(nextGridData[alloc.guruId] || {}) };

    // Pasang rombel yang dipilih
    assignedRombels.forEach((rId) => {
      const curCell = gGrid[rId];
      const curItems = getCellItems(curCell);
      const remainingItems = curItems.filter((it) => it.mapelKode.toUpperCase() !== cleanKode);

      if (alloc.jpPerRombel > 0) {
        const nextItems = [...remainingItems, { mapelKode: cleanKode, jp: alloc.jpPerRombel }];
        const nextJp = nextItems.reduce((acc, curr) => acc + curr.jp, 0);
        const nextKode = nextItems.map((it) => it.mapelKode).join(' + ');
        gGrid[rId] = {
          mapelKode: nextKode,
          jp: nextJp,
          items: nextItems,
        };
      } else {
        if (remainingItems.length === 0) {
          delete gGrid[rId];
        } else {
          gGrid[rId] = {
            mapelKode: remainingItems.map((it) => it.mapelKode).join(' + '),
            jp: remainingItems.reduce((acc, curr) => acc + curr.jp, 0),
            items: remainingItems,
          };
        }
      }
    });

    // Lepas penugasan pada rombel yang tidak dipilih guru ini (dari unassignRombelIds atau rombel lain)
    if (params.unassignRombelIds && params.unassignRombelIds.length > 0) {
      params.unassignRombelIds.forEach((rId) => {
        if (assignedRombels.includes(rId)) return;
        const curCell = gGrid[rId];
        if (!curCell) return;
        const curItems = getCellItems(curCell);
        const remainingItems = curItems.filter((it) => it.mapelKode.toUpperCase() !== cleanKode);
        if (remainingItems.length === 0) {
          delete gGrid[rId];
        } else {
          gGrid[rId] = {
            mapelKode: remainingItems.map((it) => it.mapelKode).join(' + '),
            jp: remainingItems.reduce((acc, curr) => acc + curr.jp, 0),
            items: remainingItems,
          };
        }
      });
    }

    nextGridData[alloc.guruId] = gGrid;
  });

  const nextMatrix: MatrixGridStorage = {
    gridData: nextGridData,
    teacherMapels: nextTeacherMapels,
    updated_at: new Date().toISOString(),
  };

  // 2. Sinkronkan ke Menu 2: daftar_mapel_kode
  const nextMapelList = currentMapels.map((m) => {
    if (m.kode.toUpperCase() !== cleanKode) return m;
    const nextGuruJp = { ...(m.guruJp || {}) };

    // Hapus guru yang dikeluarkan
    if (params.removedGuruIds && params.removedGuruIds.length > 0) {
      params.removedGuruIds.forEach((remGId) => {
        Object.keys(nextGuruJp).forEach((nameKey) => {
          delete nextGuruJp[nameKey];
        });
      });
    }

    params.allocations.forEach((alloc) => {
      const cleanName = cleanTeacherName(alloc.guruNama);
      if (alloc.jpPerRombel > 0) {
        nextGuruJp[cleanName] = alloc.jpPerRombel;
      } else {
        delete nextGuruJp[cleanName];
      }
    });

    return {
      ...m,
      jp: params.standardJp && params.standardJp > 0 ? params.standardJp : m.jp,
      guru: Object.keys(nextGuruJp).join('; '),
      guruJp: nextGuruJp,
    };
  });

  await Promise.all([
    db.setting.put({
      key: 'daftar_mapel_kode',
      value_json: JSON.stringify(nextMapelList),
      updated_at: new Date().toISOString(),
    }),
    db.setting.put({
      key: 'matrix_sk_grid',
      value_json: JSON.stringify(nextMatrix),
      updated_at: new Date().toISOString(),
    }),
  ]);

  return { updatedMatrixGrid: nextMatrix, updatedMapelList: nextMapelList };
}

