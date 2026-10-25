// src/domain/schedule-resolver.ts
import { BlokNo, Hari, Guru, Mapel } from './types';
import { RombelCol, ROMBELS_48 } from '../features/03-matrix-sk/MatrixSKView';
import { isSameTeacher, DaftarMapelKodeItem } from './sync-mapel-matrix';
import { buildAllDefaultPairs, ClassTemplatePair, TemplateMode } from './template-blok-engine';

export interface JadwalCellInfo {
  mapel: string;
  guru: string;
  isProduktif: boolean;
  kode: string;
  isInactive?: boolean;
}

export interface TeacherSlotCell {
  kelas: string;
  kelasList?: string[];
  mapel?: string;
  kode?: string;
  isProduktif?: boolean;
}

// Format nama guru singkat (membersihkan gelar belakang)
export function formatShortTeacherName(fullName: string): string {
  if (!fullName || fullName.trim() === '' || fullName === '- Belum diset -') return '- Belum diset -';
  const clean = fullName.replace(/,.*$/, '').trim();
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  return `${parts[0]} ${parts[1]} ${parts[2]?.slice(0, 2)}..`;
}

// Format gabungan rombel jika mengajar di rombel paralel sekaligus (misal "XII PSPT 2,1")
export function formatCombinedClasses(kelasList: string[]): string {
  if (!kelasList || !kelasList.length) return '';
  if (kelasList.length === 1) return kelasList[0]!;

  const parsed = kelasList.map((c) => {
    const m = String(c).trim().match(/^(.*?)\s*(\d+)$/);
    if (m) return { base: m[1]!.trim(), num: m[2]! };
    return { base: c, num: '' };
  });

  const allHaveNums = parsed.every((p) => p.num);
  const allSameBase = parsed.every((p) => p.base === parsed[0]!.base);
  if (allHaveNums && allSameBase) {
    const nums = parsed.map((p) => p.num);
    if (nums.includes('2') && nums.includes('1') && nums.length === 2) {
      return `${parsed[0]!.base} 2,1`;
    }
    return `${parsed[0]!.base} ${nums.join(',')}`;
  }
  return kelasList.join(', ');
}

// Kode / ID guru untuk lembar jadwal resmi (menggunakan ID guru / kode dari master data)
export function getTeacherDisplayCode(tObj: Guru | null | undefined, _allGurus: Guru[] = []): string {
  if (!tObj) return '-';
  return tObj.kode || String(tObj.id || '-');
}

// Nama mata pelajaran utama guru untuk kop jadwal
export function getTeacherMapelDisplay(tObj: Guru | null | undefined): string {
  if (!tObj || !tObj.sk_guru) return 'Mata Pelajaran';
  const mu = String(tObj.sk_guru).trim();
  const muUpper = mu.toUpperCase();
  if (muUpper.includes('PSPT')) return 'Prod. PSPT';
  if (muUpper.includes('TKJ')) return 'Prod. TKJ';
  if (muUpper.includes('TKR')) return 'Prod. TKR';
  if (muUpper.includes('AK')) return 'Prod. AK';
  if (muUpper.includes('KULINER') || muUpper.includes('KUL')) return 'Prod. Kuliner';
  if (muUpper.includes('DPB') || muUpper.includes('FASHION')) return 'Prod. DPB';
  if (muUpper.includes('LAS')) return 'Prod. LAS';
  if (muUpper.includes('APAT')) return 'Prod. APAT';
  if (muUpper.startsWith('PRODUKTIF ')) return 'Prod. ' + mu.slice(10);
  if (muUpper.includes('AGAMA') || muUpper.includes('PAI')) return 'Pendidikan Agama Islam';
  if (muUpper.includes('PANCASILA') || muUpper.includes('PPKN')) return 'Pancasila';
  if (muUpper.includes('INDONESIA') && !muUpper.includes('SEJARAH')) return 'Bahasa Indonesia';
  if (muUpper.includes('INGGRIS')) return 'Bahasa Inggris';
  if (muUpper.includes('MATEMATIKA')) return 'Matematika';
  if (muUpper.includes('SEJARAH')) return 'Sejarah Indonesia';
  if (muUpper.includes('PENJAS') || muUpper.includes('PJOK')) return 'PJOK / Penjas';
  if (muUpper.includes('IPAS')) return 'IPAS';
  if (muUpper.includes('INFORMATIKA')) return 'Informatika';
  if (muUpper.includes('SENI')) return 'Seni Budaya';
  if (muUpper.includes('BK') || muUpper.includes('KONSELING')) return 'Bimbingan Konseling';
  return mu;
}

// Mencari guru pengampu untuk rombel tertentu & mapel tertentu dari Matrix SK (Menu 3) & Menu Mapel (Menu 2 & 5)
export function findTeacherForRombelAndMapel(
  rombelId: string,
  mapelKode: string,
  mapelName: string = '',
  matrixGrid: any,
  daftarMapelKodeList: DaftarMapelKodeItem[] = [],
  guruList: Guru[] = []
): string {
  if (!rombelId) return '- Belum diset -';
  const cleanKode = (mapelKode || '').toUpperCase().trim();
  const cleanName = (mapelName || '').toUpperCase().trim();

  // Helper lokal mencari nama guru
  const findTeacherName = (guruKey: string): string => {
    if (!guruKey) return '- Belum diset -';
    const gObj = guruList.find(
      (g) => g.id === guruKey || g.kode === guruKey || isSameTeacher(g.nama, guruKey)
    );
    if (gObj) return formatShortTeacherName(gObj.nama);
    return formatShortTeacherName(guruKey);
  };

  // 1. Cek di Matrix SK (Menu 3 & Menu 5)
  if (matrixGrid?.gridData) {
    for (const [guruId, rombelMap] of Object.entries(
      matrixGrid.gridData as Record<string, Record<string, any>>
    )) {
      const cell = rombelMap[rombelId];
      if (cell) {
        const cCode = (typeof cell === 'string' ? cell : cell.mapelKode || '').toUpperCase();
        const items = Array.isArray(cell.items) ? cell.items : [];

        const hasDirectMatch =
          (cleanKode && (cCode === cleanKode || items.some((it: any) => it.mapelKode && it.mapelKode.toUpperCase() === cleanKode))) ||
          (cleanKode && (cCode.includes(cleanKode) || items.some((it: any) => it.mapelKode && it.mapelKode.toUpperCase().includes(cleanKode))));

        const isBothProduktif =
          (cleanKode.startsWith('PRO') || cleanName.includes('PRODUKTIF')) &&
          (cCode.startsWith('PRO') || cCode.includes('PRODUKTIF') || items.some((it: any) => (it.mapelKode || '').toUpperCase().startsWith('PRO')));

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
          if (cleanKode.includes('MAT') || cleanKode.includes('MTK') || cleanName.includes('MATEMATIKA')) {
            return cCode.includes('MAT') || cCode.includes('MTK') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('MAT'));
          }
          if (cleanKode.includes('PJOK') || cleanKode.includes('PENJAS') || cleanName.includes('PJOK')) {
            return cCode.includes('PJOK') || cCode.includes('PENJAS') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('PJOK'));
          }
          if (cleanKode.includes('INF') || cleanName.includes('INFORMATIKA')) {
            return cCode.includes('INF') || cCode.includes('INFORMATIKA') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('INF'));
          }
          if (cleanKode.includes('IPAS') || cleanName.includes('IPAS')) {
            return cCode.includes('IPAS') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('IPAS'));
          }
          if (cleanKode.includes('SEJ') || cleanName.includes('SEJARAH')) {
            return cCode.includes('SEJ') || cCode.includes('SEJARAH') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('SEJ'));
          }
          if (cleanKode.includes('SB') || cleanKode.includes('SENI') || cleanName.includes('SENI')) {
            return cCode.includes('SB') || cCode.includes('SENI') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('SB'));
          }
          if (cleanKode.includes('BING') || cleanKode.includes('INGGRIS') || cleanName.includes('INGGRIS')) {
            return cCode.includes('BING') || cCode.includes('INGGRIS') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('BING'));
          }
          if (cleanKode.includes('ML') || cleanKode.includes('MULOK') || cleanName.includes('LOKAL') || cleanName.includes('JAWA')) {
            return cCode.includes('ML') || cCode.includes('JAWA') || cCode.includes('MULOK') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('ML'));
          }
          if (cleanKode.includes('KOD') || cleanName.includes('KODING')) {
            return cCode.includes('KOD') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('KOD'));
          }
          if (cleanKode.includes('PKK') || cleanName.includes('KREATIF') || cleanName.includes('KEWIRAUSAHAAN')) {
            return cCode.includes('PKK') || items.some((it: any) => (it.mapelKode || '').toUpperCase().includes('PKK'));
          }
          return false;
        })();

        if (hasDirectMatch || isBothProduktif || isAliasMatch) {
          return findTeacherName(guruId);
        }
      }
    }
  }

  // 2. Cek alokasi di Menu 2 / 5 (daftarMapelKodeList.guruJp)
  const matchedMapel = daftarMapelKodeList.find((m) => {
    const mCode = m.kode.toUpperCase();
    return (
      (cleanKode && mCode === cleanKode) ||
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
}

// Resolver Sel Jadwal Master Rombel
export function resolveCellSchedule(
  blok: BlokNo,
  hari: Hari,
  jp: number,
  r: RombelCol,
  context: {
    dbEntries: any[];
    mapelList: Mapel[];
    daftarMapelKodeList: DaftarMapelKodeItem[];
    guruList: Guru[];
    matrixGrid: any;
    customTemplatesMap: Record<string, ClassTemplatePair>;
    templateMode: TemplateMode;
  }
): JadwalCellInfo {
  const { dbEntries, mapelList, daftarMapelKodeList, guruList, matrixGrid, customTemplatesMap, templateMode } = context;

  // 1. Cek dari db.jadwal_entry jika ada jadwal yang sudah digenerate
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
      const isProd =
        (mObj as any)?.jenis === 'PRODUKTIF' ||
        (mObj as any)?.kategori === 'PRODUKTIF' ||
        mKode.toUpperCase().startsWith('PRO') ||
        mNama.toUpperCase().includes('PRODUKTIF');

      let teacherName = findTeacherForRombelAndMapel(r.id, mKode, mNama, matrixGrid, daftarMapelKodeList, guruList);
      if (teacherName === '- Belum diset -' && match.guru_id) {
        const gObj = guruList.find((g) => g.id === match.guru_id || g.kode === match.guru_id);
        if (gObj) teacherName = formatShortTeacherName(gObj.nama);
      }

      return {
        mapel: mNama,
        guru: teacherName,
        isProduktif: isProd,
        kode: mKode,
      };
    }
  }

  // 2. Aliran Data Template Jadwal Blok (Menu 8) + Matrix SK (Menu 3)
  const tingkat = r.tingkat;
  const jur = r.jurusanKode;
  const no = r.nomor;

  const pairKey = `${tingkat}_${jur}`;
  const pair =
    customTemplatesMap[pairKey] ||
    buildAllDefaultPairs(templateMode).find((p) => p.id === pairKey);

  if (pair) {
    const schedule =
      (blok === 1 && no === 1) || (blok === 2 && no === 2)
        ? pair.rombel1
        : (blok === 1 && no === 2) || (blok === 2 && no === 1)
        ? pair.rombel2
        : no === 3
        ? (blok === 1 ? pair.rombel1 : pair.rombel2)
        : pair.rombel1;

    const daySlots = schedule.days[hari] || [];
    const slot = daySlots.find((s) => s.jp === jp);

    if (slot && slot.type === 'PRODUKTIF') {
      const slotCode = slot.code || `PRO${tingkat === 'X' ? '1' : tingkat === 'XI' ? '2' : '3'}${jur}`;
      const teacherName = findTeacherForRombelAndMapel(r.id, slotCode, slot.label || 'PRODUKTIF', matrixGrid, daftarMapelKodeList, guruList);

      return {
        mapel: slot.label || slotCode,
        guru: teacherName,
        isProduktif: true,
        kode: slotCode,
      };
    } else if (slot && slot.type === 'REGULER') {
      const slotCode = slot.code || 'REG';
      const slotLabel = slot.label || 'REGULER';
      const teacherName = findTeacherForRombelAndMapel(r.id, slotCode, slotLabel, matrixGrid, daftarMapelKodeList, guruList);

      return {
        mapel: slotLabel,
        guru: teacherName,
        isProduktif: false,
        kode: slotCode,
      };
    }
  }

  // Fallback mapel umum
  const regularSubjects = [
    { kode: 'PAI', label: 'Pendidikan Agama Islam' },
    { kode: 'PANC', label: 'Pendidikan Pancasila' },
    { kode: 'BIN', label: 'Bahasa Indonesia' },
    { kode: 'MAT', label: 'Matematika' },
    { kode: 'PJOK', label: 'PJOK' },
    { kode: 'SEJ', label: 'Sejarah' },
    { kode: 'BING', label: 'Bahasa Inggris' },
    { kode: 'IPAS', label: 'IPAS' },
    { kode: 'INF', label: 'Informatika' },
    { kode: 'SB', label: 'Seni Budaya' },
    { kode: 'ML', label: 'Muatan Lokal' },
  ];

  const pickIdx = (jp + hari + no) % regularSubjects.length;
  const picked = regularSubjects[pickIdx]!;
  const teacherName = findTeacherForRombelAndMapel(r.id, picked.kode, picked.label, matrixGrid, daftarMapelKodeList, guruList);

  return {
    mapel: picked.label,
    guru: teacherName,
    isProduktif: false,
    kode: picked.kode,
  };
}

// Resolver Grid Jadwal Mengajar Per Guru (5 Hari x 11 JP)
export function resolveTeacherScheduleGrid(
  teacherIdentifier: string,
  blok: BlokNo,
  context: {
    dbEntries: any[];
    mapelList: Mapel[];
    daftarMapelKodeList: DaftarMapelKodeItem[];
    guruList: Guru[];
    matrixGrid: any;
    customTemplatesMap: Record<string, ClassTemplatePair>;
    templateMode: TemplateMode;
  }
): {
  grid: (TeacherSlotCell | null | 'X')[][];
  totalJp: number;
  classesTaught: string[];
} {
  const { guruList } = context;
  const teacherObj = guruList.find(
    (g) => g.id === teacherIdentifier || g.kode === teacherIdentifier || g.nama === teacherIdentifier || isSameTeacher(g.nama, teacherIdentifier)
  );

  const teacherName = teacherObj ? teacherObj.nama : teacherIdentifier;
  const teacherId = teacherObj ? teacherObj.id : teacherIdentifier;

  // Inisialisasi grid 5 hari (d=0..4) x 11 slot (s=0..10)
  const grid: (TeacherSlotCell | null | 'X')[][] = [];
  for (let d = 0; d < 5; d++) {
    const dayArr: (TeacherSlotCell | null | 'X')[] = [];
    const maxDayJp = d === 4 ? 6 : 11; // Jumat max 6 JP efektif
    for (let s = 0; s < 11; s++) {
      dayArr.push(s < maxDayJp ? null : 'X');
    }
    grid.push(dayArr);
  }

  const classesSet = new Set<string>();
  let totalJp = 0;

  // Loop seluruh 48 rombel
  for (const r of ROMBELS_48) {
    for (let h = 1; h <= 5; h++) {
      const d = h - 1;
      const maxSlots = h === 5 ? 6 : 11;

      for (let jp = 1; jp <= maxSlots; jp++) {
        const s = jp - 1;
        const cell = resolveCellSchedule(blok, h as Hari, jp, r, context);

        const isMatchTeacher =
          cell.guru &&
          cell.guru !== '- Belum diset -' &&
          (isSameTeacher(cell.guru, teacherName) ||
            (teacherObj?.kode && cell.guru === teacherObj.kode) ||
            formatShortTeacherName(teacherName) === cell.guru);

        if (isMatchTeacher) {
          totalJp++;
          classesSet.add(r.nama);

          const existing = grid[d]![s];
          if (!existing || existing === 'X') {
            grid[d]![s] = {
              kelas: r.nama,
              kelasList: [r.nama],
              mapel: cell.mapel,
              kode: cell.kode,
              isProduktif: cell.isProduktif,
            };
          } else {
            // Jika mengajar di rombel paralel sekaligus (team / blok ganda)
            const list = existing.kelasList ? [...existing.kelasList] : [existing.kelas];
            if (!list.includes(r.nama)) {
              list.push(r.nama);
            }
            grid[d]![s] = {
              ...existing,
              kelasList: list,
              kelas: formatCombinedClasses(list),
            };
          }
        }
      }
    }
  }

  return {
    grid,
    totalJp,
    classesTaught: Array.from(classesSet),
  };
}
