// src/db/snapshot.ts
import { db } from './schema';
import { ulid } from 'ulid';
import { logger } from '../lib/logger';

export async function createSnapshot(label: string): Promise<string> {
  const snapshotId = ulid();
  try {
    const tables = [
      'meta', 'setting', 'level', 'jurusan', 'kelas', 'pola_blok', 'lab',
      'mapel', 'matrix_sk', 'mapel_kelas', 'guru', 'guru_kompetensi',
      'guru_ketersediaan', 'pengampu', 'jam_template', 'jam_slot',
      'jadwal_run', 'jadwal_entry', 'konflik',
    ] as const;

    const data: Record<string, unknown[]> = {};
    for (const t of tables) {
      data[t] = await db.table(t).toArray();
    }

    const payload = JSON.stringify(data);
    await db.snapshot.put({
      id: snapshotId,
      created_at: new Date().toISOString(),
      label,
      schema_version: 1,
      payload,
    });

    // Prune rolling snapshots (keep manual, keep max 20 non-manual)
    const allAuto = await db.snapshot
      .filter((s) => !s.label.startsWith('manual'))
      .sortBy('created_at');

    if (allAuto.length > 20) {
      const toDelete = allAuto.slice(0, allAuto.length - 20);
      for (const item of toDelete) {
        await db.snapshot.delete(item.id);
      }
    }

    logger.info('SNAPSHOT', `Snapshot berhasil dibuat: ${label} (${snapshotId})`);
    return snapshotId;
  } catch (e) {
    logger.error('SNAPSHOT', `Gagal membuat snapshot ${label}`, e);
    throw e;
  }
}

export async function restoreSnapshot(snapshotId: string): Promise<void> {
  const snap = await db.snapshot.get(snapshotId);
  if (!snap) {
    throw new Error(`Snapshot ${snapshotId} tidak ditemukan`);
  }

  const data = JSON.parse(snap.payload) as Record<string, unknown[]>;
  await db.transaction('rw', [
    db.meta, db.setting, db.level, db.jurusan, db.kelas, db.pola_blok, db.lab,
    db.mapel, db.matrix_sk, db.mapel_kelas, db.guru, db.guru_kompetensi,
    db.guru_ketersediaan, db.pengampu, db.jam_template, db.jam_slot,
    db.jadwal_run, db.jadwal_entry, db.konflik, db.audit_log,
  ], async () => {
    for (const [tblName, rows] of Object.entries(data)) {
      try {
        const tbl = db.table(tblName);
        if (tbl) {
          await tbl.clear();
          await tbl.bulkPut(rows);
        }
      } catch {
        // Abaikan tabel yang tidak terdaftar
      }
    }

    await db.audit_log.put({
      id: ulid(),
      at: new Date().toISOString(),
      aksi: 'RESTORE',
      entitas: 'SNAPSHOT',
      entitas_id: snapshotId,
      ringkas: `Dipulihkan dari snapshot ${snap.label}`,
    });
  });

  logger.info('SNAPSHOT', `Snapshot ${snapshotId} berhasil dipulihkan`);
}

export async function exportBackupJSON(): Promise<string> {
  const tables = [
    'meta', 'setting', 'level', 'jurusan', 'kelas', 'pola_blok', 'lab',
    'mapel', 'matrix_sk', 'mapel_kelas', 'guru', 'guru_kompetensi',
    'guru_ketersediaan', 'pengampu', 'jam_template', 'jam_slot',
    'jadwal_run', 'jadwal_entry', 'konflik',
  ] as const;

  const exportData: Record<string, unknown> = {
    app: 'penjadwal-blok-smk',
    schema_version: 1,
    exported_at: new Date().toISOString(),
    tables: {},
  };

  const tableRecords: Record<string, unknown[]> = {};
  for (const t of tables) {
    tableRecords[t] = await db.table(t).toArray();
  }
  exportData['tables'] = tableRecords;

  return JSON.stringify(exportData, null, 2);
}
