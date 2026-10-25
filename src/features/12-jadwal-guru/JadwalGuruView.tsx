// src/features/12-jadwal-guru/JadwalGuruView.tsx
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { BlokNo, Hari } from '../../domain/types';
import { UserCheck, Download, BarChart3 } from 'lucide-react';
import { NAMA_HARI } from '../../domain/constants';
import { exportSchedulePDF } from '../../lib/export-pdf';
import { exportTableToXLSX } from '../../lib/export-xlsx';
import { useAppStore } from '../../app/store';

export const JadwalGuruView: React.FC = () => {
  const { selectedGuruIdForSchedule, setSelectedGuruIdForSchedule } = useAppStore();
  const guruList = useLiveQuery(() => db.guru.filter((g) => g.aktif === 1).toArray()) ?? [];
  const kelasList = useLiveQuery(() => db.kelas.toArray()) ?? [];
  const mapelList = useLiveQuery(() => db.mapel.toArray()) ?? [];
  const runs = useLiveQuery(() => db.jadwal_run.orderBy('updated_at').reverse().toArray()) ?? [];

  const [activeTab, setActiveTab] = useState<'jadwal' | 'rekap'>('jadwal');
  const [selectedGuruId, setSelectedGuruId] = useState<string>('');
  const [activeBlok, setActiveBlok] = useState<BlokNo>(1);

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
        setSelectedGuruIdForSchedule(null); // reset setelah diterapkan
        return;
      }
    }
    if (guruList.length > 0 && !selectedGuruId) {
      setSelectedGuruId(guruList[0]!.id);
    }
  }, [guruList, selectedGuruId, selectedGuruIdForSchedule]);

  const activeRunId = runs[0]?.id;
  const entries = useLiveQuery(
    () => (activeRunId ? db.jadwal_entry.where({ run_id: activeRunId }).toArray() : []),
    [activeRunId]
  ) ?? [];

  const selectedGuru = guruList.find((g) => g.id === selectedGuruId);
  const guruEntries = entries.filter(
    (e) => e.guru_id === selectedGuruId && e.blok_no === activeBlok
  );

  // Hitung total JP per hari & total minggu
  const jpPerDay: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const e of guruEntries) {
    jpPerDay[e.hari] = (jpPerDay[e.hari] ?? 0) + 1;
  }
  const totalMinggu = Object.values(jpPerDay).reduce((a, b) => a + b, 0);
  const freeDays = Object.values(jpPerDay).filter((v) => v === 0).length;

  const handleExportPDF = () => {
    if (!selectedGuru) return;
    const headers = ['JP Ke', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const rows: (string | number)[][] = [];

    for (let jp = 1; jp <= 10; jp++) {
      const row: (string | number)[] = [`JP ${jp}`];
      for (let h = 1; h <= 5; h++) {
        const e = guruEntries.find((x) => x.hari === h && x.jp_ke === jp);
        if (e) {
          const k = kelasList.find((x) => x.id === e.kelas_id);
          const m = mapelList.find((x) => x.id === e.mapel_kelas_id);
          row.push(`${k?.nama ?? 'KLS'}\n${m?.kode ?? 'M'}`);
        } else {
          row.push('-');
        }
      }
      rows.push(row);
    }

    exportSchedulePDF(
      `Jadwal Mengajar Guru: ${selectedGuru.nama} (${selectedGuru.kode})`,
      `Blok ${activeBlok} — SMK Negeri 1 (Total: ${totalMinggu} JP, Hari Bebas: ${freeDays})`,
      headers,
      rows,
      `Jadwal_Guru_${selectedGuru.kode}_Blok_${activeBlok}`
    );
  };

  const handleExportRekapXLSX = () => {
    const headers = ['Kode Guru', 'Nama Guru', 'Total JP Blok 1', 'Total JP Blok 2', 'Rata-rata/Minggu', 'Hari Bebas B1', 'Hari Bebas B2'];
    const rows: (string | number)[][] = [];

    for (const g of guruList) {
      const b1Entries = entries.filter((e) => e.guru_id === g.id && e.blok_no === 1);
      const b2Entries = entries.filter((e) => e.guru_id === g.id && e.blok_no === 2);

      const days1 = new Set(b1Entries.map((e) => e.hari)).size;
      const days2 = new Set(b2Entries.map((e) => e.hari)).size;

      const free1 = 5 - days1;
      const free2 = 5 - days2;
      const avg = ((b1Entries.length + b2Entries.length) / 2).toFixed(1);

      rows.push([g.kode, g.nama, b1Entries.length, b2Entries.length, avg, free1, free2]);
    }

    exportTableToXLSX([headers, ...rows], 'Rekap_Beban_Guru_SMK', 'Rekap_Beban');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-brand-600" />
            Menu 12 — Jadwal per Guru & Rekap Beban Mengajar
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Jadwal individual mengajar per guru dan tabel rekapitulasi beban mingguan terhadap batas jam.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {activeTab === 'jadwal' ? (
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Cetak Jadwal Guru
            </button>
          ) : (
            <button
              onClick={handleExportRekapXLSX}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Ekspor Rekap Excel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('jadwal')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'jadwal'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Jadwal Guru Personal
        </button>
        <button
          onClick={() => setActiveTab('rekap')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'rekap'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Rekap Beban Seluruh Guru
        </button>
      </div>

      {activeTab === 'jadwal' ? (
        <div className="space-y-6">
          {/* Selector Guru & Blok */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Pilih Guru:</label>
              <select
                value={selectedGuruId}
                onChange={(e) => setSelectedGuruId(e.target.value)}
                className="px-3 py-1.5 text-sm font-bold border border-slate-200 rounded-xl bg-white text-brand-700"
              >
                {guruList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.kode} — {g.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveBlok(1)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  activeBlok === 1 ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Blok 1 (Ganjil)
              </button>
              <button
                onClick={() => setActiveBlok(2)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  activeBlok === 2 ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Blok 2 (Genap)
              </button>
            </div>
          </div>

          {/* Ringkasan Beban Guru */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold text-slate-500 block">Total Jam Mengajar</span>
              <span className="text-2xl font-black text-brand-700">{totalMinggu} JP</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">di Blok {activeBlok}</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold text-slate-500 block">Hari Bebas Mengajar</span>
              <span className="text-2xl font-black text-emerald-600">{freeDays} Hari</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Target minimal: 1 hari</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold text-slate-500 block">Batas Maks Harian</span>
              <span className="text-2xl font-black text-slate-800">{selectedGuru?.maks_jp_hari ?? 8} JP</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold text-slate-500 block">Toleransi Jeda (Gap)</span>
              <span className="text-2xl font-black text-slate-800">{selectedGuru?.maks_gap ?? 1} JP</span>
            </div>
          </div>

          {/* Matriks Jadwal Guru */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3 border border-slate-200 w-20">JP</th>
                  {([1, 2, 3, 4, 5] as Hari[]).map((h) => (
                    <th key={h} className="py-2.5 px-3 border border-slate-200">
                      {NAMA_HARI[h]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((jp) => (
                  <tr key={jp} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 border border-slate-200 font-mono font-bold text-slate-400 bg-slate-50">
                      JP {jp}
                    </td>
                    {([1, 2, 3, 4, 5] as Hari[]).map((h) => {
                      const entry = guruEntries.find((e) => e.hari === h && e.jp_ke === jp);
                      const kls = entry ? kelasList.find((k) => k.id === entry.kelas_id) : undefined;
                      const mapel = entry ? mapelList.find((m) => m.id === entry.mapel_kelas_id) : undefined;

                      return (
                        <td key={h} className="p-2 border border-slate-200">
                          {entry ? (
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-brand-700 block font-mono text-xs">
                                {kls?.nama}
                              </span>
                              <span className="text-[11px] text-slate-600 font-medium block">
                                {mapel?.kode}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Baris Total JP per Hari */}
                <tr className="bg-slate-100 font-black text-slate-800 border-t-2 border-slate-300">
                  <td className="py-2.5 px-3 border border-slate-200 text-left">Total JP</td>
                  {([1, 2, 3, 4, 5] as Hari[]).map((h) => (
                    <td key={h} className="py-2.5 px-3 border border-slate-200 font-mono text-brand-700">
                      {jpPerDay[h] ?? 0} JP
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tab 2: Rekap Beban Seluruh Guru */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60">
                <th className="py-3 px-4">Kode</th>
                <th className="py-3 px-4">Nama Guru</th>
                <th className="py-3 px-4 text-center">Blok 1</th>
                <th className="py-3 px-4 text-center">Blok 2</th>
                <th className="py-3 px-4 text-center">Rata-rata/Minggu</th>
                <th className="py-3 px-4 text-center">Hari Bebas (B1/B2)</th>
                <th className="py-3 px-4 text-center">Status Beban</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guruList.map((g) => {
                const b1 = entries.filter((e) => e.guru_id === g.id && e.blok_no === 1);
                const b2 = entries.filter((e) => e.guru_id === g.id && e.blok_no === 2);
                const days1 = new Set(b1.map((e) => e.hari)).size;
                const days2 = new Set(b2.map((e) => e.hari)).size;
                const free1 = 5 - days1;
                const free2 = 5 - days2;
                const avg = ((b1.length + b2.length) / 2).toFixed(1);

                const minJp = g.jp_min ?? 24;
                const maxJp = g.jp_maks ?? 40;
                const avgNum = parseFloat(avg);
                const isUnder = avgNum < minJp && avgNum > 0;
                const isOver = avgNum > maxJp;

                return (
                  <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-700">{g.kode}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{g.nama}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">{b1.length} JP</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">{b2.length} JP</td>
                    <td className="py-3 px-4 text-center font-mono font-black text-brand-700">{avg} JP</td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-600">
                      {free1} / {free2} Hari
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isOver ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                          Lebih Jam
                        </span>
                      ) : isUnder ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                          Kurang Jam
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                          Ideal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
