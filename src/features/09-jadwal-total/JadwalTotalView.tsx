// src/features/09-jadwal-total/JadwalTotalView.tsx
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { BlokNo, Hari } from '../../domain/types';
import {
  Download,
  Printer,
  Lock,
  Unlock,
  Check,
  ArrowDownUp,
  ArrowLeftRight,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';
import { NAMA_HARI } from '../../domain/constants';
import { exportTableToXLSX } from '../../lib/export-xlsx';
import { ROMBELS_48, RombelCol } from '../03-matrix-sk/MatrixSKView';
import {
  cellContainsMapel,
  DAFTAR_MAPEL_KODE_DEFAULT,
  DaftarMapelKodeItem,
  isSameTeacher,
} from '../../domain/sync-mapel-matrix';
import {
  TemplateMode,
  ClassTemplatePair,
  buildAllDefaultPairs,
  buildDefaultPair,
  generateFullScheduleFromTemplate,
} from '../../domain/template-blok-engine';
import { useToastStore } from '../../ui/Toast';

export interface JadwalCellInfo {
  mapel: string;
  guru: string;
  isProduktif: boolean;
  kode?: string;
}

// Konfigurasi Jam per Hari
export interface JamSlotInfo {
  jp: number;
  label: string;
  waktu: string;
}

export const JAM_SLOTS_SENIN: JamSlotInfo[] = [
  { jp: 1, label: 'Jam 1', waktu: '06.30 - 07.25' },
  { jp: 2, label: 'Jam 2', waktu: '07.25 - 08.00' },
  { jp: 3, label: 'Jam 3', waktu: '08.00 - 08.35' },
  { jp: 4, label: 'Jam 4', waktu: '08.35 - 09.10' },
  { jp: 5, label: 'Jam 5', waktu: '09.10 - 09.45' },
  { jp: 6, label: 'Jam 6', waktu: '10.00 - 10.35' },
  { jp: 7, label: 'Jam 7', waktu: '10.35 - 11.10' },
  { jp: 8, label: 'Jam 8', waktu: '11.10 - 11.45' },
  { jp: 9, label: 'Jam 9', waktu: '12.20 - 12.55' },
  { jp: 10, label: 'Jam 10', waktu: '12.55 - 13.30' },
  { jp: 11, label: 'Jam 11', waktu: '13.30 - 14.05' },
];

export const JAM_SLOTS_SELASA_KAMIS: JamSlotInfo[] = [
  { jp: 1, label: 'Jam 1', waktu: '07.00 - 07.35' },
  { jp: 2, label: 'Jam 2', waktu: '07.35 - 08.10' },
  { jp: 3, label: 'Jam 3', waktu: '08.10 - 08.45' },
  { jp: 4, label: 'Jam 4', waktu: '08.45 - 09.20' },
  { jp: 5, label: 'Jam 5', waktu: '09.45 - 10.20' },
  { jp: 6, label: 'Jam 6', waktu: '10.20 - 10.55' },
  { jp: 7, label: 'Jam 7', waktu: '10.55 - 11.30' },
  { jp: 8, label: 'Jam 8', waktu: '12.15 - 12.50' },
  { jp: 9, label: 'Jam 9', waktu: '12.50 - 13.25' },
  { jp: 10, label: 'Jam 10', waktu: '13.25 - 14.00' },
  { jp: 11, label: 'Jam 11', waktu: '14.00 - 14.35' },
];

export const JAM_SLOTS_JUMAT: JamSlotInfo[] = [
  { jp: 1, label: 'Jam 1', waktu: '07.00 - 07.45' },
  { jp: 2, label: 'Jam 2', waktu: '07.45 - 08.20' },
  { jp: 3, label: 'Jam 3', waktu: '08.20 - 08.55' },
  { jp: 4, label: 'Jam 4', waktu: '08.55 - 09.30' },
  { jp: 5, label: 'Jam 5', waktu: '09.30 - 10.05' },
  { jp: 6, label: 'Jam 6', waktu: '12.15 - 13.00' },
];

export function getJamSlotsByHari(hari: Hari): JamSlotInfo[] {
  if (hari === 1) return JAM_SLOTS_SENIN;
  if (hari === 5) return JAM_SLOTS_JUMAT;
  return JAM_SLOTS_SELASA_KAMIS;
}

export const JadwalTotalView: React.FC = () => {
  const { addToast } = useToastStore();

  // 1. Queries Database Reaktif (Menu 1: db.guru, Menu 8: db.jadwal_run & db.jadwal_entry, Menu 2: db.mapel)
  const runs = useLiveQuery(() => db.jadwal_run.orderBy('updated_at').reverse().toArray()) ?? [];
  const activeRunId = runs[0]?.id;
  const dbEntries = useLiveQuery(
    () => (activeRunId ? db.jadwal_entry.where({ run_id: activeRunId }).toArray() : []),
    [activeRunId]
  ) ?? [];
  const guruList = useLiveQuery(() => db.guru.toArray()) ?? [];
  const mapelList = useLiveQuery(() => db.mapel.toArray()) ?? [];

  // 2. Queries Setting Reaktif (Menu 3: matrix_sk_grid, Menu 2 & 5: daftar_mapel_kode, Menu 8: template jadwal)
  const settingMatrix = useLiveQuery(() => db.setting.get('matrix_sk_grid'));
  const settingMapel = useLiveQuery(() => db.setting.get('daftar_mapel_kode'));
  const settingTemplateMode = useLiveQuery(() => db.setting.get('jadwal_template_mode'));
  const settingTemplateCustomA = useLiveQuery(() => db.setting.get('jadwal_template_custom_v2_TIPE_A'));
  const settingTemplateCustomB = useLiveQuery(() => db.setting.get('jadwal_template_custom_v2_TIPE_B'));

  // Parse Matrix Grid (Menu 3: Matrix SK)
  const matrixGrid = useMemo(() => {
    if (settingMatrix?.value_json) {
      try {
        const parsed = JSON.parse(settingMatrix.value_json);
        return {
          gridData: parsed.gridData || {},
          teacherMapels: parsed.teacherMapels || {},
        };
      } catch (e) {
        console.warn('Matrix grid parse error:', e);
      }
    }
    return { gridData: {}, teacherMapels: {} };
  }, [settingMatrix]);

  // Parse Daftar Mapel & Kode (Menu 2: Daftar Mapel, Menu 5: Menu Mapel)
  const daftarMapelKodeList: DaftarMapelKodeItem[] = useMemo(() => {
    if (settingMapel?.value_json) {
      try {
        const parsed = JSON.parse(settingMapel.value_json);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn('Daftar mapel parse error:', e);
      }
    }
    return DAFTAR_MAPEL_KODE_DEFAULT;
  }, [settingMapel]);

  // Parse Mode Template (Menu 8: Template Jadwal)
  const templateMode: TemplateMode = useMemo(() => {
    if (settingTemplateMode?.value_json) {
      try {
        const m = JSON.parse(settingTemplateMode.value_json);
        if (m === 'TIPE_A' || m === 'TIPE_B') return m;
      } catch (e) {}
    }
    return 'TIPE_A';
  }, [settingTemplateMode]);

  // Parse Custom Templates Map (Menu 8: Template Jadwal Blok)
  const customTemplatesMap: Record<string, ClassTemplatePair> = useMemo(() => {
    const setting = templateMode === 'TIPE_A' ? settingTemplateCustomA : settingTemplateCustomB;
    if (setting?.value_json) {
      try {
        const p = JSON.parse(setting.value_json);
        if (p && typeof p === 'object') return p;
      } catch (e) {}
    }
    const defaults = buildAllDefaultPairs(templateMode);
    const map: Record<string, ClassTemplatePair> = {};
    defaults.forEach((pair) => {
      map[pair.id] = pair;
    });
    return map;
  }, [templateMode, settingTemplateCustomA, settingTemplateCustomB]);

  // State Kontrol Toolbar
  const [activeBlok, setActiveBlok] = useState<BlokNo>(1);
  const [orientation, setOrientation] = useState<'DOWN' | 'SIDE'>('DOWN'); // 'DOWN' = Jam Kebawah, 'SIDE' = Jam Kesamping
  const [filterHari, setFilterHari] = useState<string>('ALL'); // 'ALL' | '1'..'5'
  const [filterTingkat, setFilterTingkat] = useState<string>('ALL'); // 'ALL' | 'X' | 'XI' | 'XII'
  const [filterJurusan, setFilterJurusan] = useState<string>('ALL'); // 'ALL' | 'AK' | 'TKR' | ...
  const [isLockedBlokHijau, setIsLockedBlokHijau] = useState<boolean>(true);
  const [isAutoResolving, setIsAutoResolving] = useState<boolean>(false);
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);

  // Filter 48 Rombel Sekolah
  const displayRombels = useMemo(() => {
    return ROMBELS_48.filter((r) => {
      const matchT = filterTingkat === 'ALL' || r.tingkat === filterTingkat;
      const matchJ =
        filterJurusan === 'ALL' ||
        r.jurusanKode.toUpperCase() === filterJurusan.toUpperCase() ||
        (filterJurusan === 'DPB' && r.jurusanKode === 'DPB');
      return matchT && matchJ;
    });
  }, [filterTingkat, filterJurusan]);

  // Daftar Hari yang Ditampilkan
  const displayHariList = useMemo(() => {
    if (filterHari === 'ALL') return [1, 2, 3, 4, 5] as Hari[];
    const h = parseInt(filterHari, 10);
    return [h as Hari];
  }, [filterHari]);

  // Helper: Format Nama Guru Singkat (Bersih Gelar)
  const formatShortTeacherName = (fullName: string): string => {
    if (!fullName || fullName.trim() === '' || fullName === '- Belum diset -') return '- Belum diset -';
    const clean = fullName.replace(/,.*$/, '').trim(); // Buang gelar belakang jika ada
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0]!;
    if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
    return `${parts[0]} ${parts[1]} ${parts[2]?.slice(0, 2)}..`;
  };

  // Helper: Menemukan nama guru dari ID, Kode, atau Nama
  const findTeacherNameByIdOrKey = (guruKey: string): string => {
    if (!guruKey) return '- Belum diset -';
    const gObj = guruList.find(
      (g) => g.id === guruKey || g.kode === guruKey || isSameTeacher(g.nama, guruKey)
    );
    if (gObj) return formatShortTeacherName(gObj.nama);
    return formatShortTeacherName(guruKey);
  };

  // Helper: Mencari guru pengampu untuk rombel tertentu & mapel tertentu dari Matrix SK (Menu 3) & Menu Mapel (Menu 2 & 5)
  const findTeacherForRombelAndMapel = (
    rombelId: string,
    mapelKode: string,
    mapelName?: string
  ): string => {
    if (!rombelId) return '- Belum diset -';
    const cleanKode = (mapelKode || '').toUpperCase().trim();
    const cleanName = (mapelName || '').toUpperCase().trim();

    // 1. Cek di Matrix SK (Menu 3: Matrix SK & Menu 5: Menu Mapel) - Sumber Kebenaran Penugasan Rombel
    if (matrixGrid?.gridData) {
      for (const [guruId, rombelMap] of Object.entries(
        matrixGrid.gridData as Record<string, Record<string, any>>
      )) {
        const cell = rombelMap[rombelId];
        if (cell) {
          const cCode = (typeof cell === 'string' ? cell : cell.mapelKode || '').toUpperCase();
          const items = Array.isArray(cell.items) ? cell.items : [];

          // Match jika cell memuat kode mapel ini atau keyword mapel
          const hasDirectMatch =
            (cleanKode && (cCode === cleanKode || items.some((it: any) => it.mapelKode && it.mapelKode.toUpperCase() === cleanKode))) ||
            (cleanKode && (cCode.includes(cleanKode) || items.some((it: any) => it.mapelKode && it.mapelKode.toUpperCase().includes(cleanKode))));

          const isBothProduktif =
            (cleanKode.startsWith('PRO') || cleanName.includes('PRODUKTIF')) &&
            !cleanKode.includes('PKK') && !cleanKode.includes('MINAT') &&
            (cCode.startsWith('PRO') || cCode.includes('PRODUKTIF') || items.some((it: any) => (it.mapelKode || '').toUpperCase().startsWith('PRO')));

          // Aliases untuk mapel kurikulum umum SMK
          const isAliasMatch = (() => {
            if (cleanKode.includes('PAI') || cleanName.includes('AGAMA')) {
              return cCode.includes('PAI') || cCode.includes('AGAMA') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('PAI'));
            }
            if (cleanKode.includes('PANC') || cleanName.includes('PANCASILA')) {
              return cCode.includes('PANC') || cCode.includes('PPKN') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('PANC'));
            }
            if (cleanKode.includes('BIN') || cleanName.includes('INDONESIA')) {
              return cCode.includes('BIN') || (cCode.includes('INDONESIA') && !cCode.includes('SEJARAH')) || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('BIN'));
            }
            if (cleanKode.includes('MAT') || cleanName.includes('MATEMATIKA') || cleanKode.includes('MTK')) {
              return cCode.includes('MAT') || cCode.includes('MTK') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('MAT') || (it.mapelKode || '').toUpperCase().includes('MTK'));
            }
            if (cleanKode.includes('PJOK') || cleanName.includes('PENJAS')) {
              return cCode.includes('PJOK') || cCode.includes('PENJAS') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('PJOK') || (it.mapelKode || '').toUpperCase().includes('PENJAS'));
            }
            if (cleanKode.includes('INF') || cleanName.includes('INFORMATIKA')) {
              return cCode.includes('INF') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('INF'));
            }
            if (cleanKode.includes('IPAS')) {
              return cCode.includes('IPAS') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('IPAS'));
            }
            if (cleanKode.includes('SEJ') || cleanName.includes('SEJARAH')) {
              return cCode.includes('SEJ') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('SEJ'));
            }
            if (cleanKode.includes('SB') || cleanName.includes('SENI')) {
              return cCode.includes('SB') || cCode.includes('SENI') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('SB') || (it.mapelKode || '').toUpperCase().includes('SENI'));
            }
            if (cleanKode.includes('BING') || cleanName.includes('INGGRIS')) {
              return cCode.includes('BING') || cCode.includes('INGGRIS') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('BING') || (it.mapelKode || '').toUpperCase().includes('INGGRIS'));
            }
            if (cleanKode.includes('ML') || cleanName.includes('LOKAL') || cleanName.includes('MULOK')) {
              return cCode.includes('ML') || cCode.includes('MULOK') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('ML') || (it.mapelKode || '').toUpperCase().includes('MULOK'));
            }
            if (cleanKode.includes('KOD') || cleanName.includes('KODING')) {
              return cCode.includes('KOD') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('KOD'));
            }
            if (cleanKode.includes('PKK')) {
              return cCode.includes('PKK') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('PKK'));
            }
            if (cleanKode.includes('MINAT') || cleanKode.includes('PILIHAN') || cleanName.includes('PEMINATAN') || cleanName.includes('PILIHAN')) {
              return cCode.includes('MINAT') || cCode.includes('PILIHAN') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('MINAT') || (it.mapelKode || '').toUpperCase().includes('PILIHAN'));
            }
            return false;
          })();

          if (hasDirectMatch || isBothProduktif || isAliasMatch) {
            return findTeacherNameByIdOrKey(guruId);
          }
        }
      }
    }

    // 2. Fallback: Cek di Daftar Mapel & Kode (Menu 2 & Menu 5)
    const matchedMapel = daftarMapelKodeList.find((m) => {
      const mCode = m.kode.toUpperCase();
      return (
        mCode === cleanKode ||
        (cleanKode && mCode.includes(cleanKode)) ||
        (cleanName && m.mapel.toUpperCase().includes(cleanName))
      );
    });

    if (matchedMapel) {
      if (matchedMapel.guruJp) {
        const teachersWithJp = Object.entries(matchedMapel.guruJp).filter(
          ([_, jpVal]) => Number(jpVal) > 0
        );
        if (teachersWithJp.length === 1 && teachersWithJp[0]) {
          return formatShortTeacherName(teachersWithJp[0][0]);
        }
      }
      if (
        matchedMapel.guru &&
        matchedMapel.guru.trim() &&
        !matchedMapel.guru.includes(';') &&
        matchedMapel.guru !== '- Belum diset -'
      ) {
        return formatShortTeacherName(matchedMapel.guru);
      }
    }

    return '- Belum diset -';
  };

  // Resolver Sel Jadwal Master 48 Rombel Mengikuti Aliran Data Menu-Menu Sebelumnya
  const getCellSchedule = (blok: BlokNo, hari: Hari, jp: number, r: RombelCol): JadwalCellInfo => {
    // 1. Cek dari db.jadwal_entry jika ada jadwal hasil Generate dari Menu 8
    if (dbEntries.length > 0) {
      const match = dbEntries.find(
        (e) => e.kelas_id === r.id && e.blok_no === blok && e.hari === hari && e.jp_ke === jp
      );
      if (match) {
        const mObj =
          mapelList.find((m) => m.id === match.mapel_kelas_id || m.kode === match.mapel_kelas_id) ||
          daftarMapelKodeList.find((m) => m.kode === match.mapel_kelas_id);
        
        const mKode = mObj?.kode || match.mapel_kelas_id || '';
        const mNama = (mObj as any)?.nama || (mObj as any)?.mapel || mKode || 'MAPEL';
        const codeUpper = mKode.toUpperCase();
        const namaUpper = mNama.toUpperCase();

        const isProd =
          (mObj as any)?.jenis === 'PRODUKTIF' ||
          (mObj as any)?.kategori === 'PRODUKTIF' ||
          codeUpper.startsWith('PRO') ||
          namaUpper.includes('PRODUKTIF') ||
          codeUpper.startsWith('PKK') ||
          namaUpper.includes('PKK') ||
          codeUpper.startsWith('MINAT') ||
          codeUpper.startsWith('PILIHAN') ||
          namaUpper.includes('PEMINATAN');

        let displayMapel = mNama;
        if (displayMapel === 'MAPEL' || !displayMapel) {
          const tNum = r.tingkat === 'X' ? '1' : r.tingkat === 'XI' ? '2' : '3';
          if (codeUpper.startsWith('MINAT') || codeUpper.startsWith('PILIHAN')) {
            displayMapel = `PEMINATAN ${tNum}`;
          } else if (codeUpper.startsWith('PKK')) {
            displayMapel = `PKK ${tNum}`;
          } else if (codeUpper.startsWith('PRO')) {
            displayMapel = `PRODUKTIF ${tNum}`;
          } else {
            displayMapel = mKode;
          }
        }

        let teacherName = '- Belum diset -';
        if (match.guru_id) {
          const gObj = guruList.find((g) => g.id === match.guru_id || g.kode === match.guru_id);
          if (gObj) {
            teacherName = formatShortTeacherName(gObj.nama);
          } else if (
            match.guru_id.startsWith('GURU_REG_') ||
            match.guru_id.startsWith('GURU_PROD_') ||
            match.guru_id.startsWith('GURU_PKK_') ||
            match.guru_id.startsWith('GURU_MINAT_')
          ) {
            teacherName = findTeacherForRombelAndMapel(r.id, mKode, displayMapel);
          } else {
            teacherName = match.guru_id;
          }
        } else {
          teacherName = findTeacherForRombelAndMapel(r.id, mKode, displayMapel);
        }

        return {
          mapel: displayMapel,
          guru: teacherName,
          isProduktif: isProd,
          kode: mKode,
        };
      }
    }

    // 2. Aliran Data Template Jadwal Blok (Menu 8) + Matrix SK (Menu 3) + Menu Mapel (Menu 2 & 5)
    const tingkat = r.tingkat;
    const jur = r.jurusanKode;
    const no = r.nomor; // 1, 2, 3

    // Ambil template pair dari Menu 8
    const pairKey = `${tingkat}_${jur}`;
    const pair =
      customTemplatesMap[pairKey] ||
      buildDefaultPair(tingkat, jur, r.jurusanNama, templateMode);

    // Menentukan giliran template rombel (alternating block SMK)
    const schedule =
      (blok === 1 && no === 1) || (blok === 2 && no === 2)
        ? pair.rombel1
        : pair.rombel2;

    // Untuk Rombel 3 (seperti X AK 3, X TKR 3):
    // Dalam pola SMK 3 rombel:
    // Blok 1: Rombel 1 Produktif Senin, Rombel 2 Produktif Selasa, Rombel 3 Produktif Rabu
    // Blok 2: Rombel 2 Produktif Senin, Rombel 1 Produktif Selasa, Rombel 3 Produktif Rabu
    const isRombel3ProdDay = no === 3 && hari === 3;

    // Periksa slot template Menu 8 pada hari dan JP ini
    const templateDaySlots = schedule.days[hari] || [];
    const templateSlot = templateDaySlots.find((s) => s.jp === jp);

    const isSlotProduktif =
      isRombel3ProdDay ||
      (templateSlot && templateSlot.type === 'PRODUKTIF') ||
      (no === 1 && blok === 1 && hari === 1) ||
      (no === 2 && blok === 2 && hari === 1) ||
      (no === 2 && blok === 1 && hari === 2) ||
      (no === 1 && blok === 2 && hari === 2) ||
      (no === 1 && tingkat === 'XII' && blok === 1 && hari === 2) ||
      (no === 2 && tingkat === 'XII' && blok === 1 && hari === 4) ||
      (no === 1 && tingkat === 'XI' && blok === 1 && hari === 2 && jp <= 7) ||
      (no === 2 && tingkat === 'XI' && blok === 1 && hari === 4 && jp <= 11);

    // A. JIKA SLOT BLOK PRODUKTIF (HIJAU)
    if (isSlotProduktif) {
      const prodCode =
        templateSlot?.code ||
        (tingkat === 'X' ? `PRO1${jur}` : tingkat === 'XI' ? `PRO2${jur}` : `PRO3${jur}`);

      const codeUpper = prodCode.toUpperCase();
      const tNum = tingkat === 'X' ? '1' : tingkat === 'XI' ? '2' : '3';
      const prodLabel =
        templateSlot?.label ||
        (codeUpper.includes('PKK')
          ? `PKK ${tNum}`
          : codeUpper.includes('MINAT') || codeUpper.includes('PILIHAN')
          ? `PEMINATAN ${tNum}`
          : `PRODUKTIF ${tNum}`);

      // Cari guru pengampu dari Matrix SK / Menu Mapel untuk rombel ini
      const teacherName = findTeacherForRombelAndMapel(r.id, prodCode, prodLabel);

      return {
        mapel: prodLabel,
        guru: teacherName,
        isProduktif: true,
        kode: prodCode,
      };
    }

    // B. JIKA REGULER / TEORI (Aliran Data Mapel & Guru Pengampu)
    let regMapelNama = 'MAPEL TEORI';
    let regMapelKode = '';

    if (tingkat === 'X') {
      if (hari === 1) {
        if (no === 2) {
          if (jp >= 1 && jp <= 3) { regMapelNama = 'PENDIDIKAN AGAMA'; regMapelKode = 'PAI1'; }
          else if (jp >= 4 && jp <= 5) { regMapelNama = 'PANCASILA 1'; regMapelKode = 'PANC1'; }
          else if (jp >= 6 && jp <= 8) { regMapelNama = 'PENJASKES 1'; regMapelKode = 'PJOK1'; }
          else if (jp >= 9 && jp <= 10) { regMapelNama = 'MUATAN LOKAL 1'; regMapelKode = 'ML1'; }
          else if (jp === 11) { regMapelNama = 'KODING DAN KECER'; regMapelKode = 'KOD1'; }
        } else if (no === 3) {
          if (jp >= 1 && jp <= 4) { regMapelNama = 'MATEMATIKA 1'; regMapelKode = 'MAT1'; }
          else if (jp >= 5 && jp <= 8) { regMapelNama = 'BAHASA INDONESIA'; regMapelKode = 'BIN1'; }
          else if (jp === 9) {
            const pKode = `PRO1${jur}`;
            return {
              mapel: 'PRODUKTIF 1',
              guru: findTeacherForRombelAndMapel(r.id, pKode, 'PRODUKTIF 1'),
              isProduktif: true,
              kode: pKode,
            };
          }
          else if (jp >= 10 && jp <= 11) { regMapelNama = 'PANCASILA 1'; regMapelKode = 'PANC1'; }
        }
      } else if (hari === 2) {
        if (no === 1) {
          if (jp >= 1 && jp <= 2) { regMapelNama = 'PENJASKES 1'; regMapelKode = 'PJOK1'; }
          else if (jp >= 3 && jp <= 5) { regMapelNama = 'PENDIDIKAN AGAMA'; regMapelKode = 'PAI1'; }
          else if (jp >= 6 && jp <= 8) { regMapelNama = 'MATEMATIKA 1'; regMapelKode = 'MAT1'; }
          else if (jp >= 9 && jp <= 10) { regMapelNama = 'BAHASA INDONESIA'; regMapelKode = 'BIN1'; }
          else if (jp === 11) {
            const pKode = `PRO1${jur}`;
            return {
              mapel: 'PRODUKTIF 1',
              guru: findTeacherForRombelAndMapel(r.id, pKode, 'PRODUKTIF 1'),
              isProduktif: true,
              kode: pKode,
            };
          }
        } else if (no === 3) {
          if (jp >= 1 && jp <= 2) { regMapelNama = 'INFORMATIKA'; regMapelKode = 'INF1'; }
          else if (jp >= 3 && jp <= 5) { regMapelNama = 'PENDIDIKAN AGAMA'; regMapelKode = 'PAI1'; }
          else if (jp >= 6 && jp <= 8) { regMapelNama = 'PENJASKES 1'; regMapelKode = 'PJOK1'; }
          else if (jp >= 9 && jp <= 10) { regMapelNama = 'MUATAN LOKAL 1'; regMapelKode = 'ML1'; }
          else if (jp === 11) { regMapelNama = 'KODING DAN KECER'; regMapelKode = 'KOD1'; }
        }
      } else if (hari === 3) {
        if (jp >= 1 && jp <= 4) { regMapelNama = 'MATEMATIKA 1'; regMapelKode = 'MAT1'; }
        else if (jp >= 5 && jp <= 8) { regMapelNama = 'BAHASA INDONESIA'; regMapelKode = 'BIN1'; }
        else if (jp >= 9 && jp <= 10) {
          regMapelNama = no === 1 ? 'PANCASILA 1' : 'MUATAN LOKAL 1';
          regMapelKode = no === 1 ? 'PANC1' : 'ML1';
        } else if (jp === 11) { regMapelNama = 'KODING DAN KECER'; regMapelKode = 'KOD1'; }
      } else if (hari === 4) {
        if (jp >= 1 && jp <= 3) { regMapelNama = 'SEJARAH'; regMapelKode = 'SEJ1'; }
        else if (jp >= 4 && jp <= 5) {
          regMapelNama = no === 1 ? 'MUATAN LOKAL 1' : 'BAHASA INDONESIA';
          regMapelKode = no === 1 ? 'ML1' : 'BIN1';
        } else if (jp >= 6 && jp <= 8) { regMapelNama = 'INFORMATIKA'; regMapelKode = 'INF1'; }
        else if (jp >= 9 && jp <= 11) { regMapelNama = 'IPAS 1'; regMapelKode = 'IPAS1'; }
      } else if (hari === 5) {
        if (jp >= 1 && jp <= 3) { regMapelNama = 'SENI BUDAYA'; regMapelKode = 'SB1'; }
        else if (jp >= 4 && jp <= 6) { regMapelNama = 'B. INGGRIS 1'; regMapelKode = 'BING1'; }
      }
    } else if (tingkat === 'XI') {
      if (hari === 5) {
        if (jp >= 1 && jp <= 3) { regMapelNama = 'PENDIDIKAN AGAMA 2'; regMapelKode = 'PAI2'; }
        else if (jp >= 4 && jp <= 6) { regMapelNama = 'PANCASILA 2'; regMapelKode = 'PANC2'; }
      } else {
        if (jp >= 1 && jp <= 4) { regMapelNama = 'MATEMATIKA 2'; regMapelKode = 'MAT2'; }
        else if (jp >= 5 && jp <= 7) { regMapelNama = 'B. INGGRIS 2'; regMapelKode = 'BING2'; }
        else if (jp >= 8 && jp <= 10) { regMapelNama = 'B. INDONESIA 2'; regMapelKode = 'BIN2'; }
        else { regMapelNama = 'MUATAN LOKAL 2'; regMapelKode = 'ML2'; }
      }
    } else {
      // TINGKAT XII
      if (hari === 5) {
        if (jp >= 1 && jp <= 3) { regMapelNama = 'PENDIDIKAN AGAMA 3'; regMapelKode = 'PAI3'; }
        else if (jp >= 4 && jp <= 6) { regMapelNama = 'B. INDONESIA 3'; regMapelKode = 'BIN3'; }
      } else {
        if (jp >= 1 && jp <= 4) { regMapelNama = 'MATEMATIKA 3'; regMapelKode = 'MAT3'; }
        else if (jp >= 5 && jp <= 8) { regMapelNama = 'B. INGGRIS 3'; regMapelKode = 'BING3'; }
        else if (jp >= 9 && jp <= 11) { regMapelNama = 'PKK 3'; regMapelKode = 'PKK3'; }
      }
    }

    // Cari guru pengampu dari Matrix SK / Menu Mapel untuk rombel dan mapel reguler ini
    const teacherName = findTeacherForRombelAndMapel(r.id, regMapelKode, regMapelNama);

    return {
      mapel: regMapelNama,
      guru: teacherName,
      isProduktif: false,
      kode: regMapelKode,
    };
  };

  // Handler Toggle Kunci Blok Hijau
  const handleToggleLockBlokHijau = () => {
    setIsLockedBlokHijau((prev) => {
      const next = !prev;
      addToast({
        type: next ? 'success' : 'info',
        title: next ? '🔒 Blok Hijau Terkunci' : '🔓 Blok Hijau Dibuka',
        message: next
          ? 'Seluruh 48 rombel pada slot Blok Produktif (Hijau) telah terkunci dan aman dari tabrakan.'
          : 'Kunci blok dibuka sementara untuk pengaturan mandiri.',
      });
      return next;
    });
  };

  // Handler Export Excel Seluruh 48 Rombel
  const handleExportXLSX = () => {
    try {
      const headers = ['Hari', 'Jam Ke', 'Waktu'];
      displayRombels.forEach((r) => {
        headers.push(`${r.nama} [Mapel]`, `${r.nama} [Guru]`);
      });

      const rows: string[][] = [];

      displayHariList.forEach((h) => {
        const slots = getJamSlotsByHari(h);
        slots.forEach((s) => {
          const row: string[] = [NAMA_HARI[h], s.label, s.waktu];
          displayRombels.forEach((r) => {
            const cell = getCellSchedule(activeBlok, h, s.jp, r);
            row.push(cell.mapel, cell.guru);
          });
          rows.push(row);
        });
      });

      exportTableToXLSX([headers, ...rows], `JADWAL_TOTAL_MASTER_BLOK_${activeBlok}_48_ROMBEL`, `Blok_${activeBlok}`);
      addToast({
        type: 'success',
        title: '✓ Excel Berhasil Diekspor',
        message: `Jadwal Total Master Blok ${activeBlok} (${displayRombels.length} Rombel) telah diunduh.`,
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal Ekspor Excel', message: String(err?.message || err) });
    }
  };

  // Handler Cetak
  const handlePrint = () => {
    window.print();
  };

  // Handler Selesaikan Bentrok Otomatis (Algoritma Cerdas Anti-Tabrakan)
  const handleAutoResolveConflicts = async () => {
    try {
      setIsAutoResolving(true);
      const result = await generateFullScheduleFromTemplate(templateMode, customTemplatesMap);
      addToast({
        type: 'success',
        title: '⚡ Jadwal Otomatis Berhasil Disusun',
        message: `Jadwal Total 48 Rombel berhasil di-generate bebas tabrakan (${result.totalEntries} slot tersimpan di database).`,
      });
      setShowConflictModal(false);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Gagal Menyelesaikan Bentrok',
        message: String(err?.message || err),
      });
    } finally {
      setIsAutoResolving(false);
    }
  };

  // Cek Bentrok Guru Otomatis Antar Seluruh 48 Rombel
  const realConflicts = useMemo(() => {
    const teacherSlots = new Map<string, string[]>(); // key: `${hari}_${jp}_${guru}`, value: rombelNames

    displayHariList.forEach((h) => {
      const slots = getJamSlotsByHari(h);
      slots.forEach((s) => {
        displayRombels.forEach((r) => {
          const cell = getCellSchedule(activeBlok, h, s.jp, r);
          if (cell.guru && cell.guru !== '- Belum diset -') {
            const key = `${h}_${s.jp}_${cell.guru}`;
            const existing = teacherSlots.get(key) || [];
            existing.push(r.nama);
            teacherSlots.set(key, existing);
          }
        });
      });
    });

    const conflicts: { hari: Hari; jp: number; guru: string; rombels: string[] }[] = [];
    teacherSlots.forEach((rombels, key) => {
      if (rombels.length > 1) {
        const [hStr, jpStr, ...gParts] = key.split('_');
        conflicts.push({
          hari: Number(hStr) as Hari,
          jp: Number(jpStr),
          guru: gParts.join('_'),
          rombels,
        });
      }
    });

    return conflicts;
  }, [displayHariList, displayRombels, activeBlok, matrixGrid, dbEntries, daftarMapelKodeList, customTemplatesMap]);

  const bentrokCount = realConflicts.length;

  return (
    <div className="w-full h-full flex flex-col min-h-0 space-y-2 font-sans select-none overflow-hidden bg-slate-100 p-2 md:p-3">
      {/* 1. Header Toolbar Master Biru Tua (Sesuai Gambar User) */}
      <div className="bg-[#1b4cb4] text-white rounded-xl shadow-md p-3 md:py-3.5 md:px-5 flex flex-col gap-2.5 shrink-0 border border-blue-400/30">
        <h1 className="text-base md:text-lg font-black uppercase tracking-wider text-white text-center drop-shadow-xs">
          JADWAL TOTAL MASTER (48 ROMBEL)
        </h1>

        {/* Toolbar Tombol & Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-blue-400/30">
          {/* Sisi Kiri: Tab Blok, Toggle Jam, Filter Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tab Blok 1 / Blok 2 */}
            <div className="inline-flex rounded-lg p-0.5 bg-blue-900/40 border border-blue-400/30 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveBlok(1)}
                className={`px-3 py-1.5 rounded-md text-xs font-black transition-all cursor-pointer ${
                  activeBlok === 1
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
              >
                Blok 1 (Ganjil)
              </button>
              <button
                type="button"
                onClick={() => setActiveBlok(2)}
                className={`px-3 py-1.5 rounded-md text-xs font-black transition-all cursor-pointer ${
                  activeBlok === 2
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
              >
                Blok 2 (Genap)
              </button>
            </div>

            {/* Toggle Orientasi: Jam Kebawah vs Jam Kesamping */}
            <div className="inline-flex rounded-lg p-0.5 bg-blue-900/40 border border-blue-400/30 shadow-2xs">
              <button
                type="button"
                onClick={() => setOrientation('DOWN')}
                className={`px-3 py-1.5 rounded-md text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  orientation === 'DOWN'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
                title="Tampilkan Jam Berbaris ke Bawah (Sesuai Gambar)"
              >
                <ArrowDownUp className="w-3.5 h-3.5 text-blue-700" />
                <span>Jam Kebawah</span>
              </button>
              <button
                type="button"
                onClick={() => setOrientation('SIDE')}
                className={`px-3 py-1.5 rounded-md text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  orientation === 'SIDE'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
                title="Tampilkan Jam Berkolom ke Samping"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-300" />
                <span>Jam Kesamping</span>
              </button>
            </div>

            {/* Filter Hari */}
            <select
              value={filterHari}
              onChange={(e) => setFilterHari(e.target.value)}
              className="bg-white text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-xs cursor-pointer focus:outline-none"
            >
              <option value="ALL">Semua Hari</option>
              <option value="1">Senin</option>
              <option value="2">Selasa</option>
              <option value="3">Rabu</option>
              <option value="4">Kamis</option>
              <option value="5">Jumat</option>
            </select>

            {/* Filter Tingkat */}
            <select
              value={filterTingkat}
              onChange={(e) => setFilterTingkat(e.target.value)}
              className="bg-white text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-xs cursor-pointer focus:outline-none"
            >
              <option value="ALL">Semua Tingkat</option>
              <option value="X">Kelas X</option>
              <option value="XI">Kelas XI</option>
              <option value="XII">Kelas XII</option>
            </select>

            {/* Filter Jurusan */}
            <select
              value={filterJurusan}
              onChange={(e) => setFilterJurusan(e.target.value)}
              className="bg-white text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-xs cursor-pointer focus:outline-none"
            >
              <option value="ALL">Semua Jurusan</option>
              <option value="AK">AK (Akuntansi)</option>
              <option value="TKR">TKR (Otomotif)</option>
              <option value="TKJ">TKJ (Komputer)</option>
              <option value="PSPT">PSPT (Broadcasting)</option>
              <option value="KUL">KULINER</option>
              <option value="DPB">FASHION (Busana)</option>
              <option value="LAS">LAS (Pengelasan)</option>
              <option value="APAT">APAT (Perikanan)</option>
            </select>
          </div>

          {/* Sisi Kanan: Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {/* Tombol Kunci Blok Hijau */}
            <button
              type="button"
              onClick={handleToggleLockBlokHijau}
              className={`px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap ${
                isLockedBlokHijau
                  ? 'bg-[#059669] hover:bg-[#047857] text-white border border-emerald-400'
                  : 'bg-amber-500 hover:bg-amber-600 text-white border border-amber-300'
              }`}
              title="Kunci / Buka Status Blok Produktif"
            >
              <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isLockedBlokHijau ? 'Kunci Blok Hijau' : 'Buka Kunci Blok'}</span>
            </button>

            {/* Tombol Export Excel */}
            <button
              type="button"
              onClick={handleExportXLSX}
              className="bg-[#0284c7] hover:bg-[#0369a1] text-white font-black text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm border border-sky-400 transition-all cursor-pointer whitespace-nowrap"
              title="Export Matriks Jadwal ke File Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Export Excel Blok</span>
            </button>

            {/* Pill Status Bentrok / Bebas Tabrakan Dinamis & Tombol Selesaikan */}
            {bentrokCount === 0 ? (
              <div
                className="bg-[#10b981] text-white font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-emerald-300 whitespace-nowrap"
                title="Sistem Bebas Tabrakan di Seluruh 48 Rombel"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>✓ 0 Bentrok / Bebas Tabrakan (48 Kelas)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowConflictModal(true)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-rose-300 whitespace-nowrap cursor-pointer transition-all animate-pulse"
                  title="Klik untuk melihat rincian guru yang bentrok"
                >
                  <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>⚠️ {bentrokCount} Bentrok Guru Terdeteksi (Lihat)</span>
                </button>
                <button
                  type="button"
                  onClick={handleAutoResolveConflicts}
                  disabled={isAutoResolving}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-amber-200 whitespace-nowrap cursor-pointer transition-all disabled:opacity-50"
                  title="Klik untuk menyelesaikan bentrok secara otomatis menggunakan algoritma cerdas anti-tabrakan"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-slate-900 ${isAutoResolving ? 'animate-spin' : ''}`} />
                  <span>{isAutoResolving ? 'Menyusun...' : '⚡ Selesaikan Bentrok Otomatis'}</span>
                </button>
              </div>
            )}

            {/* Tombol Cetak */}
            <button
              type="button"
              onClick={handlePrint}
              className="bg-white hover:bg-slate-100 text-slate-800 font-black text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm border border-slate-300 transition-all cursor-pointer whitespace-nowrap"
              title="Cetak Jadwal Master"
            >
              <Printer className="w-3.5 h-3.5 text-purple-600 stroke-[2.5]" />
              <span>Cetak</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Grid Table: Tampilan Matriks Master 48 Rombel (Persis Gambar) */}
      <div className="flex-1 min-h-0 flex border-2 border-black rounded-xl overflow-hidden bg-white shadow-md">
        <div className="flex-1 min-h-0 overflow-auto">
          {orientation === 'DOWN' ? (
            /* =========================================================================
               MODE 1: JAM KEBAWAH (Default Sesuai Gambar User)
               - Kolom 1: Hari (Rowspan per hari)
               - Kolom 2: Jam Ke & Rentang Waktu (Jam 1 06.30-07.25, ...)
               - Kolom 3..N: 48 Rombel Kelas (X AK 1, X AK 2, ...)
               ========================================================================= */
            <table className="w-full text-center border-collapse text-xs select-none min-w-[1200px]">
              <thead className="sticky top-0 z-20 bg-[#8faadc] text-[#0d1f42] text-[11px] font-black uppercase tracking-wider border-b-2 border-black shadow-xs">
                <tr className="h-11">
                  {/* Sticky Kolom Hari */}
                  <th className="py-2 px-1 text-center border-r-[1.5px] border-black w-16 min-w-[64px] bg-[#8faadc] sticky left-0 z-30">
                    Hari
                  </th>
                  {/* Sticky Kolom Jam Ke */}
                  <th className="py-2 px-1 text-center border-r-[1.5px] border-black w-24 min-w-[96px] bg-[#8faadc] sticky left-[64px] z-30">
                    Jam Ke
                  </th>

                  {/* Header 48 Rombel Kelas */}
                  {displayRombels.map((r) => {
                    // Penyesuaian nama tampilan khusus sesuai gambar (misal DPB -> FASHION)
                    const displayJur = r.jurusanKode === 'DPB' ? 'FASHION' : r.jurusanKode;
                    const displayName =
                      r.jurusanKode === 'DPB'
                        ? `${r.tingkat} FASHION ${r.nomor}`
                        : r.nama;

                    return (
                      <th
                        key={r.id}
                        className="py-1.5 px-1.5 text-center border-r-[1.5px] border-black min-w-[125px] w-[130px] bg-[#8faadc]"
                      >
                        <div className="flex flex-col items-center justify-center leading-tight">
                          <span className="font-black text-xs text-[#0a1936] tracking-tight">
                            {displayName}
                          </span>
                          <span className="text-[9px] font-bold text-blue-950 mt-0.5 opacity-90">
                            {displayJur} • Tkt {r.tingkat}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y-[1.5px] divide-black font-medium">
                {displayHariList.map((hari) => {
                  const slots = getJamSlotsByHari(hari);

                  return slots.map((slot, sIdx) => {
                    const isFirstSlotOfDay = sIdx === 0;

                    return (
                      <tr
                        key={`${hari}-${slot.jp}`}
                        className="hover:bg-blue-50/30 transition-colors h-12"
                      >
                        {/* Kolom Hari (Rowspan di Slot Pertama) */}
                        {isFirstSlotOfDay && (
                          <td
                            rowSpan={slots.length}
                            className="py-2 px-1 text-center font-black text-sm uppercase text-slate-900 tracking-widest border-r-[1.5px] border-black sticky left-0 z-10 bg-white align-middle shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]"
                          >
                            <span className="writing-mode-vertical inline-block">
                              {NAMA_HARI[hari]}
                            </span>
                          </td>
                        )}

                        {/* Kolom Jam Ke & Rentang Waktu */}
                        <td className="py-1 px-1 text-center border-r-[1.5px] border-black sticky left-[64px] z-10 bg-white align-middle shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                          <div className="leading-tight">
                            <span className="font-black text-xs text-slate-900 block">
                              {slot.label}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 block mt-0.5">
                              {slot.waktu}
                            </span>
                          </div>
                        </td>

                        {/* Sel-Sel Rombel Kelas */}
                        {displayRombels.map((r) => {
                          const cell = getCellSchedule(activeBlok, hari, slot.jp, r);

                          return (
                            <td
                              key={r.id}
                              className={`py-1 px-1 text-center border-r-[1.5px] border-black align-middle transition-colors ${
                                cell.isProduktif
                                  ? 'bg-[#dcfce7] hover:bg-[#bbf7d0]'
                                  : 'bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col items-center justify-center leading-tight py-0.5">
                                {/* Nama Mata Pelajaran */}
                                <span
                                  className="block font-black text-[10px] uppercase tracking-tight truncate max-w-[125px] text-[#15803d]"
                                  title={cell.mapel}
                                >
                                  {cell.mapel}
                                </span>

                                {/* Nama Guru Pengampu */}
                                <span
                                  className={`block text-[8.5px] truncate max-w-[125px] mt-0.5 ${
                                    cell.guru === '- Belum diset -'
                                      ? 'text-[#0d9488] font-medium italic opacity-85'
                                      : 'text-[#166534] font-bold'
                                  }`}
                                  title={cell.guru}
                                >
                                  {cell.guru}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          ) : (
            /* =========================================================================
               MODE 2: JAM KESAMPING
               - Baris: 48 Rombel
               - Kolom: Hari x Jam Ke
               ========================================================================= */
            <table className="w-full text-center border-collapse text-xs select-none min-w-[1400px]">
              <thead className="sticky top-0 z-20 bg-[#8faadc] text-[#0d1f42] text-[11px] font-black uppercase tracking-wider border-b-2 border-black shadow-xs">
                <tr>
                  <th
                    rowSpan={2}
                    className="py-2 px-2 text-center border-r-[1.5px] border-black w-32 min-w-[128px] bg-[#8faadc] sticky left-0 z-30"
                  >
                    Rombel Kelas
                  </th>
                  {displayHariList.map((hari) => {
                    const slots = getJamSlotsByHari(hari);
                    return (
                      <th
                        key={hari}
                        colSpan={slots.length}
                        className="py-1.5 px-2 text-center border-r-[1.5px] border-black font-black uppercase tracking-wider bg-[#7d9fd6]"
                      >
                        {NAMA_HARI[hari]}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  {displayHariList.flatMap((hari) => {
                    const slots = getJamSlotsByHari(hari);
                    return slots.map((s) => (
                      <th
                        key={`${hari}-${s.jp}`}
                        className="py-1 px-1 text-center border-r-[1.5px] border-black w-24 min-w-[95px] text-[10px] font-extrabold bg-[#8faadc]"
                      >
                        <div>{s.label}</div>
                        <div className="text-[8.5px] font-normal opacity-85">{s.waktu}</div>
                      </th>
                    ));
                  })}
                </tr>
              </thead>
              <tbody className="divide-y-[1.5px] divide-black font-medium">
                {displayRombels.map((r) => {
                  const displayJur = r.jurusanKode === 'DPB' ? 'FASHION' : r.jurusanKode;
                  const displayName =
                    r.jurusanKode === 'DPB'
                      ? `${r.tingkat} FASHION ${r.nomor}`
                      : r.nama;

                  return (
                    <tr key={r.id} className="hover:bg-blue-50/30 transition-colors h-12">
                      <td className="py-2 px-2 text-left font-black text-xs text-slate-900 border-r-[1.5px] border-black sticky left-0 z-10 bg-white shadow-xs">
                        <div>{displayName}</div>
                        <div className="text-[9px] font-bold text-slate-400">
                          {displayJur} • Tkt {r.tingkat}
                        </div>
                      </td>

                      {displayHariList.flatMap((hari) => {
                        const slots = getJamSlotsByHari(hari);
                        return slots.map((s) => {
                          const cell = getCellSchedule(activeBlok, hari, s.jp, r);

                          return (
                            <td
                              key={`${r.id}-${hari}-${s.jp}`}
                              className={`py-1 px-1 text-center border-r-[1.5px] border-black align-middle ${
                                cell.isProduktif
                                  ? 'bg-[#dcfce7] hover:bg-[#bbf7d0]'
                                  : 'bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col items-center justify-center leading-tight">
                                <span
                                  className="block font-black text-[10px] uppercase truncate max-w-[90px] text-[#15803d]"
                                  title={cell.mapel}
                                >
                                  {cell.mapel}
                                </span>
                                <span
                                  className={`block text-[8.5px] truncate max-w-[90px] ${
                                    cell.guru === '- Belum diset -'
                                      ? 'text-[#0d9488] font-medium italic opacity-85'
                                      : 'text-[#166534] font-bold'
                                  }`}
                                  title={cell.guru}
                                >
                                  {cell.guru}
                                </span>
                              </div>
                            </td>
                          );
                        });
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 3. Modal Dialog Detail Bentrok Guru & Solusi Otomatis */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300 stroke-[2.5]" />
                <h3 className="font-black text-base uppercase tracking-wide">
                  Detail {bentrokCount} Bentrok Guru Terdeteksi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConflictModal(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Isi Konten Modal */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
                <p className="font-bold mb-1">💡 Mengapa terjadi bentrok?</p>
                <p>
                  Bentrok terjadi ketika seorang guru yang sama dijadwalkan mengajar di dua atau lebih kelas rombel yang berbeda pada hari dan jam yang persis sama.
                </p>
                <p className="mt-1 font-semibold text-rose-700">
                  Gunakan tombol <strong>&ldquo;⚡ Selesaikan Bentrok Otomatis&rdquo;</strong> di bawah untuk menyusun ulang penugasan guru secara cerdas dengan algoritma anti-tabrakan.
                </p>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {realConflicts.map((c, idx) => (
                  <div
                    key={`${c.hari}-${c.jp}-${c.guru}-${idx}`}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors"
                  >
                    <div>
                      <div className="font-extrabold text-slate-800 text-[12px] flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black uppercase">
                          {NAMA_HARI[c.hari]} Jam Ke-{c.jp}
                        </span>
                        <span>{c.guru}</span>
                      </div>
                      <div className="text-slate-600 text-[11px] mt-0.5">
                        Mengajar bersamaan di kelas:{' '}
                        <span className="font-bold text-rose-600">{c.rombels.join(' & ')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowConflictModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={handleAutoResolveConflicts}
                disabled={isAutoResolving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 text-amber-300 ${isAutoResolving ? 'animate-spin' : ''}`} />
                <span>{isAutoResolving ? 'Menyusun Jadwal Bebas Tabrakan...' : '⚡ Selesaikan Bentrok Otomatis'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
