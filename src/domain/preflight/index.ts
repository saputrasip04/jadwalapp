// src/domain/preflight/index.ts
import { db } from '../../db/schema';
import { Severity } from '../types';

export interface PreflightIssue {
  severity: Severity;
  kode: string;
  pesan: string;
  saran: string;
  entityId?: string;
}

export interface PreflightResult {
  lulus: boolean;
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
  infos: PreflightIssue[];
}

export async function runPreflightCheck(): Promise<PreflightResult> {
  const issues: PreflightIssue[] = [];

  const [
    kelasList,
    mapelList,
    mapelKelasList,
    polaList,
    guruList,
    pengampuList,
    templateList,
    slotList,
    labList,
  ] = await Promise.all([
    db.kelas.filter((k) => k.aktif === 1).toArray(),
    db.mapel.filter((m) => m.aktif === 1).toArray(),
    db.mapel_kelas.filter((mk) => mk.aktif === 1).toArray(),
    db.pola_blok.toArray(),
    db.guru.filter((g) => g.aktif === 1).toArray(),
    db.pengampu.toArray(),
    db.jam_template.filter((t) => t.aktif === 1).toArray(),
    db.jam_slot.toArray(),
    db.lab.filter((l) => l.aktif === 1).toArray(),
  ]);

  const activeTemplate = templateList[0];
  if (!activeTemplate) {
    issues.push({
      severity: 'ERROR',
      kode: 'PRE_8.5',
      pesan: 'Tidak ada Template Jam Efektif yang aktif.',
      saran: 'Buka Menu 7 dan aktifkan minimal satu template jam.',
    });
    return {
      lulus: false,
      errors: issues,
      warnings: [],
      infos: [],
    };
  }

  // Hitung slot JP per hari pada template aktif
  const activeSlots = slotList.filter((s) => s.template_id === activeTemplate.id && s.tipe === 'JP');
  const jpCountPerDay: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of activeSlots) {
    jpCountPerDay[s.hari] = (jpCountPerDay[s.hari] ?? 0) + 1;
  }

  // Cek apakah ada istirahat panjang bila ada PJOK
  const hasPJOK = mapelList.some((m) => m.is_pjok === 1);
  const hasLongBreak = slotList.some(
    (s) => s.template_id === activeTemplate.id && s.tipe === 'ISTIRAHAT' && s.is_long_break === 1
  );
  if (hasPJOK && !hasLongBreak) {
    issues.push({
      severity: 'ERROR',
      kode: 'PRE_8.5_PJOK',
      pesan: 'Terdapat mapel PJOK, tetapi template jam tidak memiliki istirahat panjang (ISHOMA).',
      saran: 'Tandai minimal satu slot istirahat sebagai "Istirahat Panjang" di Menu 7.',
    });
  }

  // 8.1 & 8.2: Kapasitas dan Kelengkapan per Kelas per Blok
  for (const k of kelasList) {
    for (const blok of [1, 2] as const) {
      const polas = polaList.filter((p) => p.kelas_id === k.id && p.blok_no === blok);
      if (polas.length !== 5) {
        issues.push({
          severity: 'ERROR',
          kode: 'PRE_8.2_POLA',
          pesan: `Pola hari kelas ${k.nama} Blok ${blok} belum lengkap (${polas.length}/5 hari).`,
          saran: 'Lengkapi pola hari P/R di Menu 4.',
          entityId: k.id,
        });
        continue;
      }

      let slotP = 0;
      let slotR = 0;
      for (const p of polas) {
        const slotsToday = jpCountPerDay[p.hari] ?? 0;
        if (p.jenis === 'PRODUKTIF') slotP += slotsToday;
        else slotR += slotsToday;
      }

      // Hitung JP target dari mapel kelas
      const classMapels = mapelKelasList.filter((mk) => mk.kelas_id === k.id);
      let targetP = 0;
      let targetR = 0;

      for (const cm of classMapels) {
        const mapel = mapelList.find((m) => m.id === cm.mapel_id);
        const jp = blok === 1 ? cm.jp_blok1 : cm.jp_blok2;
        if (!mapel) continue;

        if (mapel.jenis === 'PRODUKTIF') targetP += jp;
        else targetR += jp;

        // Cek pengampu
        if (jp > 0) {
          const hasPengampu = pengampuList.some((p) => p.mapel_kelas_id === cm.id);
          if (!hasPengampu) {
            issues.push({
              severity: 'ERROR',
              kode: 'PRE_8.2_PENGAMPU',
              pesan: `Mapel ${mapel.nama} di kelas ${k.nama} (Blok ${blok}) belum memiliki guru pengampu.`,
              saran: 'Tugaskan guru pengampu di Menu 6.',
              entityId: cm.id,
            });
          }
        }
      }

      // Validasi kapasitas
      if (targetP > slotP) {
        issues.push({
          severity: 'ERROR',
          kode: 'PRE_8.1_P_OVER',
          pesan: `Kapasitas Produktif kelas ${k.nama} Blok ${blok} tidak cukup: Butuh ${targetP} JP, tetapi hanya tersedia ${slotP} slot.`,
          saran: 'Kurangi JP Produktif di Menu 3/5 atau tambah hari Produktif di Menu 4.',
          entityId: k.id,
        });
      } else if (targetP < slotP && targetP > 0) {
        issues.push({
          severity: 'PERINGATAN',
          kode: 'PRE_8.1_P_UNDER',
          pesan: `Ada ${slotP - targetP} slot jam kosong pada hari Produktif kelas ${k.nama} Blok ${blok}.`,
          saran: 'Pastikan seluruh JP Produktif telah diisi.',
          entityId: k.id,
        });
      }

      if (targetR > slotR) {
        issues.push({
          severity: 'ERROR',
          kode: 'PRE_8.1_R_OVER',
          pesan: `Kapasitas Reguler kelas ${k.nama} Blok ${blok} tidak cukup: Butuh ${targetR} JP, tetapi hanya tersedia ${slotR} slot.`,
          saran: 'Kurangi JP Reguler di Menu 3/5 atau sesuaikan pola hari di Menu 4.',
          entityId: k.id,
        });
      }
    }
  }

  // 8.3: Kapasitas Beban Guru
  for (const g of guruList) {
    for (const blok of [1, 2] as const) {
      const pengampus = pengampuList.filter((p) => p.guru_id === g.id);
      let totalJP = 0;
      for (const p of pengampus) {
        const mk = mapelKelasList.find((m) => m.id === p.mapel_kelas_id);
        if (mk) {
          totalJP += blok === 1 ? mk.jp_blok1 : mk.jp_blok2;
        }
      }

      const jpMaks = g.jp_maks ?? 40;
      if (totalJP > jpMaks) {
        issues.push({
          severity: 'PERINGATAN',
          kode: 'PRE_8.3_GURU_OVER',
          pesan: `Total jam mengajar guru ${g.nama} (${g.kode}) di Blok ${blok} (${totalJP} JP) melebihi batas maksimal (${jpMaks} JP).`,
          saran: 'Alihkan sebagian kelas ke guru lain di Menu 6.',
          entityId: g.id,
        });
      }
    }
  }

  const errors = issues.filter((i) => i.severity === 'ERROR');
  const warnings = issues.filter((i) => i.severity === 'PERINGATAN');
  const infos = issues.filter((i) => i.severity === 'INFO');

  return {
    lulus: errors.length === 0,
    errors,
    warnings,
    infos,
  };
}
