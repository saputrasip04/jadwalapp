// src/features/10-jadwal-jurusan/JadwalJurusanView.tsx
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { BlokNo, Hari } from '../../domain/types';
import { RombelCol, ROMBELS_48 } from '../03-matrix-sk/MatrixSKView';
import { DAFTAR_MAPEL_KODE_DEFAULT, DaftarMapelKodeItem } from '../../domain/sync-mapel-matrix';
import { ClassTemplatePair, TemplateMode } from '../../domain/template-blok-engine';
import { resolveCellSchedule } from '../../domain/schedule-resolver';
import { useAppStore } from '../../app/store';
import {
  Layers,
  ArrowDown,
  ArrowRight,
  Lock,
  Printer,
  FileSpreadsheet,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { exportHtmlTableToXLSX } from '../../lib/export-xlsx';

export const JadwalJurusanView: React.FC = () => {
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
  const [selectedJurusan, setSelectedJurusan] = useState<string>('AK');
  const [activeBlok, setActiveBlok] = useState<BlokNo>(1);
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical'); // 'vertical' = Jam Kebawah, 'horizontal' = Jam Kesamping

  // Program Keahlian (8 Jurusan)
  const programs = [
    { code: 'AK', name: '[AK] AK - Akuntansi dan Keuangan Lembaga' },
    { code: 'TKJ', name: '[TKJ] TKJ - Teknik Komputer dan Jaringan' },
    { code: 'PSPT', name: '[PSPT] PSPT - Produksi dan Siaran Program Televisi' },
    { code: 'TKR', name: '[TKR] TKR - Teknik Kendaraan Ringan' },
    { code: 'KUL', name: '[KUL] KUL - Kuliner' },
    { code: 'DPB', name: '[DPB] DPB - Desain Produksi Busana' },
    { code: 'LAS', name: '[LAS] LAS - Teknik Pengelasan' },
    { code: 'APAT', name: '[APAT] APAT - Agribisnis Perikanan Air Tawar' },
  ];

  // Filter rombel berdasarkan jurusan terpilih
  const jurusanRombels = useMemo(() => {
    return ROMBELS_48.filter((r: RombelCol) => {
      const jCode = r.jurusanKode.toUpperCase();
      const sel = selectedJurusan.toUpperCase();
      return (
        jCode === sel ||
        (sel === 'KUL' && jCode === 'KULINER') ||
        (sel === 'DPB' && (jCode === 'DPB' || jCode === 'FASHION')) ||
        (sel === 'KULINER' && jCode === 'KUL')
      );
    });
  }, [selectedJurusan]);

  // Slot jam & rentang waktu standar
  const timeSlots = [
    { jp: 1, senin: '07:00-07:45', regular: '07:00-07:45' },
    { jp: 2, senin: '07:45-08:30', regular: '07:45-08:30' },
    { jp: 3, senin: '08:30-09:15', regular: '08:30-09:15' },
    { jp: 4, senin: '09:15-10:00', regular: '09:15-10:00' },
    { jp: 5, senin: '10:15-11:00', regular: '10:15-11:00' },
    { jp: 6, senin: '11:00-11:45', regular: '11:00-11:45' },
    { jp: 7, senin: '12:30-13:15', regular: '12:30-13:15' },
    { jp: 8, senin: '13:15-14:00', regular: '13:15-14:00' },
    { jp: 9, senin: '14:00-14:40', regular: '14:00-14:45' },
    { jp: 10, senin: '14:40-15:20', regular: '14:45-15:30' },
    { jp: 11, senin: '15:20-16:00', regular: '15:30-16:15' },
  ];

  const DAYS = [
    { hari: 1 as Hari, nama: 'SENIN' },
    { hari: 2 as Hari, nama: 'SELASA' },
    { hari: 3 as Hari, nama: 'RABU' },
    { hari: 4 as Hari, nama: 'KAMIS' },
    { hari: 5 as Hari, nama: 'JUMAT' },
  ];

  // Buka detail jadwal kelas di Menu 11
  const handleOpenClass = (rombelId: string) => {
    useAppStore.setState({ activeMenu: 11 });
    window.location.hash = '#jadwal_kelas';
  };

  // Export Excel Format Blok
  const handleExportExcel = () => {
    const tableEl = document.getElementById('table-jadwal-jurusan');
    if (tableEl) {
      exportHtmlTableToXLSX(tableEl, `Jadwal_Jurusan_${selectedJurusan}_Blok_${activeBlok}`);
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* CARD UTAMA BIRU (PERSIS SEPERTI JADWALSMK) */}
      <div className="bg-[#1e3a8a] text-white rounded-lg shadow-lg p-4 border border-blue-900">
        <div className="flex items-center justify-between pb-3 border-b border-blue-700/60 mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-200" />
            <h2 className="text-lg font-black tracking-wide uppercase text-white">
              JADWAL PERJURUSAN PROGRAM KEAHLIAN
            </h2>
          </div>
          <div className="text-xs font-semibold text-blue-200 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-400/30">
            Sistem Jadwal Blok SMK — 48 Rombel
          </div>
        </div>

        {/* 1. JURUSAN SELECTOR PILLS */}
        <div className="flex flex-wrap gap-1.5 mb-3.5 bg-black/25 p-2 rounded border border-white/10">
          {programs.map((p) => {
            const isActive = selectedJurusan === p.code;
            return (
              <button
                key={p.code}
                onClick={() => setSelectedJurusan(p.code)}
                className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow border border-blue-400'
                    : 'bg-transparent text-white/90 hover:bg-white/10 border border-white/30'
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        {/* 2. CONTROLS BAR: BLOK SWITCHER, LAYOUT SWITCHER, ACTION BUTTONS */}
        <div className="flex flex-wrap justify-between items-center gap-2.5 mb-3.5 bg-black/25 p-2.5 px-3 rounded border border-white/10">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Blok Switcher */}
            <div className="inline-flex bg-white rounded border-[1.5px] border-black overflow-hidden shadow-sm">
              <button
                onClick={() => setActiveBlok(1)}
                className={`px-3 py-1 text-xs font-black transition-colors ${
                  activeBlok === 1 ? 'bg-blue-600 text-white' : 'bg-white text-black hover:bg-slate-100'
                }`}
              >
                Blok 1 (Ganjil)
              </button>
              <button
                onClick={() => setActiveBlok(2)}
                className={`px-3 py-1 text-xs font-black transition-colors ${
                  activeBlok === 2 ? 'bg-blue-600 text-white' : 'bg-white text-black hover:bg-slate-100'
                }`}
              >
                Blok 2 (Genap)
              </button>
            </div>

            {/* Layout Switcher: Jam Kebawah (Default) vs Jam Kesamping */}
            <div className="inline-flex bg-white rounded border-[1.5px] border-black overflow-hidden shadow-sm">
              <button
                onClick={() => setLayout('vertical')}
                title="Jam 1-11 kebawah, Hari ke samping (Format Standar)"
                className={`px-3 py-1 text-xs font-black flex items-center gap-1 transition-colors ${
                  layout === 'vertical' ? 'bg-blue-600 text-white' : 'bg-white text-black hover:bg-slate-100'
                }`}
              >
                <ArrowDown className="w-3.5 h-3.5" />
                Jam Kebawah
              </button>
              <button
                onClick={() => setLayout('horizontal')}
                title="Jam 1-11 kesamping, Hari kebawah"
                className={`px-3 py-1 text-xs font-black flex items-center gap-1 transition-colors ${
                  layout === 'horizontal' ? 'bg-blue-600 text-white' : 'bg-white text-black hover:bg-slate-100'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Jam Kesamping
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {}}
              title="Kunci Blok Hijau & Terapkan Jadwal Anti-Crash"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded border border-emerald-500 shadow-sm transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              Kunci Blok Hijau
            </button>
            <button
              onClick={handleExportExcel}
              title="Export Excel Format Blok (.xlsx)"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-black rounded border border-sky-500 shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Excel Blok
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-transparent hover:bg-white/10 text-white text-xs font-bold rounded border border-white transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Jadwal Jurusan
            </button>
          </div>
        </div>

        {/* 3. DAFTAR KELAS-KELAS PADA JURUSAN TERPILIH */}
        <div id="table-jadwal-jurusan" className="flex flex-col gap-4">
          {jurusanRombels.length === 0 ? (
            <div className="bg-white border-2 border-black rounded p-6 text-center text-slate-500 font-bold">
              Belum ada rombel kelas yang terdaftar untuk jurusan ini.
            </div>
          ) : (
            jurusanRombels.map((c: RombelCol) => {
              return (
                <div
                  key={c.id}
                  className="bg-white border-2 border-black rounded overflow-hidden text-black shadow-sm"
                >
                  {/* Card Header Rombel */}
                  <div className="bg-[#8faadc] px-3.5 py-2 border-b-2 border-black flex justify-between items-center">
                    <div className="font-black text-sm uppercase text-slate-900 tracking-wide">
                      JADWAL KELAS: {c.nama} (Jenjang {c.tingkat})
                    </div>
                    <button
                      onClick={() => handleOpenClass(c.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded shadow transition-colors"
                    >
                      Lihat Lengkap
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Format Layout Tabel */}
                  <div className="overflow-x-auto">
                    {layout === 'vertical' ? (
                      /* FORMAT UTAMA: JAM 1 - 11 KEBAWAH, HARI KE SAMPING */
                      <table className="w-full text-xs border-collapse text-black">
                        <thead>
                          <tr className="bg-[#8faadc] text-black">
                            <th className="w-[90px] min-w-[90px] text-center border border-black p-2 bg-[#7b9ccf] font-black text-xs">
                              Jam Ke
                            </th>
                            {DAYS.map((d) => (
                              <th
                                key={d.hari}
                                className="min-w-[130px] text-center border border-black p-2 text-xs font-black bg-[#8faadc]"
                              >
                                {d.nama}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {timeSlots.map((ts, idx) => {
                            const jp = ts.jp;
                            return (
                              <tr key={jp} className="hover:bg-slate-50">
                                {/* Kolom Jam */}
                                <td className="text-center font-extrabold bg-slate-100 text-slate-900 border border-slate-300 p-1.5 w-[90px]">
                                  <div className="font-black text-xs">Jam {jp}</div>
                                  <div className="text-[10px] text-slate-500 font-semibold leading-tight mt-0.5">
                                    {ts.regular}
                                  </div>
                                </td>

                                {/* Kolom Tiap Hari */}
                                {DAYS.map((d) => {
                                  // Pada hari Jumat, jam 7-11 off
                                  if (d.hari === 5 && jp > 6) {
                                    return (
                                      <td
                                        key={d.hari}
                                        className="text-center bg-slate-200 text-slate-400 font-bold border border-slate-300 text-xs"
                                      >
                                        -
                                      </td>
                                    );
                                  }

                                  const cell = resolveCellSchedule(activeBlok, d.hari, jp, c, scheduleContext);
                                  const isProd = cell.isProduktif;
                                  const bgStyle = isProd
                                    ? 'bg-[#dcfce7] text-[#14532d] hover:bg-[#bbf7d0]'
                                    : 'bg-[#eff6ff] text-[#1e40af] hover:bg-[#dbeafe]';

                                  return (
                                    <td
                                      key={d.hari}
                                      className={`p-1.5 px-2 text-center border border-slate-300 transition-colors ${bgStyle}`}
                                      title={`${c.nama} | ${d.nama} Jam ${jp}: ${cell.mapel} (${cell.guru})`}
                                    >
                                      <div className="font-extrabold text-xs leading-tight mb-0.5 line-clamp-1">
                                        {cell.mapel}
                                      </div>
                                      <div
                                        className={`text-[11px] truncate ${
                                          isProd ? 'text-emerald-800' : 'text-slate-600'
                                        }`}
                                      >
                                        {cell.guru !== '- Belum diset -' ? (
                                          <span className="font-semibold">👨‍🏫 {cell.guru}</span>
                                        ) : (
                                          <span className="text-slate-400 italic text-[10px]">
                                            - Belum diset -
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      /* FORMAT ALTERNATIF: JAM 1 - 11 KESAMPING, HARI KEBAWAH */
                      <table className="w-full text-xs border-collapse text-black">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800">
                            <th className="w-[80px] text-center border border-slate-300 p-1.5 font-bold">
                              Hari
                            </th>
                            {timeSlots.map((ts) => (
                              <th
                                key={ts.jp}
                                className="text-center border border-slate-300 p-1.5 font-bold min-w-[95px]"
                              >
                                Jam {ts.jp}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {DAYS.map((d) => (
                            <tr key={d.hari}>
                              <td className="text-center font-black bg-slate-50 border border-slate-300 p-1">
                                {d.nama.slice(0, 3)}
                              </td>
                              {timeSlots.map((ts) => {
                                const jp = ts.jp;
                                if (d.hari === 5 && jp > 6) {
                                  return (
                                    <td
                                      key={jp}
                                      className="text-center bg-slate-200 text-slate-400 font-bold border border-slate-300 text-xs"
                                    >
                                      -
                                    </td>
                                  );
                                }

                                const cell = resolveCellSchedule(activeBlok, d.hari, jp, c, scheduleContext);
                                const isProd = cell.isProduktif;
                                const bgStyle = isProd
                                  ? 'bg-[#dcfce7] text-[#14532d]'
                                  : 'bg-[#eff6ff] text-[#1e40af]';

                                return (
                                  <td
                                    key={jp}
                                    className={`p-1 text-center border border-slate-300 ${bgStyle}`}
                                    title={`${cell.mapel} (${cell.guru})`}
                                  >
                                    <div className="font-bold text-[11px] truncate">
                                      {cell.mapel.slice(0, 14)}
                                    </div>
                                    <div className="text-[10px] text-slate-600 truncate">
                                      {cell.guru !== '- Belum diset -' ? (
                                        cell.guru.slice(0, 12)
                                      ) : (
                                        <span className="text-slate-400 italic">- Belum diset -</span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
