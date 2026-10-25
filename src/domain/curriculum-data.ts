// src/domain/curriculum-data.ts
import { db } from '../db/schema';

export interface DaftarMapelKodeItem {
  no: number;
  kode: string;
  mapel: string;
  jp: number;
  kategori: string; // 'UMUM' | 'AK' | 'TKR' | 'TKJ' | 'PSPT' | 'KULINER' | 'DPB' | 'LAS' | 'APAT'
  tingkat: 'X' | 'XI' | 'XII';
  jenis?: 'REGULER' | 'PRODUKTIF';
  guru?: string;
  guruJp?: Record<string, number>;
}

export const DAFTAR_MAPEL_KODE_DEFAULT: DaftarMapelKodeItem[] = [
  { no: 1, kode: "PAI1", mapel: "PENDIDIKAN AGAMA ISLAM 1", jp: 3, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 2, kode: "PAI2", mapel: "PENDIDIKAN AGAMA ISLAM 2", jp: 3, kategori: "UMUM", tingkat: "XI", jenis: "REGULER" },
  { no: 3, kode: "PAI3", mapel: "PENDIDIKAN AGAMA ISLAM 3", jp: 3, kategori: "UMUM", tingkat: "XII", jenis: "REGULER" },
  { no: 4, kode: "PANC1", mapel: "PANCASILA 1", jp: 2, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 5, kode: "PANC2", mapel: "PANCASILA 2", jp: 2, kategori: "UMUM", tingkat: "XI", jenis: "REGULER" },
  { no: 6, kode: "PANC3", mapel: "PANCASILA 3", jp: 2, kategori: "UMUM", tingkat: "XII", jenis: "REGULER" },
  { no: 7, kode: "BIN1", mapel: "BAHASA INDONESIA 1", jp: 4, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 8, kode: "BIN2", mapel: "BAHASA INDONESIA 2", jp: 3, kategori: "UMUM", tingkat: "XI", jenis: "REGULER" },
  { no: 9, kode: "BIN3", mapel: "BAHASA INDONESIA 3", jp: 3, kategori: "UMUM", tingkat: "XII", jenis: "REGULER" },
  { no: 10, kode: "MTK1", mapel: "MATEMATIKA 1", jp: 4, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 11, kode: "MTK2", mapel: "MATEMATIKA 2", jp: 3, kategori: "UMUM", tingkat: "XI", jenis: "REGULER" },
  { no: 12, kode: "MTK3", mapel: "MATEMATIKA 3", jp: 3, kategori: "UMUM", tingkat: "XII", jenis: "REGULER" },
  { no: 13, kode: "BING1", mapel: "BAHASA INGGRIS 1", jp: 4, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 14, kode: "BING2", mapel: "BAHASA INGGRIS 2", jp: 4, kategori: "UMUM", tingkat: "XI", jenis: "REGULER" },
  { no: 15, kode: "BING3", mapel: "BAHASA INGGRIS 3", jp: 4, kategori: "UMUM", tingkat: "XII", jenis: "REGULER" },
  { no: 16, kode: "SB", mapel: "SENI BUDAYA", jp: 2, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 17, kode: "IPAS", mapel: "ILMU PENGETAHUAN ALAM DAN SOSIAL", jp: 6, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 18, kode: "PENJAS1", mapel: "PENJASKES 1", jp: 3, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 19, kode: "PENJAS2", mapel: "PENJASKES 2", jp: 2, kategori: "UMUM", tingkat: "XI", jenis: "REGULER" },
  { no: 20, kode: "MULOK1", mapel: "MUATAN LOKAL 1", jp: 2, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 21, kode: "MULOK2", mapel: "MUATAN LOKAL 2", jp: 2, kategori: "UMUM", tingkat: "XI", jenis: "REGULER" },
  { no: 22, kode: "KKA", mapel: "KODING DAN KECERDASAN ARTIFICIAL", jp: 2, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 23, kode: "INF", mapel: "INFORMATIKA", jp: 3, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 24, kode: "SI1", mapel: "SEJARAH INDONESIA 1", jp: 2, kategori: "UMUM", tingkat: "X", jenis: "REGULER" },
  { no: 25, kode: "SI2", mapel: "SEJARAH INDONESIA 2", jp: 2, kategori: "UMUM", tingkat: "XI", jenis: "REGULER" },
  { no: 26, kode: "PRO1AK", mapel: "PRODUKTIF 1 FASE E AK", jp: 12, kategori: "AK", tingkat: "X", jenis: "PRODUKTIF" },
  { no: 27, kode: "PRO2AK", mapel: "PRODUKTIF 2 FASE F AK", jp: 18, kategori: "AK", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 28, kode: "PRO3AK", mapel: "PRODUKTIF 3 FASE F AK", jp: 22, kategori: "AK", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 29, kode: "MINAT2AK", mapel: "PEMINATAN 2 AK", jp: 4, kategori: "AK", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 30, kode: "MINAT3AK", mapel: "PEMINATAN 3 AK", jp: 4, kategori: "AK", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 31, kode: "PKK2AK", mapel: "PKK 2 AK", jp: 5, kategori: "AK", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 32, kode: "PKK3AK", mapel: "PKK 3 AK", jp: 5, kategori: "AK", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 33, kode: "PRO1TKR", mapel: "PRODUKTIF 1 FASE E TKR", jp: 12, kategori: "TKR", tingkat: "X", jenis: "PRODUKTIF" },
  { no: 34, kode: "PRO2TKR", mapel: "PRODUKTIF 2 FASE F TKR", jp: 18, kategori: "TKR", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 35, kode: "PRO3TKR", mapel: "PRODUKTIF 3 FASE F TKR", jp: 22, kategori: "TKR", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 36, kode: "MINAT2TKR", mapel: "PEMINATAN 2 TKR", jp: 4, kategori: "TKR", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 37, kode: "MINAT3TKR", mapel: "PEMINATAN 3 TKR", jp: 4, kategori: "TKR", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 38, kode: "PKK2TKR", mapel: "PKK 2 TKR", jp: 5, kategori: "TKR", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 39, kode: "PKK3TKR", mapel: "PKK 3 TKR", jp: 5, kategori: "TKR", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 40, kode: "PRO1TKJ", mapel: "PRODUKTIF 1 FASE E TKJ", jp: 12, kategori: "TKJ", tingkat: "X", jenis: "PRODUKTIF" },
  { no: 41, kode: "PRO2TKJ", mapel: "PRODUKTIF 2 FASE F TKJ", jp: 18, kategori: "TKJ", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 42, kode: "PRO3TKJ", mapel: "PRODUKTIF 3 FASE F TKJ", jp: 22, kategori: "TKJ", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 43, kode: "MINAT2TKJ", mapel: "PEMINATAN 2 TKJ", jp: 4, kategori: "TKJ", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 44, kode: "MINAT3TKJ", mapel: "PEMINATAN 3 TKJ", jp: 4, kategori: "TKJ", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 45, kode: "PKK2TKJ", mapel: "PKK 2 TKJ", jp: 5, kategori: "TKJ", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 46, kode: "PKK3TKJ", mapel: "PKK 3 TKJ", jp: 5, kategori: "TKJ", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 47, kode: "PRO1PSPT", mapel: "PRODUKTIF 1 FASE E PSPT", jp: 12, kategori: "PSPT", tingkat: "X", jenis: "PRODUKTIF" },
  { no: 48, kode: "PRO2PSPT", mapel: "PRODUKTIF 2 FASE F PSPT", jp: 18, kategori: "PSPT", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 49, kode: "PRO3PSPT", mapel: "PRODUKTIF 3 FASE F PSPT", jp: 22, kategori: "PSPT", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 50, kode: "MINAT2PSPT", mapel: "PEMINATAN 2 PSPT", jp: 4, kategori: "PSPT", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 51, kode: "MINAT3PSPT", mapel: "PEMINATAN 3 PSPT", jp: 4, kategori: "PSPT", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 52, kode: "PKK2PSPT", mapel: "PKK 2 PSPT", jp: 5, kategori: "PSPT", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 53, kode: "PKK3PSPT", mapel: "PKK 3 PSPT", jp: 5, kategori: "PSPT", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 54, kode: "PRO1KUL", mapel: "PRODUKTIF 1 FASE E KULINER", jp: 12, kategori: "KULINER", tingkat: "X", jenis: "PRODUKTIF" },
  { no: 55, kode: "PRO2KUL", mapel: "PRODUKTIF 2 FASE F KULINER", jp: 18, kategori: "KULINER", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 56, kode: "PRO3KUL", mapel: "PRODUKTIF 3 FASE F KULINER", jp: 22, kategori: "KULINER", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 57, kode: "MINAT2KUL", mapel: "PEMINATAN 2 KULINER", jp: 4, kategori: "KULINER", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 58, kode: "MINAT3KUL", mapel: "PEMINATAN 3 KULINER", jp: 4, kategori: "KULINER", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 59, kode: "PKK2KUL", mapel: "PKK 2 KULINER", jp: 5, kategori: "KULINER", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 60, kode: "PKK3KUL", mapel: "PKK 3 KULINER", jp: 5, kategori: "KULINER", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 61, kode: "PRO1DPB", mapel: "PRODUKTIF 1 FASE E DPB", jp: 12, kategori: "DPB", tingkat: "X", jenis: "PRODUKTIF" },
  { no: 62, kode: "PRO2DPB", mapel: "PRODUKTIF 2 FASE F DPB", jp: 18, kategori: "DPB", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 63, kode: "PRO3DPB", mapel: "PRODUKTIF 3 FASE F DPB", jp: 22, kategori: "DPB", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 64, kode: "MINAT2DPB", mapel: "PEMINATAN 2 DPB", jp: 4, kategori: "DPB", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 65, kode: "MINAT3DPB", mapel: "PEMINATAN 3 DPB", jp: 4, kategori: "DPB", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 66, kode: "PKK2DPB", mapel: "PKK 2 DPB", jp: 5, kategori: "DPB", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 67, kode: "PKK3DPB", mapel: "PKK 3 DPB", jp: 5, kategori: "DPB", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 68, kode: "PRO1LAS", mapel: "PRODUKTIF 1 FASE E LAS", jp: 12, kategori: "LAS", tingkat: "X", jenis: "PRODUKTIF" },
  { no: 69, kode: "PRO2LAS", mapel: "PRODUKTIF 2 FASE F LAS", jp: 18, kategori: "LAS", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 70, kode: "PRO3LAS", mapel: "PRODUKTIF 3 FASE F LAS", jp: 22, kategori: "LAS", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 71, kode: "MINAT2LAS", mapel: "PEMINATAN 2 LAS", jp: 4, kategori: "LAS", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 72, kode: "MINAT3LAS", mapel: "PEMINATAN 3 LAS", jp: 4, kategori: "LAS", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 73, kode: "PKK2LAS", mapel: "PKK 2 LAS", jp: 5, kategori: "LAS", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 74, kode: "PKK3LAS", mapel: "PKK 3 LAS", jp: 5, kategori: "LAS", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 75, kode: "PRO1APAT", mapel: "PRODUKTIF 1 FASE E APAT", jp: 12, kategori: "APAT", tingkat: "X", jenis: "PRODUKTIF" },
  { no: 76, kode: "PRO2APAT", mapel: "PRODUKTIF 2 FASE F APAT", jp: 18, kategori: "APAT", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 77, kode: "PRO3APAT", mapel: "PRODUKTIF 3 FASE F APAT", jp: 22, kategori: "APAT", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 78, kode: "MINAT2APAT", mapel: "PEMINATAN 2 APAT", jp: 4, kategori: "APAT", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 79, kode: "MINAT3APAT", mapel: "PEMINATAN 3 APAT", jp: 4, kategori: "APAT", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 80, kode: "PKK2APAT", mapel: "PKK 2 APAT", jp: 5, kategori: "APAT", tingkat: "XI", jenis: "PRODUKTIF" },
  { no: 81, kode: "PKK3APAT", mapel: "PKK 3 APAT", jp: 5, kategori: "APAT", tingkat: "XII", jenis: "PRODUKTIF" },
  { no: 82, kode: "BK", mapel: "BIMBINGAN KONSELING", jp: 2, kategori: "UMUM", tingkat: "XII", jenis: "REGULER" },
];

export function getMapelJenis(item: DaftarMapelKodeItem): 'REGULER' | 'PRODUKTIF' {
  if (item.jenis) return item.jenis;
  return item.kategori && item.kategori.toUpperCase() === 'UMUM' ? 'REGULER' : 'PRODUKTIF';
}

export function cleanTeacherName(name: string): string {
  return (name || '').trim();
}

import skCurriculumJson from './sk_curriculum_2026.json';

export interface SkTeacherItem {
  mapel: string;
  cols: any[];
  jp: number;
}

export interface SkTeacher {
  id: number;
  nama: string;
  kode: string;
  mapelUtama: string;
  total: number;
  items: SkTeacherItem[];
  tipe: 'R' | 'P';
  bebanJp: number;
}

export const SK_TEACHERS_DEFAULT: SkTeacher[] = ((skCurriculumJson as any).teachers || []) as SkTeacher[];

export function normTeacherName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mencocokkan apakah dua nama guru merujuk pada orang yang sama (mengabaikan gelar & format kapital)
 */
export function isSameTeacher(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;
  const aNorm = normTeacherName(nameA);
  const bNorm = normTeacherName(nameB);
  if (aNorm === bNorm) return true;

  // Bandingkan nama dasar (tanpa gelar)
  const baseA = normTeacherName(splitTeacherNameAndDegree(nameA).baseName);
  const baseB = normTeacherName(splitTeacherNameAndDegree(nameB).baseName);
  if (baseA && baseB && baseA === baseB) return true;

  if (baseA.length >= 4 && baseB.length >= 4 && (baseA.includes(baseB) || baseB.includes(baseA))) {
    return true;
  }

  return false;
}

export function findMatchingTeachersForMapel(
  m: DaftarMapelKodeItem,
  teachers: { id: string; kode: string; nama: string; sk_guru?: string | null }[]
) {
  if (!m) return [];
  const mKode = (m.kode || '').toUpperCase();
  const normStr = (str: string) =>
    (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const normMapel = normStr(m.mapel || '');

  let mKat = (m.kategori || '').toUpperCase();
  if (!mKat || mKat === '') {
    const jurusans = ['PSPT', 'TKJ', 'TKR', 'AK', 'KUL', 'DPB', 'LAS', 'APAT'];
    for (const j of jurusans) {
      if (mKode.endsWith(j)) {
        mKat = j === 'KUL' ? 'KULINER' : j;
        break;
      }
    }
  }

  return teachers.filter((t) => {
    // 0. Cek jika guru memiliki items penugasan SK dengan kode mapel yang persis
    if ((t as any).items && Array.isArray((t as any).items)) {
      if ((t as any).items.some((it: any) => (it.mapel || '').toUpperCase() === mKode)) {
        return true;
      }
    }

    let rawSk = (t.sk_guru || (t as any).mapelUtama || '').trim();
    if (!rawSk) {
      // Fallback ke kurikulum resmi SK_TEACHERS_DEFAULT jika kolom SK GURU belum diset
      const skT = SK_TEACHERS_DEFAULT.find(
        (st) => isSameTeacher(st.nama, t.nama) || String(st.kode) === String(t.kode)
      );
      if (skT) {
        rawSk = (skT.mapelUtama || '').trim();
      }
    }

    const mu = normStr(rawSk);
    if (!mu) return false;

    // Cek jika sk_guru mengandung kode mapel langsung
    if (mKode.length >= 3 && mu.includes(mKode.toLowerCase())) return true;

    // 1. Kejuruan 8 Jurusan: Hanya sesama guru produktif jurusan tersebut
    if (mKat !== 'UMUM' && mKat !== '') {
      if (mKat === 'PSPT' || mKode.endsWith('PSPT')) return mu.includes('pspt') || mu.includes('siaran') || mu.includes('televisi');
      if (mKat === 'TKJ' || mKode.endsWith('TKJ')) return mu.includes('tkj') || mu.includes('jaringan') || mu.includes('komputer');
      if (mKat === 'TKR' || mKode.endsWith('TKR')) return mu.includes('tkr') || mu.includes('otomotif') || mu.includes('kendaraan');
      if (mKat === 'AK' || mKode.endsWith('AK')) return mu.includes('akuntansi') || mu.includes(' ak') || mu.endsWith('ak') || mu.includes('keuangan');
      if (mKat === 'KULINER' || mKat === 'KUL' || mKode.endsWith('KUL')) return mu.includes('kuliner') || mu.includes('boga');
      if (mKat === 'DPB' || mKat === 'FASHION' || mKode.endsWith('DPB')) return mu.includes('dpb') || mu.includes('busana') || mu.includes('fashion');
      if (mKat === 'LAS' || mKode.endsWith('LAS')) return mu.includes('las') || mu.includes('pengelasan');
      if (mKat === 'APAT' || mKode.endsWith('APAT')) return mu.includes('apat') || mu.includes('perikanan') || mu.includes('air tawar');
    }

    // 2. Mapel Umum
    if (mKode.startsWith('BING') || normMapel.includes('bahasa inggris') || normMapel.includes('inggris')) {
      return mu.includes('inggris') || mu.includes('bing');
    }
    if (mKode.startsWith('BIN') || normMapel.includes('bahasa indonesia')) {
      return (mu.includes('indonesia') || mu.includes('bin')) && !mu.includes('sejarah');
    }
    if (mKode.startsWith('PAI') || normMapel.includes('agama islam') || normMapel.includes('pai') || normMapel.includes('pendidikan agama')) {
      return mu.includes('agama') || mu.includes('pai') || mu.includes('islam');
    }
    if (mKode.startsWith('PANC') || normMapel.includes('pancasila') || normMapel.includes('ppkn') || normMapel.includes('kewarganegaraan')) {
      return mu.includes('pancasila') || mu.includes('ppkn') || mu.includes('kewarganegaraan') || mu.includes('panc');
    }
    if (mKode.startsWith('MTK') || normMapel.includes('matematika')) {
      return mu.includes('matematika') || mu.includes('mtk');
    }
    if (mKode.startsWith('SI') || normMapel.includes('sejarah')) {
      return mu.includes('sejarah') || mu.includes('si');
    }
    if (mKode === 'SB' || normMapel.includes('seni budaya') || normMapel.includes('seni')) {
      return mu.includes('seni') || mu.includes('budaya') || mu.includes('sb');
    }
    if (
      mKode === 'IPAS' ||
      mKode.startsWith('IPAS') ||
      normMapel.includes('ilmu pengetahuan alam') ||
      normMapel.includes('alam dan sosial') ||
      normMapel.includes('projek ipas') ||
      normMapel.includes('proyek ipas') ||
      normMapel.includes('ipas')
    ) {
      return (
        mu.includes('ipas') ||
        mu.includes('ipa') ||
        mu.includes('ips') ||
        mu.includes('ilmu pengetahuan alam') ||
        mu.includes('ilmu pengetahuan sosial') ||
        mu.includes('ilmu pengetahuan alam dan sosial') ||
        mu.includes('pengetahuan alam') ||
        mu.includes('alam dan sosial') ||
        mu.includes('projek ipas') ||
        mu.includes('proyek ipas') ||
        mu.includes('projek ilmu') ||
        mu.includes('proyek ilmu') ||
        mu.includes('sains') ||
        mu.includes('fisika') ||
        mu.includes('kimia') ||
        mu.includes('biologi') ||
        (normMapel.length >= 4 && (normMapel.includes(mu) || mu.includes(normMapel)))
      );
    }
    if (
      mKode.startsWith('PENJAS') ||
      mKode.startsWith('PJOK') ||
      normMapel.includes('penjas') ||
      normMapel.includes('pjok') ||
      normMapel.includes('olahraga') ||
      normMapel.includes('pendidikan jasmani') ||
      normMapel.includes('jasmani')
    ) {
      return (
        mu.includes('penjas') ||
        mu.includes('pjok') ||
        mu.includes('olahraga') ||
        mu.includes('jasmani')
      );
    }
    if (mKode === 'INF' || normMapel.includes('informatika')) {
      return mu.includes('informatika') || mu.includes('inf') || mu.includes('komputer');
    }
    if (mKode === 'KKA' || normMapel.includes('koding') || normMapel.includes('kka') || normMapel.includes('kecerdasan')) {
      return mu.includes('informatika') || mu.includes('kka') || mu.includes('koding') || mu.includes('kecerdasan') || mu.includes('artifisial');
    }
    if (mKode.startsWith('MULOK') || normMapel.includes('muatan lokal') || normMapel.includes('jawa') || normMapel.includes('daerah')) {
      return mu.includes('mulok') || mu.includes('jawa') || mu.includes('daerah');
    }
    if (mKode.startsWith('BK') || normMapel.includes('bimbingan') || normMapel.includes('konseling') || normMapel.includes('bk')) {
      return mu.includes('konseling') || mu.includes('bk') || mu.includes('bp') || mu.includes('bimbingan');
    }

    // 3. Fallback kecocokan nama umum jika panjang >= 4
    if (normMapel.length >= 4 && mu.length >= 4) {
      if (normMapel.includes(mu) || mu.includes(normMapel)) return true;
    }

    return false;
  });
}

/**
 * Memeriksa apakah suatu string HANYA merupakan gelar akademik (bukan nama guru).
 * Contoh yang menghasilkan true: 'S.Pd', 'S.PdI', 'S.Pdi', 'M.Pd', 'S.PD', 'M.PD', 'S.Si', 'Gr.', 'S.T', 'M.M', 'S.Pd, M.Pd'
 * Contoh yang menghasilkan false: 'MASHURI, S.Pdi', 'HARTONO', 'FRIDA ARI SUGIANTI'
 */
export function isDegreeOnly(str: string): boolean {
  if (!str) return false;
  const s = str.trim();
  if (!s) return false;

  // Bersihkan karakter non-huruf untuk cek kode gelar
  const clean = s.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const knownDegrees = new Set([
    'SPD', 'SPDI', 'MPD', 'MPDI', 'SSI', 'ST', 'SKOM', 'SSOS', 'SPI', 'SE', 'MSI',
    'GR', 'MM', 'MKOM', 'MT', 'DR', 'DRA', 'DRS', 'SAG', 'MAG', 'LC', 'MMPD',
    'MPH', 'MA', 'BA', 'MSC', 'MBA', 'PHD', 'SSN', 'SH', 'SPT', 'SFARM', 'SPSI', 'SGZ', 'SKED'
  ]);

  if (knownDegrees.has(clean)) return true;

  // Cek jika merupakan rentetan gelar majemuk yang dipisah koma/titik/spasi (contoh: "S.PdI, M.Pd")
  const parts = s.split(/[,;\s]+/).map((p) => p.replace(/[^a-zA-Z]/g, '').toUpperCase()).filter(Boolean);
  if (parts.length > 0 && parts.every((p) => knownDegrees.has(p))) {
    return true;
  }

  return false;
}

/**
 * Membersihkan data mapel dari key gelar yang tidak sengaja tersimpan sebagai nama guru
 */
export function sanitizeMapelGuruData(m: DaftarMapelKodeItem): DaftarMapelKodeItem {
  let changed = false;

  // 1. Bersihkan guruJp
  let cleanGuruJp: Record<string, number> | undefined = undefined;
  if (m.guruJp && typeof m.guruJp === 'object') {
    cleanGuruJp = {};
    for (const [k, v] of Object.entries(m.guruJp)) {
      if (!k || isDegreeOnly(k)) {
        changed = true;
      } else {
        cleanGuruJp[k] = v;
      }
    }
  }

  // 2. Bersihkan string guru (hanya pisahkan dengan titik koma atau baris baru)
  let cleanGuru = m.guru;
  if (cleanGuru && typeof cleanGuru === 'string') {
    const rawParts = cleanGuru.split(/[;\n]+/).map((x) => x.trim()).filter(Boolean);
    const validParts = rawParts.filter((part) => !isDegreeOnly(part));
    cleanGuru = validParts.join('; ');
    if (cleanGuru !== m.guru) changed = true;
  }

  if (changed) {
    return {
      ...m,
      guru: cleanGuru,
      guruJp: cleanGuruJp,
    };
  }

  return m;
}

export function splitTeacherNameAndDegree(raw: string): { baseName: string; degree: string } {
  let name = (raw || '').trim();
  if (!name) return { baseName: '-', degree: '' };

  const commaIdx = name.indexOf(',');
  if (commaIdx !== -1) {
    const base = name.slice(0, commaIdx).trim();
    const deg = name.slice(commaIdx + 1).replace(/^[\s,]+/, '').trim();
    return { baseName: base, degree: deg };
  }

  const match = name.match(/^(.*?)\s*(S\.Pd[iI]?|M\.Pd|S\.Sos|S\.Si|S\.T|S\.Kom|S\.Pi|SE|M\.Si|Gr\.?)$/i);
  if (match && match[1] && match[2]) {
    return { baseName: match[1].trim(), degree: match[2].trim() };
  }

  return { baseName: name, degree: '' };
}

export function getMapelRombelAndBebanTotal(m: DaftarMapelKodeItem): { program: string; rombelText: string; rombelCount: number; bebanTotal: number } {
  const kat = (m.kategori || '').toUpperCase();
  if (kat === 'UMUM') {
    return {
      program: 'ALL',
      rombelText: '16 Rombel',
      rombelCount: 16,
      bebanTotal: m.jp * 16,
    };
  }

  // Jurusan kejuruan
  let rCount = 2;
  let pName = kat;
  if (kat === 'AK') {
    rCount = 3;
    pName = 'AK';
  } else if (kat === 'TKR') {
    rCount = m.tingkat === 'XII' ? 2 : 3;
    pName = 'TKR';
  } else if (kat === 'TKJ') {
    rCount = 2;
    pName = 'TKJ';
  } else if (kat === 'PSPT') {
    rCount = 2;
    pName = 'PSPT';
  } else if (kat === 'KULINER' || kat === 'KUL') {
    rCount = 2;
    pName = 'KUL';
  } else if (kat === 'DPB' || kat === 'FASHION') {
    rCount = 2;
    pName = 'DPB';
  } else if (kat === 'LAS') {
    rCount = 1;
    pName = 'LAS';
  } else if (kat === 'APAT') {
    rCount = 1;
    pName = 'APAT';
  }

  return {
    program: pName,
    rombelText: `${rCount} Rombel`,
    rombelCount: rCount,
    bebanTotal: m.jp * rCount,
  };
}

/* ==========================================================================
   PROGRAM KEAHLIAN / JURUSAN DATA (J1 s/d J8 RESMI SMK)
   ========================================================================== */
export interface JurusanItem {
  no: number;
  kode: string; // 'J1'..'J8'
  nama: string;
  singkat: string;
  internalCode: string;
  bidang: string;
  icon: string;
  warna: string;
  bgLight: string;
  deskripsi: string;
}

export const DEFAULT_JURUSAN_LIST: JurusanItem[] = [
  {
    no: 1,
    kode: 'J1',
    nama: 'AKUNTANSI',
    singkat: 'AK',
    internalCode: 'AK',
    bidang: 'Bisnis dan Manajemen',
    icon: '📊',
    warna: '#1e40af',
    bgLight: '#eff6ff',
    deskripsi: 'Program keahlian pengelolaan keuangan, akuntansi perbankan, pembukuan digital, dan perpajakan.',
  },
  {
    no: 2,
    kode: 'J2',
    nama: 'TEKNIK KENDARAAN RINGAN',
    singkat: 'TKR',
    internalCode: 'TKR',
    bidang: 'Teknologi Manufaktur & Rekayasa',
    icon: '🚗',
    warna: '#b45309',
    bgLight: '#fefce8',
    deskripsi: 'Program keahlian perawatan mesin kendaraan ringan, sistem pemindah tenaga, chasis, dan kelistrikan otomotif.',
  },
  {
    no: 3,
    kode: 'J3',
    nama: 'TEKNIK KOMPUTER DAN JARINGAN',
    singkat: 'TKJ',
    internalCode: 'TKJ',
    bidang: 'Teknologi Informasi & Komunikasi',
    icon: '💻',
    warna: '#0284c7',
    bgLight: '#f0f9ff',
    deskripsi: 'Program keahlian infrastruktur jaringan, konfigurasi server, fiber optik, cloud computing, dan cyber security.',
  },
  {
    no: 4,
    kode: 'J4',
    nama: 'PRODUKSI DAN SIARAN PROGRAM TELEVISI',
    singkat: 'PSPT',
    internalCode: 'PSPT',
    bidang: 'Seni dan Ekonomi Kreatif',
    icon: '🎥',
    warna: '#7c3aed',
    bgLight: '#faf5ff',
    deskripsi: 'Program keahlian penyiaran televisi, tata sinematografi, pencahayaan, tata suara, dan pascaproduksi video/film.',
  },
  {
    no: 5,
    kode: 'J5',
    nama: 'KULINER',
    singkat: 'KUL',
    internalCode: 'KULINER',
    bidang: 'Pariwisata',
    icon: '🍳',
    warna: '#ea580c',
    bgLight: '#fff7ed',
    deskripsi: 'Program keahlian pengolahan makanan nusantara & internasional, pastry & bakery, dan manajemen perhotelan/restoran.',
  },
  {
    no: 6,
    kode: 'J6',
    nama: 'DESAIN PRODUK BUSANA',
    singkat: 'DPB',
    internalCode: 'FASHION',
    bidang: 'Seni dan Ekonomi Kreatif',
    icon: '👗',
    warna: '#db2777',
    bgLight: '#fdf2f8',
    deskripsi: 'Program keahlian pembuatan pola busana, ilustrasi mode, teknik menjahit adibusana, bordir, dan bisnis fashion retail.',
  },
  {
    no: 7,
    kode: 'J7',
    nama: 'TEKNIK PENGELASAN',
    singkat: 'LAS',
    internalCode: 'LAS',
    bidang: 'Teknologi Manufaktur & Rekayasa',
    icon: '⚡',
    warna: '#475569',
    bgLight: '#f8fafc',
    deskripsi: 'Program keahlian pengelasan SMAW, GMAW, GTAW, OAW, fabrikasi logam, dan inspeksi pengelasan industri modern.',
  },
  {
    no: 8,
    kode: 'J8',
    nama: 'AGRIBISNIS PERIKANAN DAN AIR TAWAR',
    singkat: 'APAT',
    internalCode: 'APAT',
    bidang: 'Agribisnis dan Agriteknologi',
    icon: '🐟',
    warna: '#059669',
    bgLight: '#ecfdf5',
    deskripsi: 'Program keahlian budidaya biota air tawar, pembenihan, pembesaran, formulasi pakan, dan biosecurity perikanan.',
  },
];

export const DEFAULT_PROG: [string, number][] = [
  ['AK', 3],
  ['TKR', 3],
  ['TKJ', 2],
  ['PSPT', 2],
  ['KULINER', 2],
  ['FASHION', 2],
  ['LAS', 1],
  ['APAT', 1],
];

export async function getStoredJurusanList(): Promise<JurusanItem[]> {
  const row = await db.setting.get('jurusan_list');
  if (row && row.value_json) {
    try {
      const parsed = JSON.parse(row.value_json);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].kode) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  return JSON.parse(JSON.stringify(DEFAULT_JURUSAN_LIST));
}

export async function getStoredJurusanProg(): Promise<[string, number][]> {
  const row = await db.setting.get('jurusan_prog');
  if (row && row.value_json) {
    try {
      const parsed = JSON.parse(row.value_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  return JSON.parse(JSON.stringify(DEFAULT_PROG));
}

export async function saveStoredJurusan(list: JurusanItem[], prog: [string, number][]): Promise<void> {
  const now = new Date().toISOString();
  await db.setting.put({
    key: 'jurusan_list',
    value_json: JSON.stringify(list),
    updated_at: now,
  });
  await db.setting.put({
    key: 'jurusan_prog',
    value_json: JSON.stringify(prog),
    updated_at: now,
  });
}

