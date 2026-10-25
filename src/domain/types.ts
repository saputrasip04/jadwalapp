// src/domain/types.ts

export type BlokNo = 1 | 2;
export type Hari = 1 | 2 | 3 | 4 | 5; // 1: Senin, 2: Selasa, 3: Rabu, 4: Kamis, 5: Jumat
export type JenisHari = 'PRODUKTIF' | 'REGULER';
export type StatusJadwal = 'DRAFT' | 'PERLU_VERIFIKASI' | 'TERVERIFIKASI' | 'FINAL';
export type Severity = 'ERROR' | 'PERINGATAN' | 'INFO';

export interface Level {
  id: string;
  kode: 'X' | 'XI' | 'XII';
  urutan: number;
}

export interface Jurusan {
  id: string;
  kode: string; // 'AK', 'TKR', 'TKJ', 'PSPT', 'KUL', 'DPB', 'APAT', 'LAS'
  nama: string;
  aktif: number; // 1 = aktif, 0 = nonaktif
}

export interface Kelas {
  id: string;
  level_id: string;
  jurusan_id: string;
  rombel_no: number;
  nama: string; // misal 'X PSPT 1'
  wali_guru_id: string | null;
  aktif: number;
}

export interface PolaBlok {
  id: string;
  kelas_id: string;
  blok_no: BlokNo;
  hari: Hari;
  jenis: JenisHari;
  is_assumed: number; // 1 = asumsi, 0 = konfirmasi
}

export interface Lab {
  id: string;
  kode: string;
  nama: string;
  kapasitas_paralel: number;
  aktif: number;
}

export type KelompokMapel = 'UMUM' | 'C1' | 'C2' | 'C3' | 'MULOK' | 'LAINNYA';

export interface Mapel {
  id: string;
  kode: string;
  nama: string;
  kelompok: KelompokMapel;
  jenis: JenisHari;
  is_berat: number; // 1 / 0
  is_pjok: number;
  butuh_lab: number;
  lab_default_id: string | null;
  maks_jp_sesi: number | null;
  aktif: number;
}

export interface MatrixSK {
  id: string;
  jurusan_id: string;
  level_id: string;
  mapel_id: string;
  jp_blok1: number;
  jp_blok2: number;
}

export interface MapelKelas {
  id: string;
  kelas_id: string;
  mapel_id: string;
  jp_blok1: number;
  jp_blok2: number;
  pola_sesi1: string | null; // misal '3+3'
  pola_sesi2: string | null;
  lab_id: string | null;
  sumber: 'SK' | 'OVERRIDE' | 'KHUSUS';
  aktif: number;
}

export interface Guru {
  id: string;
  kode: string; // misal '1', '2', 'G01'
  nip_nik: string | null;
  nama: string;
  sk_guru?: string | null;
  tipe_guru?: 'PRODUKTIF' | 'REGULER';
  setting_jp?: number;
  jp_min: number | null;
  jp_maks: number | null;
  maks_jp_hari: number | null;
  min_hari_bebas: number | null;
  maks_gap: number | null;
  aktif: number;
}

export interface GuruKompetensi {
  guru_id: string;
  mapel_id: string;
}

export interface GuruKetersediaan {
  id: string;
  guru_id: string;
  blok_no: BlokNo;
  hari: Hari;
  jp_ke: number;
  status: 'TIDAK_BISA' | 'HINDARI';
}

export interface Pengampu {
  id: string;
  mapel_kelas_id: string;
  guru_id: string;
}

export interface JamTemplate {
  id: string;
  nama: string;
  aktif: number;
  is_assumed: number;
}

export interface JamSlot {
  id: string;
  template_id: string;
  hari: Hari;
  urutan: number;
  tipe: 'JP' | 'ISTIRAHAT';
  jp_ke: number | null;
  mulai: string; // '07:00'
  selesai: string; // '07:45'
  is_long_break: number; // 1 = ISHOMA, 0 = biasa
}

export interface JadwalRun {
  id: string;
  nama: string;
  status: StatusJadwal;
  seed: number;
  config_json: string;
  stats_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface JadwalEntry {
  id: string;
  run_id: string;
  blok_no: BlokNo;
  kelas_id: string;
  hari: Hari;
  jp_ke: number;
  mapel_kelas_id: string;
  guru_id: string;
  lab_id: string | null;
  sesi_id: string | null;
  is_locked: number;
}

export interface Konflik {
  id: string;
  run_id: string;
  severity: Severity;
  aturan: string; // 'R1', 'H2', 'H3', 'H4', dll.
  pesan: string;
  saran: string | null;
  refs_json: string | null;
  status: 'TERBUKA' | 'DITERIMA' | 'SELESAI';
}

export interface Snapshot {
  id: string;
  created_at: string;
  label: string;
  schema_version: number;
  payload: string; // JSON stringify data
}

export interface AuditLog {
  id: string;
  at: string;
  aksi: 'CREATE' | 'UPDATE' | 'DELETE' | 'SOLVE' | 'FINALIZE' | 'IMPORT' | 'RESTORE';
  entitas: string;
  entitas_id: string | null;
  ringkas: string | null;
}

// Setting Interfaces
export interface SettingSekolah {
  nama: string;
  tahun_ajaran: string;
  semester: 'Ganjil' | 'Genap';
  kepala_sekolah?: string;
  nip_kepala_sekolah?: string;
  tanggal_tertulis?: string;
}

export interface SettingKalender {
  hari_aktif: Hari[];
  blok1: string;
  blok2: string;
}

export interface SettingJP {
  durasi_menit: number;
  maks_jp_sesi: number;
  sesi_lintas_istirahat: boolean;
}

export interface SettingGuruDefault {
  jp_min: number;
  jp_maks: number;
  maks_jp_hari: number;
  min_hari_bebas: number;
  maks_gap: number;
}

export interface SettingBobot {
  R2: number;
  R4a: number;
  R4b: number;
  S5: number;
  S6: number;
  S7: number;
  S8: number;
}

export interface SettingAturanFlags {
  r3_hard: boolean;
}

export interface AturanTambahan {
  kode: string;
  aktif: boolean;
  tipe: 'HARD' | 'SOFT';
  teks: string;
  param: Record<string, unknown>;
}

export interface SettingSolver {
  time_budget_ms: number;
  seed: number;
  mode: 'BARU' | 'LANJUT_LOCKED' | 'PERBAIKI_KONFLIK';
}
