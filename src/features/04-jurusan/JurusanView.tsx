// src/features/04-jurusan/JurusanView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useToastStore } from '../../ui/Toast';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useAppStore } from '../../app/store';
import {
  JurusanItem,
  DEFAULT_JURUSAN_LIST,
  DEFAULT_PROG,
  getStoredJurusanList,
  getStoredJurusanProg,
  saveStoredJurusan,
} from '../../domain/curriculum-data';
import { getStoredMapelList } from '../../domain/sync-mapel-matrix';
import {
  Search,
  Plus,
  RotateCcw,
  BarChart2,
  Calendar,
  Settings,
  Users,
  Trash2,
  X,
  Check,
  Sparkles,
} from 'lucide-react';

const COMMON_EMOJIS = ['📊', '🚗', '💻', '🎥', '🍳', '👗', '⚡', '🐟', '🎨', '📐', '⚙️', '🏨'];

export const JurusanView: React.FC = () => {
  const { addToast } = useToastStore();
  const { setActiveMenu, setFilterGuruJurusan } = useAppStore();

  const [jurusanList, setJurusanList] = useState<JurusanItem[]>(DEFAULT_JURUSAN_LIST);
  const [progList, setProgList] = useState<[string, number][]>(DEFAULT_PROG);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalNo, setModalNo] = useState<number>(1);
  const [modalKode, setModalKode] = useState('');
  const [modalNama, setModalNama] = useState('');
  const [modalSingkat, setModalSingkat] = useState('');
  const [modalBidang, setModalBidang] = useState('');
  const [modalRombel, setModalRombel] = useState<number>(2);
  const [modalIcon, setModalIcon] = useState('📚');
  const [modalWarna, setModalWarna] = useState('#1e40af');
  const [modalDeskripsi, setModalDeskripsi] = useState('');

  // Confirm Reset Modal State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  // Load teachers from database
  const dbGuruList = useLiveQuery(() => db.guru.toArray()) ?? [];
  const [mapelList, setMapelList] = useState<any[]>([]);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const storedJ = await getStoredJurusanList();
        const storedP = await getStoredJurusanProg();
        const storedM = await getStoredMapelList();
        setJurusanList(storedJ);
        setProgList(storedP);
        setMapelList(storedM);
      } catch (err) {
        console.error('Failed to load jurusan data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Map of rombel counts by code/singkat
  const progMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [code, count] of progList) {
      map[code.toUpperCase()] = count;
    }
    return map;
  }, [progList]);

  // Total Rombel Per Tingkat & Total Sekolah
  const totalRombelPerTingkat = useMemo(() => {
    return jurusanList.reduce((acc, j) => {
      const cnt =
        progMap[j.internalCode?.toUpperCase()] ??
        progMap[j.singkat?.toUpperCase()] ??
        progMap[j.kode?.toUpperCase()] ??
        1;
      return acc + cnt;
    }, 0);
  }, [jurusanList, progMap]);

  const totalRombelSekolah = totalRombelPerTingkat * 3;

  // Total productive teachers
  const totalGuruProduktif = useMemo(() => {
    return dbGuruList.filter((g) => g.tipe_guru === 'PRODUKTIF').length;
  }, [dbGuruList]);

  // Enriched Jurusan Data with Rombel and Teachers
  const enrichedList = useMemo(() => {
    return jurusanList.map((info, originalIndex) => {
      const rombelCount =
        progMap[info.internalCode?.toUpperCase()] ??
        progMap[info.singkat?.toUpperCase()] ??
        progMap[info.kode?.toUpperCase()] ??
        1;

      const totalKelas = rombelCount * 3;

      // Generate Class Badges for X, XI, XII
      const kelasX: string[] = [];
      const kelasXI: string[] = [];
      const kelasXII: string[] = [];

      for (let r = 1; r <= rombelCount; r++) {
        const suffix = rombelCount > 1 ? ` ${r}` : '';
        kelasX.push(`X ${info.singkat}${suffix}`);
        kelasXI.push(`XI ${info.singkat}${suffix}`);
        kelasXII.push(`XII ${info.singkat}${suffix}`);
      }

      // Count associated teachers
      const jurTeachers = dbGuruList.filter((g) => {
        const sUpper = info.singkat.toUpperCase();
        const nUpper = info.nama.toUpperCase();
        const iUpper = (info.internalCode || '').toUpperCase();
        const skUpper = (g.sk_guru || '').toUpperCase();
        const isMatchedSK = skUpper === sUpper || (iUpper && skUpper === iUpper) || skUpper.includes(sUpper);
        if (isMatchedSK) return true;

        // Check assigned subjects
        const teachesSubject = mapelList.some((m) => {
          const mKat = (m.kategori || '').toUpperCase();
          const matchKat = mKat === sUpper || (iUpper && mKat === iUpper) || (m.mapel || '').toUpperCase().includes(sUpper);
          return matchKat && m.guru && m.guru.toUpperCase().includes(g.nama.toUpperCase());
        });

        return teachesSubject;
      });

      return {
        ...info,
        originalIndex,
        rombelCount,
        totalKelas,
        kelasX,
        kelasXI,
        kelasXII,
        teacherCount: jurTeachers.length,
      };
    });
  }, [jurusanList, progMap, dbGuruList, mapelList]);

  // Filtered by search query
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return enrichedList;
    return enrichedList.filter(
      (item) =>
        item.kode.toLowerCase().includes(q) ||
        item.nama.toLowerCase().includes(q) ||
        item.singkat.toLowerCase().includes(q) ||
        item.bidang.toLowerCase().includes(q) ||
        (item.deskripsi && item.deskripsi.toLowerCase().includes(q))
    );
  }, [enrichedList, searchQuery]);

  // Change Rombel Count (+ / -)
  const handleChangeRombel = async (jurIndex: number, delta: number) => {
    const item = jurusanList[jurIndex];
    if (!item) return;

    const currentKey = item.internalCode || item.singkat || item.kode;
    const currentCount =
      progMap[item.internalCode?.toUpperCase()] ??
      progMap[item.singkat?.toUpperCase()] ??
      progMap[item.kode?.toUpperCase()] ??
      1;

    const newCount = currentCount + delta;
    if (newCount < 1 || newCount > 6) return;

    const updatedProg = [...progList];
    const pIdx = updatedProg.findIndex(
      (p) =>
        p[0].toUpperCase() === item.internalCode?.toUpperCase() ||
        p[0].toUpperCase() === item.singkat?.toUpperCase() ||
        p[0].toUpperCase() === item.kode?.toUpperCase()
    );

    if (pIdx !== -1) {
      updatedProg[pIdx] = [updatedProg[pIdx]![0], newCount];
    } else {
      updatedProg.push([currentKey, newCount]);
    }

    setProgList(updatedProg);
    await saveStoredJurusan(jurusanList, updatedProg);

    addToast({
      type: 'success',
      title: 'Kapasitas Diperbarui',
      message: `[${item.kode}] ${item.singkat} disetel menjadi ${newCount} rombel per tingkat (${newCount * 3} kelas).`,
    });
  };

  // Open Modal Tambah
  const handleOpenAddModal = () => {
    const nextNo = jurusanList.length > 0 ? Math.max(...jurusanList.map((j) => j.no)) + 1 : 1;
    setEditingIndex(null);
    setModalNo(nextNo);
    setModalKode(`J${nextNo}`);
    setModalNama('');
    setModalSingkat('');
    setModalBidang('Bisnis dan Manajemen');
    setModalRombel(2);
    setModalIcon('📚');
    setModalWarna('#1e40af');
    setModalDeskripsi('');
    setIsModalOpen(true);
  };

  // Open Modal Edit
  const handleOpenEditModal = (index: number) => {
    const item = jurusanList[index];
    if (!item) return;

    const currentRombel =
      progMap[item.internalCode?.toUpperCase()] ??
      progMap[item.singkat?.toUpperCase()] ??
      progMap[item.kode?.toUpperCase()] ??
      1;

    setEditingIndex(index);
    setModalNo(item.no);
    setModalKode(item.kode);
    setModalNama(item.nama);
    setModalSingkat(item.singkat);
    setModalBidang(item.bidang);
    setModalRombel(currentRombel);
    setModalIcon(item.icon || '📚');
    setModalWarna(item.warna || '#1e40af');
    setModalDeskripsi(item.deskripsi || '');
    setIsModalOpen(true);
  };

  // Save Modal (Tambah / Edit)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalKode.trim() || !modalNama.trim() || !modalSingkat.trim()) {
      addToast({
        type: 'warning',
        title: 'Form Belum Lengkap',
        message: 'Kode, Nama Jurusan, dan Singkatan wajib diisi.',
      });
      return;
    }

    const cleanKode = modalKode.trim().toUpperCase();
    const cleanNama = modalNama.trim().toUpperCase();
    const cleanSingkat = modalSingkat.trim().toUpperCase();

    const updatedList = [...jurusanList];
    const updatedProg = [...progList];

    if (editingIndex !== null && updatedList[editingIndex]) {
      // Edit existing
      const existing = updatedList[editingIndex]!;
      updatedList[editingIndex] = {
        ...existing,
        no: modalNo,
        kode: cleanKode,
        nama: cleanNama,
        singkat: cleanSingkat,
        bidang: modalBidang.trim(),
        icon: modalIcon || '📚',
        warna: modalWarna || '#1e40af',
        deskripsi: modalDeskripsi.trim(),
      };

      // Sync rombel in progList
      const pIdx = updatedProg.findIndex(
        (p) =>
          p[0].toUpperCase() === existing.internalCode?.toUpperCase() ||
          p[0].toUpperCase() === existing.singkat?.toUpperCase() ||
          p[0].toUpperCase() === existing.kode?.toUpperCase()
      );
      if (pIdx !== -1) {
        updatedProg[pIdx] = [cleanSingkat, modalRombel];
      } else {
        updatedProg.push([cleanSingkat, modalRombel]);
      }

      addToast({
        type: 'success',
        title: 'Jurusan Diperbarui',
        message: `Konfigurasi jurusan [${cleanKode}] ${cleanSingkat} berhasil disimpan!`,
      });
    } else {
      // Add new
      const newJur: JurusanItem = {
        no: modalNo,
        kode: cleanKode,
        nama: cleanNama,
        singkat: cleanSingkat,
        internalCode: cleanSingkat,
        bidang: modalBidang.trim(),
        icon: modalIcon || '📚',
        warna: modalWarna || '#1e40af',
        bgLight: '#f8fafc',
        deskripsi: modalDeskripsi.trim(),
      };
      updatedList.push(newJur);
      updatedProg.push([cleanSingkat, modalRombel]);

      addToast({
        type: 'success',
        title: 'Jurusan Baru Ditambahkan',
        message: `Program keahlian [${cleanKode}] ${cleanSingkat} berhasil didaftarkan.`,
      });
    }

    setJurusanList(updatedList);
    setProgList(updatedProg);
    await saveStoredJurusan(updatedList, updatedProg);
    setIsModalOpen(false);
  };

  // Delete Jurusan
  const handleDeleteJurusan = (index: number) => {
    setDeletingIndex(index);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteJurusan = async () => {
    if (deletingIndex === null) return;
    const item = jurusanList[deletingIndex];
    if (!item) return;

    const updatedList = jurusanList.filter((_, idx) => idx !== deletingIndex);
    const updatedProg = progList.filter(
      (p) =>
        p[0].toUpperCase() !== item.internalCode?.toUpperCase() &&
        p[0].toUpperCase() !== item.singkat?.toUpperCase() &&
        p[0].toUpperCase() !== item.kode?.toUpperCase()
    );

    setJurusanList(updatedList);
    setProgList(updatedProg);
    await saveStoredJurusan(updatedList, updatedProg);

    setIsDeleteConfirmOpen(false);
    setIsModalOpen(false);
    setDeletingIndex(null);

    addToast({
      type: 'info',
      title: 'Jurusan Dihapus',
      message: `Program keahlian [${item.kode}] ${item.singkat} telah dihapus.`,
    });
  };

  // Reset to Default J1..J8
  const handleResetToDefault = async () => {
    setJurusanList(JSON.parse(JSON.stringify(DEFAULT_JURUSAN_LIST)));
    setProgList(JSON.parse(JSON.stringify(DEFAULT_PROG)));
    await saveStoredJurusan(DEFAULT_JURUSAN_LIST, DEFAULT_PROG);
    setIsResetConfirmOpen(false);

    addToast({
      type: 'success',
      title: 'Format Standar Dipulihkan',
      message: 'Daftar jurusan berhasil dikembalikan ke standar resmi J1 s/d J8 (8 Jurusan SMK).',
    });
  };

  const firstKode = jurusanList[0]?.kode || 'J1';
  const lastKode = jurusanList[jurusanList.length - 1]?.kode || `J${jurusanList.length}`;

  return (
    <div className="w-full h-full flex flex-col min-h-0 space-y-4 font-sans select-none overflow-y-auto pb-12">
      {/* 1. KARTU BLUE MOCKUP BESAR (Persis Tampilan http://localhost/jadwalsmk/#jurusan) */}
      <div className="mockup-card-blue">
        {/* Title & Subtitle */}
        <h2 className="mockup-title">
          MENU JURUSAN: {jurusanList.length} PROGRAM KEAHLIAN SMK
        </h2>
        <p className="text-center text-xs md:text-sm -mt-3 mb-4 opacity-95">
          Master Program Keahlian ({firstKode} s/d {lastKode}) &bull; Manajemen Rombel (X, XI, XII) &bull; Beban Jam Kejuruan &bull; Hubungan Guru Produktif &bull; Sistem Blok
        </p>

        {/* 2. KPI Summary Cards (4 Cards Grid) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
          <div className="bg-white/10 p-2.5 md:p-3.5 rounded border border-white/25 text-center">
            <div className="text-[11px] uppercase font-bold opacity-90 tracking-wider">
              Program Keahlian
            </div>
            <div className="text-xl md:text-2xl font-black mt-0.5">
              {jurusanList.length} Jurusan
            </div>
          </div>

          <div className="bg-white/10 p-2.5 md:p-3.5 rounded border border-white/25 text-center">
            <div className="text-[11px] uppercase font-bold opacity-90 tracking-wider">
              Kapasitas per Tingkat
            </div>
            <div className="text-xl md:text-2xl font-black text-blue-200 mt-0.5">
              {totalRombelPerTingkat} Rombel
            </div>
          </div>

          <div className="bg-white/10 p-2.5 md:p-3.5 rounded border border-white/25 text-center">
            <div className="text-[11px] uppercase font-bold opacity-90 tracking-wider">
              Total Rombel Sekolah
            </div>
            <div className="text-xl md:text-2xl font-black text-emerald-200 mt-0.5">
              {totalRombelSekolah} Kelas
            </div>
          </div>

          <div className="bg-white/10 p-2.5 md:p-3.5 rounded border border-white/25 text-center">
            <div className="text-[11px] uppercase font-bold opacity-90 tracking-wider">
              Guru Produktif (P)
            </div>
            <div className="text-xl md:text-2xl font-black text-yellow-200 mt-0.5">
              {totalGuruProduktif} Tenaga Pendidik
            </div>
          </div>
        </div>

        {/* 3. Search & Action Toolbar */}
        <div className="flex flex-wrap gap-2.5 justify-between items-center mb-4 bg-black/20 p-2.5 md:p-3 rounded border border-white/25">
          <div className="flex-1 min-w-[260px]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                className="w-full bg-white text-slate-900 text-xs md:text-sm pl-9 pr-3 py-1.5 h-9 rounded border-[1.5px] border-black focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-500 font-medium"
                placeholder="🔍 Cari jurusan (kode J1..J8, singkatan, nama program, bidang)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3.5 py-1.5 text-xs font-extrabold bg-[#10b981] hover:bg-[#059669] border border-[#059669] text-white rounded shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jurusan</span>
            </button>

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white border border-white/70 hover:bg-white/10 rounded transition-all flex items-center gap-1.5 cursor-pointer"
              title="Kembalikan tabel ke format standar resmi J1 s/d J8"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Format J1-J8</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMenu(3)}
              className="px-3 py-1.5 text-xs font-semibold text-white border border-white/50 hover:bg-white/10 rounded transition-all flex items-center gap-1.5 cursor-pointer"
              title="Buka Matriks SK (Menu 3)"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Buka Matriks SK</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMenu(10)}
              className="px-3 py-1.5 text-xs font-semibold bg-[#2563eb] hover:bg-[#1d4ed8] border border-[#1d4ed8] text-white rounded transition-all flex items-center gap-1.5 cursor-pointer shadow"
              title="Jadwal Per Jurusan (Menu 10)"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Jadwal Per Jurusan</span>
            </button>
          </div>
        </div>

        {/* 4. TABEL MASTER PROGRAM KEAHLIAN (JURUSAN SMK) */}
        <div className="flex justify-between items-center mb-2 text-white">
          <h3 className="text-sm md:text-base font-extrabold flex items-center gap-2">
            <span>🏛️ TABEL MASTER PROGRAM KEAHLIAN (JURUSAN SMK)</span>
          </h3>
          <span className="text-xs opacity-90 font-medium">
            Total {filteredList.length} Program Keahlian
          </span>
        </div>

        <div className="overflow-x-auto bg-white border-2 border-black mb-6 shadow-sm">
          <table className="mockup-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>NO</th>
                <th style={{ width: '75px', textAlign: 'center' }}>KODE</th>
                <th style={{ textAlign: 'left' }}>JURUSAN</th>
                <th style={{ width: '90px', textAlign: 'center' }}>SINGKAT</th>
                <th style={{ textAlign: 'left' }}>BIDANG KEAHLIAN</th>
                <th style={{ width: '140px', textAlign: 'center' }}>ROMBEL / TINGKAT</th>
                <th style={{ width: '95px', textAlign: 'center' }}>TOTAL KELAS</th>
                <th style={{ width: '105px', textAlign: 'center' }}>GURU TERKAIT</th>
                <th style={{ width: '190px', textAlign: 'center' }}>AKSI &amp; KONFIGURASI</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-slate-500 font-semibold text-xs">
                    Tidak ada jurusan yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredList.map((j) => (
                  <tr key={j.kode}>
                    {/* NO */}
                    <td className="font-extrabold text-center text-slate-900">
                      {j.no}
                    </td>

                    {/* KODE */}
                    <td className="text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-white font-black text-xs tracking-wide shadow-sm"
                        style={{ backgroundColor: j.warna || '#1e40af' }}
                      >
                        {j.kode}
                      </span>
                    </td>

                    {/* JURUSAN */}
                    <td className="font-bold text-xs md:text-sm">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl shrink-0">{j.icon || '📚'}</span>
                        <div>
                          <div className="text-slate-900 font-extrabold">{j.nama}</div>
                          <div className="text-[11px] font-normal text-slate-500 leading-tight">
                            {j.deskripsi || '-'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* SINGKAT */}
                    <td className="text-center">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded-full font-black text-xs border"
                        style={{
                          backgroundColor: j.bgLight || '#eff6ff',
                          color: j.warna || '#1e40af',
                          borderColor: j.warna || '#1e40af',
                        }}
                      >
                        {j.singkat}
                      </span>
                    </td>

                    {/* BIDANG KEAHLIAN */}
                    <td className="text-xs text-slate-700 font-semibold">
                      {j.bidang || '-'}
                    </td>

                    {/* ROMBEL / TINGKAT (STEPPER) */}
                    <td className="text-center">
                      <div className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-1 rounded border border-slate-300">
                        <button
                          type="button"
                          className="w-5 h-5 flex items-center justify-center font-black text-xs border border-black bg-white rounded hover:bg-slate-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          onClick={() => handleChangeRombel(j.originalIndex, -1)}
                          disabled={j.rombelCount <= 1}
                          title="Kurangi rombel"
                        >
                          -
                        </button>
                        <span className="min-w-[55px] text-center font-black text-xs text-slate-900">
                          {j.rombelCount} Rombel
                        </span>
                        <button
                          type="button"
                          className="w-5 h-5 flex items-center justify-center font-black text-xs border border-black bg-white rounded hover:bg-slate-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          onClick={() => handleChangeRombel(j.originalIndex, 1)}
                          disabled={j.rombelCount >= 6}
                          title="Tambah rombel"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* TOTAL KELAS */}
                    <td className="text-center font-black text-xs md:text-sm text-blue-700">
                      {j.totalKelas} Kelas
                    </td>

                    {/* GURU TERKAIT */}
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterGuruJurusan(j.singkat || j.internalCode);
                          setActiveMenu(6);
                        }}
                        className="px-2 py-0.5 text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                        title={`Lihat guru kejuruan ${j.singkat}`}
                      >
                        👥 {j.teacherCount} Guru
                      </button>
                    </td>

                    {/* AKSI & KONFIGURASI */}
                    <td className="text-center">
                      <div className="flex gap-1.5 justify-center flex-wrap">
                        <button
                          type="button"
                          className="px-2.5 py-1 text-[11px] font-bold bg-[#3b82f6] hover:bg-blue-600 text-white rounded transition-colors flex items-center gap-1 cursor-pointer"
                          onClick={() => handleOpenEditModal(j.originalIndex)}
                          title={`Konfigurasikan program keahlian ${j.kode}`}
                        >
                          <Settings className="w-3 h-3" />
                          <span>Konfigurasi</span>
                        </button>

                        <button
                          type="button"
                          className="px-2.5 py-1 text-[11px] font-bold text-white rounded transition-colors flex items-center gap-1 cursor-pointer"
                          style={{ backgroundColor: j.warna || '#1e40af' }}
                          onClick={() => setActiveMenu(10)}
                          title={`Lihat jadwal pelajaran ${j.kode}`}
                        >
                          <Calendar className="w-3 h-3" />
                          <span>Jadwal</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 5. KARTU DETAIL PROGRAM KEAHLIAN & STRUKTUR KELAS RESMI */}
        <h3 className="text-sm md:text-base font-extrabold mb-2.5 text-white flex items-center gap-2">
          <span>🗂️ KARTU DETAIL PROGRAM KEAHLIAN &amp; STRUKTUR KELAS RESMI</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-2">
          {filteredList.map((j) => (
            <div
              key={j.kode}
              className="bg-white border-2 border-black rounded p-3.5 text-slate-900 flex flex-col justify-between shadow-md"
            >
              <div>
                {/* Header Card */}
                <div className="flex justify-between items-start mb-2.5 border-b-2 border-slate-200 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl shrink-0">{j.icon || '📚'}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-white font-black text-[11px] px-1.5 py-0.5 rounded tracking-wide shadow-sm"
                          style={{ backgroundColor: j.warna || '#1e40af' }}
                        >
                          {j.kode}
                        </span>
                        <span
                          className="text-[11px] px-1.5 py-0.5 rounded-full font-black border"
                          style={{
                            backgroundColor: j.bgLight || '#eff6ff',
                            color: j.warna || '#1e40af',
                            borderColor: j.warna || '#1e40af',
                          }}
                        >
                          {j.singkat}
                        </span>
                      </div>
                      <div className="text-xs md:text-sm font-extrabold text-slate-900 mt-1 line-clamp-1">
                        {j.nama}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 text-right shrink-0">
                    {j.bidang || '-'}
                  </span>
                </div>

                {/* Deskripsi */}
                <p className="text-[11px] text-slate-600 mb-2.5 line-clamp-2 leading-relaxed">
                  {j.deskripsi || '-'}
                </p>

                {/* Rombel Stepper & Count */}
                <div className="bg-slate-50 border border-slate-300 rounded p-2 mb-2.5 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] uppercase font-extrabold text-slate-500">
                      Kapasitas Rombel
                    </div>
                    <div className="text-xs font-black text-slate-900">
                      {j.rombelCount} Rombel / Tingkat &bull;{' '}
                      <span className="text-blue-600">Total: {j.totalKelas} Kelas</span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      className="w-6 h-6 flex items-center justify-center font-black text-sm border-2 border-black bg-white rounded hover:bg-slate-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      onClick={() => handleChangeRombel(j.originalIndex, -1)}
                      disabled={j.rombelCount <= 1}
                      title="Kurangi rombel"
                    >
                      -
                    </button>
                    <span className="min-w-[20px] text-center font-black text-sm">
                      {j.rombelCount}
                    </span>
                    <button
                      type="button"
                      className="w-6 h-6 flex items-center justify-center font-black text-sm border-2 border-black bg-white rounded hover:bg-slate-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      onClick={() => handleChangeRombel(j.originalIndex, 1)}
                      disabled={j.rombelCount >= 6}
                      title="Tambah rombel"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Daftar Rombel Generated */}
                <div className="mb-3 space-y-1">
                  <div className="text-[10px] uppercase font-extrabold text-slate-600">
                    Daftar Kelas Resmi ({j.totalKelas} Rombel):
                  </div>

                  {/* Kelas X */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold w-11 text-blue-700">
                      Kelas X:
                    </span>
                    {j.kelasX.map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setActiveMenu(11)}
                        className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 cursor-pointer"
                        title={`Buka jadwal ${cls}`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>

                  {/* Kelas XI */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold w-11 text-emerald-700">
                      Kelas XI:
                    </span>
                    {j.kelasXI.map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setActiveMenu(11)}
                        className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer"
                        title={`Buka jadwal ${cls}`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>

                  {/* Kelas XII */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold w-11 text-amber-700">
                      Kelas XII:
                    </span>
                    {j.kelasXII.map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setActiveMenu(11)}
                        className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 cursor-pointer"
                        title={`Buka jadwal ${cls}`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Card Actions */}
              <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center gap-1 mt-1">
                <span className="text-[11px] text-slate-600 font-bold">
                  👥 {j.teacherCount} Guru Kejuruan
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(j.originalIndex)}
                    className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded cursor-pointer"
                    title={`Konfigurasikan jurusan ${j.kode}`}
                  >
                    ⚙️ Konfigurasi
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilterGuruJurusan(j.singkat || j.internalCode);
                      setActiveMenu(6);
                    }}
                    className="px-2 py-1 text-[11px] font-bold border border-black bg-white hover:bg-slate-100 text-black rounded cursor-pointer"
                    title={`Lihat guru kejuruan ${j.kode}`}
                  >
                    👥 Guru
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMenu(10)}
                    className="px-2 py-1 text-[11px] font-bold text-white rounded cursor-pointer"
                    style={{ backgroundColor: j.warna || '#1e40af' }}
                    title={`Lihat jadwal pelajaran ${j.kode}`}
                  >
                    📅 Jadwal
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. MODAL KONFIGURASI / TAMBAH JURUSAN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-lg max-w-xl w-full p-5 shadow-2xl border-2 border-slate-900 text-slate-900 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-base font-extrabold flex items-center gap-2 text-slate-900">
                {editingIndex !== null ? (
                  <>
                    <span>⚙️ Konfigurasi Jurusan:</span>
                    <span className="text-blue-600">
                      [{modalKode}] {modalSingkat}
                    </span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-emerald-600" />
                    <span>Tambah Jurusan Baru</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveModal} className="flex-1 overflow-y-auto py-3 space-y-3.5">
              {/* Baris 1: No Urut & Kode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor Urut (NO)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={modalNo}
                    onChange={(e) => setModalNo(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Nomor urutan pada tabel master resmi.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kode Jurusan (KODE)
                  </label>
                  <input
                    type="text"
                    value={modalKode}
                    onChange={(e) => setModalKode(e.target.value.toUpperCase())}
                    placeholder="Misal: J1, J2, J8..."
                    required
                    className="w-full px-3 py-1.5 text-xs font-extrabold uppercase border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Kode program keahlian (J1 s/d J8).
                  </span>
                </div>
              </div>

              {/* Baris 2: Nama & Singkatan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Jurusan (JURUSAN)
                  </label>
                  <input
                    type="text"
                    value={modalNama}
                    onChange={(e) => setModalNama(e.target.value.toUpperCase())}
                    placeholder="Contoh: AKUNTANSI, KULINER..."
                    required
                    className="w-full px-3 py-1.5 text-xs font-bold uppercase border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Nama lengkap resmi program keahlian.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Singkatan Resmi (SINGKAT)
                  </label>
                  <input
                    type="text"
                    value={modalSingkat}
                    onChange={(e) => setModalSingkat(e.target.value.toUpperCase())}
                    placeholder="Contoh: AK, TKR, KUL, DPB, LAS..."
                    required
                    className="w-full px-3 py-1.5 text-xs font-extrabold uppercase border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Kode singkatan resmi (misal: KUL, DPB, LAS).
                  </span>
                </div>
              </div>

              {/* Baris 3: Bidang Keahlian & Kapasitas Rombel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bidang Keahlian
                  </label>
                  <select
                    value={modalBidang}
                    onChange={(e) => setModalBidang(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Bisnis dan Manajemen">Bisnis dan Manajemen</option>
                    <option value="Teknologi Manufaktur & Rekayasa">Teknologi Manufaktur &amp; Rekayasa</option>
                    <option value="Teknologi Informasi & Komunikasi">Teknologi Informasi &amp; Komunikasi</option>
                    <option value="Seni dan Ekonomi Kreatif">Seni dan Ekonomi Kreatif</option>
                    <option value="Pariwisata">Pariwisata</option>
                    <option value="Agribisnis dan Agriteknologi">Agribisnis dan Agriteknologi</option>
                    <option value="Kesehatan dan Pekerjaan Sosial">Kesehatan dan Pekerjaan Sosial</option>
                    <option value="Kemaritiman">Kemaritiman</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kapasitas Rombel / Tingkat
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={modalRombel}
                      onChange={(e) => setModalRombel(parseInt(e.target.value) || 1)}
                      className="w-20 px-2 py-1 text-sm font-black text-center border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-500 font-semibold">
                      Total: {modalRombel * 3} Kelas
                    </span>
                  </div>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Total kelas sekolah = Rombel × 3 (X, XI, XII).
                  </span>
                </div>
              </div>

              {/* Baris 4: Ikon Emoji & Warna Tema */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ikon Emoji
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={modalIcon}
                      onChange={(e) => setModalIcon(e.target.value)}
                      className="w-12 h-9 text-xl text-center border border-slate-300 rounded shrink-0"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {COMMON_EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setModalIcon(em)}
                          className={`w-7 h-7 flex items-center justify-center text-sm border rounded hover:bg-slate-100 cursor-pointer ${
                            modalIcon === em ? 'border-blue-600 bg-blue-50' : 'border-slate-300'
                          }`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Warna Tema
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={modalWarna}
                      onChange={(e) => setModalWarna(e.target.value)}
                      className="w-10 h-8 p-0.5 border border-slate-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={modalWarna}
                      onChange={(e) => setModalWarna(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs font-mono font-bold border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Baris 5: Deskripsi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deskripsi Program Keahlian
                </label>
                <textarea
                  value={modalDeskripsi}
                  onChange={(e) => setModalDeskripsi(e.target.value)}
                  rows={2}
                  placeholder="Tuliskan fokus kompetensi keahlian..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Integrasi Info */}
              <div className="bg-blue-50 p-2.5 rounded border border-blue-200 text-[11px] text-blue-900 leading-normal flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Integrasi Jadwal:</strong> Mengubah kapasitas rombel atau nama jurusan akan otomatis terhubung dengan rombel kelas, jadwal blok mingguan, dan guru pengampu.
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <div>
                  {editingIndex !== null && editingIndex >= 8 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteJurusan(editingIndex)}
                      className="px-3 py-1.5 text-xs font-bold text-rose-600 border border-rose-300 rounded hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Jurusan</span>
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-1.5 text-xs font-semibold border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold bg-[#2563eb] hover:bg-blue-700 text-white rounded shadow transition-all cursor-pointer"
                  >
                    💾 {editingIndex !== null ? 'Simpan Konfigurasi' : 'Tambahkan Jurusan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. CONFIRM RESET DIALOG */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        title="Reset Format Standar J1-J8"
        message="Kembalikan daftar jurusan ke format standar resmi J1 s/d J8 sesuai tabel kurikulum resmi SMK? Perubahan kapasitas rombel kustom akan dikembalikan ke pengaturan default."
        confirmLabel="Ya, Reset Format"
        variant="warning"
        onConfirm={handleResetToDefault}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* 8. CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title="Hapus Program Keahlian"
        message={`Apakah Anda yakin ingin menghapus program keahlian ini? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Jurusan"
        variant="danger"
        onConfirm={confirmDeleteJurusan}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
};

export default JurusanView;
