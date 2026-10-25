// src/domain/verifier/index.ts
import { db } from '../../db/schema';
import { Severity, Hari, BlokNo } from '../types';

export interface Violation {
  aturan: string;
  severity: Severity;
  pesan: string;
  saran?: string;
  refs: {
    blok?: BlokNo;
    hari?: Hari;
    jp_ke?: number;
    kelas_id?: string;
    guru_id?: string;
    mapel_id?: string;
    lab_id?: string;
  };
}

export interface VerifierReport {
  lulus: boolean;
  totalHardViolations: number;
  totalSoftPenalties: number;
  violations: Violation[];
  checklist: Record<string, 'LULUS' | 'PERINGATAN' | 'GAGAL'>;
  stats: {
    totalEntries: number;
    totalJPPlaced: number;
    totalJPTarget: number;
    guruHariBebas: Record<string, { blok1: number; blok2: number }>;
  };
}

export async function runIndependentVerifier(runId: string): Promise<VerifierReport> {
  const violations: Violation[] = [];
  const checklist: Record<string, 'LULUS' | 'PERINGATAN' | 'GAGAL'> = {
    R1: 'LULUS',
    H2: 'LULUS',
    H3: 'LULUS',
    H4: 'LULUS',
    H5: 'LULUS',
    H6: 'LULUS',
    H7: 'LULUS',
    H8: 'LULUS',
    H9: 'LULUS',
    R3: 'LULUS',
    R2: 'LULUS',
    R4a: 'LULUS',
    R4b: 'LULUS',
    S5: 'LULUS',
    S7: 'LULUS',
    R8: 'LULUS',
  };

  const [
    entries,
    kelasList,
    mapelList,
    mapelKelasList,
    polaList,
    guruList,
    ketersediaanList,
    slotList,
    labList,
    settingSekolah,
  ] = await Promise.all([
    db.jadwal_entry.where({ run_id: runId }).toArray(),
    db.kelas.toArray(),
    db.mapel.toArray(),
    db.mapel_kelas.toArray(),
    db.pola_blok.toArray(),
    db.guru.toArray(),
    db.guru_ketersediaan.toArray(),
    db.jam_slot.toArray(),
    db.lab.toArray(),
    db.setting.get('aturan_flags'),
  ]);

  const flags = settingSekolah ? JSON.parse(settingSekolah.value_json) : { r3_hard: true };

  // Dictionaries for fast lookup
  const kelasMap = new Map(kelasList.map((k) => [k.id, k]));
  const mapelMap = new Map(mapelList.map((m) => [m.id, m]));
  const mkMap = new Map(mapelKelasList.map((mk) => [mk.id, mk]));
  const guruMap = new Map(guruList.map((g) => [g.id, g]));

  // 1. R1: Guru tidak mengajar di dua kelas pada slot sama (di dalam blok yang sama)
  const guruOcc = new Map<string, string[]>(); // key: `${blok}|${guruId}|${hari}|${jp}` -> entryIds
  // 2. H2: Kelas tidak menerima dua mapel pada slot sama
  const kelasOcc = new Map<string, string[]>(); // key: `${blok}|${kelasId}|${hari}|${jp}`
  // 3. H3: Lab tidak melebihi kapasitas
  const labOcc = new Map<string, string[]>(); // key: `${blok}|${labId}|${hari}|${jp}`

  for (const entry of entries) {
    const gKey = `${entry.blok_no}|${entry.guru_id}|${entry.hari}|${entry.jp_ke}`;
    const kKey = `${entry.blok_no}|${entry.kelas_id}|${entry.hari}|${entry.jp_ke}`;

    // R1 Check
    const gList = guruOcc.get(gKey) ?? [];
    gList.push(entry.id);
    guruOcc.set(gKey, gList);
    if (gList.length > 1) {
      checklist.R1 = 'GAGAL';
      const guru = guruMap.get(entry.guru_id);
      violations.push({
        aturan: 'R1',
        severity: 'ERROR',
        pesan: `Bentrok Guru: ${guru?.nama ?? entry.guru_id} dijadwalkan di lebih dari satu kelas pada Blok ${entry.blok_no}, Hari ${entry.hari}, JP ${entry.jp_ke}.`,
        saran: 'Pindahkan salah satu sesi ke hari atau jam lain.',
        refs: { blok: entry.blok_no, hari: entry.hari, jp_ke: entry.jp_ke, guru_id: entry.guru_id },
      });
    }

    // H2 Check
    const kList = kelasOcc.get(kKey) ?? [];
    kList.push(entry.id);
    kelasOcc.set(kKey, kList);
    if (kList.length > 1) {
      checklist.H2 = 'GAGAL';
      const kls = kelasMap.get(entry.kelas_id);
      violations.push({
        aturan: 'H2',
        severity: 'ERROR',
        pesan: `Bentrok Kelas: Kelas ${kls?.nama ?? entry.kelas_id} menerima lebih dari satu mapel pada Blok ${entry.blok_no}, Hari ${entry.hari}, JP ${entry.jp_ke}.`,
        saran: 'Kosongkan salah satu entri pada slot ini.',
        refs: { blok: entry.blok_no, hari: entry.hari, jp_ke: entry.jp_ke, kelas_id: entry.kelas_id },
      });
    }

    // H3 Check
    if (entry.lab_id) {
      const lKey = `${entry.blok_no}|${entry.lab_id}|${entry.hari}|${entry.jp_ke}`;
      const lList = labOcc.get(lKey) ?? [];
      lList.push(entry.id);
      labOcc.set(lKey, lList);
      const lab = labList.find((l) => l.id === entry.lab_id);
      const cap = lab?.kapasitas_paralel ?? 1;
      if (lList.length > cap) {
        checklist.H3 = 'GAGAL';
        violations.push({
          aturan: 'H3',
          severity: 'ERROR',
          pesan: `Bentrok Lab: ${lab?.nama ?? entry.lab_id} dipakai melebihi kapasitas (${lList.length}/${cap}) pada Blok ${entry.blok_no}, Hari ${entry.hari}, JP ${entry.jp_ke}.`,
          saran: 'Pindahkan salah satu kelas pengguna laboratorium.',
          refs: { blok: entry.blok_no, hari: entry.hari, jp_ke: entry.jp_ke, lab_id: entry.lab_id },
        });
      }
    }

    // H4 Check: Mapel PRODUKTIF vs Pola Hari Kelas
    const mk = mkMap.get(entry.mapel_kelas_id);
    const mapel = mk ? mapelMap.get(mk.mapel_id) : undefined;
    if (mapel) {
      const pola = polaList.find(
        (p) => p.kelas_id === entry.kelas_id && p.blok_no === entry.blok_no && p.hari === entry.hari
      );
      if (pola && pola.jenis !== mapel.jenis) {
        checklist.H4 = 'GAGAL';
        const kls = kelasMap.get(entry.kelas_id);
        violations.push({
          aturan: 'H4',
          severity: 'ERROR',
          pesan: `Salah Jenis Hari: Mapel ${mapel.nama} bertipe ${mapel.jenis}, tetapi dijadwalkan di hari ${pola.jenis} pada kelas ${kls?.nama}.`,
          saran: `Pindahkan mapel ini ke hari berlabel ${mapel.jenis}.`,
          refs: { blok: entry.blok_no, hari: entry.hari, jp_ke: entry.jp_ke, kelas_id: entry.kelas_id },
        });
      }
    }

    // H6 Check: Guru Tidak Bisa
    const isUnavail = ketersediaanList.some(
      (u) =>
        u.guru_id === entry.guru_id &&
        u.blok_no === entry.blok_no &&
        u.hari === entry.hari &&
        u.jp_ke === entry.jp_ke &&
        u.status === 'TIDAK_BISA'
    );
    if (isUnavail) {
      checklist.H6 = 'GAGAL';
      const guru = guruMap.get(entry.guru_id);
      violations.push({
        aturan: 'H6',
        severity: 'ERROR',
        pesan: `Guru Berhalangan: ${guru?.nama} memiliki status 'TIDAK BISA' pada Blok ${entry.blok_no}, Hari ${entry.hari}, JP ${entry.jp_ke}.`,
        saran: 'Pindahkan jadwal mengajar guru ini ke slot waktu yang tersedia.',
        refs: { blok: entry.blok_no, hari: entry.hari, jp_ke: entry.jp_ke, guru_id: entry.guru_id },
      });
    }

    // R3 Check: PJOK vs ISHOMA (Istirahat Panjang)
    if (mapel?.is_pjok === 1) {
      // Periksa apakah slot sebelum atau sesudah adalah is_long_break
      const prevSlot = slotList.find(
        (s) => s.hari === entry.hari && s.tipe === 'ISTIRAHAT' && s.is_long_break === 1 && s.urutan === entry.jp_ke
      );
      const nextSlot = slotList.find(
        (s) => s.hari === entry.hari && s.tipe === 'ISTIRAHAT' && s.is_long_break === 1 && s.urutan === entry.jp_ke + 1
      );

      if (prevSlot || nextSlot) {
        const isHard = flags.r3_hard ?? true;
        if (isHard) checklist.R3 = 'GAGAL';
        else if (checklist.R3 === 'LULUS') checklist.R3 = 'PERINGATAN';

        violations.push({
          aturan: 'R3',
          severity: isHard ? 'ERROR' : 'PERINGATAN',
          pesan: `Aturan PJOK: Mapel PJOK dijadwalkan tepat menempel istirahat panjang (ISHOMA) pada Hari ${entry.hari}, JP ${entry.jp_ke}.`,
          saran: 'Geser sesi PJOK agar berjarak minimal 1 JP dari jam istirahat panjang.',
          refs: { blok: entry.blok_no, hari: entry.hari, jp_ke: entry.jp_ke, kelas_id: entry.kelas_id },
        });
      }
    }
  }

  // H5 Check: Target JP Terpenuhi
  let totalJPTarget = 0;
  for (const mk of mapelKelasList) {
    if (mk.aktif !== 1) continue;
    for (const blok of [1, 2] as const) {
      const target = blok === 1 ? mk.jp_blok1 : mk.jp_blok2;
      totalJPTarget += target;
      const placed = entries.filter(
        (e) => e.mapel_kelas_id === mk.id && e.blok_no === blok
      ).length;

      if (placed < target) {
        checklist.H5 = 'GAGAL';
        const kls = kelasMap.get(mk.kelas_id);
        const mapel = mapelMap.get(mk.mapel_id);
        violations.push({
          aturan: 'H5',
          severity: 'ERROR',
          pesan: `JP Kurang: Mapel ${mapel?.nama} di kelas ${kls?.nama} (Blok ${blok}) hanya terpasang ${placed}/${target} JP.`,
          saran: 'Gunakan solver atau tambahkan sesi secara manual di Menu 8.',
          refs: { blok, kelas_id: mk.kelas_id, mapel_id: mk.mapel_id },
        });
      }
    }
  }

  // Soft Constraints R4a & R4b: Gap Guru & Hari Bebas
  const guruHariBebas: Record<string, { blok1: number; blok2: number }> = {};
  for (const guru of guruList) {
    if (guru.aktif !== 1) continue;
    guruHariBebas[guru.id] = { blok1: 0, blok2: 0 };

    for (const blok of [1, 2] as const) {
      let daysWithClass = 0;
      for (let h = 1; h <= 5; h++) {
        const jps = entries
          .filter((e) => e.guru_id === guru.id && e.blok_no === blok && e.hari === h)
          .map((e) => e.jp_ke)
          .sort((a, b) => a - b);

        if (jps.length > 0) {
          daysWithClass++;
          // Hitung gap: jps terakhir - jps pertama + 1 - jumlah jps
          const first = jps[0]!;
          const last = jps[jps.length - 1]!;
          const span = last - first + 1;
          const gaps = span - jps.length;
          const maksGap = guru.maks_gap ?? 1;

          if (gaps > maksGap) {
            if (checklist.R4a === 'LULUS') checklist.R4a = 'PERINGATAN';
            violations.push({
              aturan: 'R4a',
              severity: 'PERINGATAN',
              pesan: `Jeda Jam Guru: Guru ${guru.nama} memiliki jeda ${gaps} JP kosong pada Hari ${h} Blok ${blok} (melebihi batas ${maksGap} JP).`,
              saran: 'Rapatkan jam mengajar guru pada hari tersebut.',
              refs: { blok, hari: h as Hari, guru_id: guru.id },
            });
          }
        }
      }

      const freeDays = 5 - daysWithClass;
      if (blok === 1) guruHariBebas[guru.id]!.blok1 = freeDays;
      else guruHariBebas[guru.id]!.blok2 = freeDays;

      const minFree = guru.min_hari_bebas ?? 1;
      if (freeDays < minFree) {
        if (checklist.R4b === 'LULUS') checklist.R4b = 'PERINGATAN';
        violations.push({
          aturan: 'R4b',
          severity: 'PERINGATAN',
          pesan: `Hari Bebas Kurang: Guru ${guru.nama} hanya memiliki ${freeDays} hari bebas di Blok ${blok} (target minimal ${minFree} hari).`,
          saran: 'Padatkan jadwal mengajar ke hari-hari lain bila memungkinkan.',
          refs: { blok, guru_id: guru.id },
        });
      }
    }
  }

  const hardErrors = violations.filter((v) => v.severity === 'ERROR');
  const softWarnings = violations.filter((v) => v.severity === 'PERINGATAN');

  checklist.R8 = hardErrors.length === 0 ? 'LULUS' : 'GAGAL';

  return {
    lulus: hardErrors.length === 0,
    totalHardViolations: hardErrors.length,
    totalSoftPenalties: softWarnings.length,
    violations,
    checklist,
    stats: {
      totalEntries: entries.length,
      totalJPPlaced: entries.length,
      totalJPTarget,
      guruHariBebas,
    },
  };
}
