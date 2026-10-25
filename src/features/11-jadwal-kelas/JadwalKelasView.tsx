// src/features/11-jadwal-kelas/JadwalKelasView.tsx
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { BlokNo, Hari } from '../../domain/types';
import { Calendar, Download, Printer } from 'lucide-react';
import { NAMA_HARI } from '../../domain/constants';
import { exportSchedulePDF } from '../../lib/export-pdf';

export const JadwalKelasView: React.FC = () => {
  const kelasList = useLiveQuery(() => db.kelas.filter((k) => k.aktif === 1).toArray()) ?? [];
  const mapelList = useLiveQuery(() => db.mapel.toArray()) ?? [];
  const guruList = useLiveQuery(() => db.guru.toArray()) ?? [];
  const runs = useLiveQuery(() => db.jadwal_run.orderBy('updated_at').reverse().toArray()) ?? [];
  const slots = useLiveQuery(() => db.jam_slot.toArray()) ?? [];
  const templates = useLiveQuery(() => db.jam_template.filter((t) => t.aktif === 1).toArray()) ?? [];

  const [selectedKelasId, setSelectedKelasId] = useState<string>('');
  const [activeBlok, setActiveBlok] = useState<BlokNo>(1);

  React.useEffect(() => {
    if (kelasList.length > 0 && !selectedKelasId) {
      setSelectedKelasId(kelasList[0]!.id);
    }
  }, [kelasList, selectedKelasId]);

  const activeRunId = runs[0]?.id;
  const entries = useLiveQuery(
    () => (activeRunId ? db.jadwal_entry.where({ run_id: activeRunId }).toArray() : []),
    [activeRunId]
  ) ?? [];

  const selectedKelas = kelasList.find((k) => k.id === selectedKelasId);
  const activeTemplate = templates[0];
  const templateSlots = slots
    .filter((s) => s.template_id === activeTemplate?.id)
    .sort((a, b) => a.urutan - b.urutan);

  // Ambil list slot jam unik (misal urutan 1..12) dari hari Senin sebagai acuan baris
  const rowsAcuan = templateSlots.filter((s) => s.hari === 1);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    if (!selectedKelas) return;
    const headers = ['Waktu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const rows: (string | number)[][] = [];

    for (const r of rowsAcuan) {
      if (r.tipe === 'ISTIRAHAT') {
        rows.push([`${r.mulai}-${r.selesai}`, 'ISTIRAHAT', 'ISTIRAHAT', 'ISTIRAHAT', 'ISTIRAHAT', 'ISTIRAHAT']);
      } else {
        const row: (string | number)[] = [`JP ${r.jp_ke} (${r.mulai}-${r.selesai})`];
        for (let h = 1; h <= 5; h++) {
          const entry = entries.find(
            (e) =>
              e.kelas_id === selectedKelas.id &&
              e.blok_no === activeBlok &&
              e.hari === h &&
              e.jp_ke === r.jp_ke
          );
          if (entry) {
            const m = mapelList.find((x) => x.id === entry.mapel_kelas_id);
            const g = guruList.find((x) => x.id === entry.guru_id);
            row.push(`${m?.kode ?? 'M'}\n(${g?.kode ?? 'G'})`);
          } else {
            row.push('-');
          }
        }
        rows.push(row);
      }
    }

    exportSchedulePDF(
      `Jadwal Pelajaran Kelas ${selectedKelas.nama}`,
      `Blok ${activeBlok} (${activeBlok === 1 ? 'Minggu Ganjil' : 'Minggu Genap'}) — SMK Negeri 1`,
      headers,
      rows,
      `Jadwal_${selectedKelas.nama.replace(/\s+/g, '_')}_Blok_${activeBlok}`,
      'landscape'
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 print:p-0 print:max-w-none">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-brand-600" />
            Menu 11 — Jadwal per Kelas (Siap Cetak)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Format jadwal mingguan standar kelas, lengkap dengan jam dan istirahat.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Ekspor PDF
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            Cetak Jadwal Kelas
          </button>
        </div>
      </div>

      {/* Selector Rombel & Blok */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700">Pilih Kelas:</label>
          <select
            value={selectedKelasId}
            onChange={(e) => setSelectedKelasId(e.target.value)}
            className="px-3 py-1.5 text-sm font-bold border border-slate-200 rounded-xl bg-white text-brand-700"
          >
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
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

      {/* Dokumen Jadwal Siap Cetak */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-lg space-y-6 print:border-none print:shadow-none print:p-2">
        <div className="text-center pb-4 border-b-2 border-slate-900">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">
            Jadwal Pelajaran Kelas {selectedKelas?.nama ?? '...'}
          </h2>
          <p className="text-xs font-semibold text-slate-600 mt-0.5">
            Tahun Ajaran 2026/2027 — Blok {activeBlok} ({activeBlok === 1 ? 'Minggu Ganjil' : 'Minggu Genap'})
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse border-2 border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 font-extrabold text-slate-900 border-b-2 border-slate-900">
                <th className="py-2.5 px-3 border border-slate-400 w-32">Waktu</th>
                {([1, 2, 3, 4, 5] as Hari[]).map((h) => (
                  <th key={h} className="py-2.5 px-3 border border-slate-400">
                    {NAMA_HARI[h]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsAcuan.map((slot) => {
                if (slot.tipe === 'ISTIRAHAT') {
                  return (
                    <tr key={slot.id} className="bg-amber-100/60 font-bold text-amber-900">
                      <td className="py-2 px-3 border border-slate-400 font-mono text-[11px]">
                        {slot.mulai} - {slot.selesai}
                      </td>
                      <td colSpan={5} className="py-2 px-3 border border-slate-400 tracking-wider">
                        ★ {slot.is_long_break === 1 ? 'ISTIRAHAT PANJANG (ISHOMA)' : 'ISTIRAHAT'} ★
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={slot.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 border border-slate-400 font-bold bg-slate-50">
                      <span className="block font-mono text-brand-700">JP {slot.jp_ke}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {slot.mulai} - {slot.selesai}
                      </span>
                    </td>
                    {([1, 2, 3, 4, 5] as Hari[]).map((h) => {
                      const entry = entries.find(
                        (e) =>
                          e.kelas_id === selectedKelas?.id &&
                          e.blok_no === activeBlok &&
                          e.hari === h &&
                          e.jp_ke === slot.jp_ke
                      );
                      const mapel = entry ? mapelList.find((m) => m.id === entry.mapel_kelas_id) : undefined;
                      const guru = entry ? guruList.find((g) => g.id === entry.guru_id) : undefined;

                      return (
                        <td key={h} className="p-2 border border-slate-400">
                          {entry ? (
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-slate-900 block font-mono text-xs">
                                {mapel?.kode ?? 'MAPEL'}
                              </span>
                              <span className="text-[11px] text-slate-700 font-medium block">
                                {mapel?.nama}
                              </span>
                              <span className="text-[10px] text-brand-700 font-bold block">
                                Guru: {guru?.kode ?? '-'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
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
  );
};
