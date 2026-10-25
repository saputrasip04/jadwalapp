// src/db/schema.ts
import Dexie, { Table } from 'dexie';
import type {
  Jurusan,
  Level,
  Kelas,
  PolaBlok,
  Lab,
  Mapel,
  MatrixSK,
  MapelKelas,
  Guru,
  GuruKompetensi,
  GuruKetersediaan,
  Pengampu,
  JamTemplate,
  JamSlot,
  JadwalRun,
  JadwalEntry,
  Konflik,
  Snapshot,
  AuditLog,
} from '../domain/types';

export interface MetaItem {
  key: string;
  value: string;
}

export interface SettingItem {
  key: string;
  value_json: string;
  updated_at: string;
}

export class AppDB extends Dexie {
  meta!: Table<MetaItem, string>;
  setting!: Table<SettingItem, string>;
  level!: Table<Level, string>;
  jurusan!: Table<Jurusan, string>;
  kelas!: Table<Kelas, string>;
  pola_blok!: Table<PolaBlok, string>;
  lab!: Table<Lab, string>;
  mapel!: Table<Mapel, string>;
  matrix_sk!: Table<MatrixSK, string>;
  mapel_kelas!: Table<MapelKelas, string>;
  guru!: Table<Guru, string>;
  guru_kompetensi!: Table<GuruKompetensi, [string, string]>;
  guru_ketersediaan!: Table<GuruKetersediaan, string>;
  pengampu!: Table<Pengampu, string>;
  jam_template!: Table<JamTemplate, string>;
  jam_slot!: Table<JamSlot, string>;
  jadwal_run!: Table<JadwalRun, string>;
  jadwal_entry!: Table<JadwalEntry, string>;
  konflik!: Table<Konflik, string>;
  snapshot!: Table<Snapshot, string>;
  audit_log!: Table<AuditLog, string>;

  constructor() {
    super('penjadwal_blok_smk');
    this.version(1).stores({
      meta: 'key',
      setting: 'key',
      level: 'id, &kode',
      jurusan: 'id, &kode, aktif',
      kelas: 'id, &[level_id+jurusan_id+rombel_no], jurusan_id, level_id',
      pola_blok: 'id, &[kelas_id+blok_no+hari], [kelas_id+blok_no]',
      lab: 'id, &kode',
      mapel: 'id, &kode, jenis, aktif',
      matrix_sk: 'id, &[jurusan_id+level_id+mapel_id]',
      mapel_kelas: 'id, &[kelas_id+mapel_id], mapel_id',
      guru: 'id, &kode, aktif',
      guru_kompetensi: '[guru_id+mapel_id], mapel_id',
      guru_ketersediaan: 'id, &[guru_id+blok_no+hari+jp_ke]',
      pengampu: 'id, &mapel_kelas_id, guru_id',
      jam_template: 'id, aktif',
      jam_slot: 'id, &[template_id+hari+urutan]',
      jadwal_run: 'id, status, updated_at',
      jadwal_entry:
        'id, &[run_id+blok_no+kelas_id+hari+jp_ke], &[run_id+blok_no+guru_id+hari+jp_ke], ' +
        '[run_id+blok_no+lab_id+hari+jp_ke], [run_id+blok_no+kelas_id], [run_id+blok_no+guru_id]',
      konflik: 'id, [run_id+severity]',
      snapshot: 'id, created_at',
      audit_log: 'id, at',
    });
  }
}

export const db = new AppDB();
