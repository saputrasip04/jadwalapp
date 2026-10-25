// src/domain/jam-efektif-data.ts
import { db } from '../db/schema';
import { JamSlot, Hari } from './types';
import { ulid } from 'ulid';

export interface JamEfektifRow {
  type: 'jam' | 'break' | 'pre' | 'piket' | 'extra' | '-' | 'empty';
  jamKe: string;
  labelJam?: string;
  pukul: string;
  ket: string;
  dur: number;
  start: string;
  end: string;
  span?: number[];
}

export interface JamEfektifCfgParams {
  durStandar: number;
  durJumat: number;
  startSenin: string;
  startSelasaKamis: string;
  startJumat: string;
  upacaraSenin: number;
  yasinSelasaKamis: number;
  yasinJumat: number;
  eventJumat: number;
  break1Senin: number;
  break2Senin: number;
  break1SelasaKamis: number;
  break2SelasaKamis: number;
  breakJumat: number;
  piketSelasaKamis: number;
}

export interface JamEfektifData {
  docTitle: string;
  schoolName: string;
  academicYear: string;
  signatureCity: string;
  signatureDate: string;
  principalName: string;
  principalNip: string;
  principalTitle: string;
  cfgParams: JamEfektifCfgParams;
  senin: JamEfektifRow[];
  selasa_kamis: JamEfektifRow[];
  jumat: JamEfektifRow[]; // Format Kelas X (6 JP di hari Jumat)
  jumat_xi_xii?: JamEfektifRow[]; // Format Kelas XI & XII (4 JP di hari Jumat)
}

// Format Default Jumat Kelas XI & XII (4 JP KBM)
export const DEFAULT_JUMAT_XI_XII: JamEfektifRow[] = [
  { type: 'pre', jamKe: 'YASIN', labelJam: 'YASIN', pukul: '06.45 - 07.00', ket: 'PEMBACAAN SURAT YASIN', dur: 15, start: '06.45', end: '07.00' },
  { type: 'jam', jamKe: '1', labelJam: '1', pukul: '07.00 - 07.45', ket: 'EVENT JUMAT', dur: 45, start: '07.00', end: '07.45' },
  { type: 'jam', jamKe: '2', labelJam: '2', pukul: '07.45 - 08.20', ket: 'JAM KE 2', dur: 35, start: '07.45', end: '08.20' },
  { type: 'jam', jamKe: '3', labelJam: '3', pukul: '08.20 - 08.55', ket: 'JAM KE 3', dur: 35, start: '08.20', end: '08.55' },
  { type: 'jam', jamKe: '4', labelJam: '4', pukul: '08.55 - 09.30', ket: 'JAM KE 4', dur: 35, start: '08.55', end: '09.30' },
  { type: 'break', jamKe: "ISTIRAHAT 130'", labelJam: "ISTIRAHAT 130'", pukul: '09.30 - 11.40', ket: 'ISTIRAHAT / SHOLAT JUMAT', dur: 130, start: '09.30', end: '11.40' },
  { type: '-', jamKe: '5', labelJam: '5', pukul: '-', ket: 'KOSONG / PULANG', dur: 0, start: '11.40', end: '-' },
  { type: '-', jamKe: '6', labelJam: '6', pukul: '-', ket: 'KOSONG / PULANG', dur: 0, start: '11.40', end: '-' },
];

export const DEFAULT_JAM_EFEKTIF: JamEfektifData = {
  docTitle: 'JAM PEMBELAJARAN EFEKTIF',
  schoolName: 'SMKN IHYA ULUMUDDIN SINGOJURUH',
  academicYear: '2026/2027',
  signatureCity: 'Singojuruh',
  signatureDate: '8 Agustus 2023',
  principalName: 'MOHAMAD MALIKI, S.Pd',
  principalNip: '19820921 201407 1 001',
  principalTitle: 'Kepala UPT SMKN Ihya Ulumuddin Singojuruh',
  cfgParams: {
    durStandar: 35,
    durJumat: 35,
    startSenin: '06:30',
    startSelasaKamis: '06:45',
    startJumat: '06:45',
    upacaraSenin: 20,
    yasinSelasaKamis: 15,
    yasinJumat: 15,
    eventJumat: 45,
    break1Senin: 15,
    break2Senin: 35,
    break1SelasaKamis: 25,
    break2SelasaKamis: 45,
    breakJumat: 130,
    piketSelasaKamis: 10,
  },
  senin: [
    { type: 'jam', jamKe: 'UPACARA + 1', labelJam: 'UPACARA + 1', pukul: '06.30 - 07.25', ket: 'UPACARA DAN JAM KE 1', dur: 55, start: '06.30', end: '07.25' },
    { type: 'jam', jamKe: '2', labelJam: '2', pukul: '07.25 - 08.00', ket: 'JAM KE 2', dur: 35, start: '07.25', end: '08.00' },
    { type: 'jam', jamKe: '3', labelJam: '3', pukul: '08.00 - 08.35', ket: 'JAM KE 3', dur: 35, start: '08.00', end: '08.35' },
    { type: 'jam', jamKe: '4', labelJam: '4', pukul: '08.35 - 09.10', ket: 'JAM KE 4', dur: 35, start: '08.35', end: '09.10' },
    { type: 'jam', jamKe: '5', labelJam: '5', pukul: '09.10 - 09.45', ket: 'JAM KE 5', dur: 35, start: '09.10', end: '09.45' },
    { type: 'break', jamKe: "ISTIRAHAT 15'", labelJam: "ISTIRAHAT 15'", pukul: '09.45 - 10.00', ket: 'ISTIRAHAT', dur: 15, start: '09.45', end: '10.00' },
    { type: 'jam', jamKe: '6', labelJam: '6', pukul: '10.00 - 10.35', ket: 'JAM KE 6', dur: 35, start: '10.00', end: '10.35' },
    { type: 'jam', jamKe: '7', labelJam: '7', pukul: '10.35 - 11.10', ket: 'JAM KE 7', dur: 35, start: '10.35', end: '11.10' },
    { type: 'jam', jamKe: '8', labelJam: '8', pukul: '11.10 - 11.45', ket: 'JAM KE 8', dur: 35, start: '11.10', end: '11.45' },
    { type: 'break', jamKe: "ISTIRAHAT 35'", labelJam: "ISTIRAHAT 35'", pukul: '11.45 - 12.20', ket: 'ISTIRAHAT', dur: 35, start: '11.45', end: '12.20' },
    { type: 'jam', jamKe: '9', labelJam: '9', pukul: '12.20 - 12.55', ket: 'JAM KE 9', dur: 35, start: '12.20', end: '12.55' },
    { type: 'jam', jamKe: '10', labelJam: '10', pukul: '12.55 - 13.30', ket: 'JAM KE 10', dur: 35, start: '12.55', end: '13.30' },
    { type: 'jam', jamKe: '11', labelJam: '11', pukul: '13.30 - 14.05', ket: 'JAM KE 11', dur: 35, start: '13.30', end: '14.05' },
  ],
  selasa_kamis: [
    { type: 'pre', jamKe: 'YASIN', labelJam: 'YASIN', pukul: '06.45 - 07.00', ket: 'PEMBACAAN SURAT YASIN', dur: 15, start: '06.45', end: '07.00' },
    { type: 'jam', jamKe: '1', labelJam: '1', pukul: '07.00 - 07.35', ket: 'JAM KE 1', dur: 35, start: '07.00', end: '07.35' },
    { type: 'jam', jamKe: '2', labelJam: '2', pukul: '07.35 - 08.10', ket: 'JAM KE 2', dur: 35, start: '07.35', end: '08.10' },
    { type: 'jam', jamKe: '3', labelJam: '3', pukul: '08.10 - 08.45', ket: 'JAM KE 3', dur: 35, start: '08.10', end: '08.45' },
    { type: 'jam', jamKe: '4', labelJam: '4', pukul: '08.45 - 09.20', ket: 'JAM KE 4', dur: 35, start: '08.45', end: '09.20' },
    { type: 'break', jamKe: "ISTIRAHAT 25'", labelJam: "ISTIRAHAT 25'", pukul: '09.20 - 09.45', ket: 'ISTIRAHAT', dur: 25, start: '09.20', end: '09.45' },
    { type: 'jam', jamKe: '5', labelJam: '5', pukul: '09.45 - 10.20', ket: 'JAM KE 5', dur: 35, start: '09.45', end: '10.20' },
    { type: 'jam', jamKe: '6', labelJam: '6', pukul: '10.20 - 10.55', ket: 'JAM KE 6', dur: 35, start: '10.20', end: '10.55' },
    { type: 'jam', jamKe: '7', labelJam: '7', pukul: '10.55 - 11.30', ket: 'JAM KE 7', dur: 35, start: '10.55', end: '11.30' },
    { type: 'break', jamKe: "ISTIRAHAT 45'", labelJam: "ISTIRAHAT 45'", pukul: '11.30 - 12.15', ket: 'ISTIRAHAT', dur: 45, start: '11.30', end: '12.15' },
    { type: 'jam', jamKe: '8', labelJam: '8', pukul: '12.15 - 12.50', ket: 'JAM KE 8', dur: 35, start: '12.15', end: '12.50' },
    { type: 'jam', jamKe: '9', labelJam: '9', pukul: '12.50 - 13.25', ket: 'JAM KE 9', dur: 35, start: '12.50', end: '13.25' },
    { type: 'jam', jamKe: '10', labelJam: '10', pukul: '13.25 - 14.00', ket: 'JAM KE 10', dur: 35, start: '13.25', end: '14.00' },
    { type: 'jam', jamKe: '11', labelJam: '11', pukul: '14.00 - 14.35', ket: 'JAM KE 11', dur: 35, start: '14.00', end: '14.35' },
    { type: 'piket', jamKe: 'PIKET KELAS', labelJam: 'PIKET KELAS', pukul: '14.35 - 14.45', ket: 'PIKET KELAS', dur: 10, start: '14.35', end: '14.45' },
  ],
  jumat: [
    { type: 'pre', jamKe: 'YASIN', labelJam: 'YASIN', pukul: '06.45 - 07.00', ket: 'PEMBACAAN SURAT YASIN', dur: 15, start: '06.45', end: '07.00' },
    { type: 'jam', jamKe: '1', labelJam: '1', pukul: '07.00 - 07.45', ket: 'EVENT JUMAT', dur: 45, start: '07.00', end: '07.45' },
    { type: 'jam', jamKe: '2', labelJam: '2', pukul: '07.45 - 08.20', ket: 'JAM KE 2', dur: 35, start: '07.45', end: '08.20' },
    { type: 'jam', jamKe: '3', labelJam: '3', pukul: '08.20 - 08.55', ket: 'JAM KE 3', dur: 35, start: '08.20', end: '08.55' },
    { type: 'jam', jamKe: '4', labelJam: '4', pukul: '08.55 - 09.30', ket: 'JAM KE 4', dur: 35, start: '08.55', end: '09.30' },
    { type: 'jam', jamKe: '5', labelJam: '5', pukul: '09.30 - 10.05', ket: 'JAM KE 5', dur: 35, start: '09.30', end: '10.05' },
    { type: 'break', jamKe: "ISTIRAHAT 130'", labelJam: "ISTIRAHAT 130'", pukul: '10.05 - 12.15', ket: 'ISTIRAHAT / SHOLAT JUMAT', dur: 130, start: '10.05', end: '12.15' },
    { type: 'jam', jamKe: '6', labelJam: '6', pukul: '12.15 - 13.00', ket: 'JAM KE 6', dur: 45, start: '12.15', end: '13.00' },
    { type: 'extra', jamKe: '7', labelJam: '7', pukul: '13.00 - 15.00', ket: 'PRAMUKA / EKSTRA PILIHAN', dur: 120, start: '13.00', end: '15.00' },
    { type: 'extra', jamKe: 'PRAMUKA', labelJam: 'PRAMUKA', pukul: '15.00 - SELESAI', ket: 'PULANG', dur: 0, start: '15.00', end: 'SELESAI', span: [8, 9, 10, 11, 12] },
  ],
  jumat_xi_xii: DEFAULT_JUMAT_XI_XII,
};

export function toMin(timeStr: string): number {
  if (!timeStr) return 0;
  const normalized = String(timeStr).trim().replace('.', ':');
  const [h, m] = normalized.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function toTimeDot(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
}

export function toTimeColon(timeStr: string): string {
  if (!timeStr) return '';
  return timeStr.trim().replace('.', ':');
}

export function recalculateJamEfektifFromParams(je: JamEfektifData): void {
  const p = je.cfgParams || DEFAULT_JAM_EFEKTIF.cfgParams;
  const durStd = Number(p.durStandar) || 35;
  const durJum = Number(p.durJumat) || 35;
  const upac = Number(p.upacaraSenin) || 20;

  // 1. Senin (11 JP)
  let cur = toMin(p.startSenin || '06:30');
  const s1_start = cur;
  const s1_end = cur + upac + durStd;
  cur = s1_end;

  const senin: JamEfektifRow[] = [
    { type: 'jam', jamKe: 'UPACARA + 1', labelJam: 'UPACARA + 1', pukul: `${toTimeDot(s1_start)} - ${toTimeDot(s1_end)}`, ket: 'UPACARA DAN JAM KE 1', dur: upac + durStd, start: toTimeDot(s1_start), end: toTimeDot(s1_end) }
  ];

  for (let j = 2; j <= 5; j++) {
    const st = cur;
    const en = cur + durStd;
    senin.push({ type: 'jam', jamKe: String(j), labelJam: String(j), pukul: `${toTimeDot(st)} - ${toTimeDot(en)}`, ket: `JAM KE ${j}`, dur: durStd, start: toTimeDot(st), end: toTimeDot(en) });
    cur = en;
  }

  const b1_st = cur;
  const b1_dur = Number(p.break1Senin) || 15;
  const b1_en = cur + b1_dur;
  senin.push({ type: 'break', jamKe: `ISTIRAHAT ${b1_dur}'`, labelJam: `ISTIRAHAT ${b1_dur}'`, pukul: `${toTimeDot(b1_st)} - ${toTimeDot(b1_en)}`, ket: 'ISTIRAHAT', dur: b1_dur, start: toTimeDot(b1_st), end: toTimeDot(b1_en) });
  cur = b1_en;

  for (let j = 6; j <= 8; j++) {
    const st = cur;
    const en = cur + durStd;
    senin.push({ type: 'jam', jamKe: String(j), labelJam: String(j), pukul: `${toTimeDot(st)} - ${toTimeDot(en)}`, ket: `JAM KE ${j}`, dur: durStd, start: toTimeDot(st), end: toTimeDot(en) });
    cur = en;
  }

  const b2_st = cur;
  const b2_dur = Number(p.break2Senin) || 35;
  const b2_en = cur + b2_dur;
  senin.push({ type: 'break', jamKe: `ISTIRAHAT ${b2_dur}'`, labelJam: `ISTIRAHAT ${b2_dur}'`, pukul: `${toTimeDot(b2_st)} - ${toTimeDot(b2_en)}`, ket: 'ISTIRAHAT', dur: b2_dur, start: toTimeDot(b2_st), end: toTimeDot(b2_en) });
  cur = b2_en;

  for (let j = 9; j <= 11; j++) {
    const st = cur;
    const en = cur + durStd;
    senin.push({ type: 'jam', jamKe: String(j), labelJam: String(j), pukul: `${toTimeDot(st)} - ${toTimeDot(en)}`, ket: `JAM KE ${j}`, dur: durStd, start: toTimeDot(st), end: toTimeDot(en) });
    cur = en;
  }
  je.senin = senin;

  // 2. Selasa s/d Kamis
  cur = toMin(p.startSelasaKamis || '06:45');
  const yasin_dur = Number(p.yasinSelasaKamis) || 15;
  const y_en = cur + yasin_dur;
  const selasa_kamis: JamEfektifRow[] = [
    { type: 'pre', jamKe: 'YASIN', labelJam: 'YASIN', pukul: `${toTimeDot(cur)} - ${toTimeDot(y_en)}`, ket: 'PEMBACAAN SURAT YASIN', dur: yasin_dur, start: toTimeDot(cur), end: toTimeDot(y_en) }
  ];
  cur = y_en;

  for (let j = 1; j <= 4; j++) {
    const st = cur;
    const en = cur + durStd;
    selasa_kamis.push({ type: 'jam', jamKe: String(j), labelJam: String(j), pukul: `${toTimeDot(st)} - ${toTimeDot(en)}`, ket: `JAM KE ${j}`, dur: durStd, start: toTimeDot(st), end: toTimeDot(en) });
    cur = en;
  }

  const sb1_st = cur;
  const sb1_dur = Number(p.break1SelasaKamis) || 25;
  const sb1_en = cur + sb1_dur;
  selasa_kamis.push({ type: 'break', jamKe: `ISTIRAHAT ${sb1_dur}'`, labelJam: `ISTIRAHAT ${sb1_dur}'`, pukul: `${toTimeDot(sb1_st)} - ${toTimeDot(sb1_en)}`, ket: 'ISTIRAHAT', dur: sb1_dur, start: toTimeDot(sb1_st), end: toTimeDot(sb1_en) });
  cur = sb1_en;

  for (let j = 5; j <= 7; j++) {
    const st = cur;
    const en = cur + durStd;
    selasa_kamis.push({ type: 'jam', jamKe: String(j), labelJam: String(j), pukul: `${toTimeDot(st)} - ${toTimeDot(en)}`, ket: `JAM KE ${j}`, dur: durStd, start: toTimeDot(st), end: toTimeDot(en) });
    cur = en;
  }

  const sb2_st = cur;
  const sb2_dur = Number(p.break2SelasaKamis) || 45;
  const sb2_en = cur + sb2_dur;
  selasa_kamis.push({ type: 'break', jamKe: `ISTIRAHAT ${sb2_dur}'`, labelJam: `ISTIRAHAT ${sb2_dur}'`, pukul: `${toTimeDot(sb2_st)} - ${toTimeDot(sb2_en)}`, ket: 'ISTIRAHAT', dur: sb2_dur, start: toTimeDot(sb2_st), end: toTimeDot(sb2_en) });
  cur = sb2_en;

  for (let j = 8; j <= 11; j++) {
    const st = cur;
    const en = cur + durStd;
    selasa_kamis.push({ type: 'jam', jamKe: String(j), labelJam: String(j), pukul: `${toTimeDot(st)} - ${toTimeDot(en)}`, ket: `JAM KE ${j}`, dur: durStd, start: toTimeDot(st), end: toTimeDot(en) });
    cur = en;
  }

  const pikt_dur = Number(p.piketSelasaKamis) || 10;
  const pikt_en = cur + pikt_dur;
  selasa_kamis.push({ type: 'piket', jamKe: 'PIKET KELAS', labelJam: 'PIKET KELAS', pukul: `${toTimeDot(cur)} - ${toTimeDot(pikt_en)}`, ket: 'PIKET KELAS', dur: pikt_dur, start: toTimeDot(cur), end: toTimeDot(pikt_en) });
  je.selasa_kamis = selasa_kamis;

  // 3. Jumat
  cur = toMin(p.startJumat || '06:45');
  const yj_dur = Number(p.yasinJumat) || 15;
  const yj_en = cur + yj_dur;
  const jumat: JamEfektifRow[] = [
    { type: 'pre', jamKe: 'YASIN', labelJam: 'YASIN', pukul: `${toTimeDot(cur)} - ${toTimeDot(yj_en)}`, ket: 'PEMBACAAN SURAT YASIN', dur: yj_dur, start: toTimeDot(cur), end: toTimeDot(yj_en) }
  ];
  cur = yj_en;

  const ev_dur = Number(p.eventJumat) || durJum;
  const ev_en = cur + ev_dur;
  jumat.push({ type: 'jam', jamKe: '1', labelJam: '1', pukul: `${toTimeDot(cur)} - ${toTimeDot(ev_en)}`, ket: 'EVENT JUMAT', dur: ev_dur, start: toTimeDot(cur), end: toTimeDot(ev_en) });
  cur = ev_en;

  for (let j = 2; j <= 5; j++) {
    const st = cur;
    const en = cur + durJum;
    jumat.push({ type: 'jam', jamKe: String(j), labelJam: String(j), pukul: `${toTimeDot(st)} - ${toTimeDot(en)}`, ket: `JAM KE ${j}`, dur: durJum, start: toTimeDot(st), end: toTimeDot(en) });
    cur = en;
  }

  const jb_st = cur;
  const jb_dur = Number(p.breakJumat) || 130;
  const jb_en = cur + jb_dur;
  jumat.push({ type: 'break', jamKe: `ISTIRAHAT ${jb_dur}'`, labelJam: `ISTIRAHAT ${jb_dur}'`, pukul: `${toTimeDot(jb_st)} - ${toTimeDot(jb_en)}`, ket: 'ISTIRAHAT / SHOLAT JUMAT', dur: jb_dur, start: toTimeDot(jb_st), end: toTimeDot(jb_en) });
  cur = jb_en;

  // Slot 6 (45m, type: 'jam', ket: 'JAM KE 6' untuk Kelas X)
  const j6_st = cur;
  const j6_dur = 45;
  const j6_en = cur + j6_dur;
  jumat.push({ type: 'jam', jamKe: '6', labelJam: '6', pukul: `${toTimeDot(j6_st)} - ${toTimeDot(j6_en)}`, ket: 'JAM KE 6', dur: j6_dur, start: toTimeDot(j6_st), end: toTimeDot(j6_en) });
  cur = j6_en;

  // Slot 7 (120m, type: 'extra', ket: 'PRAMUKA / EKSTRA PILIHAN')
  const j7_st = cur;
  const j7_dur = 120;
  const j7_en = cur + j7_dur;
  jumat.push({ type: 'extra', jamKe: '7', labelJam: '7', pukul: `${toTimeDot(j7_st)} - ${toTimeDot(j7_en)}`, ket: 'PRAMUKA / EKSTRA PILIHAN', dur: j7_dur, start: toTimeDot(j7_st), end: toTimeDot(j7_en) });
  cur = j7_en;

  // PRAMUKA (dur: 0, type: 'extra', ket: 'PULANG')
  jumat.push({ type: 'extra', jamKe: 'PRAMUKA', labelJam: 'PRAMUKA', pukul: `${toTimeDot(cur)} - SELESAI`, ket: 'PULANG', dur: 0, start: toTimeDot(cur), end: 'SELESAI', span: [8, 9, 10, 11, 12] });
  je.jumat = jumat;

  // 4. Jumat Kelas XI & XII (4 JP KBM)
  let curXi = toMin(p.startJumat || '06:45');
  const yj_en_xi = curXi + yj_dur;
  const jumat_xi_xii: JamEfektifRow[] = [
    { type: 'pre', jamKe: 'YASIN', labelJam: 'YASIN', pukul: `${toTimeDot(curXi)} - ${toTimeDot(yj_en_xi)}`, ket: 'PEMBACAAN SURAT YASIN', dur: yj_dur, start: toTimeDot(curXi), end: toTimeDot(yj_en_xi) }
  ];
  curXi = yj_en_xi;

  const ev_en_xi = curXi + ev_dur;
  jumat_xi_xii.push({ type: 'jam', jamKe: '1', labelJam: '1', pukul: `${toTimeDot(curXi)} - ${toTimeDot(ev_en_xi)}`, ket: 'EVENT JUMAT', dur: ev_dur, start: toTimeDot(curXi), end: toTimeDot(ev_en_xi) });
  curXi = ev_en_xi;

  for (let j = 2; j <= 4; j++) {
    const st = curXi;
    const en = curXi + durJum;
    jumat_xi_xii.push({ type: 'jam', jamKe: String(j), labelJam: String(j), pukul: `${toTimeDot(st)} - ${toTimeDot(en)}`, ket: `JAM KE ${j}`, dur: durJum, start: toTimeDot(st), end: toTimeDot(en) });
    curXi = en;
  }

  const jb_xi_st = curXi;
  const jb_xi_en = curXi + jb_dur;
  jumat_xi_xii.push({ type: 'break', jamKe: `ISTIRAHAT ${jb_dur}'`, labelJam: `ISTIRAHAT ${jb_dur}'`, pukul: `${toTimeDot(jb_xi_st)} - ${toTimeDot(jb_xi_en)}`, ket: 'ISTIRAHAT / SHOLAT JUMAT', dur: jb_dur, start: toTimeDot(jb_xi_st), end: toTimeDot(jb_xi_en) });

  jumat_xi_xii.push({ type: '-', jamKe: '5', labelJam: '5', pukul: '-', ket: 'KOSONG / PULANG', dur: 0, start: toTimeDot(jb_xi_en), end: '-' });
  jumat_xi_xii.push({ type: '-', jamKe: '6', labelJam: '6', pukul: '-', ket: 'KOSONG / PULANG', dur: 0, start: toTimeDot(jb_xi_en), end: '-' });
  je.jumat_xi_xii = jumat_xi_xii;
}

const STORAGE_KEY = 'jbsmk_jam_efektif';

export async function getStoredJamEfektif(): Promise<JamEfektifData> {
  let result: JamEfektifData | null = null;
  try {
    const s = await db.setting.get('jam_efektif');
    if (s && s.value_json) {
      const parsed = JSON.parse(s.value_json);
      if (parsed && parsed.senin && parsed.selasa_kamis && parsed.jumat) {
        result = parsed as JamEfektifData;
      }
    }
  } catch (err) {
    console.warn('Failed to read jam_efektif from db.setting:', err);
  }

  if (!result) {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && parsed.senin && parsed.selasa_kamis && parsed.jumat) {
          result = parsed as JamEfektifData;
        }
      }
    } catch (err) {
      console.warn('Failed to read jam_efektif from localStorage:', err);
    }
  }

  if (!result) {
    result = JSON.parse(JSON.stringify(DEFAULT_JAM_EFEKTIF)) as JamEfektifData;
  }

  // Pastikan jumat_xi_xii terisi jika belum ada
  if (!result.jumat_xi_xii || result.jumat_xi_xii.length === 0) {
    result.jumat_xi_xii = JSON.parse(JSON.stringify(DEFAULT_JUMAT_XI_XII));
  }

  // Koreksi jam 6 di hari Jumat Kelas X bila sebelumnya tersimpan sebagai break/istirahat
  const j6 = result.jumat.find((r) => r.jamKe === '6');
  if (j6 && j6.type === 'break' && j6.ket === 'ISTIRAHAT') {
    j6.type = 'jam';
    j6.ket = 'JAM KE 6';
  }

  // Sinkronkan nama sekolah dan tahun ajaran secara otomatis jika ada di db.setting sekolah
  try {
    const sSekolah = await db.setting.get('sekolah');
    if (sSekolah?.value_json) {
      const parsedSekolah = JSON.parse(sSekolah.value_json);
      if (parsedSekolah.nama && parsedSekolah.nama.trim()) {
        result.schoolName = parsedSekolah.nama.trim();
      }
      if (parsedSekolah.tahun_ajaran && parsedSekolah.tahun_ajaran.trim()) {
        result.academicYear = parsedSekolah.tahun_ajaran.trim();
      }
      if (parsedSekolah.kepala_sekolah && parsedSekolah.kepala_sekolah.trim()) {
        result.principalName = parsedSekolah.kepala_sekolah.trim();
      }
      if (parsedSekolah.nip_kepala_sekolah && parsedSekolah.nip_kepala_sekolah.trim()) {
        result.principalNip = parsedSekolah.nip_kepala_sekolah.trim();
      }
      if (parsedSekolah.tanggal_tertulis && parsedSekolah.tanggal_tertulis.trim()) {
        const tt = parsedSekolah.tanggal_tertulis.trim();
        if (tt.includes(',')) {
          const parts = tt.split(',');
          result.signatureCity = parts[0].trim();
          result.signatureDate = parts.slice(1).join(',').trim();
        } else {
          result.signatureDate = tt;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to sync sekolah identity to jam_efektif:', err);
  }

  return result;
}

export async function saveStoredJamEfektif(je: JamEfektifData): Promise<void> {
  const json = JSON.stringify(je);
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }

  try {
    await db.setting.put({
      key: 'jam_efektif',
      value_json: json,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to save to db.setting:', err);
  }

  // Sync to db.jam_slot
  try {
    await syncJamEfektifToDbSlots(je);
  } catch (err) {
    console.warn('Failed to sync to db.jam_slot:', err);
  }
}

export async function syncJamEfektifToDbSlots(je: JamEfektifData): Promise<void> {
  let activeTemplate = await db.jam_template.filter((t) => t.aktif === 1).first();
  if (!activeTemplate) {
    const templateId = ulid();
    activeTemplate = {
      id: templateId,
      nama: 'Template Jam Efektif Sekolah',
      aktif: 1,
      is_assumed: 0,
    };
    await db.jam_template.put(activeTemplate);
  }

  const templateId = activeTemplate.id;
  const newSlots: JamSlot[] = [];

  const convertRowsToSlots = (rows: JamEfektifRow[], hari: Hari) => {
    let urutan = 1;
    let jpCounter = 1;
    for (const r of rows) {
      const startTime = toTimeColon(r.start);
      const endTime = toTimeColon(r.end);
      let tipe: JamSlot['tipe'] = 'JP';
      let jpKe: number | null = null;
      let isLongBreak = 0;

      if (r.type === 'break' || r.type === '-' || r.type === 'empty') {
        tipe = 'ISTIRAHAT';
        isLongBreak = r.dur >= 30 ? 1 : 0;
      } else {
        tipe = 'JP';
        const num = parseInt(r.jamKe, 10);
        jpKe = !isNaN(num) ? num : jpCounter;
        jpCounter++;
      }

      newSlots.push({
        id: ulid(),
        template_id: templateId,
        hari,
        urutan: urutan++,
        tipe,
        jp_ke: jpKe,
        mulai: startTime || '07:00',
        selesai: endTime || '07:45',
        is_long_break: isLongBreak,
      });
    }
  };

  // Hari 1: Senin
  convertRowsToSlots(je.senin, 1);
  // Hari 2: Selasa
  convertRowsToSlots(je.selasa_kamis, 2);
  // Hari 3: Rabu
  convertRowsToSlots(je.selasa_kamis, 3);
  // Hari 4: Kamis
  convertRowsToSlots(je.selasa_kamis, 4);
  // Hari 5: Jumat
  convertRowsToSlots(je.jumat, 5);

  // Replace existing slots for this template
  await db.transaction('rw', db.jam_slot, async () => {
    await db.jam_slot.where('template_id').equals(templateId).delete();
    await db.jam_slot.bulkPut(newSlots);
  });
}

export interface EffectiveDaySlot {
  jp: number;
  start: string;
  end: string;
  dur: number;
  pukul: string;
  ket: string;
  labelJam: string;
}

export interface EffectiveDayBreak {
  afterJp: number;
  start: string;
  end: string;
  dur: number;
  pukul: string;
  label: string;
  ket: string;
}

export interface EffectiveScheduleStructure {
  slotsPerDay: EffectiveDaySlot[][];
  breaksPerDay: EffectiveDayBreak[][];
  maxJpPerDay: number[];
  totalJpRows: number;
  breakAfterJps: number[];
  hasBreakAtJp: (jp: number) => boolean;
  getBreakForDay: (dayIdx: number, jp: number) => EffectiveDayBreak | undefined;
  getRepresentativeTime: (jp: number) => string;
}

export function parseEffectiveScheduleStructure(
  je: JamEfektifData | null | undefined
): EffectiveScheduleStructure {
  const data = je || DEFAULT_JAM_EFEKTIF;

  const dayRowsList: JamEfektifRow[][] = [
    data.senin && data.senin.length > 0 ? data.senin : DEFAULT_JAM_EFEKTIF.senin,
    data.selasa_kamis && data.selasa_kamis.length > 0 ? data.selasa_kamis : DEFAULT_JAM_EFEKTIF.selasa_kamis,
    data.selasa_kamis && data.selasa_kamis.length > 0 ? data.selasa_kamis : DEFAULT_JAM_EFEKTIF.selasa_kamis,
    data.selasa_kamis && data.selasa_kamis.length > 0 ? data.selasa_kamis : DEFAULT_JAM_EFEKTIF.selasa_kamis,
    data.jumat && data.jumat.length > 0 ? data.jumat : DEFAULT_JAM_EFEKTIF.jumat,
  ];

  const slotsPerDay: EffectiveDaySlot[][] = [];
  const breaksPerDay: EffectiveDayBreak[][] = [];

  for (let d = 0; d < 5; d++) {
    const rows = dayRowsList[d] || [];
    const daySlots: EffectiveDaySlot[] = [];
    const dayBreaks: EffectiveDayBreak[] = [];
    let currentJp = 0;

    for (const r of rows) {
      if (r.type === 'jam') {
        currentJp++;
        const s = (r.start || '').replace(':', '.');
        const e = (r.end || '').replace(':', '.');
        const timeStr = r.pukul || (s && e ? `${s} - ${e}` : '');
        daySlots.push({
          jp: currentJp,
          start: s,
          end: e,
          dur: r.dur || (d === 4 ? (data.cfgParams?.durJumat || 35) : (data.cfgParams?.durStandar || 35)),
          pukul: timeStr,
          ket: r.ket || `JAM KE ${currentJp}`,
          labelJam: r.labelJam || r.jamKe || String(currentJp),
        });
      } else if (r.type === 'break') {
        const s = (r.start || '').replace(':', '.');
        const e = (r.end || '').replace(':', '.');
        const timeStr = r.pukul || (s && e ? `${s} - ${e}` : '');
        const label = r.labelJam || r.jamKe || 'ISTIRAHAT';
        const ket = r.ket || 'ISTIRAHAT';
        dayBreaks.push({
          afterJp: currentJp,
          start: s,
          end: e,
          dur: r.dur || 15,
          pukul: timeStr,
          label,
          ket,
        });
      }
    }

    slotsPerDay.push(daySlots);
    breaksPerDay.push(dayBreaks);
  }

  const maxJpPerDay = slotsPerDay.map((slots, d) =>
    slots.length > 0 ? slots.length : (d === 4 ? 6 : 11)
  );
  const totalJpRows = Math.max(...maxJpPerDay, 11);

  const breakAfterJpSet = new Set<number>();
  breaksPerDay.forEach((brs) =>
    brs.forEach((br) => {
      if (br.afterJp > 0) breakAfterJpSet.add(br.afterJp);
    })
  );
  const breakAfterJps = Array.from(breakAfterJpSet).sort((a, b) => a - b);

  const hasBreakAtJp = (jp: number) => breakAfterJps.includes(jp);
  const getBreakForDay = (dayIdx: number, jp: number) => {
    return breaksPerDay[dayIdx]?.find((b) => b.afterJp === jp);
  };

  const getRepresentativeTime = (jp: number) => {
    const slotSelasa = slotsPerDay[1]?.[jp - 1];
    if (slotSelasa?.pukul) return slotSelasa.pukul;
    const slotSenin = slotsPerDay[0]?.[jp - 1];
    if (slotSenin?.pukul) return slotSenin.pukul;
    return '';
  };

  return {
    slotsPerDay,
    breaksPerDay,
    maxJpPerDay,
    totalJpRows,
    breakAfterJps,
    hasBreakAtJp,
    getBreakForDay,
    getRepresentativeTime,
  };
}
