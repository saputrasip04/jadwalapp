// src/features/12-jadwal-guru/JadwalGuruView.tsx
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { BlokNo, Guru } from '../../domain/types';
import { DAFTAR_MAPEL_KODE_DEFAULT, DaftarMapelKodeItem } from '../../domain/sync-mapel-matrix';
import { ClassTemplatePair, TemplateMode } from '../../domain/template-blok-engine';
import {
  resolveTeacherScheduleGrid,
  getTeacherDisplayCode,
  getTeacherMapelDisplay,
} from '../../domain/schedule-resolver';
import {
  JamEfektifData,
  DEFAULT_JAM_EFEKTIF,
  parseEffectiveScheduleStructure,
  EffectiveScheduleStructure,
} from '../../domain/jam-efektif-data';
import { useAppStore } from '../../app/store';
import {
  UserCheck,
  Printer,
  Calendar,
  Layers,
  Sparkles,
  Search,
  Clock,
} from 'lucide-react';

export const JadwalGuruView: React.FC = () => {
  const { selectedGuruIdForSchedule, setSelectedGuruIdForSchedule } = useAppStore();

  // 1. Aliran Data Reaktif dari Dexie
  const dbEntries = useLiveQuery(() => db.jadwal_entry.toArray()) ?? [];
  const guruList = useLiveQuery(() => db.guru.filter((g) => g.aktif === 1).toArray()) ?? [];
  const mapelList = useLiveQuery(() => db.mapel.toArray()) ?? [];
  const settingMatrix = useLiveQuery(() => db.setting.get('matrix_sk_grid'));
  const settingDaftarMapel = useLiveQuery(() => db.setting.get('daftar_mapel_kode'));
  const settingMode = useLiveQuery(() => db.setting.get('jadwal_template_mode'));
  const settingCustomA = useLiveQuery(() => db.setting.get('jadwal_template_custom_v2_TIPE_A'));
  const settingCustomB = useLiveQuery(() => db.setting.get('jadwal_template_custom_v2_TIPE_B'));
  const settingSekolah = useLiveQuery(() => db.setting.get('sekolah'));
  // Aliran Data Real-Time dari Menu 7 (Template Jam Efektif)
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

  const sekolahInfo = useMemo(() => {
    if (settingSekolah?.value_json) {
      try {
        return JSON.parse(settingSekolah.value_json);
      } catch (_) {}
    }
    return {
      nama: 'SMK NEGERI IHYA ULUMMUDIN SINGOJURUH',
      cabangDinas: 'CABANG DINAS PENDIDIKAN WILAYAH KAB.BANYUWANGI',
      alamat: 'Jl. KH Abdullah Hasbullah No.8 Singojuruh',
      kepala_sekolah: 'MOHAMAD MALIKI, S.Pd',
      nip_kepala_sekolah: '19820921 201407 1 001',
      tanggal_tertulis: 'Singojuruh, 8 Agustus 2026',
    };
  }, [settingSekolah]);

  // Parse Data Template Jam Efektif (Menu 7)
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

  // Struktur jadwal (Jam per hari, posisi istirahat, pukul) yang 100% mengikuti template jam efektif
  const schedStruct: EffectiveScheduleStructure = useMemo(() => {
    return parseEffectiveScheduleStructure(jamEfektifData);
  }, [jamEfektifData]);

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
  const [selectedGuruId, setSelectedGuruId] = useState<string>('');
  const [activeBlok, setActiveBlok] = useState<BlokNo>(1);
  const [showTimes, setShowTimes] = useState<boolean>(true);

  // Inisialisasi guru terpilih (prioritaskan Saputra jika ada, atau guru pertama)
  React.useEffect(() => {
    if (selectedGuruIdForSchedule && guruList.length > 0) {
      const match = guruList.find(
        (g) =>
          g.id === selectedGuruIdForSchedule ||
          g.kode === selectedGuruIdForSchedule ||
          g.nama === selectedGuruIdForSchedule
      );
      if (match) {
        setSelectedGuruId(match.id);
        setSelectedGuruIdForSchedule(null);
        return;
      }
    }
    if (guruList.length > 0 && !selectedGuruId) {
      const saputra = guruList.find((g) => g.nama.toUpperCase().includes('SAPUTRA'));
      setSelectedGuruId(saputra ? saputra.id : guruList[0]!.id);
    }
  }, [guruList, selectedGuruId, selectedGuruIdForSchedule, setSelectedGuruIdForSchedule]);

  const selectedGuru = useMemo(() => {
    return guruList.find((g) => g.id === selectedGuruId) || guruList[0];
  }, [guruList, selectedGuruId]);

  // Hitung jadwal mengajar guru
  const teacherSchedule = useMemo(() => {
    if (!selectedGuru) {
      return { grid: [], totalJp: 0, classesTaught: [] };
    }
    return resolveTeacherScheduleGrid(selectedGuru.id, activeBlok, scheduleContext);
  }, [selectedGuru, activeBlok, scheduleContext]);

  // Format info guru
  const teacherName = selectedGuru ? selectedGuru.nama : 'GURU';
  const teacherCode = selectedGuru ? getTeacherDisplayCode(selectedGuru, guruList) : '-';
  const mapelDisplay = selectedGuru ? getTeacherMapelDisplay(selectedGuru) : 'Mata Pelajaran';

  const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

  return (
    <div className="flex flex-col items-center w-full pb-8">
      {/* 1. SCREEN TOOLBAR (NO PRINT) */}
      <div className="w-full max-w-[880px] bg-white border border-slate-300 rounded-lg p-3.5 px-4 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-sm no-print">
        {/* Pilih Guru Dropdown */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <span className="font-bold text-xs text-slate-600 whitespace-nowrap">Pilih Guru:</span>
          <select
            value={selectedGuruId}
            onChange={(e) => setSelectedGuruId(e.target.value)}
            className="w-full text-xs font-bold border border-slate-300 rounded px-3 py-1.5 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {guruList.map((g) => (
              <option key={g.id} value={g.id}>
                [{g.kode}] {g.nama} — {g.sk_guru || 'Guru'}
              </option>
            ))}
          </select>
        </div>

        {/* Siklus Blok Switcher */}
        <div className="flex items-center gap-2">
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

        {/* Toggle Tampilkan Waktu Efektif */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTimes(!showTimes)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded border transition-colors ${
              showTimes
                ? 'bg-blue-50 border-blue-400 text-blue-900'
                : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
            title="Tampilkan / Sembunyikan Jam Pukul dari Template Jam Efektif"
          >
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>{showTimes ? 'Waktu Efektif: Aktif' : 'Waktu: Ringkas'}</span>
          </button>
        </div>

        {/* Right: Total JP & Cetak */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-black bg-blue-100 text-blue-900 px-3 py-1 rounded border border-blue-300">
            {teacherSchedule.totalJp} JP / minggu
          </span>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded shadow transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Jadwal
          </button>
        </div>
      </div>

      {/* 2. OFFICIAL SCHEDULE SHEET (LEMBAR JADWAL RESMI KOP SURAT) */}
      <div
        id="jadwal-guru-sheet"
        className="w-full max-w-[880px] bg-white text-black border-2 border-black p-5 px-6 shadow-md font-sans"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Kop Surat Sekolah */}
        <div className="text-center text-black leading-tight mb-1.5">
          <div className="text-base font-extrabold tracking-wide uppercase">
            {sekolahInfo.cabangDinas || 'CABANG DINAS PENDIDIKAN WILAYAH KAB.BANYUWANGI'}
          </div>
          <div className="text-lg font-black tracking-wide uppercase my-0.5">
            {sekolahInfo.nama || 'SMK NEGERI IHYA ULUMMUDIN SINGOJURUH'}
          </div>
          <div className="text-xs font-bold text-slate-800">
            {sekolahInfo.alamat || 'Jl. KH Abdullah Hasbullah No.8 Singojuruh'}
          </div>
        </div>

        {/* Garis Ganda Pembatas Kop */}
        <div className="border-b-[3px] border-double border-black mb-2.5"></div>

        {/* Judul Jadwal Mengajar */}
        <div className="text-center font-black text-base text-black mb-2.5 tracking-wide uppercase">
          JADWAL MENGAJAR
        </div>

        {/* Tabel Metadata Guru */}
        <table className="w-full border-collapse mb-2.5 text-xs font-bold text-black leading-snug">
          <tbody>
            <tr>
              <td className="w-[85px] py-0.5 whitespace-nowrap">Nama Guru</td>
              <td className="w-[15px] text-center">:</td>
              <td className="py-0.5 font-extrabold uppercase">{teacherName}</td>
              <td className="w-[15px] text-center align-middle">:</td>
              <td className="w-[230px] py-0.5 font-extrabold whitespace-nowrap text-right">
                {mapelDisplay}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 whitespace-nowrap">Kode Guru</td>
              <td className="text-center">:</td>
              <td className="py-0.5 font-extrabold">{teacherCode}</td>
              <td className="text-center align-middle">:</td>
              <td className="py-0.5 font-extrabold text-right">
                {teacherSchedule.totalJp} JP
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tabel Jadwal Mengajar Resmi (Grid Mengikuti Template Jam Efektif dengan Baris Istirahat Dinamis) */}
        <table className="w-full border-collapse border-2 border-black table-fixed text-center text-xs">
          <thead>
            <tr className="bg-[#cccccc] h-9">
              <th className="border-[1.5px] border-black w-[15%] font-extrabold text-xs text-black p-1">
                Jam Ke
              </th>
              <th className="border-[1.5px] border-black w-[17%] font-extrabold text-xs text-black p-1">
                Senin
              </th>
              <th className="border-[1.5px] border-black w-[17%] font-extrabold text-xs text-black p-1">
                Selasa
              </th>
              <th className="border-[1.5px] border-black w-[17%] font-extrabold text-xs text-black p-1">
                Rabu
              </th>
              <th className="border-[1.5px] border-black w-[17%] font-extrabold text-xs text-black p-1">
                Kamis
              </th>
              <th className="border-[1.5px] border-black w-[17%] font-extrabold text-xs text-black p-1">
                Jumat
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: schedStruct.totalJpRows }, (_, i) => i + 1).map((jp) => {
              const s = jp - 1;

              return (
                <React.Fragment key={jp}>
                  {/* Baris Jam Pelajaran Ke-jp */}
                  <tr className="h-9">
                    <td className="border-[1.5px] border-black bg-[#e5e7eb] font-bold text-xs text-black p-1 text-center align-middle">
                      <div className="font-extrabold text-[12px]">Jam Ke-{jp}</div>
                      {showTimes && schedStruct.getRepresentativeTime(jp) && (
                        <div className="text-[10px] text-slate-700 font-semibold leading-tight mt-0.5 whitespace-nowrap">
                          {schedStruct.getRepresentativeTime(jp)}
                        </div>
                      )}
                    </td>

                    {/* 5 Hari (d=0..4: Senin s/d Jumat) */}
                    {[0, 1, 2, 3, 4].map((d) => {
                      const maxJp = schedStruct.maxJpPerDay[d] ?? 11;
                      const isOff = jp > maxJp;
                      if (isOff) {
                        return (
                          <td
                            key={d}
                            className="border-[1.5px] border-black bg-white p-1 text-center text-slate-300"
                          >
                            &nbsp;
                          </td>
                        );
                      }

                      const cell = teacherSchedule.grid[d]?.[s];
                      const slotInfo = schedStruct.slotsPerDay[d]?.[s];
                      const dayName = dayNames[d];

                      if (cell && cell !== 'X') {
                        return (
                          <td
                            key={d}
                            className="border-[1.5px] border-black bg-white font-extrabold text-xs text-black p-1 text-center align-middle"
                            title={`${cell.mapel || 'Mengajar'} (${cell.kelas}) | ${dayName} Jam Ke-${jp}${
                              slotInfo?.pukul ? ` (${slotInfo.pukul})` : ''
                            }`}
                          >
                            {cell.kelas}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={d}
                          className="border-[1.5px] border-black bg-white p-1 text-center align-middle"
                          title={slotInfo?.pukul ? `${dayName} Jam Ke-${jp} (${slotInfo.pukul})` : undefined}
                        >
                          &nbsp;
                        </td>
                      );
                    })}
                  </tr>

                  {/* Baris Istirahat Dinamis (Interleaved Berdasarkan Template Jam Efektif) */}
                  {schedStruct.hasBreakAtJp(jp) && (
                    <tr className="h-7">
                      <td className="border-[1.5px] border-black bg-[#fffde7] text-[11px] font-extrabold text-[#7c5c00] p-1 text-center tracking-wider align-middle">
                        ISTIRAHAT
                      </td>
                      {[0, 1, 2, 3, 4].map((d) => {
                        const br = schedStruct.getBreakForDay(d, jp);
                        const maxJp = schedStruct.maxJpPerDay[d] ?? 11;
                        if (br) {
                          return (
                            <td
                              key={d}
                              className="border-[1.5px] border-black bg-[#fffde7] text-[11px] font-bold text-[#7c5c00] p-1 text-center italic leading-tight align-middle"
                            >
                              <div>{br.label}</div>
                              {showTimes && br.pukul && (
                                <div className="text-[10px] font-normal not-italic text-[#8c6d00]">
                                  ({br.pukul})
                                </div>
                              )}
                            </td>
                          );
                        }
                        if (jp <= maxJp) {
                          return (
                            <td
                              key={d}
                              className="border-[1.5px] border-black bg-[#fffde7] p-1 text-center text-xs"
                            >
                              &nbsp;
                            </td>
                          );
                        }
                        return (
                          <td key={d} className="border-[1.5px] border-black bg-white p-1">
                            &nbsp;
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Footer Sheet Ringkasan Rombel */}
        <div className="mt-4 flex justify-between items-center text-[11px] text-slate-700 font-medium">
          <div>
            Total Rombel Diajar:{' '}
            <strong className="text-black">{teacherSchedule.classesTaught.length} Rombel</strong>{' '}
            ({teacherSchedule.classesTaught.join(', ') || 'Belum ada'})
          </div>
          <div className="italic">
            Dokumen Jadwal Pembagian Tugas Mengajar Semester Gasal 2026/2027
          </div>
        </div>

        {/* Tanda Tangan Resmi Kedinasan (Sesuai Standar Kop Surat SMKN) */}
        <div className="mt-8 flex justify-between items-start text-xs text-black font-bold px-4 print:mt-6">
          <div className="text-center w-[240px]">
            <div>Mengetahui,</div>
            <div className="mb-14">Kepala Sekolah</div>
            <div className="font-extrabold underline uppercase">
              {sekolahInfo.kepala_sekolah || jamEfektifData.principalName || 'MOHAMAD MALIKI, S.Pd'}
            </div>
            <div className="text-[11px] font-normal">
              NIP. {sekolahInfo.nip_kepala_sekolah || jamEfektifData.principalNip || '19820921 201407 1 001'}
            </div>
          </div>

          <div className="text-center w-[240px]">
            <div>
              {sekolahInfo.tanggal_tertulis ||
                `${jamEfektifData.signatureCity || 'Singojuruh'}, ${
                  jamEfektifData.signatureDate || '8 Agustus 2026'
                }`}
            </div>
            <div className="mb-14">Guru Pengajar,</div>
            <div className="font-extrabold underline uppercase">{teacherName}</div>
            <div className="text-[11px] font-normal">
              {selectedGuru?.nip_nik ? `NIP/NIK. ${selectedGuru.nip_nik}` : 'NIP. -'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
