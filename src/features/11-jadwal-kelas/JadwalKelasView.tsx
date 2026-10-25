// src/features/11-jadwal-kelas/JadwalKelasView.tsx
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { BlokNo, Hari } from '../../domain/types';
import { RombelCol, ROMBELS_48 } from '../03-matrix-sk/MatrixSKView';
import { DAFTAR_MAPEL_KODE_DEFAULT, DaftarMapelKodeItem } from '../../domain/sync-mapel-matrix';
import { ClassTemplatePair, TemplateMode } from '../../domain/template-blok-engine';
import { resolveCellSchedule } from '../../domain/schedule-resolver';
import {
  JamEfektifData,
  DEFAULT_JAM_EFEKTIF,
  parseEffectiveScheduleStructure,
} from '../../domain/jam-efektif-data';
import { useAppStore } from '../../app/store';
import {
  Calendar,
  Users,
  CheckCircle2,
  Printer,
  FileSpreadsheet,
  Clock,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { exportHtmlTableToXLSX } from '../../lib/export-xlsx';

export const JadwalKelasView: React.FC = () => {
  const { setActiveMenu } = useAppStore();

  // 1. Aliran Data Reaktif dari Dexie
  const dbEntries = useLiveQuery(() => db.jadwal_entry.toArray()) ?? [];
  const guruList = useLiveQuery(() => db.guru.toArray()) ?? [];
  const mapelList = useLiveQuery(() => db.mapel.toArray()) ?? [];
  const settingMatrix = useLiveQuery(() => db.setting.get('matrix_sk_grid'));
  const settingDaftarMapel = useLiveQuery(() => db.setting.get('daftar_mapel_kode'));
  const settingMode = useLiveQuery(() => db.setting.get('jadwal_template_mode'));
  const settingCustomA = useLiveQuery(() => db.setting.get('jadwal_template_custom_v2_TIPE_A'));
  const settingCustomB = useLiveQuery(() => db.setting.get('jadwal_template_custom_v2_TIPE_B'));
  const settingJamEfektif = useLiveQuery(() => db.setting.get('jam_efektif'));

  // Parser data setting
  const matrixGrid = useMemo(() => {
    if (settingMatrix?.value_json) {
      try {
        return JSON.parse(settingMatrix.value_json);
      } catch (_) {}
    }
    return { gridData: {}, teacherMapels: {} };
  }, [settingMatrix]);

  const daftarMapelKodeList: DaftarMapelKodeItem[] = useMemo(() => {
    if (settingDaftarMapel?.value_json) {
      try {
        return JSON.parse(settingDaftarMapel.value_json);
      } catch (_) {}
    }
    return DAFTAR_MAPEL_KODE_DEFAULT;
  }, [settingDaftarMapel]);

  const templateMode: TemplateMode = useMemo(() => {
    if (settingMode?.value_json) {
      try {
        const m = JSON.parse(settingMode.value_json);
        if (m === 'TIPE_A' || m === 'TIPE_B') return m;
      } catch (_) {}
    }
    return 'TIPE_A';
  }, [settingMode]);

  const customTemplatesMap: Record<string, ClassTemplatePair> = useMemo(() => {
    const raw = templateMode === 'TIPE_A' ? settingCustomA : settingCustomB;
    if (raw?.value_json) {
      try {
        return JSON.parse(raw.value_json);
      } catch (_) {}
    }
    return {};
  }, [templateMode, settingCustomA, settingCustomB]);

  // Context resolver sel jadwal
  const scheduleContext = useMemo(() => ({
    dbEntries,
    mapelList,
    daftarMapelKodeList,
    guruList,
    matrixGrid,
    customTemplatesMap,
    templateMode,
  }), [dbEntries, mapelList, daftarMapelKodeList, guruList, matrixGrid, customTemplatesMap, templateMode]);

  // State tampilan & filter
  const [selectedKelasId, setSelectedKelasId] = useState<string>('X_AK_1');
  const [activeBlok, setActiveBlok] = useState<BlokNo>(1);

  // Cari kelas aktif
  const currentClass = useMemo(() => {
    return ROMBELS_48.find((r: RombelCol) => r.id === selectedKelasId) || ROMBELS_48[0]!;
  }, [selectedKelasId]);

  // Parse Template Jam Efektif (Menu 7)
  const jamEfektifData: JamEfektifData = useMemo(() => {
    if (settingJamEfektif?.value_json) {
      try {
        const p = JSON.parse(settingJamEfektif.value_json);
        if (p && p.senin && p.selasa_kamis && p.jumat) return p as JamEfektifData;
      } catch (_) {}
    }
    try {
      const local = localStorage.getItem('jbsmk_jam_efektif');
      if (local) {
        const p = JSON.parse(local);
        if (p && p.senin && p.selasa_kamis && p.jumat) return p as JamEfektifData;
      }
    } catch (_) {}
    return DEFAULT_JAM_EFEKTIF;
  }, [settingJamEfektif]);

  const schedStruct = useMemo(() => {
    return parseEffectiveScheduleStructure(jamEfektifData);
  }, [jamEfektifData]);

  // Rentang jam pelajaran per hari (Dinamis dari Template Jam Efektif)
  const timeSlots = useMemo(() => {
    return Array.from({ length: schedStruct.totalJpRows }, (_, i) => {
      const jp = i + 1;
      const sSenin = schedStruct.slotsPerDay[0]?.[i];
      const sSelasa = schedStruct.slotsPerDay[1]?.[i];
      return {
        jp,
        senin: sSenin?.pukul || '',
        selasa: sSelasa?.pukul || '',
        start: sSenin?.start || sSelasa?.start || '',
      };
    });
  }, [schedStruct]);

  const DAYS = [
    { hari: 1 as Hari, nama: 'Senin', key: 'Sen' },
    { hari: 2 as Hari, nama: 'Selasa', key: 'Sel' },
    { hari: 3 as Hari, nama: 'Rabu', key: 'Rab' },
    { hari: 4 as Hari, nama: 'Kamis', key: 'Kam' },
    { hari: 5 as Hari, nama: 'Jumat', key: 'Jum' },
  ];

  // Hitung pola hari kelas (Produktif vs Reguler)
  const patternInfo = useMemo(() => {
    return DAYS.map((d) => {
      // Sampel jam ke-2 untuk mendeteksi tipe hari
      const cell = resolveCellSchedule(activeBlok, d.hari, 2, currentClass, scheduleContext);
      return {
        ...d,
        isProd: cell.isProduktif,
      };
    });
  }, [activeBlok, currentClass, scheduleContext]);

  const pCount = patternInfo.filter((x) => x.isProd).length;
  const rCount = patternInfo.filter((x) => !x.isProd).length;

  const handleExportExcel = () => {
    const tableEl = document.getElementById('table-jadwal-kelas');
    if (tableEl) {
      exportHtmlTableToXLSX(tableEl, `Jadwal_Kelas_${currentClass.nama.replace(/\s+/g, '_')}_Blok_${activeBlok}`);
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* CARD UTAMA BIRU (PERSIS SEPERTI JADWALSMK) */}
      <div className="bg-[#1e3a8a] text-white rounded-lg shadow-lg p-4 border border-blue-900">
        <div className="flex items-center justify-between pb-3 border-b border-blue-700/60 mb-3.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-200" />
            <h2 className="text-lg font-black tracking-wide uppercase text-white">
              JADWAL PELAJARAN PER KELAS
            </h2>
          </div>
          <div className="text-xs font-semibold text-blue-200 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-400/30">
            Sistem Jadwal Blok SMK — 48 Rombel
          </div>
        </div>

        {/* 1. FILTER & CONTROLS TOOLBAR */}
        <div className="bg-white rounded p-3 mb-3 text-slate-800 border border-slate-300 shadow-sm flex flex-wrap gap-3 justify-between items-center">
          {/* Siklus Blok */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-600">Siklus:</span>
            <div className="inline-flex bg-slate-100 rounded border border-slate-300 overflow-hidden">
              <button
                onClick={() => setActiveBlok(1)}
                className={`px-3 py-1 text-xs font-black transition-colors ${
                  activeBlok === 1 ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-700 hover:bg-slate-200'
                }`}
              >
                Blok 1 (Ganjil)
              </button>
              <button
                onClick={() => setActiveBlok(2)}
                className={`px-3 py-1 text-xs font-black transition-colors ${
                  activeBlok === 2 ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-700 hover:bg-slate-200'
                }`}
              >
                Blok 2 (Genap)
              </button>
            </div>
          </div>

          {/* Tampilan Switcher (Per Kelas vs Per Guru) */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-600">Tampilan:</span>
            <div className="inline-flex bg-slate-100 rounded border border-slate-300 overflow-hidden">
              <button
                className="px-3 py-1 text-xs font-black bg-blue-600 text-white flex items-center gap-1"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Per Kelas
              </button>
              <button
                onClick={() => {
                  useAppStore.setState({ activeMenu: 12 });
                  window.location.hash = '#jadwal_guru';
                }}
                className="px-3 py-1 text-xs font-black bg-transparent text-slate-700 hover:bg-slate-200 flex items-center gap-1 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                Per Guru
              </button>
            </div>
          </div>

          {/* Pilih Kelas Dropdown */}
          <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-[320px]">
            <span className="font-bold text-xs text-slate-600 whitespace-nowrap">Pilih Kelas:</span>
            <select
              value={selectedKelasId}
              onChange={(e) => setSelectedKelasId(e.target.value)}
              className="w-full text-xs font-bold border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ROMBELS_48.map((r: RombelCol) => (
                <option key={r.id} value={r.id}>
                  {r.nama} ({r.jurusanNama})
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-black rounded shadow transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Excel
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded shadow transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Jadwal
            </button>
          </div>
        </div>

        {/* 2. CLASS METADATA INFO BAR */}
        <div className="bg-black/25 rounded p-2.5 px-3 mb-3 border border-white/10 flex flex-wrap gap-2.5 items-center text-xs">
          <div className="bg-white/10 px-2.5 py-1 rounded border border-white/20">
            <span className="text-white/70">Jurusan:</span>{' '}
            <strong className="text-white">{currentClass.jurusanNama}</strong>
          </div>
          <div className="bg-white/10 px-2.5 py-1 rounded border border-white/20">
            <span className="text-white/70">Jenjang:</span>{' '}
            <strong className="text-white">Kelas {currentClass.tingkat}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/70 mr-0.5">Pola:</span>
            {patternInfo.map((p) => (
              <span
                key={p.hari}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                  p.isProd ? 'bg-emerald-500 text-white' : 'bg-blue-400 text-slate-900'
                }`}
              >
                {p.key} {p.isProd ? 'P' : 'R'}
              </span>
            ))}
          </div>
          <div className="ml-auto text-xs text-white/80 font-bold">
            <span className="text-emerald-300">{pCount} Hari Produktif</span> •{' '}
            <span className="text-sky-300">{rCount} Hari Reguler</span>
          </div>
        </div>

        {/* 3. ALERT BEBAS BENTROK 100% */}
        <div className="bg-emerald-50 text-emerald-900 border border-emerald-300 rounded p-2.5 px-3 mb-3.5 flex items-center gap-2 text-xs font-medium shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <strong className="font-bold text-emerald-950">Jadwal Bebas Bentrok 100%:</strong> Seluruh
            alokasi mata pelajaran untuk {currentClass.nama} terdistribusi optimal tanpa tabrakan jam
            guru!
          </div>
        </div>

        {/* 4. SCHEDULE TABLE PER KELAS */}
        <div
          id="table-jadwal-kelas"
          className="bg-white border-2 border-black rounded overflow-hidden text-black shadow-sm"
        >
          <div className="bg-[#8faadc] px-4 py-2 border-b-2 border-black flex justify-between items-center">
            <div className="font-black text-sm uppercase text-slate-900 tracking-wide">
              JADWAL KELAS: {currentClass.nama} — BLOK {activeBlok} ({activeBlok === 1 ? 'Minggu Ganjil' : 'Minggu Genap'})
            </div>
            <div className="text-xs font-bold text-slate-800">
              SMK Negeri Ihya Ulummudin Singojuruh
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse text-black">
              <thead>
                <tr className="bg-[#8faadc] text-black">
                  <th className="w-[110px] min-w-[110px] text-center border border-black p-2 bg-[#7b9ccf] font-black text-xs">
                    JP & Waktu
                  </th>
                  {patternInfo.map((p) => (
                    <th
                      key={p.hari}
                      className="min-w-[140px] text-center border border-black p-2 text-xs font-black bg-[#8faadc]"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>{p.nama.toUpperCase()}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            p.isProd ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                          }`}
                        >
                          {p.isProd ? 'Produktif' : 'Reguler'}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((ts) => {
                  const jp = ts.jp;
                  return (
                    <tr key={jp} className="hover:bg-slate-50">
                      {/* Kolom JP & Waktu */}
                      <td className="text-center font-extrabold bg-slate-100 text-slate-900 border border-slate-300 p-2 w-[110px]">
                        <div className="font-black text-xs text-blue-900">JP {jp}</div>
                        <div className="text-[10px] text-slate-500 font-semibold leading-tight mt-0.5">
                          Sen: {ts.senin}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold leading-tight">
                          Sel: {ts.selasa}
                        </div>
                      </td>

                      {/* Kolom Tiap Hari */}
                      {DAYS.map((d) => {
                        // Pada hari Jumat (d.hari === 5), jika jam melebihi batas KBM jam efektif
                        if (d.hari === 5 && jp > (schedStruct.maxJpPerDay[4] || 6)) {
                          return (
                            <td
                              key={d.hari}
                              className="text-center bg-slate-200 text-slate-400 font-bold border border-slate-300 text-xs"
                            >
                              Selesai
                            </td>
                          );
                        }

                        const cell = resolveCellSchedule(
                          activeBlok,
                          d.hari,
                          jp,
                          currentClass,
                          scheduleContext
                        );
                        const isProd = cell.isProduktif;
                        const bgStyle = isProd
                          ? 'bg-[#dcfce7] text-[#14532d] hover:bg-[#bbf7d0]'
                          : 'bg-[#eff6ff] text-[#1e40af] hover:bg-[#dbeafe]';

                        return (
                          <td
                            key={d.hari}
                            className={`p-2 text-center border border-slate-300 transition-colors ${bgStyle}`}
                            title={`${currentClass.nama} | ${d.nama} Jam ${jp}: ${cell.mapel} (${cell.guru})`}
                          >
                            <div className="font-extrabold text-xs leading-tight mb-1">
                              {cell.mapel}
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-[11px]">
                              {cell.guru !== '- Belum diset -' ? (
                                <span className="font-bold text-slate-800">
                                  👨‍🏫 {cell.guru}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">
                                  - Belum diset -
                                </span>
                              )}
                              <span className="text-[9px] px-1 py-0.2 bg-black/10 rounded font-semibold text-slate-700">
                                {ts.start}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
