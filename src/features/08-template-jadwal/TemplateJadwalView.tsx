// src/features/08-template-jadwal/TemplateJadwalView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/schema';
import { Hari } from '../../domain/types';
import { useToastStore } from '../../ui/Toast';
import {
  TemplateMode,
  SlotType,
  TemplateCell,
  ClassTemplatePair,
  buildAllDefaultPairs,
  buildDefaultPair,
  getStoredTemplateMode,
  saveStoredTemplateMode,
  getStoredCustomTemplates,
  saveStoredCustomTemplates,
  generateFullScheduleFromTemplate,
} from '../../domain/template-blok-engine';
import {
  Printer,
  RotateCcw,
  Settings,
  X,
  Check,
  Zap,
  Info,
} from 'lucide-react';
import { NAMA_HARI } from '../../domain/constants';

export const TemplateJadwalView: React.FC = () => {
  const { addToast } = useToastStore();

  // State Mode: TIPE A vs TIPE B (Sesuai Dokumen PDF Halaman 3, 4, 5)
  const [mode, setMode] = useState<TemplateMode>('TIPE_A');
  const [pairsMap, setPairsMap] = useState<Record<string, ClassTemplatePair>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter state (Default jurusan PSPT & Semua Tingkat XII, XI, X sesuai PDF)
  const [selectedJurusan, setSelectedJurusan] = useState<string>('PSPT');
  const [selectedTingkat, setSelectedTingkat] = useState<'ALL' | 'XII' | 'XI' | 'X'>('ALL');

  // Modal Edit Slot
  const [editingSlot, setEditingSlot] = useState<{
    pairId: string;
    rombelKey: 'rombel1' | 'rombel2';
    hari: Hari;
    jp: number;
    currentCell: TemplateCell;
  } | null>(null);

  const [modalType, setModalType] = useState<SlotType>('PRODUKTIF');
  const [modalCode, setModalCode] = useState('');
  const [modalLabel, setModalLabel] = useState('');
  const [modalApplyAllDay, setModalApplyAllDay] = useState(false);
  const [modalApplyMode, setModalApplyMode] = useState<'SINGLE' | 'RANGE' | 'ALL'>('SINGLE');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(4);

  // Inisialisasi data template
  useEffect(() => {
    async function loadTemplateData() {
      try {
        const storedMode = await getStoredTemplateMode();
        setMode(storedMode);

        const customData = await getStoredCustomTemplates(storedMode);
        if (customData) {
          setPairsMap(customData);
        } else {
          const defaults = buildAllDefaultPairs(storedMode);
          const map: Record<string, ClassTemplatePair> = {};
          defaults.forEach((p) => {
            map[p.id] = p;
          });
          setPairsMap(map);
        }
      } catch (err) {
        console.error('Failed to load template data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTemplateData();
  }, []);

  // Ganti Mode Tipe A / Tipe B
  const handleSwitchMode = async (newMode: TemplateMode) => {
    if (newMode === mode) return;
    setIsLoading(true);
    setMode(newMode);
    await saveStoredTemplateMode(newMode);

    const customData = await getStoredCustomTemplates(newMode);
    if (customData) {
      setPairsMap(customData);
    } else {
      const defaults = buildAllDefaultPairs(newMode);
      const map: Record<string, ClassTemplatePair> = {};
      defaults.forEach((p) => {
        map[p.id] = p;
      });
      setPairsMap(map);
    }
    setIsLoading(false);

    addToast({
      type: 'info',
      title: 'Mode Template Berubah',
      message: `Beralih ke format ${newMode === 'TIPE_A' ? 'JADWAL BLOK TIPE A' : 'JADWAL BLOK TIPE B'}.`,
    });
  };

  // Reset ke Standar PDF Sesuai Halaman 3-5
  const handleResetStandard = async () => {
    if (
      !window.confirm(
        `Kembalikan seluruh template ${
          mode === 'TIPE_A' ? 'TIPE A' : 'TIPE B'
        } ke format standar sesuai dokumen alur kerja PDF?`
      )
    ) {
      return;
    }
    const defaults = buildAllDefaultPairs(mode);
    const map: Record<string, ClassTemplatePair> = {};
    defaults.forEach((p) => {
      map[p.id] = p;
    });
    setPairsMap(map);
    await saveStoredCustomTemplates(mode, map);

    addToast({
      type: 'success',
      title: 'Reset Template Berhasil',
      message: `Template ${
        mode === 'TIPE_A' ? 'TIPE A' : 'TIPE B'
      } telah dipulihkan 100% ke standar resmi dokumen PDF.`,
    });
  };

  // Terapkan Template & Generate Jadwal Lengkap Bebas Bentrok (Langkah 7 PDF)
  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    try {
      const result = await generateFullScheduleFromTemplate(mode, pairsMap);
      addToast({
        type: 'success',
        title: 'Jadwal Otomatis Dibuat!',
        message: `Berhasil menata ${result.totalEntries} sesi jadwal bebas bentrok berdasarkan ${
          mode === 'TIPE_A' ? 'Jadwal Blok Tipe A' : 'Jadwal Blok Tipe B'
        }. Jadwal Total, Perjurusan, Perkelas, dan Perguru kini siap dibuka!`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Gagal Membuat Jadwal',
        message: String(err),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Buka Modal Edit Slot
  const handleOpenEditSlot = (
    pairId: string,
    rombelKey: 'rombel1' | 'rombel2',
    hari: Hari,
    jp: number,
    cell: TemplateCell
  ) => {
    setEditingSlot({ pairId, rombelKey, hari, jp, currentCell: cell });
    setModalType(cell.type);
    setModalCode(cell.code || '');
    setModalLabel(cell.label || cell.code || '');
    setModalApplyAllDay(false);
    setModalApplyMode('SINGLE');
    setRangeStart(jp);
    setRangeEnd(Math.min(11, jp + 3));
  };

  // Simpan Edit Slot
  const handleSaveEditSlot = async () => {
    if (!editingSlot) return;

    const { pairId, rombelKey, hari, jp } = editingSlot;
    const updatedMap = { ...pairsMap };
    const pair = updatedMap[pairId];
    if (!pair) return;

    const targetSchedule = { ...pair[rombelKey] };
    const targetDays = { ...targetSchedule.days };
    const daySlots = [...(targetDays[hari] || [])];

    const finalCode = modalType === 'KOSONG' ? '' : modalCode.trim().toUpperCase();
    const finalLabel = modalType === 'KOSONG' ? '' : modalLabel.trim() || finalCode;

    if (modalApplyMode === 'ALL' || modalApplyAllDay) {
      for (let i = 0; i < 11; i++) {
        daySlots[i] = {
          jp: i + 1,
          type: modalType,
          code: finalCode,
          label: finalLabel,
        };
      }
    } else if (modalApplyMode === 'RANGE') {
      const start = Math.max(1, Math.min(rangeStart, rangeEnd));
      const end = Math.min(11, Math.max(rangeStart, rangeEnd));
      for (let i = start - 1; i <= end - 1; i++) {
        daySlots[i] = {
          jp: i + 1,
          type: modalType,
          code: finalCode,
          label: finalLabel,
        };
      }
    } else {
      daySlots[jp - 1] = {
        jp,
        type: modalType,
        code: finalCode,
        label: finalLabel,
      };
    }

    targetDays[hari] = daySlots;
    targetSchedule.days = targetDays;
    pair[rombelKey] = targetSchedule;
    updatedMap[pairId] = pair;

    setPairsMap(updatedMap);
    await saveStoredCustomTemplates(mode, updatedMap);
    setEditingSlot(null);

    addToast({
      type: 'success',
      title: 'Slot Diperbarui',
      message: `Perubahan slot (${finalCode || modalType}) pada hari ${NAMA_HARI[hari]} berhasil disimpan di Blok Hijau.`,
    });
  };

  // Cetak Dokumen Template
  const handlePrint = () => {
    window.print();
  };

  // Daftar Jurusan yang Tersedia
  const jurusanList = [
    { kode: 'PSPT', nama: 'Produksi dan Siaran Program Televisi' },
    { kode: 'AK', nama: 'Akuntansi dan Keuangan Lembaga' },
    { kode: 'TKJ', nama: 'Teknik Komputer dan Jaringan' },
    { kode: 'TKR', nama: 'Teknik Kendaraan Ringan' },
    { kode: 'KUL', nama: 'Kuliner' },
    { kode: 'DPB', nama: 'Desain Produksi Busana' },
    { kode: 'APAT', nama: 'Agribisnis Perikanan Air Tawar' },
    { kode: 'LAS', nama: 'Teknik Pengelasan' },
  ];

  // Filter pasangan rombel yang ditampilkan (Urutan: XII -> XI -> X sesuai PDF)
  const filteredPairs = useMemo(() => {
    const list: ClassTemplatePair[] = [];
    const tingkats: ('XII' | 'XI' | 'X')[] =
      selectedTingkat === 'ALL' ? ['XII', 'XI', 'X'] : [selectedTingkat];

    const jurs =
      selectedJurusan === 'ALL'
        ? jurusanList
        : jurusanList.filter((j) => j.kode === selectedJurusan);

    for (const j of jurs) {
      for (const t of tingkats) {
        const id = `${t}_${j.kode}`;
        const p = pairsMap[id] || buildDefaultPair(t, j.kode, j.nama, mode);
        list.push(p);
      }
    }
    return list;
  }, [pairsMap, selectedJurusan, selectedTingkat, mode]);

  // Cek apakah slot adalah non-aktif di hari Jumat (Sesuai layout visual PDF)
  const isInactiveSlot = (tingkat: 'X' | 'XI' | 'XII', hari: Hari, jp: number): boolean => {
    if (hari !== 5) return false;
    if (tingkat === 'X') {
      return jp >= 7; // Kelas X: baris Jumat 7-11 tidak aktif
    }
    return jp >= 5; // Kelas XII & XI: baris Jumat 5-11 tidak aktif
  };

  // Warna aksen tema berdasarkan mode (Tipe A = biru lembut #bfdbfe, Tipe B = kuning emas #fde68a)
  const isTipeA = mode === 'TIPE_A';
  const themeHeaderBg = isTipeA ? 'bg-[#bfdbfe]' : 'bg-[#fde68a]';
  const themeColHeaderBg = isTipeA ? 'bg-[#dbeafe]' : 'bg-[#fef3c7]';
  const themeInactiveBg = isTipeA ? 'bg-[#bfdbfe]' : 'bg-[#fde68a]';

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 font-bold flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span>Memuat Template Jadwal Blok SMK...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto pb-16 select-text" style={{ padding: '16px 20px' }}>
      {/* 1. Header Toolbar Control (Hidden saat cetak) */}
      <div className="no-print space-y-4 mb-6">
        {/* Top Control Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-yellow-400 text-yellow-950 rounded-xl font-black text-xs shadow-sm">
                LANGKAH 6
              </span>
              <h1 className="text-xl font-black tracking-wide uppercase text-white">
                MENU TEMPLATE JADWAL
              </h1>
            </div>
            <p className="text-xs text-blue-100/90 mt-1.5 max-w-2xl leading-relaxed">
              Di <strong>MENU TEMPLATE JADWAL</strong>, Admin dapat memilih 2 mode jadwal yaitu{' '}
              <strong>JADWAL BLOK TIPE A</strong> dan <strong>JADWAL BLOK TIPE B</strong>, 
              serta meng-generate otomatis jadwal total bebas bentrok (Langkah 7).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleResetStandard}
              className="px-3.5 py-2 text-xs font-bold text-blue-100 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              title="Kembalikan format ke standar dokumen PDF"
            >
              <RotateCcw className="w-4 h-4 text-yellow-300" />
              Reset Standar PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4 text-blue-700" />
              Cetak Dokumen
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateSchedule}
              className="px-4 py-2 text-xs font-extrabold text-blue-950 bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 hover:from-yellow-400 hover:to-amber-500 rounded-xl transition-all flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-blue-950" />
              {isGenerating ? 'Menyusun Jadwal...' : '⚡ Terapkan & Generate Jadwal Otomatis (Langkah 7)'}
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs (TIPE A vs TIPE B) & Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider mr-1">
              Mode Template:
            </span>
            <button
              type="button"
              onClick={() => handleSwitchMode('TIPE_A')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                mode === 'TIPE_A'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {mode === 'TIPE_A' && <Check className="w-4 h-4" />}
              JADWAL BLOK TIPE A
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('TIPE_B')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                mode === 'TIPE_B'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-600/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {mode === 'TIPE_B' && <Check className="w-4 h-4" />}
              JADWAL BLOK TIPE B
            </button>
          </div>

          {/* Filter Jurusan & Tingkat */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Pilih Jurusan:</label>
              <select
                value={selectedJurusan}
                onChange={(e) => setSelectedJurusan(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Semua Jurusan</option>
                {jurusanList.map((j) => (
                  <option key={j.kode} value={j.kode}>
                    {j.kode} — {j.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Tingkat:</label>
              <select
                value={selectedTingkat}
                onChange={(e) => setSelectedTingkat(e.target.value as any)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Semua Tingkat (XII, XI, X)</option>
                <option value="XII">Kelas XII</option>
                <option value="XI">Kelas XI</option>
                <option value="X">Kelas X</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Official Document Paper Container (Print-ready, Identik 100% Format Dokumen PDF) */}
      <div
        id="templateJadwalPaper"
        className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-md border border-slate-300 text-slate-900 select-text"
      >
        {/* Banner Header Mode (Identik Tampilan Halaman 3 & Halaman 5 PDF) */}
        <div className="w-full text-center mb-6">
          <div
            className={`w-full py-2.5 px-4 rounded-md border-2 border-slate-900 ${themeHeaderBg} shadow-sm`}
          >
            <h2 className="text-base sm:text-lg font-black tracking-widest uppercase text-slate-950">
              {isTipeA ? 'JADWAL BLOK TIPE A' : 'JADWAL BLOK TIPE B'}
            </h2>
          </div>
        </div>

        {/* 3. Render Daftar Pasangan Rombel (Kelas XII, XI, X Sesuai Urutan Halaman 3-5 PDF) */}
        <div className="space-y-6">
          {filteredPairs.map((pair) => (
            <div key={pair.id} className="space-y-4 page-break-inside-avoid">
              {/* Table 1: Rombel 1 Blok 1 */}
              <div className="border-2 border-slate-900 rounded-md overflow-hidden">
                {/* Header Card Rombel 1 */}
                <div
                  className={`${themeHeaderBg} border-b-2 border-slate-900 px-3.5 py-1.5 flex items-center justify-between text-xs font-black text-slate-950`}
                >
                  <span className="uppercase tracking-wide">
                    {pair.rombel1.kelasNama} &nbsp;&nbsp; BLOK 1
                  </span>
                  <span className="uppercase tracking-wide">
                    PRODUKTIF {pair.tingkat} &nbsp;&nbsp; {pair.totalJpProduktif} JP
                  </span>
                </div>

                {/* 10 Columns Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse border-spacing-0 table-fixed">
                    <thead>
                      <tr className={`${themeColHeaderBg} text-[11px] font-black text-slate-950 border-b-2 border-slate-900`}>
                        <th className="py-1 px-1 border-r border-slate-400 w-[7%]">senin</th>
                        <th className="py-1 px-1 border-r-2 border-slate-900 w-[13%]">KODE</th>
                        <th className="py-1 px-1 border-r border-slate-400 w-[7%]">selasa</th>
                        <th className="py-1 px-1 border-r-2 border-slate-900 w-[13%]">KODE</th>
                        <th className="py-1 px-1 border-r border-slate-400 w-[7%]">rabu</th>
                        <th className="py-1 px-1 border-r-2 border-slate-900 w-[13%]">KODE</th>
                        <th className="py-1 px-1 border-r border-slate-400 w-[7%]">kamis</th>
                        <th className="py-1 px-1 border-r-2 border-slate-900 w-[13%]">KODE</th>
                        <th className="py-1 px-1 border-r border-slate-400 w-[7%]">jumat</th>
                        <th className="py-1 px-1 w-[13%]">KODE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 11 }, (_, i) => i + 1).map((jp) => (
                        <tr key={jp} className="border-b border-slate-300 last:border-b-0 h-[25px]">
                          {([1, 2, 3, 4, 5] as Hari[]).map((hari) => {
                            const inactive = isInactiveSlot(pair.tingkat, hari, jp);
                            const cell = pair.rombel1.days[hari]?.[jp - 1] || {
                              jp,
                              type: 'KOSONG',
                              code: '',
                            };
                            const isProd = cell.type === 'PRODUKTIF';
                            const isReg = cell.type === 'REGULER';

                            if (inactive) {
                              return (
                                <React.Fragment key={hari}>
                                  {/* Kolom Jam Non-aktif (Polos Tanpa Angka Jam Sesuai PDF) */}
                                  <td className={`border-r border-slate-400 ${themeInactiveBg}`} />
                                  {/* Kolom KODE Non-aktif (Polos Berwarna Sesuai Tema PDF) */}
                                  <td
                                    className={`${themeInactiveBg} ${
                                      hari < 5 ? 'border-r-2 border-slate-900' : ''
                                    }`}
                                  />
                                </React.Fragment>
                              );
                            }

                            return (
                              <React.Fragment key={hari}>
                                {/* Kolom Jam */}
                                <td className="text-[11px] font-bold text-slate-800 border-r border-slate-400 bg-slate-50/80">
                                  {jp}
                                </td>

                                {/* Kolom KODE (Hijau untuk Produktif, Putih untuk Reguler dan Kosong) */}
                                <td
                                  onClick={() =>
                                    handleOpenEditSlot(pair.id, 'rombel1', hari, jp, cell)
                                  }
                                  title="Klik untuk kustomisasi slot ini"
                                  className={`text-[10px] sm:text-[11px] font-black uppercase tracking-tight cursor-pointer transition-opacity select-none ${
                                    hari < 5 ? 'border-r-2 border-slate-900' : ''
                                  } ${
                                    isProd
                                      ? 'bg-[#86efac] text-slate-950 hover:brightness-95'
                                      : isReg
                                      ? 'bg-white text-slate-950 hover:bg-slate-100'
                                      : 'bg-white text-transparent hover:bg-slate-100'
                                  }`}
                                >
                                  {isProd
                                    ? cell.code
                                    : isReg
                                    ? cell.label === 'MUATAN LOKAL'
                                      ? 'MUATAN LOKAL'
                                      : cell.code || ''
                                    : ''}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: Rombel 2 Blok 2 */}
              <div className="border-2 border-slate-900 rounded-md overflow-hidden">
                {/* Header Card Rombel 2 */}
                <div
                  className={`${themeHeaderBg} border-b-2 border-slate-900 px-3.5 py-1.5 flex items-center justify-between text-xs font-black text-slate-950`}
                >
                  <span className="uppercase tracking-wide">
                    {pair.rombel2.kelasNama} &nbsp;&nbsp; BLOK 2
                  </span>
                  <span className="uppercase tracking-wide">
                    PRODUKTIF {pair.tingkat} &nbsp;&nbsp; {pair.totalJpProduktif} JP
                  </span>
                </div>

                {/* 10 Columns Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse border-spacing-0 table-fixed">
                    <thead>
                      <tr className={`${themeColHeaderBg} text-[11px] font-black text-slate-950 border-b-2 border-slate-900`}>
                        <th className="py-1 px-1 border-r border-slate-400 w-[7%]">senin</th>
                        <th className="py-1 px-1 border-r-2 border-slate-900 w-[13%]">KODE</th>
                        <th className="py-1 px-1 border-r border-slate-400 w-[7%]">selasa</th>
                        <th className="py-1 px-1 border-r-2 border-slate-900 w-[13%]">KODE</th>
                        <th className="py-1 px-1 border-r border-slate-400 w-[7%]">rabu</th>
                        <th className="py-1 px-1 border-r-2 border-slate-900 w-[13%]">KODE</th>
                        <th className="py-1 px-1 border-r border-slate-400 w-[7%]">kamis</th>
                        <th className="py-1 px-1 border-r-2 border-slate-900 w-[13%]">KODE</th>
                        <th className="py-1 px-1 border-r border-slate-400 w-[7%]">jumat</th>
                        <th className="py-1 px-1 w-[13%]">KODE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 11 }, (_, i) => i + 1).map((jp) => (
                        <tr key={jp} className="border-b border-slate-300 last:border-b-0 h-[25px]">
                          {([1, 2, 3, 4, 5] as Hari[]).map((hari) => {
                            const inactive = isInactiveSlot(pair.tingkat, hari, jp);
                            const cell = pair.rombel2.days[hari]?.[jp - 1] || {
                              jp,
                              type: 'KOSONG',
                              code: '',
                            };
                            const isProd = cell.type === 'PRODUKTIF';
                            const isReg = cell.type === 'REGULER';

                            if (inactive) {
                              return (
                                <React.Fragment key={hari}>
                                  {/* Kolom Jam Non-aktif (Polos Tanpa Angka Jam Sesuai PDF) */}
                                  <td className={`border-r border-slate-400 ${themeInactiveBg}`} />
                                  {/* Kolom KODE Non-aktif (Polos Berwarna Sesuai Tema PDF) */}
                                  <td
                                    className={`${themeInactiveBg} ${
                                      hari < 5 ? 'border-r-2 border-slate-900' : ''
                                    }`}
                                  />
                                </React.Fragment>
                              );
                            }

                            return (
                              <React.Fragment key={hari}>
                                {/* Kolom Jam */}
                                <td className="text-[11px] font-bold text-slate-800 border-r border-slate-400 bg-slate-50/80">
                                  {jp}
                                </td>

                                {/* Kolom KODE (Hijau untuk Produktif, Putih untuk Reguler dan Kosong) */}
                                <td
                                  onClick={() =>
                                    handleOpenEditSlot(pair.id, 'rombel2', hari, jp, cell)
                                  }
                                  title="Klik untuk kustomisasi slot ini"
                                  className={`text-[10px] sm:text-[11px] font-black uppercase tracking-tight cursor-pointer transition-opacity select-none ${
                                    hari < 5 ? 'border-r-2 border-slate-900' : ''
                                  } ${
                                    isProd
                                      ? 'bg-[#86efac] text-slate-950 hover:brightness-95'
                                      : isReg
                                      ? 'bg-white text-slate-950 hover:bg-slate-100'
                                      : 'bg-white text-transparent hover:bg-slate-100'
                                  }`}
                                >
                                  {isProd
                                    ? cell.code
                                    : isReg
                                    ? cell.label === 'MUATAN LOKAL'
                                      ? 'MUATAN LOKAL'
                                      : cell.code || ''
                                    : ''}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 4. Keterangan Box (Identik Kata-per-Kata Sesuai Dokumen Alur Kerja PDF) */}
        <div className="mt-8 pt-6 border-t-2 border-slate-300">
          {isTipeA ? (
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 sm:p-5 text-xs text-slate-800 space-y-2">
              <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-700" />
                Keterangan:
              </h4>
              <p className="leading-relaxed text-[12.5px] text-slate-800 font-medium">
                Untuk perencanaan, desain <strong>BLOK TIPE A JADWALNYA</strong> seperti ini, yang di{' '}
                <span className="font-bold text-emerald-950 bg-[#86efac] px-2 py-0.5 rounded border border-emerald-400">
                  blok hijau
                </span>{' '}
                untuk mata pelajaran <strong>PRODUKTIF</strong>, dan yang di{' '}
                <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-400 shadow-2xs">
                  blok putih
                </span>{' '}
                adalah slot untuk mata pelajaran <strong>REGULER</strong>. Mata pelajaran reguler bisa
                saling mengacak dan tidak crash dengan jadwal guru yang lain.
              </p>
            </div>
          ) : (
            <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-4 sm:p-5 text-xs text-slate-800 space-y-2.5">
              <h4 className="font-black text-amber-950 text-sm uppercase tracking-wide flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-800" />
                Keterangan & Catatan Tipe B:
              </h4>
              <p className="leading-relaxed text-[12.5px] text-slate-800 font-medium">
                Pada <strong>JADWAL BLOK TIPE B</strong> konsepnya adalah di minggu ganjil kelas XII PSPT 1
                mata pelajaran produktif, maka di XII PSPT 2 mata pelajarannya adalah reguler.{' '}
                <span className="font-bold text-emerald-950 bg-[#86efac] px-2 py-0.5 rounded border border-emerald-400">
                  Blok hijau
                </span>{' '}
                untuk jadwal produktif,{' '}
                <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-400 shadow-2xs">
                  blok putih
                </span>{' '}
                untuk reguler.
              </p>
              <p className="leading-relaxed text-[12.5px] text-slate-800 font-medium">
                Catatan untuk di minggu produktif (BLOK 1), slot putih pada hari Jumat dapat diisi mata pelajaran reguler atau <strong>MUATAN LOKAL</strong> yang dapat digenerate secara acak.
              </p>
              <div className="pt-2 border-t border-amber-200 text-slate-700">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 block mb-0.5">
                  LANGKAH 7:
                </span>
                <p className="text-[12px] italic">
                  Setelah pengaturan dimenu DAFTAR MAPEL DAN KODE sampai MENU TEMPLATE JADWAL selesai dipersonalisasi/ diatur, MENU JADWAL TOTAL sampai JADWAL PERGURU akan otomatis tergenerate tanpa ada crash antar jadwal guru mata pelajaran.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Modal Edit Slot */}
      {editingSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setEditingSlot(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-600" />
                Kustomisasi Slot Jadwal
              </h3>
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 space-y-1">
                <div className="font-bold flex items-center justify-between">
                  <span>{NAMA_HARI[editingSlot.hari]} — Jam Ke-{editingSlot.jp}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-200 text-blue-950">
                    {pairsMap[editingSlot.pairId]?.tingkat} {pairsMap[editingSlot.pairId]?.jurusanKode}
                  </span>
                </div>
                <div className="text-[11px] text-blue-700">
                  Target: <strong>{pairsMap[editingSlot.pairId]?.[editingSlot.rombelKey].kelasNama}</strong> ({editingSlot.rombelKey === 'rombel1' ? 'Blok 1' : 'Blok 2'})
                </div>
              </div>

              {/* Tipe Slot */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Tipe Slot:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalType('PRODUKTIF')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all text-center ${
                      modalType === 'PRODUKTIF'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-300'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    PRODUKTIF (Hijau)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalType('REGULER')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all text-center ${
                      modalType === 'REGULER'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-300'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    REGULER (Putih)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalType('KOSONG')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all text-center ${
                      modalType === 'KOSONG'
                        ? 'bg-slate-600 text-white border-slate-700 shadow-sm'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    KOSONG (Putih)
                  </button>
                </div>
              </div>

              {/* Pilihan Khusus Blok Hijau: Produktif, PKK, Peminatan */}
              {modalType === 'PRODUKTIF' && (() => {
                const pInfo = pairsMap[editingSlot.pairId];
                const t = pInfo?.tingkat || 'XII';
                const j = pInfo?.jurusanKode || 'PSPT';
                const tNum = t === 'X' ? '1' : t === 'XI' ? '2' : '3';
                const proCode = `PRO${tNum}${j}`;
                const minatCode = `MINAT${tNum}${j}`;
                const pkkCode = `PKK${tNum}${j}`;

                return (
                  <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3 space-y-2">
                    <label className="font-extrabold text-emerald-950 block text-[11px] uppercase tracking-wide">
                      ⚡ Pilih Kategori Mapel Kejuruan (Blok Hijau):
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setModalCode(proCode);
                          setModalLabel(`PRODUKTIF ${tNum}`);
                        }}
                        className={`py-1.5 px-2 rounded-lg font-bold text-xs border transition-all ${
                          modalCode === proCode
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        <div className="font-black">PRODUKTIF</div>
                        <div className="text-[10px] font-mono">{proCode}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setModalCode(minatCode);
                          setModalLabel(`PEMINATAN ${tNum}`);
                        }}
                        className={`py-1.5 px-2 rounded-lg font-bold text-xs border transition-all ${
                          modalCode === minatCode
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        <div className="font-black">PEMINATAN</div>
                        <div className="text-[10px] font-mono">{minatCode}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setModalCode(pkkCode);
                          setModalLabel(`PKK ${tNum}`);
                        }}
                        className={`py-1.5 px-2 rounded-lg font-bold text-xs border transition-all ${
                          modalCode === pkkCode
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        <div className="font-black">PKK</div>
                        <div className="text-[10px] font-mono">{pkkCode}</div>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Kode Mapel Input Manual */}
              {modalType !== 'KOSONG' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Kode & Label Mata Pelajaran:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={modalCode}
                      onChange={(e) => setModalCode(e.target.value)}
                      placeholder="Kode Mapel (PRO3PSPT, MINAT3PSPT, PKK3PSPT)"
                      className="w-1/2 px-3 py-2 border border-slate-300 rounded-xl font-bold text-xs uppercase"
                    />
                    <input
                      type="text"
                      value={modalLabel}
                      onChange={(e) => setModalLabel(e.target.value)}
                      placeholder="Label Tampilan (Opsional)"
                      className="w-1/2 px-3 py-2 border border-slate-300 rounded-xl font-bold text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Pengaturan Penerapan Jam / Rentang Jam */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide">
                  Cakupan Penerapan Jam di Hari {NAMA_HARI[editingSlot.hari]}:
                </label>
                
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setModalApplyMode('SINGLE')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all ${
                      modalApplyMode === 'SINGLE'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Jam Ke-{editingSlot.jp} Saja
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalApplyMode('RANGE')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all ${
                      modalApplyMode === 'RANGE'
                        ? 'bg-white text-blue-900 shadow-sm ring-1 ring-blue-300'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Rentang Jam
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalApplyMode('ALL')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all ${
                      modalApplyMode === 'ALL'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua Jam (1-11)
                  </button>
                </div>

                {/* Input Rentang Jam jika mode RANGE dipilih */}
                {modalApplyMode === 'RANGE' && (
                  <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-700">Dari Jam Ke:</span>
                      <select
                        value={rangeStart}
                        onChange={(e) => setRangeStart(Number(e.target.value))}
                        className="border border-slate-300 bg-white rounded px-2 py-1 font-bold text-xs"
                      >
                        {Array.from({ length: 11 }, (_, i) => i + 1).map((j) => (
                          <option key={j} value={j}>Jam {j}</option>
                        ))}
                      </select>
                      <span className="font-bold text-slate-700">s/d Jam Ke:</span>
                      <select
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(Number(e.target.value))}
                        className="border border-slate-300 bg-white rounded px-2 py-1 font-bold text-xs"
                      >
                        {Array.from({ length: 11 }, (_, i) => i + 1).map((j) => (
                          <option key={j} value={j}>Jam {j}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tombol Shortcut Rentang Jam Cepat */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      <span className="text-[10px] text-slate-500 font-bold self-center">Shortcut:</span>
                      <button
                        type="button"
                        onClick={() => { setRangeStart(1); setRangeEnd(4); }}
                        className="px-2 py-0.5 rounded bg-white hover:bg-blue-100 text-blue-900 font-bold text-[10px] border border-blue-200"
                      >
                        Jam 1-4 (4 JP: Peminatan)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRangeStart(5); setRangeEnd(9); }}
                        className="px-2 py-0.5 rounded bg-white hover:bg-blue-100 text-blue-900 font-bold text-[10px] border border-blue-200"
                      >
                        Jam 5-9 (5 JP: PKK)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRangeStart(1); setRangeEnd(7); }}
                        className="px-2 py-0.5 rounded bg-white hover:bg-blue-100 text-blue-900 font-bold text-[10px] border border-blue-200"
                      >
                        Jam 1-7 (7 JP)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRangeStart(8); setRangeEnd(11); }}
                        className="px-2 py-0.5 rounded bg-white hover:bg-blue-100 text-blue-900 font-bold text-[10px] border border-blue-200"
                      >
                        Jam 8-11 (4 JP)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 leading-snug">
                💡 <strong>Ketentuan:</strong> Peletakan mata pelajaran <strong>PRODUKTIF</strong>, <strong>PKK</strong>, dan <strong>PEMINATAN</strong> boleh bebas dirubah atau ditukar jam/harinya, asalkan tetap berada di <strong>Blok Hijau</strong>.
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditSlot}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
