// src/db/integrity.ts
import { db } from './schema';
import { logger } from '../lib/logger';

export interface IntegrityIssue {
  tabel: string;
  id: string;
  pesan: string;
  tingkat: 'ERROR' | 'PERINGATAN';
}

export async function integrityCheck(): Promise<{ ok: boolean; issues: IntegrityIssue[] }> {
  const issues: IntegrityIssue[] = [];

  try {
    // 1. Cek Pola Blok: setiap kelas aktif harus punya tepat 10 entri (2 blok x 5 hari)
    const kelasList = await db.kelas.filter((k) => k.aktif === 1).toArray();
    for (const k of kelasList) {
      const polas = await db.pola_blok.where({ kelas_id: k.id }).toArray();
      if (polas.length !== 10) {
        issues.push({
          tabel: 'pola_blok',
          id: k.id,
          pesan: `Kelas ${k.nama} memiliki ${polas.length}/10 entri pola blok.`,
          tingkat: 'ERROR',
        });
      }
    }

    // 2. Cek Pengampu: pengampu.guru_id dan mapel_kelas_id harus valid
    const pengampuList = await db.pengampu.toArray();
    for (const p of pengampuList) {
      const guru = await db.guru.get(p.guru_id);
      if (!guru) {
        issues.push({
          tabel: 'pengampu',
          id: p.id,
          pesan: `Pengampu mereferensikan guru yang tidak ada (id: ${p.guru_id})`,
          tingkat: 'ERROR',
        });
      }
      const mk = await db.mapel_kelas.get(p.mapel_kelas_id);
      if (!mk) {
        issues.push({
          tabel: 'pengampu',
          id: p.id,
          pesan: `Pengampu mereferensikan mapel_kelas yang tidak ada (id: ${p.mapel_kelas_id})`,
          tingkat: 'ERROR',
        });
      }
    }

    // 3. Cek Jam Template Aktif
    const activeTemplates = await db.jam_template.filter((t) => t.aktif === 1).toArray();
    if (activeTemplates.length === 0) {
      issues.push({
        tabel: 'jam_template',
        id: 'global',
        pesan: 'Tidak ada template jam efektif yang berstatus aktif.',
        tingkat: 'ERROR',
      });
    } else if (activeTemplates.length > 1) {
      issues.push({
        tabel: 'jam_template',
        id: 'global',
        pesan: 'Lebih dari 1 template jam efektif bertanda aktif.',
        tingkat: 'PERINGATAN',
      });
    }

    logger.info('INTEGRITY', `Pemeriksaan integritas selesai dengan ${issues.length} catatan.`);
    return {
      ok: issues.filter((i) => i.tingkat === 'ERROR').length === 0,
      issues,
    };
  } catch (err) {
    logger.error('INTEGRITY', 'Gagal menjalankan pemeriksaan integritas', err);
    return {
      ok: false,
      issues: [{
        tabel: 'system',
        id: 'unknown',
        pesan: `Pemeriksaan integritas gagal: ${String(err)}`,
        tingkat: 'ERROR',
      }],
    };
  }
}
