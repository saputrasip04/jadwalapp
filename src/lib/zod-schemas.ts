// src/lib/zod-schemas.ts
import { z } from 'zod';

export const MapelSchema = z.object({
  id: z.string().min(1),
  kode: z.string().min(1).max(20).toUpperCase(),
  nama: z.string().min(1).max(100),
  kelompok: z.enum(['UMUM', 'C1', 'C2', 'C3', 'MULOK', 'LAINNYA']),
  jenis: z.enum(['PRODUKTIF', 'REGULER']),
  is_berat: z.number().int().min(0).max(1),
  is_pjok: z.number().int().min(0).max(1),
  butuh_lab: z.number().int().min(0).max(1),
  lab_default_id: z.string().nullable().optional(),
  maks_jp_sesi: z.number().int().min(1).max(8).nullable().optional(),
  aktif: z.number().int().min(0).max(1).default(1),
});

export const GuruSchema = z.object({
  id: z.string().min(1),
  kode: z.string().min(1).max(20).toUpperCase(),
  nip_nik: z.string().nullable().optional(),
  nama: z.string().min(1).max(100),
  sk_guru: z.string().nullable().optional(),
  tipe_guru: z.enum(['PRODUKTIF', 'REGULER']).optional().default('REGULER'),
  setting_jp: z.number().int().min(0).max(60).optional().default(0),
  jp_min: z.number().int().min(0).max(60).nullable().optional(),
  jp_maks: z.number().int().min(0).max(60).nullable().optional(),
  maks_jp_hari: z.number().int().min(1).max(12).nullable().optional(),
  min_hari_bebas: z.number().int().min(0).max(5).nullable().optional(),
  maks_gap: z.number().int().min(0).max(8).nullable().optional(),
  aktif: z.number().int().min(0).max(1).default(1),
});

export const JurusanSchema = z.object({
  id: z.string().min(1),
  kode: z.string().min(1).max(20).toUpperCase(),
  nama: z.string().min(1).max(100),
  aktif: z.number().int().min(0).max(1).default(1),
});

export const KelasSchema = z.object({
  id: z.string().min(1),
  level_id: z.string().min(1),
  jurusan_id: z.string().min(1),
  rombel_no: z.number().int().min(1),
  nama: z.string().min(1),
  wali_guru_id: z.string().nullable().optional(),
  aktif: z.number().int().min(0).max(1).default(1),
});

export const PolaBlokSchema = z.object({
  id: z.string().min(1),
  kelas_id: z.string().min(1),
  blok_no: z.union([z.literal(1), z.literal(2)]),
  hari: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  jenis: z.enum(['PRODUKTIF', 'REGULER']),
  is_assumed: z.number().int().min(0).max(1).default(0),
});

export const MatrixSKSchema = z.object({
  id: z.string().min(1),
  jurusan_id: z.string().min(1),
  level_id: z.string().min(1),
  mapel_id: z.string().min(1),
  jp_blok1: z.number().int().min(0).max(20),
  jp_blok2: z.number().int().min(0).max(20),
});

export const JamSlotSchema = z.object({
  id: z.string().min(1),
  template_id: z.string().min(1),
  hari: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  urutan: z.number().int().min(1),
  tipe: z.enum(['JP', 'ISTIRAHAT']),
  jp_ke: z.number().int().min(1).nullable().optional(),
  mulai: z.string().regex(/^\d{2}:\d{2}$/),
  selesai: z.string().regex(/^\d{2}:\d{2}$/),
  is_long_break: z.number().int().min(0).max(1).default(0),
});
