// src/features/10-jadwal-jurusan/JadwalJurusanView.tsx
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { BlokNo, Hari } from '../../domain/types';
import { Layers, Download } from 'lucide-react';
import { NAMA_HARI } from '../../domain/constants';
import { exportSchedulePDF } from '../../lib/export-pdf';

export const JadwalJurusanView: React.FC = () => {
  const jurusans = useLiveQuery(() => db.jurusan.filter((j) => j.aktif === 1).toArray()) ?? [];
  const kelasList = useLiveQuery(() => db.kelas.filter((k) => k.aktif === 1).toArray()) ?? [];
  const mapelList = useLiveQuery(() => db.mapel.toArray()) ?? [];
  const guruList = useLiveQuery(() => db.guru.toArray()) ?? [];
  const runs = useLiveQuery(() => db.jadwal_run.orderBy('updated_at').reverse().toArray()) ?? [];

  const [selectedJurusanId, setSelectedJurusanId] = useState<string>('');
  const [activeBlok, setActiveBlok] = useState<BlokNo>(1);

  React.useEffect(() => {
    if (jurusans.length > 0 && !selectedJurusanId) {
      setSelectedJurusanId(jurusans[0]!.id);
    }
  }, [jurusans, selectedJurusanId]);

  const activeRunId = runs[0]?.id;
  const entries = useLiveQuery(
    () => (activeRunId ? db.jadwal_entry.where({ run_id: activeRunId }).toArray() : []),
    [activeRunId]
  ) ?? [];

  const activeJurusan = jurusans.find((j) => j.id === selectedJurusanId);
  const jurusanKelas = kelasList.filter((k) => k.jurusan_id === selectedJurusanId);

  const handleExportPDF = () => {
    if (!activeJurusan) return;
    const headers = ['Kelas', 'Hari', 'JP', 'Mata Pelajaran', 'Guru'];
    const rows: (string | number)[][] = [];

    for (const k of jurusanKelas) {
      const kEntries = entries
        .filter((e) => e.kelas_id === k.id && e.blok_no === activeBlok)
        .sort((a, b) => a.hari - b.hari || a.jp_ke - b.jp_ke);

      for (const e of kEntries) {
        const m = mapelList.find((x) => x.id === e.mapel_kelas_id);
        const g = guruList.find((x) => x.id === e.guru_id);
        rows.push([k.nama, NAMA_HARI[e.hari], `JP ${e.jp_ke}`, m?.nama ?? '-', g?.nama ?? '-']);
      }
    }

    exportSchedulePDF(
      `Jadwal Jurusan ${activeJurusan.nama} (Blok ${activeBlok})`,
      'SMK Negeri 1 — Tahun Ajaran 2026/2027',
      headers,
      rows,
      `Jadwal_Jurusan_${activeJurusan.kode}_Blok_${activeBlok}`,
      'portrait'
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-600" />
            Menu 10 — Jadwal per Program Keahlian
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualisasi jadwal terpadu seluruh kelas di bawah program keahlian {activeJurusan?.nama}.
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
        >
          <Download className="w-4 h-4 text-slate-500" />
          Cetak PDF Jurusan
        </button>
      </div>

      {/* Selector Jurusan & Blok */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700">Jurusan:</label>
          <div className="flex flex-wrap gap-1.5">
            {jurusans.map((j) => (
              <button
                key={j.id}
                onClick={() => setSelectedJurusanId(j.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  selectedJurusanId === j.id ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {j.kode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveBlok(1)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              activeBlok === 1 ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Blok 1
          </button>
          <button
            onClick={() => setActiveBlok(2)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              activeBlok === 2 ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Blok 2
          </button>
        </div>
      </div>

      {/* Tampilan Kelas-Kelas di Jurusan Ini */}
      <div className="space-y-6">
        {jurusanKelas.map((k) => {
          const kEntries = entries.filter((e) => e.kelas_id === k.id && e.blok_no === activeBlok);

          return (
            <div key={k.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">{k.nama}</span>
                <span className="text-xs text-slate-500 font-semibold">{kEntries.length} Jam Pelajaran</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-2 px-3 w-16">JP</th>
                      {([1, 2, 3, 4, 5] as Hari[]).map((h) => (
                        <th key={h} className="py-2 px-3 border-l border-slate-200">
                          {NAMA_HARI[h]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((jp) => (
                      <tr key={jp} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-slate-400 bg-slate-50">JP {jp}</td>
                        {([1, 2, 3, 4, 5] as Hari[]).map((h) => {
                          const entry = kEntries.find((e) => e.hari === h && e.jp_ke === jp);
                          const mapel = entry ? mapelList.find((m) => m.id === entry.mapel_kelas_id) : undefined;
                          const guru = entry ? guruList.find((g) => g.id === entry.guru_id) : undefined;

                          return (
                            <td key={h} className="p-2 border-l border-slate-200">
                              {entry ? (
                                <div>
                                  <span className="font-bold text-brand-700 block font-mono">{mapel?.kode}</span>
                                  <span className="text-[10px] text-slate-500">{guru?.kode}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
