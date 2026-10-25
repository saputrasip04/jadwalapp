// src/features/06-guru/GuruView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useToastStore } from '../../ui/Toast';
import { useAppStore } from '../../app/store';
import {
  SK_TEACHERS_DEFAULT,
  getStoredJurusanList,
  JurusanItem,
  DEFAULT_JURUSAN_LIST,
  normTeacherName,
  DaftarMapelKodeItem,
} from '../../domain/curriculum-data';
import {
  getStoredMatrixGrid,
  getStoredMapelList,
  MatrixGridStorage,
  isSameTeacher,
} from '../../domain/sync-mapel-matrix';
import { ROMBELS_48 } from '../03-matrix-sk/MatrixSKView';
import { Search, Clock, X, Calendar } from 'lucide-react';
import { Hari, BlokNo } from '../../domain/types';
import { NAMA_HARI } from '../../domain/constants';
import { ulid } from 'ulid';

export interface TeacherJurusanRow {
  id: string;
  kode: string;
  nama: string;
  mapel: string;
  totalJp: number;
  jurusans: string[];
  rombels: string[];
  isProduktif: boolean;
}

function normalizeJurusanCode(code: string): string {
  const c = (code || '').toUpperCase().trim();
  if (c === 'KULINER') return 'KUL';
  if (c === 'FASHION' || c === 'BUSANA') return 'DPB';
  return c;
}

function isJurusanMatch(j1: string, j2: string): boolean {
  if (!j1 || !j2) return false;
  const n1 = normalizeJurusanCode(j1);
  const n2 = normalizeJurusanCode(j2);
  return n1 === n2;
}

function isRombelOfJurusan(rombelName: string, jurCode: string): boolean {
  if (!rombelName || !jurCode) return false;
  const normJur = normalizeJurusanCode(jurCode);
  const rObj = ROMBELS_48.find((r) => r.nama === rombelName || r.id === rombelName);
  if (rObj) {
    return normalizeJurusanCode(rObj.jurusanKode) === normJur;
  }
  const rU = rombelName.toUpperCase();
  if (normJur === 'AK' && (rU.includes(' AK ') || rU.endsWith(' AK') || rU.includes('AKUNTANSI'))) return true;
  if (normJur === 'TKR' && rU.includes('TKR')) return true;
  if (normJur === 'TKJ' && rU.includes('TKJ')) return true;
  if (normJur === 'PSPT' && rU.includes('PSPT')) return true;
  if (normJur === 'KUL' && (rU.includes('KUL') || rU.includes('BOGA') || rU.includes('KULINER'))) return true;
  if (normJur === 'DPB' && (rU.includes('DPB') || rU.includes('FASHION') || rU.includes('BUSANA'))) return true;
  if (normJur === 'LAS' && rU.includes('LAS')) return true;
  if (normJur === 'APAT' && rU.includes('APAT')) return true;
  return false;
}

export const GuruView: React.FC = () => {
  const { addToast } = useToastStore();
  const {
    filterGuruJurusan,
    setFilterGuruJurusan,
    setSelectedGuruIdForSchedule,
    setActiveMenu,
  } = useAppStore();

  // 1. Data Sumber Primer
  const dbGuruList = useLiveQuery(() => db.guru.toArray()) ?? [];
  const kelasList = useLiveQuery(() => db.kelas.toArray()) ?? [];
  const mapelKelasList = useLiveQuery(() => db.mapel_kelas.toArray()) ?? [];
  const pengampuList = useLiveQuery(() => db.pengampu.toArray()) ?? [];
  const ketersediaanList = useLiveQuery(() => db.guru_ketersediaan.toArray()) ?? [];

  // State Eksternal Terstruktur
  const [jurList, setJurList] = useState<JurusanItem[]>(DEFAULT_JURUSAN_LIST);
  const [matrixGrid, setMatrixGrid] = useState<MatrixGridStorage>({
    gridData: {},
    teacherMapels: {},
    updated_at: new Date().toISOString(),
  });
  const [storedMapels, setStoredMapels] = useState<DaftarMapelKodeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // State Filter & Search Sesuai http://localhost/jadwalsmk/#guru_jurusan
  const [selJurusan, setSelJurusan] = useState<string>(filterGuruJurusan || 'ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Ketersediaan Guru (Fitur Tambahan Terintegrasi)
  const [showKetersediaanModal, setShowKetersediaanModal] = useState(false);
  const [selectedGuruIdKetersediaan, setSelectedGuruIdKetersediaan] = useState<string>('');
  const [selectedBlokKetersediaan, setSelectedBlokKetersediaan] = useState<BlokNo>(1);

  // Sinkronisasi filter jika berubah dari luar (misal dari menu Jurusan)
  useEffect(() => {
    if (filterGuruJurusan && filterGuruJurusan !== selJurusan) {
      setSelJurusan(filterGuruJurusan);
    }
  }, [filterGuruJurusan]);

  // Load Jurusan, Matrix SK Grid, & Daftar Mapel
  useEffect(() => {
    async function loadAllData() {
      try {
        const [jList, mGrid, sMapels] = await Promise.all([
          getStoredJurusanList(),
          getStoredMatrixGrid(),
          getStoredMapelList(),
        ]);
        if (jList && jList.length > 0) setJurList(jList);
        if (mGrid) setMatrixGrid(mGrid);
        if (sMapels) setStoredMapels(sMapels);
      } catch (err) {
        console.error('Failed to load curriculum/matrix data for GuruView:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, []);

  // Merge Data Guru: Dari db.guru (jika ada) dan fallback ke SK_TEACHERS_DEFAULT
  const allTeachers = useMemo(() => {
    if (dbGuruList && dbGuruList.length > 0) {
      return dbGuruList
        .filter((g) => g.aktif !== 0)
        .map((g, idx) => ({
          id: g.id,
          kode: g.kode || String(idx + 1),
          nama: g.nama,
          tipe: (g.tipe_guru === 'PRODUKTIF' ? 'P' : 'R') as 'R' | 'P',
          sk_guru: g.sk_guru || '',
          setting_jp: Number(g.setting_jp) || 0,
        }));
    }
    return SK_TEACHERS_DEFAULT.map((t) => ({
      id: String(t.id),
      kode: t.kode,
      nama: t.nama,
      tipe: t.tipe,
      sk_guru: t.mapelUtama || '',
      setting_jp: Number(t.bebanJp) || 0,
    }));
  }, [dbGuruList]);

  // Bangun Program Filter Tabs Sesuai http://localhost/jadwalsmk/#guru_jurusan
  const programs = useMemo(() => {
    return [
      { code: 'ALL', label: 'SEMUA JURUSAN' },
      ...jurList.map((j) => ({
        code: normalizeJurusanCode(j.singkat || j.internalCode),
        label: `[${j.kode}] ${j.singkat}`,
      })),
      { code: 'UMUM', label: 'UMUM (R)' },
    ];
  }, [jurList]);

  // Matriks Utama: Menghitung rombel diajar, jurusan terlibat, dan total JP
  const teacherRows = useMemo(() => {
    return allTeachers.map((t) => {
      const rombelSet = new Set<string>();
      const jurSet = new Set<string>();
      let computedJp = 0;

      // 1. Cek dari skT (SK_TEACHERS_DEFAULT)
      const skT = SK_TEACHERS_DEFAULT.find(
        (x) => isSameTeacher(x.nama, t.nama) || String(x.kode) === String(t.kode)
      );

      if (skT && Array.isArray(skT.items)) {
        skT.items.forEach((it) => {
          if (Array.isArray(it.cols)) {
            it.cols.forEach((colIdx) => {
              const rObj = ROMBELS_48[colIdx - 1];
              if (rObj) {
                rombelSet.add(rObj.nama);
                jurSet.add(normalizeJurusanCode(rObj.jurusanKode));
              }
            });
            computedJp += (Number(it.jp) || 0) * (it.cols.length || 0);
          }
        });
      }

      // 2. Cek dari matrix_sk_grid (Menu 3)
      const gGrid =
        matrixGrid.gridData[t.id] ||
        matrixGrid.gridData[t.kode] ||
        (skT ? matrixGrid.gridData[String(skT.id)] : undefined);

      if (gGrid && typeof gGrid === 'object') {
        Object.entries(gGrid).forEach(([colKey, cell]) => {
          if (!cell) return;
          const rObj =
            ROMBELS_48.find((r) => r.id === colKey || r.nama === colKey) ||
            (!isNaN(Number(colKey)) ? ROMBELS_48[Number(colKey) - 1] : undefined);
          if (rObj) {
            rombelSet.add(rObj.nama);
            jurSet.add(normalizeJurusanCode(rObj.jurusanKode));
          }
          const cellJp =
            Number(cell.jp) ||
            (cell.items ? cell.items.reduce((sum, it) => sum + (Number(it.jp) || 0), 0) : 0);
          if (cellJp > 0) computedJp += cellJp;
        });
      }

      // 3. Cek dari db.pengampu & db.mapel_kelas
      const assigned = pengampuList.filter((p) => p.guru_id === t.id);
      assigned.forEach((p) => {
        const mk = mapelKelasList.find((m) => m.id === p.mapel_kelas_id);
        const kls = kelasList.find((k) => k.id === mk?.kelas_id);
        if (kls) {
          rombelSet.add(kls.nama);
          const rObj = ROMBELS_48.find((r) => r.nama === kls.nama);
          if (rObj) {
            jurSet.add(normalizeJurusanCode(rObj.jurusanKode));
          } else {
            jurList.forEach((j) => {
              if (kls.nama.includes(j.singkat) || kls.nama.includes(j.kode)) {
                jurSet.add(normalizeJurusanCode(j.singkat));
              }
            });
          }
          computedJp += mk ? Number(mk.jp_blok1) || 0 : 0;
        }
      });

      // 4. Cek dari storedMapels (Daftar Mapel & Kode)
      storedMapels.forEach((m) => {
        const isAssigned =
          (m.guru && (isSameTeacher(m.guru, t.nama) || m.guru.includes(t.nama))) ||
          (m.guruJp &&
            (m.guruJp[t.nama] || Object.keys(m.guruJp).some((k) => isSameTeacher(k, t.nama))));
        if (isAssigned && m.kategori && m.kategori !== 'UMUM') {
          jurSet.add(normalizeJurusanCode(m.kategori));
        }
      });

      // 5. Cek tMapel / sk_guru / mapelUtama
      const tMapel = (t.sk_guru || skT?.mapelUtama || '').trim();
      const mUpper = tMapel.toUpperCase();
      jurList.forEach((j) => {
        const sUpper = j.singkat.toUpperCase();
        const nUpper = j.nama.toUpperCase();
        const iUpper = (j.internalCode || '').toUpperCase();
        if (mUpper.includes(sUpper) || (iUpper && mUpper.includes(iUpper)) || mUpper.includes(nUpper)) {
          jurSet.add(normalizeJurusanCode(j.singkat));
        }
      });

      // Jika belum terasosiasi kejuruan spesifik, tandai UMUM
      if (jurSet.size === 0) {
        jurSet.add('UMUM');
      }

      // Total JP Final
      let finalJp = computedJp;
      if (finalJp === 0) {
        finalJp = Number(t.setting_jp || skT?.bebanJp || skT?.total || 0);
      }

      // Urutkan rombels sesuai urutan resmi ROMBELS_48
      const sortedRombels = Array.from(rombelSet).sort((a, b) => {
        const idxA = ROMBELS_48.findIndex((r) => r.nama === a);
        const idxB = ROMBELS_48.findIndex((r) => r.nama === b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return a.localeCompare(b);
      });

      // Urutkan jurusans (Kejuruan dahulu, UMUM di akhir)
      const sortedJurusans = Array.from(jurSet).sort((a, b) => {
        if (a === 'UMUM') return 1;
        if (b === 'UMUM') return -1;
        return a.localeCompare(b);
      });

      const isProduktif =
        t.tipe === 'P' ||
        tMapel.toLowerCase().includes('produktif') ||
        sortedJurusans.some((j) => j !== 'UMUM');

      return {
        id: t.id,
        kode: t.kode,
        nama: t.nama,
        mapel: tMapel || 'GURU MATA PELAJARAN',
        totalJp: finalJp,
        jurusans: sortedJurusans,
        rombels: sortedRombels,
        isProduktif,
      };
    });
  }, [allTeachers, matrixGrid, storedMapels, jurList, pengampuList, mapelKelasList, kelasList]);

  // Filter Berdasarkan Tab Jurusan dan Pencarian
  const filteredList = useMemo(() => {
    let result = teacherRows;

    // Filter Jurusan: Selain produktif, tampilkan semua guru yang mengajar di jurusan tertentu
    if (selJurusan !== 'ALL') {
      if (selJurusan === 'UMUM') {
        result = result.filter(
          (t) =>
            !t.mapel.toLowerCase().includes('produktif') ||
            t.jurusans.includes('UMUM') ||
            !t.isProduktif
        );
      } else {
        result = result.filter(
          (t) =>
            t.jurusans.some((j) => isJurusanMatch(j, selJurusan)) ||
            t.rombels.some((r) => isRombelOfJurusan(r, selJurusan)) ||
            t.mapel.toUpperCase().includes(selJurusan)
        );
      }
    }

    // Filter Kata Kunci Pencarian
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.nama.toLowerCase().includes(q) ||
          String(t.kode).toLowerCase().includes(q) ||
          t.mapel.toLowerCase().includes(q) ||
          t.rombels.some((r) => r.toLowerCase().includes(q)) ||
          t.jurusans.some((j) => j.toLowerCase().includes(q))
      );
    }

    return result;
  }, [teacherRows, selJurusan, searchQuery]);

  // Klik baris guru -> Buka Jadwal Guru (Menu 12)
  const handleTeacherClick = (t: TeacherJurusanRow) => {
    setSelectedGuruIdForSchedule(t.id);
    setActiveMenu(12);
  };

  // Toggle Ketersediaan Slot Guru
  const handleToggleKetersediaan = async (hari: Hari, jp: number) => {
    if (!selectedGuruIdKetersediaan) return;

    const existing = ketersediaanList.find(
      (k) =>
        k.guru_id === selectedGuruIdKetersediaan &&
        k.blok_no === selectedBlokKetersediaan &&
        k.hari === hari &&
        k.jp_ke === jp
    );

    if (!existing) {
      await db.guru_ketersediaan.put({
        id: ulid(),
        guru_id: selectedGuruIdKetersediaan,
        blok_no: selectedBlokKetersediaan,
        hari,
        jp_ke: jp,
        status: 'TIDAK_BISA',
      });
    } else if (existing.status === 'TIDAK_BISA') {
      await db.guru_ketersediaan.update(existing.id, { status: 'HINDARI' });
    } else {
      await db.guru_ketersediaan.delete(existing.id);
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 font-sans select-none overflow-y-auto pb-6">
      {/* CARD BIRU RESMI MOCKUP SMK (Sesuaikan persis dengan http://localhost/jadwalsmk/#guru_jurusan) */}
      <div className="mockup-card-blue flex flex-col flex-1 min-h-[620px] shadow-lg">
        {/* JUDUL RESMI MOCKUP */}
        <div className="flex justify-between items-center relative mb-5">
          <div className="w-24 hidden sm:block" />
          <h2 className="mockup-title flex-1 text-center m-0">DAFTAR GURU DAN JURUSAN KELAS</h2>
          <div className="w-auto flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (allTeachers.length > 0 && !selectedGuruIdKetersediaan) {
                  setSelectedGuruIdKetersediaan(allTeachers[0]!.id);
                }
                setShowKetersediaanModal(true);
              }}
              className="px-2.5 py-1 text-xs font-bold bg-white/20 hover:bg-white/30 text-white rounded border border-white/40 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              title="Atur Ketersediaan Jam Mengajar Guru"
            >
              <Clock className="w-3.5 h-3.5 text-yellow-300" />
              <span className="hidden sm:inline">Ketersediaan Jam</span>
            </button>
          </div>
        </div>

        {/* TAB FILTER JURUSAN (SEMUA JURUSAN, [J1] AK, [J2] TKR, ..., UMUM) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '14px',
            background: 'rgba(0, 0, 0, 0.18)',
            padding: '8px',
            borderRadius: '4px',
            alignItems: 'center',
          }}
        >
          {programs.map((p) => {
            const isActive = selJurusan === p.code;
            return (
              <button
                key={p.code}
                type="button"
                onClick={() => {
                  setSelJurusan(p.code);
                  setFilterGuruJurusan(p.code);
                }}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  color: '#ffffff',
                  borderColor: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                  backgroundColor: isActive ? '#1e40af' : 'transparent',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: '4px',
                  boxShadow: isActive ? '0 2px 6px rgba(0, 0, 0, 0.3)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* SEARCH BAR & COUNTER GURU */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div className="relative flex-1 max-w-[380px]">
            <input
              type="text"
              className="form-control"
              style={{
                background: '#ffffff',
                color: '#000000',
                fontSize: '0.85rem',
                padding: '6px 12px',
                height: '36px',
                border: '1.5px solid #000000',
                borderRadius: '4px',
                width: '100%',
                boxSizing: 'border-box',
              }}
              placeholder="🔍 Filter nama, kode, atau rombel kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#ffffff',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }}
          >
            Menampilkan <strong>{filteredList.length}</strong> Guru
          </div>
        </div>

        {/* TABEL GURU & JURUSAN KELAS MOCKUP RESMI */}
        <div
          style={{
            overflowX: 'auto',
            background: '#ffffff',
            border: '2px solid #000000',
            borderRadius: '2px',
            flex: 1,
            minHeight: '380px',
          }}
        >
          <table className="mockup-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>NO.</th>
                <th style={{ textAlign: 'left' }}>NAMA GURU</th>
                <th style={{ width: '60px', textAlign: 'center' }}>ID</th>
                <th style={{ textAlign: 'left' }}>MATA PELAJARAN</th>
                <th style={{ width: '120px', textAlign: 'center' }}>JURUSAN</th>
                <th style={{ textAlign: 'left' }}>DAFTAR ROMBEL DIAJAR</th>
                <th style={{ width: '85px', textAlign: 'center' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: 'center',
                      padding: '36px',
                      color: '#64748b',
                      fontStyle: 'italic',
                      fontWeight: 600,
                    }}
                  >
                    Tidak ada guru yang ditemukan untuk jurusan atau kata kunci ini.
                  </td>
                </tr>
              ) : (
                filteredList.map((t, idx) => (
                  <tr
                    key={t.id || t.kode}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleTeacherClick(t)}
                    title={`Klik untuk melihat jadwal pengajaran ${t.nama}`}
                  >
                    <td className="col-no">{idx + 1}</td>
                    <td className="col-nama">{t.nama}</td>
                    <td className="col-id">{t.kode}</td>
                    <td className="col-mapel">{t.mapel}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="flex flex-wrap gap-1 justify-center items-center">
                        {t.jurusans.map((j) => (
                          <span
                            key={j}
                            style={{
                              display: 'inline-block',
                              margin: '1px',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              background: '#e0e7ff',
                              color: '#3730a3',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              border: '1px solid #c7d2fe',
                            }}
                          >
                            {j}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
                      <div className="flex flex-wrap gap-1 items-center">
                        {t.rombels.length > 0 ? (
                          t.rombels.map((r) => (
                            <span
                              key={r}
                              style={{
                                display: 'inline-block',
                                margin: '1px 2px',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                fontWeight: 600,
                                fontSize: '0.76rem',
                              }}
                            >
                              {r}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>
                            - Belum ada alokasi rombel -
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        fontWeight: 900,
                        color: '#1e3a8a',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.totalJp} JP
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL KETERSEDIAAN JAM GURU (INTEGRASI FITUR KETERSEDIAAN) */}
      {showKetersediaanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border-2 border-black max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="bg-[#1e3a8a] text-white p-4 flex justify-between items-center border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-300" />
                <h3 className="font-extrabold text-sm md:text-base">
                  Pengaturan Ketersediaan Jam Mengajar Guru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowKetersediaanModal(false)}
                className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Konten Modal */}
            <div className="p-4 overflow-y-auto space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs font-bold text-slate-700 shrink-0">Pilih Guru:</label>
                  <select
                    value={selectedGuruIdKetersediaan}
                    onChange={(e) => setSelectedGuruIdKetersediaan(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-300 rounded p-1.5 bg-white text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {allTeachers.map((g) => (
                      <option key={g.id} value={g.id}>
                        [{g.kode}] {g.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedBlokKetersediaan(1)}
                    className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                      selectedBlokKetersediaan === 1
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Blok 1 (Ganjil)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBlokKetersediaan(2)}
                    className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                      selectedBlokKetersediaan === 2
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Blok 2 (Genap)
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs font-semibold px-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-400" /> Bisa
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-rose-200 border border-rose-400" /> TIDAK BISA (Hard)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-amber-200 border border-amber-400" /> HINDARI (Soft)
                </span>
              </div>

              {/* Grid 10 JP x 5 Hari */}
              <div className="overflow-x-auto border border-slate-300 rounded">
                <table className="w-full text-center border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                      <th className="py-2 px-2 border-r border-slate-300 w-16">JP</th>
                      {([1, 2, 3, 4, 5] as Hari[]).map((h) => (
                        <th key={h} className="py-2 px-2 border-r border-slate-300 last:border-r-0">
                          {NAMA_HARI[h]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((jp) => (
                      <tr key={jp} className="border-b border-slate-200 last:border-b-0">
                        <td className="py-1.5 px-2 font-bold bg-slate-50 border-r border-slate-300 text-slate-600">
                          JP {jp}
                        </td>
                        {([1, 2, 3, 4, 5] as Hari[]).map((hari) => {
                          const item = ketersediaanList.find(
                            (k) =>
                              k.guru_id === selectedGuruIdKetersediaan &&
                              k.blok_no === selectedBlokKetersediaan &&
                              k.hari === hari &&
                              k.jp_ke === jp
                          );

                          let bg = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium';
                          let label = 'BISA';
                          if (item?.status === 'TIDAK_BISA') {
                            bg = 'bg-rose-200 hover:bg-rose-300 text-rose-950 font-bold';
                            label = 'TIDAK BISA';
                          } else if (item?.status === 'HINDARI') {
                            bg = 'bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold';
                            label = 'HINDARI';
                          }

                          return (
                            <td key={hari} className="p-0.5 border-r border-slate-200 last:border-r-0">
                              <button
                                type="button"
                                onClick={() => handleToggleKetersediaan(hari, jp)}
                                className={`w-full py-1.5 rounded text-[11px] transition-colors cursor-pointer ${bg}`}
                                title="Klik untuk mengubah: BISA -> TIDAK BISA -> HINDARI"
                              >
                                {label}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="bg-slate-100 p-3 border-t border-slate-300 flex justify-end">
              <button
                type="button"
                onClick={() => setShowKetersediaanModal(false)}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
