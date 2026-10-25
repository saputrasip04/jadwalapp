// src/db/seed.ts
import { db } from './schema';
import { ulid } from 'ulid';
import {
  DEFAULT_SETTING_BOBOT,
  DEFAULT_SETTING_GURU,
  DEFAULT_SETTING_JP,
  JURUSAN_DEFAULT,
} from '../domain/constants';
import type { JamSlot, Hari } from '../domain/types';

export async function initSeed(force = false) {
  const version = await db.meta.get('schema_version');
  if (version && !force) {
    return;
  }

  await db.transaction('rw', [
    db.meta,
    db.setting,
    db.level,
    db.jurusan,
    db.lab,
    db.guru,
    db.jam_template,
    db.jam_slot,
  ], async () => {
    // 1. Meta
    await db.meta.put({ key: 'schema_version', value: '1' });
    await db.meta.put({ key: 'created_at', value: new Date().toISOString() });

    // 2. Settings Default
    const now = new Date().toISOString();
    await db.setting.put({
      key: 'sekolah',
      value_json: JSON.stringify({
        nama: '',
        tahun_ajaran: '2026/2027',
        semester: 'Ganjil',
        kepala_sekolah: 'MOHAMAD MALIKI, S.Pd',
        nip_kepala_sekolah: '19820921 201407 1 001',
        tanggal_tertulis: 'Singojuruh, 8 Agustus 2023',
      }),
      updated_at: now,
    });

    await db.setting.put({
      key: 'kalender',
      value_json: JSON.stringify({
        hari_aktif: [1, 2, 3, 4, 5],
        blok1: 'ganjil',
        blok2: 'genap',
      }),
      updated_at: now,
    });

    await db.setting.put({
      key: 'jp',
      value_json: JSON.stringify(DEFAULT_SETTING_JP),
      updated_at: now,
    });

    await db.setting.put({
      key: 'guru_default',
      value_json: JSON.stringify(DEFAULT_SETTING_GURU),
      updated_at: now,
    });

    await db.setting.put({
      key: 'bobot',
      value_json: JSON.stringify(DEFAULT_SETTING_BOBOT),
      updated_at: now,
    });

    await db.setting.put({
      key: 'aturan_flags',
      value_json: JSON.stringify({ r3_hard: true }),
      updated_at: now,
    });

    await db.setting.put({
      key: 'aturan_tambahan',
      value_json: JSON.stringify([]),
      updated_at: now,
    });

    await db.setting.put({
      key: 'solver',
      value_json: JSON.stringify({
        time_budget_ms: 60000,
        seed: 1,
        mode: 'BARU',
      }),
      updated_at: now,
    });

    // 3. Level (X, XI, XII)
    const levelCount = await db.level.count();
    if (levelCount === 0) {
      await db.level.bulkPut([
        { id: ulid(), kode: 'X', urutan: 1 },
        { id: ulid(), kode: 'XI', urutan: 2 },
        { id: ulid(), kode: 'XII', urutan: 3 },
      ]);
    }

    // 4. 8 Jurusan
    const jurusanCount = await db.jurusan.count();
    if (jurusanCount === 0) {
      await db.jurusan.bulkPut(
        JURUSAN_DEFAULT.map((j) => ({
          id: ulid(),
          kode: j.kode,
          nama: j.nama,
          aktif: 1,
        }))
      );
    }

    // 5. Default Lab
    const labCount = await db.lab.count();
    if (labCount === 0) {
      await db.lab.bulkPut([
        { id: ulid(), kode: 'LAB_KOMP', nama: 'Laboratorium Komputer', kapasitas_paralel: 1, aktif: 1 },
        { id: ulid(), kode: 'LAB_PSPT', nama: 'Studio TV / Penyiaran', kapasitas_paralel: 1, aktif: 1 },
        { id: ulid(), kode: 'BENGKEL_LAS', nama: 'Bengkel Pengelasan', kapasitas_paralel: 1, aktif: 1 },
        { id: ulid(), kode: 'BENGKEL_OTOMOTIF', nama: 'Bengkel TKR', kapasitas_paralel: 1, aktif: 1 },
      ]);
    }

    // 6. Template Jam Default (Senin-Kamis 10 JP, Jumat 7 JP, ISHOMA jam ke-8)
    const templateCount = await db.jam_template.count();
    if (templateCount === 0) {
      const templateId = ulid();
      await db.jam_template.put({
        id: templateId,
        nama: 'Standar SMK 10 JP (ISHOMA di JP 8)',
        aktif: 1,
        is_assumed: 1,
      });

      const slots: JamSlot[] = [];
      // Senin s/d Kamis (Hari 1-4)
      for (let hari = 1; hari <= 4; hari++) {
        let urutan = 1;
        // JP 1 - 4
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'JP' as const, jp_ke: 1, mulai: '07:00', selesai: '07:45', is_long_break: 0 });
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'JP' as const, jp_ke: 2, mulai: '07:45', selesai: '08:30', is_long_break: 0 });
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'JP' as const, jp_ke: 3, mulai: '08:30', selesai: '09:15', is_long_break: 0 });
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'JP' as const, jp_ke: 4, mulai: '09:15', selesai: '10:00', is_long_break: 0 });
        // Istirahat 1 (Pendek)
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'ISTIRAHAT' as const, jp_ke: null, mulai: '10:00', selesai: '10:15', is_long_break: 0 });
        // JP 5 - 7
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'JP' as const, jp_ke: 5, mulai: '10:15', selesai: '11:00', is_long_break: 0 });
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'JP' as const, jp_ke: 6, mulai: '11:00', selesai: '11:45', is_long_break: 0 });
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'JP' as const, jp_ke: 7, mulai: '11:45', selesai: '12:30', is_long_break: 0 });
        // Istirahat 2 (ISHOMA - Panjang)
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'ISTIRAHAT' as const, jp_ke: null, mulai: '12:30', selesai: '13:00', is_long_break: 1 });
        // JP 8 - 10
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'JP' as const, jp_ke: 8, mulai: '13:00', selesai: '13:45', is_long_break: 0 });
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'JP' as const, jp_ke: 9, mulai: '13:45', selesai: '14:30', is_long_break: 0 });
        slots.push({ id: ulid(), template_id: templateId, hari: hari as 1|2|3|4|5, urutan: urutan++, tipe: 'JP' as const, jp_ke: 10, mulai: '14:30', selesai: '15:15', is_long_break: 0 });
      }

      // Jumat (Hari 5 - 7 JP, ISHOMA istirahat panjang Sholat Jumat)
      let urutanJumat = 1;
      slots.push({ id: ulid(), template_id: templateId, hari: 5 as Hari, urutan: urutanJumat++, tipe: 'JP' as const, jp_ke: 1, mulai: '07:00', selesai: '07:45', is_long_break: 0 });
      slots.push({ id: ulid(), template_id: templateId, hari: 5 as Hari, urutan: urutanJumat++, tipe: 'JP' as const, jp_ke: 2, mulai: '07:45', selesai: '08:30', is_long_break: 0 });
      slots.push({ id: ulid(), template_id: templateId, hari: 5 as Hari, urutan: urutanJumat++, tipe: 'JP' as const, jp_ke: 3, mulai: '08:30', selesai: '09:15', is_long_break: 0 });
      slots.push({ id: ulid(), template_id: templateId, hari: 5 as Hari, urutan: urutanJumat++, tipe: 'ISTIRAHAT' as const, jp_ke: null, mulai: '09:15', selesai: '09:30', is_long_break: 0 });
      slots.push({ id: ulid(), template_id: templateId, hari: 5 as Hari, urutan: urutanJumat++, tipe: 'JP' as const, jp_ke: 4, mulai: '09:30', selesai: '10:15', is_long_break: 0 });
      slots.push({ id: ulid(), template_id: templateId, hari: 5 as Hari, urutan: urutanJumat++, tipe: 'JP' as const, jp_ke: 5, mulai: '10:15', selesai: '11:00', is_long_break: 0 });
      // Istirahat Panjang Jumatan
      slots.push({ id: ulid(), template_id: templateId, hari: 5 as Hari, urutan: urutanJumat++, tipe: 'ISTIRAHAT' as const, jp_ke: null, mulai: '11:00', selesai: '13:00', is_long_break: 1 });
      slots.push({ id: ulid(), template_id: templateId, hari: 5 as Hari, urutan: urutanJumat++, tipe: 'JP' as const, jp_ke: 6, mulai: '13:00', selesai: '13:45', is_long_break: 0 });
      slots.push({ id: ulid(), template_id: templateId, hari: 5 as Hari, urutan: urutanJumat++, tipe: 'JP' as const, jp_ke: 7, mulai: '13:45', selesai: '14:30', is_long_break: 0 });

      await db.jam_slot.bulkPut(slots);
    }

    // 7. Data Guru: Dikosongkan (tidak ada data dummy guru bawaan)
    // Guru murni berasal dari input manual atau import file Excel oleh pengguna.
  });

  // 8. Pembersihan Data Dummy Lama yang Tersimpan di IndexedDB Pengguna
  const dummyCleanupDone = await db.meta.get('dummy_cleanup_done_v1');
  if (!dummyCleanupDone) {
    await db.guru.clear();
    await db.guru_kompetensi.clear();
    await db.guru_ketersediaan.clear();
    await db.pengampu.clear();
    await db.mapel.clear();
    await db.mapel_kelas.clear();
    await db.matrix_sk.clear();
    await db.kelas.clear();
    await db.pola_blok.clear();
    await db.jadwal_entry.clear();
    await db.jadwal_run.clear();
    await db.konflik.clear();

    // Reset nama sekolah jika sebelumnya masih default 'SMK Negeri 1'
    const s = await db.setting.get('sekolah');
    if (s) {
      try {
        const parsed = JSON.parse(s.value_json);
        if (parsed.nama === 'SMK Negeri 1' || parsed.nama === 'SMK NEGERI 1') {
          parsed.nama = '';
          await db.setting.put({
            key: 'sekolah',
            value_json: JSON.stringify(parsed),
            updated_at: new Date().toISOString(),
          });
        }
      } catch (_) {}
    }

    await db.meta.put({ key: 'dummy_cleanup_done_v1', value: 'true' });
  }
}
