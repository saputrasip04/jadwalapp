// src/domain/constants.ts
import { Hari, SettingBobot, SettingGuruDefault, SettingJP } from './types';

export const NAMA_HARI: Record<Hari, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
};

export const DEFAULT_SETTING_JP: SettingJP = {
  durasi_menit: 45,
  maks_jp_sesi: 3,
  sesi_lintas_istirahat: false,
};

export const DEFAULT_SETTING_GURU: SettingGuruDefault = {
  jp_min: 24,
  jp_maks: 40,
  maks_jp_hari: 8,
  min_hari_bebas: 1,
  maks_gap: 1,
};

export const DEFAULT_SETTING_BOBOT: SettingBobot = {
  R2: 5,   // Mapel berat di JP awal
  R4a: 8,  // Jeda (gap) guru dalam hari yang sama
  R4b: 30, // Hari bebas guru per blok
  S5: 10,  // Mapel sama dua sesi sehari
  S6: 3,   // Distribusi mapel merata
  S7: 2,   // Konsistensi antar blok
  S8: 15,  // Slot hindari guru
};

export const JURUSAN_DEFAULT = [
  { kode: 'AK', nama: 'Akuntansi dan Keuangan Lembaga' },
  { kode: 'TKR', nama: 'Teknik Kendaraan Ringan' },
  { kode: 'TKJ', nama: 'Teknik Komputer dan Jaringan' },
  { kode: 'PSPT', nama: 'Produksi dan Siaran Program Televisi' },
  { kode: 'KUL', nama: 'Kuliner' },
  { kode: 'DPB', nama: 'Desain Produksi Busana' },
  { kode: 'APAT', nama: 'Agribisnis Perikanan Air Tawar' },
  { kode: 'LAS', nama: 'Teknik Pengelasan' },
];
