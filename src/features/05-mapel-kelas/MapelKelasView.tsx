// src/features/05-mapel-kelas/MapelKelasView.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useToastStore } from '../../ui/Toast';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { TeacherSearchSelect } from '../../ui/TeacherSearchSelect';
import { useAppStore } from '../../app/store';
import {
  DAFTAR_MAPEL_KODE_DEFAULT,
  DaftarMapelKodeItem,
  SK_TEACHERS_DEFAULT,
  cleanTeacherName,
  findMatchingTeachersForMapel,
  splitTeacherNameAndDegree,
  getMapelRombelAndBebanTotal,
  isDegreeOnly,
  sanitizeMapelGuruData,
} from '../../domain/curriculum-data';
import {
  assignTeacherToMapelAutoSync,
  assignBatchTeachersToMapelAutoSync,
  removeTeacherFromMapelAutoSync,
  resetSingleMapelGuruAutoSync,
  getStoredMapelList,
  getStoredMatrixGrid,
  performFullTwoWaySync,
  MatrixGridStorage,
  MapelBadgeItem,
  isSameTeacher,
  getCellItems,
  cellContainsMapel,
  getCellMapelJp,
  MatrixCellData,
  isMapelProduktif,
  applyTeamTeachingSplitAutoSync,
  getProductiveStandardJp,
  isTeacherCompatibleWithMapel,
} from '../../domain/sync-mapel-matrix';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  RotateCw,
  Lock,
  RefreshCw,
  Zap,
  X,
  Users,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Check,
  Sparkles,
  Maximize,
  Minimize,
} from 'lucide-react';
import { ROMBELS_48, RombelCol, JURUSAN_GROUPS, TeamTeachingTeacherEntry } from '../03-matrix-sk/MatrixSKView';

export const MapelKelasView: React.FC = () => {
  const { addToast } = useToastStore();
  const { setActiveMenu } = useAppStore();

  // Load daftar guru dari database lokal Dexie
  const dbGuruList = useLiveQuery(() => db.guru.toArray()) ?? [];

  // Jika db.guru belum memiliki guru, gunakan daftar guru resmi sekolah SK_TEACHERS_DEFAULT
  const allTeachers = useMemo(() => {
    if (dbGuruList && dbGuruList.length > 0) {
      const list = dbGuruList
        .filter((g) => g.aktif !== 0)
        .map((g, idx) => {
          const skT = SK_TEACHERS_DEFAULT.find(
            (t) => isSameTeacher(t.nama, g.nama) || String(t.kode) === String(g.kode)
          );
          const defaultBeban = Number(g.setting_jp) || Number(skT?.bebanJp) || (g.kode === '1' ? 0 : 28);
          return {
            id: g.id,
            numId: Number(g.kode || g.id) || idx + 1,
            nama: g.nama,
            kode: g.kode || String(idx + 1),
            tipe: (g.tipe_guru === 'PRODUKTIF' ? 'P' : 'R') as 'R' | 'P',
            sk_guru: g.sk_guru || skT?.mapelUtama || '',
            setting_jp: defaultBeban,
          };
        });

      SK_TEACHERS_DEFAULT.forEach((skT) => {
        const exists = list.some((g) => isSameTeacher(g.nama, skT.nama));
        if (!exists) {
          list.push({
            id: `sk_${skT.id}`,
            numId: skT.id,
            nama: skT.nama,
            kode: skT.kode,
            tipe: skT.tipe,
            sk_guru: skT.mapelUtama || '',
            setting_jp: Number(skT.bebanJp) || (skT.kode === '1' ? 0 : 28),
          });
        }
      });

      return list;
    }
    return SK_TEACHERS_DEFAULT.map((t) => ({
      id: String(t.id),
      numId: t.id,
      nama: t.nama,
      kode: t.kode,
      tipe: t.tipe,
      sk_guru: t.mapelUtama || '',
      setting_jp: Number(t.bebanJp) || (t.kode === '1' ? 0 : 28),
    }));
  }, [dbGuruList]);

  // State Daftar Mapel & Grid Matrix
  const [mapelList, setMapelList] = useState<DaftarMapelKodeItem[]>([]);
  const [matrixGrid, setMatrixGrid] = useState<MatrixGridStorage>({
    gridData: {},
    teacherMapels: {},
    updated_at: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);

  // Filter Pane Kiri (Mata Pelajaran)
  const [searchMapel, setSearchMapel] = useState('');
  const [filterTipe, setFilterTipe] = useState<'ALL' | 'R' | 'P'>('ALL');
  const [filterJenjang, setFilterJenjang] = useState<'ALL' | 'X' | 'XI' | 'XII'>('ALL');
  const [filterProgram, setFilterProgram] = useState('ALL');

  // Filter Pane Kanan (Guru)
  const [searchGuru, setSearchGuru] = useState('');
  const [filterGuruStatus, setFilterGuruStatus] = useState('ALL');
  const [sortGuruOrder, setSortGuruOrder] = useState<'asc' | 'desc'>('asc');

  // Modal Tambah Mapel Sederhana
  const [isMapelModalOpen, setIsMapelModalOpen] = useState(false);
  const [editingMapel, setEditingMapel] = useState<DaftarMapelKodeItem | null>(null);
  const [modalNo, setModalNo] = useState<number>(1);
  const [modalKode, setModalKode] = useState('');
  const [modalNama, setModalNama] = useState('');
  const [modalJp, setModalJp] = useState<number>(2);
  const [modalKategori, setModalKategori] = useState('UMUM');
  const [modalTingkat, setModalTingkat] = useState<'X' | 'XI' | 'XII'>('X');

  // Modal Edit Mata Pelajaran & Team Teaching (Sesuai Gambar 2)
  const [teamTeachingModal, setTeamTeachingModal] = useState<{
    isOpen: boolean;
    mapelKode: string;
    mapelNama: string;
    jenis: 'PRODUKTIF' | 'REGULER';
    jenjang: 'X' | 'XI' | 'XII';
    program: string;
    jpPerRombel: number;
    jumlahRombel: number;
    teachers: TeamTeachingTeacherEntry[];
    showAll48: boolean;
    filterOnlySameMapel: boolean;
  }>({
    isOpen: false,
    mapelKode: '',
    mapelNama: '',
    jenis: 'PRODUKTIF',
    jenjang: 'X',
    program: 'PSPT',
    jpPerRombel: 12,
    jumlahRombel: 2,
    teachers: [],
    showAll48: false,
    filterOnlySameMapel: true,
  });

  // Modal Tambah Guru ke Mapel
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  const [selectedMapelForTeacher, setSelectedMapelForTeacher] = useState<DaftarMapelKodeItem | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedTeacherJp, setSelectedTeacherJp] = useState<number>(2);

  // Confirm Dialogs
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmAutoDistributeOpen, setConfirmAutoDistributeOpen] = useState(false);
  const [deletingKode, setDeletingKode] = useState<string | null>(null);

  // Full Screen State & Handlers
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleToggleFullScreen = () => {
    if (!isFullScreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullScreen(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Load data awal dari storage
  const loadData = async () => {
    try {
      const [rawItems, grid] = await Promise.all([
        getStoredMapelList(),
        getStoredMatrixGrid(),
      ]);
      // Sanitasi data dari key gelar yang corrupt/bocor
      let needsPersist = false;
      const items = rawItems.map((m) => {
        const cleaned = sanitizeMapelGuruData(m);
        if (cleaned !== m) needsPersist = true;
        return cleaned;
      });
      if (needsPersist) {
        await db.setting.put({
          key: 'daftar_mapel_kode',
          value_json: JSON.stringify(items),
          updated_at: new Date().toISOString(),
        });
      }
      setMapelList(items);
      setMatrixGrid(grid);
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Memuat Data', message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Simpan permanen perubahan mapelList ke db.setting
  const persistMapelList = async (updatedList: DaftarMapelKodeItem[]) => {
    try {
      setMapelList(updatedList);
      await db.setting.put({
        key: 'daftar_mapel_kode',
        value_json: JSON.stringify(updatedList),
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menyimpan', message: String(err) });
    }
  };

  // Helper pencocokan guru yang fleksibel (ID, Kode, Nama lengkap, Nama tanpa gelar, Substring)
  const findTeacherByRef = (ref: string) => {
    if (!ref) return undefined;
    const cleanRef = ref.replace(/^\[\d+\]\s*/, '').trim();
    return allTeachers.find(
      (g) =>
        g.id === ref ||
        g.kode === ref ||
        (g.numId && String(g.numId) === ref) ||
        g.nama.toLowerCase() === ref.toLowerCase() ||
        isSameTeacher(g.nama, ref) ||
        isSameTeacher(g.nama, cleanRef)
    );
  };

  // Helper mengekstrak guru yang ditugaskan pada suatu mapel di tabel kiri
  const getAssignedTeachers = (m: DaftarMapelKodeItem) => {
    const teacherMap = new Map<string, { id: string; kode: string; nama: string; jp: number }>();

    // 1. Ekstrak dari m.guruJp
    if (m.guruJp && typeof m.guruJp === 'object') {
      for (const [tName, jpVal] of Object.entries(m.guruJp)) {
        if (!tName || tName.trim() === '' || isDegreeOnly(tName)) continue;
        const match = findTeacherByRef(tName);
        if (!match && isDegreeOnly(tName)) continue;
        const tKey = match ? match.id : tName;
        const displayName = match ? match.nama : tName;
        if (isDegreeOnly(displayName)) continue;

        teacherMap.set(tKey, {
          id: match ? match.id : '',
          kode: match ? match.kode : '',
          nama: displayName,
          jp: Number(jpVal) || m.jp,
        });
      }
    }

    // 2. Ekstrak dari m.guru (string dipisahkan titik koma / baris baru, BUKAN koma!)
    if (m.guru && typeof m.guru === 'string' && m.guru.trim() !== '') {
      // HANYA pisahkan dengan titik koma (;) atau baris baru (\n), JANGAN dengan koma (,) karena koma dipakai gelar
      const parts = m.guru.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
      parts.forEach((name) => {
        if (!name || isDegreeOnly(name)) return;
        const match = findTeacherByRef(name);
        if (!match && isDegreeOnly(name)) return;
        const tKey = match ? match.id : name;
        const displayName = match ? match.nama : name;
        if (isDegreeOnly(displayName)) return;

        if (!teacherMap.has(tKey)) {
          teacherMap.set(tKey, {
            id: match ? match.id : '',
            kode: match ? match.kode : '',
            nama: displayName,
            jp: m.jp,
          });
        }
      });
    }

    // 3. Ekstrak dari matrixGrid.gridData (alokasi rombel kelas untuk mapel ini)
    Object.entries(matrixGrid.gridData).forEach(([gId, rombelMap]) => {
      const cells = Object.values(rombelMap).filter(
        (cell) => cell && cellContainsMapel(cell, m.kode)
      );
      if (cells.length > 0) {
        const match = findTeacherByRef(gId);
        const tKey = match ? match.id : gId;
        const displayName = match ? match.nama : (cells[0] ? `Guru ${gId}` : gId);
        if (isDegreeOnly(displayName)) return;
        const totalAllocated = cells.reduce(
          (sum, c) => sum + (getCellMapelJp(c, m.kode) || m.jp),
          0
        );
        if (teacherMap.has(tKey)) {
          const existing = teacherMap.get(tKey)!;
          if (totalAllocated > 0) existing.jp = totalAllocated;
        } else {
          teacherMap.set(tKey, {
            id: match ? match.id : gId,
            kode: match ? match.kode : '',
            nama: displayName,
            jp: totalAllocated || m.jp,
          });
        }
      }
    });

    return Array.from(teacherMap.values()).filter((t) => !isDegreeOnly(t.nama));
  };

  // Perhitungan mapel dan Beban SK yang diampu oleh setiap guru untuk Pane Kanan
  // ALIRAN DATA DARI TABEL KIRI (mapelList) & MATRIX SK (matrixGrid) -> TABEL KANAN (Guru & Beban SK)
  const teacherWorkloadCalculated = useMemo(() => {
    const res: Record<
      string,
      {
        mapels: {
          kode: string;
          mapel: string;
          jpPerRombel: number;
          rombelCount: number;
          totalJp: number;
        }[];
        totalAllocatedJp: number;
        targetBebanSk: number;
        diff: number;
        isTuntas: boolean;
        isOver: boolean;
      }
    > = {};

    allTeachers.forEach((g) => {
      const dbG = dbGuruList.find((dg) => dg.id === g.id || isSameTeacher(dg.nama, g.nama));
      const skT = SK_TEACHERS_DEFAULT.find((t) => isSameTeacher(t.nama, g.nama));
      const targetBebanSk =
        Number(dbG?.setting_jp) ||
        Number(g.setting_jp) ||
        Number(skT?.bebanJp) ||
        (g.kode === '1' ? 0 : 28);

      const isTeacherMatch = (ref: string) => {
        if (!ref) return false;
        if (ref === g.id || ref === g.kode || (g.numId && String(g.numId) === ref)) return true;
        if (isSameTeacher(g.nama, ref)) return true;
        const cleanRef = ref.replace(/^\[\d+\]\s*/, '').trim();
        if (isSameTeacher(g.nama, cleanRef)) return true;
        return false;
      };

      const mapelDetailMap = new Map<
        string,
        {
          kode: string;
          mapel: string;
          jpPerRombel: number;
          rombelSet: Set<string>;
          totalJp: number;
        }
      >();

      // 1. Baca dari matrixGrid.gridData (SUMBER UTAMA ALOKASI ROMBEL KELAS)
      const gGrid =
        matrixGrid.gridData[g.id] ||
        matrixGrid.gridData[g.kode] ||
        Object.entries(matrixGrid.gridData).find(([k]) => isTeacherMatch(k))?.[1] ||
        {};

      Object.entries(gGrid).forEach(([rombelId, cell]) => {
        if (!cell) return;
        const items = getCellItems(cell);
        items.forEach((it) => {
          const cleanK = it.mapelKode.toUpperCase();
          const mapelRef = mapelList.find((m) => m.kode.toUpperCase() === cleanK);
          const mName = mapelRef ? mapelRef.mapel : it.mapelKode;
          const cellJp = Number(it.jp) || 0;

          if (!mapelDetailMap.has(cleanK)) {
            mapelDetailMap.set(cleanK, {
              kode: it.mapelKode,
              mapel: mName,
              jpPerRombel: cellJp,
              rombelSet: new Set([rombelId]),
              totalJp: cellJp,
            });
          } else {
            const existing = mapelDetailMap.get(cleanK)!;
            existing.rombelSet.add(rombelId);
            existing.totalJp += cellJp;
            if (cellJp > 0) existing.jpPerRombel = cellJp;
          }
        });
      });

      // 2. Mata pelajaran yang baru di-set di katalog kiri tetapi belum dibagi kelas/rombelnya ke guru pengampu di Matrix SK,
      // dikosongkan terlebih dahulu (tidak memunculkan 96 JP / 160 JP perkalian fiktif seluruh rombel).
      // Hanya setelah jam dibagi ke beberapa guru mata pelajaran (tersimpan di matrixGrid.gridData), maka jumlah JP riil dimunculkan.

      // 3. Konversi hasil
      const mapels = Array.from(mapelDetailMap.values()).map((item) => ({
        kode: item.kode,
        mapel: item.mapel,
        jpPerRombel: item.jpPerRombel,
        rombelCount: item.rombelSet.size,
        totalJp: item.totalJp,
      }));

      const totalAllocatedJp = mapels.reduce((sum, item) => sum + item.totalJp, 0);
      const diff = targetBebanSk - totalAllocatedJp;
      const isOver = targetBebanSk > 0 ? totalAllocatedJp > targetBebanSk : totalAllocatedJp > 0;
      const isTuntas = targetBebanSk > 0 && totalAllocatedJp === targetBebanSk;

      res[g.id] = {
        mapels,
        totalAllocatedJp,
        targetBebanSk,
        diff,
        isTuntas,
        isOver,
      };
    });

    return res;
  }, [allTeachers, mapelList, matrixGrid, dbGuruList]);

  // Statistik Guru Tuntas (Beban SK Terpenuhi sesuai Beban JP di Matrix SK)
  const guruTuntasCount = useMemo(() => {
    return allTeachers.filter((g) => {
      const w = teacherWorkloadCalculated[g.id];
      return w ? w.isTuntas : false;
    }).length;
  }, [allTeachers, teacherWorkloadCalculated]);

  // Total JP Guru Seluruh Sekolah
  const totalSekolahJp = useMemo(() => {
    let sum = 0;
    allTeachers.forEach((g) => {
      const w = teacherWorkloadCalculated[g.id];
      if (w) sum += w.totalAllocatedJp;
    });
    return sum;
  }, [allTeachers, teacherWorkloadCalculated]);

  // Filter Pane Kiri (Mata Pelajaran)
  const filteredMapel = useMemo(() => {
    return mapelList.filter((m) => {
      const q = searchMapel.toLowerCase().trim();
      const matchSearch =
        !searchMapel ||
        m.kode.toLowerCase().includes(q) ||
        m.mapel.toLowerCase().includes(q) ||
        (m.guru && m.guru.toLowerCase().includes(q));

      const isProd = m.kategori.toUpperCase() !== 'UMUM';
      const matchTipe = filterTipe === 'ALL' || (filterTipe === 'P' ? isProd : !isProd);
      const matchJenjang = filterJenjang === 'ALL' || m.tingkat === filterJenjang;
      const matchProgram = filterProgram === 'ALL' || m.kategori.toUpperCase() === filterProgram.toUpperCase();

      return matchSearch && matchTipe && matchJenjang && matchProgram;
    });
  }, [mapelList, searchMapel, filterTipe, filterJenjang, filterProgram]);

  // Filter Pane Kanan (Guru)
  const filteredTeachers = useMemo(() => {
    let list = allTeachers.filter((g) => {
      const q = searchGuru.toLowerCase().trim();
      const matchSearch =
        !searchGuru ||
        g.nama.toLowerCase().includes(q) ||
        g.kode.toLowerCase().includes(q) ||
        String(g.numId).includes(q);

      const w = teacherWorkloadCalculated[g.id];
      const hasBeban = w ? w.mapels.length > 0 : false;
      const isFulfilled = w ? w.isTuntas : false;
      const isOverloaded = w ? w.isOver : false;

      if (filterGuruStatus === 'ADA_BEBAN') return matchSearch && hasBeban;
      if (filterGuruStatus === 'KOSONG') return matchSearch && !hasBeban;
      if (filterGuruStatus === 'TUNTAS') return matchSearch && isFulfilled;
      if (filterGuruStatus === 'OVER') return matchSearch && isOverloaded;

      return matchSearch;
    });

    list.sort((a, b) => {
      if (sortGuruOrder === 'asc') return a.numId - b.numId;
      return b.numId - a.numId;
    });

    return list;
  }, [allTeachers, searchGuru, filterGuruStatus, sortGuruOrder, teacherWorkloadCalculated]);

  // =========================================================================
  // SISTEM UNDO & REDO SATU LANGKAH / EKSEKUSI SEBELUMNYA (PERSISTEN KE DB)
  // =========================================================================
  interface UndoStateItem {
    mapelList: DaftarMapelKodeItem[];
    matrixGrid: MatrixGridStorage;
    description: string;
    timestamp: number;
  }

  const [undoStack, setUndoStack] = useState<UndoStateItem[]>([]);
  const [redoStack, setRedoStack] = useState<UndoStateItem[]>([]);

  // Simpan snapshot saat ini sebelum aksi mutasi data
  const saveSnapshot = (description: string) => {
    setUndoStack((prev) => [
      ...prev.slice(-29), // Maksimal 30 riwayat terakhir
      {
        mapelList: JSON.parse(JSON.stringify(mapelList)),
        matrixGrid: JSON.parse(JSON.stringify(matrixGrid)),
        description,
        timestamp: Date.now(),
      },
    ]);
    setRedoStack([]);
  };

  // Handler: Batalkan 1 Langkah Sebelumnya (Undo)
  const handleUndo = async () => {
    if (undoStack.length === 0) {
      addToast({
        type: 'info',
        title: 'Tidak Ada Riwayat',
        message: 'Tidak ada langkah sebelumnya yang dapat dibatalkan (Undo).',
      });
      return;
    }

    const newUndoStack = [...undoStack];
    const previousState = newUndoStack.pop()!;
    setUndoStack(newUndoStack);

    // Simpan keadaan saat ini ke Redo stack
    setRedoStack((prev) => [
      ...prev.slice(-29),
      {
        mapelList: JSON.parse(JSON.stringify(mapelList)),
        matrixGrid: JSON.parse(JSON.stringify(matrixGrid)),
        description: previousState.description,
        timestamp: Date.now(),
      },
    ]);

    try {
      // 1. Pulihkan state lokal
      setMapelList(previousState.mapelList);
      setMatrixGrid(previousState.matrixGrid);

      // 2. Simpan permanen ke Dexie db.setting
      await Promise.all([
        db.setting.put({
          key: 'daftar_mapel_kode',
          value_json: JSON.stringify(previousState.mapelList),
          updated_at: new Date().toISOString(),
        }),
        db.setting.put({
          key: 'matrix_sk_grid',
          value_json: JSON.stringify(previousState.matrixGrid),
          updated_at: new Date().toISOString(),
        }),
      ]);

      addToast({
        type: 'success',
        title: '↩️ Berhasil Dibatalkan (Undo)',
        message: `Berhasil mengembalikan langkah: "${previousState.description}".`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Gagal Melakukan Undo',
        message: String(err),
      });
    }
  };

  // Handler: Ulangi Langkah yang Di-undo (Redo)
  const handleRedo = async () => {
    if (redoStack.length === 0) return;

    const newRedoStack = [...redoStack];
    const nextState = newRedoStack.pop()!;
    setRedoStack(newRedoStack);

    // Simpan ke Undo stack
    setUndoStack((prev) => [
      ...prev.slice(-29),
      {
        mapelList: JSON.parse(JSON.stringify(mapelList)),
        matrixGrid: JSON.parse(JSON.stringify(matrixGrid)),
        description: nextState.description,
        timestamp: Date.now(),
      },
    ]);

    try {
      setMapelList(nextState.mapelList);
      setMatrixGrid(nextState.matrixGrid);

      await Promise.all([
        db.setting.put({
          key: 'daftar_mapel_kode',
          value_json: JSON.stringify(nextState.mapelList),
          updated_at: new Date().toISOString(),
        }),
        db.setting.put({
          key: 'matrix_sk_grid',
          value_json: JSON.stringify(nextState.matrixGrid),
          updated_at: new Date().toISOString(),
        }),
      ]);

      addToast({
        type: 'info',
        title: '↪️ Berhasil Redo',
        message: `Mengulangi langkah: "${nextState.description}".`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Gagal Melakukan Redo',
        message: String(err),
      });
    }
  };

  // Keyboard Shortcut: Ctrl+Z (Undo) dan Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        if (!isInput) {
          e.preventDefault();
          handleUndo();
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && e.shiftKey)
      ) {
        if (!isInput) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, mapelList, matrixGrid]);

  // Handler: Tambah Guru Serombel Sekaligus
  const handleAddSerombelTeachers = async (m: DaftarMapelKodeItem) => {
    const matchingTeachers = findMatchingTeachersForMapel(m, allTeachers);
    if (matchingTeachers.length === 0) {
      addToast({
        type: 'warning',
        title: 'Guru Serombel Tidak Ditemukan',
        message: `Tidak ditemukan guru di Menu 1 Setting dengan kolom SK GURU yang cocok untuk mapel [${m.kode} - ${m.mapel}].`,
      });
      return;
    }

    try {
      saveSnapshot(`Tugaskan guru serombel untuk [${m.kode}]`);
      const { updatedMapelList, updatedMatrixGrid } = await assignBatchTeachersToMapelAutoSync(
        m.kode,
        matchingTeachers.map((t) => ({ id: t.id, nama: t.nama, kode: t.kode, jp: m.jp })),
        m.jp
      );
      setMapelList(updatedMapelList);
      setMatrixGrid(updatedMatrixGrid);

      const names = matchingTeachers.map((t) => t.nama).join(', ');
      addToast({
        type: 'success',
        title: '✓ Guru Serombel Berhasil Ditugaskan',
        message: `${matchingTeachers.length} guru pengampu (${names}) berhasil ditugaskan ke [${m.kode}] dan OTOMATIS terisi di Matrix SK!`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menugaskan Guru Serombel', message: String(err) });
    }
  };

  // Handler: Tambah Guru Manual dari Modal
  const handleConfirmAddTeacher = async () => {
    if (!selectedMapelForTeacher || !selectedTeacherId) return;
    const targetGuru = allTeachers.find((g) => g.id === selectedTeacherId);
    if (!targetGuru) return;

    try {
      saveSnapshot(`Tugaskan ${targetGuru.nama} ke [${selectedMapelForTeacher.kode}]`);
      const { updatedMapelList, updatedMatrixGrid } = await assignTeacherToMapelAutoSync(
        selectedMapelForTeacher.kode,
        { id: targetGuru.id, nama: targetGuru.nama, kode: targetGuru.kode },
        selectedTeacherJp
      );
      setMapelList(updatedMapelList);
      setMatrixGrid(updatedMatrixGrid);
      setIsAddTeacherModalOpen(false);
      setSelectedMapelForTeacher(null);

      addToast({
        type: 'success',
        title: '✓ Sinkron 2 Arah Otomatis',
        message: `${targetGuru.nama} berhasil ditugaskan ke [${selectedMapelForTeacher.kode}] dan OTOMATIS terisi di Matrix SK!`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menugaskan Guru', message: String(err) });
    }
  };

  // Handler: Lepas Satu Guru
  const handleRemoveSingleTeacher = async (kodeMapel: string, teacherName: string) => {
    try {
      saveSnapshot(`Hapus guru ${teacherName} dari [${kodeMapel}]`);
      const { updatedMapelList, updatedMatrixGrid } = await removeTeacherFromMapelAutoSync(
        kodeMapel,
        teacherName
      );
      setMapelList(updatedMapelList);
      setMatrixGrid(updatedMatrixGrid);
      addToast({
        type: 'info',
        title: '✓ Guru Dilepas',
        message: `${teacherName} dilepas dari [${kodeMapel}] dan OTOMATIS disinkronkan di Matrix SK. Tekan "Undo" (Ctrl+Z) jika ingin membatalkan.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Melepas Guru', message: String(err) });
    }
  };

  // Handler: Reset Satu Mapel
  const handleResetSingleMapel = async (kodeMapel: string) => {
    try {
      saveSnapshot(`Reset rencana guru mapel [${kodeMapel}]`);
      const { updatedMapelList, updatedMatrixGrid } = await resetSingleMapelGuruAutoSync(kodeMapel);
      setMapelList(updatedMapelList);
      setMatrixGrid(updatedMatrixGrid);
      addToast({
        type: 'info',
        title: '✓ Rencana Dikosongkan',
        message: `Rencana guru untuk mapel [${kodeMapel}] telah dikosongkan. Tekan "Undo" (Ctrl+Z) jika ingin membatalkan.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Reset Mapel', message: String(err) });
    }
  };

  // Handler: Kosongkan Seluruh Rencana
  const handleClearAllRencana = async () => {
    try {
      saveSnapshot('Kosongkan Seluruh Guru Pengampu');
      const updated = mapelList.map((m) => ({
        ...m,
        guru: '',
        guruJp: {},
      }));
      await persistMapelList(updated);
      const nextGrid = await performFullTwoWaySync('MAPEL_TO_MATRIX');
      setMatrixGrid(nextGrid.matrixGrid);
      setConfirmClearOpen(false);
      addToast({
        type: 'success',
        title: '✓ Seluruh Rencana Dikosongkan',
        message: 'Seluruh rencana guru pengampu telah dikosongkan. Tekan "Undo" (Ctrl+Z) jika ingin membatalkan.',
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Mengosongkan Rencana', message: String(err) });
    }
  };

  // Handler: Distribusi Otomatis dari Kurikulum Resmi SK
  const handleAutoDistributeOfficialCurriculum = async () => {
    try {
      saveSnapshot('Distribusi Otomatis (0 JP)');
      const mapelTeachersMap: Record<string, { nama: string; jp: number }[]> = {};
      SK_TEACHERS_DEFAULT.forEach((t) => {
        (t.items || []).forEach((it) => {
          const mKode = it.mapel.trim().toUpperCase();
          if (!mapelTeachersMap[mKode]) mapelTeachersMap[mKode] = [];
          mapelTeachersMap[mKode].push({ nama: t.nama, jp: it.jp });
        });
      });

      const updated = mapelList.map((m) => {
        const cleanKode = m.kode.trim().toUpperCase();
        const assigned = mapelTeachersMap[cleanKode] || [];
        const guruJp: Record<string, number> = {};
        const guruNames: string[] = [];

        assigned.forEach((t) => {
          guruJp[cleanTeacherName(t.nama)] = t.jp || m.jp;
          guruNames.push(cleanTeacherName(t.nama));
        });

        return {
          ...m,
          guru: guruNames.join('; '),
          guruJp: guruJp,
        };
      });

      await persistMapelList(updated);
      const nextGrid = await performFullTwoWaySync('MAPEL_TO_MATRIX');
      setMatrixGrid(nextGrid.matrixGrid);
      setConfirmAutoDistributeOpen(false);

      addToast({
        type: 'success',
        title: '✓ Distribusi Otomatis Berhasil',
        message: 'Seluruh rencana pengampu telah dipetakan dari Kurikulum Resmi SK dan disinkronkan 2 arah ke Matrix SK!',
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Distribusi Otomatis', message: String(err) });
    }
  };

  // Handler: Kunci & Validasi
  const handleLockAndValidate = () => {
    let unassigned = 0;
    mapelList.forEach((m) => {
      const teachers = getAssignedTeachers(m);
      if (teachers.length === 0) unassigned++;
    });

    if (unassigned === 0) {
      addToast({
        type: 'success',
        title: '✓ 100% Sinkron & Terkunci',
        message: 'Seluruh 82 mata pelajaran telah lengkap memiliki guru pengampu!',
      });
    } else {
      addToast({
        type: 'warning',
        title: 'Validasi Kurikulum',
        message: `Terdapat ${unassigned} dari ${mapelList.length} mata pelajaran yang belum memiliki rencana guru pengampu.`,
      });
    }
  };

  // Helper Display Label Rombel persis seperti di gambar:
  const getRombelDisplayLabel = (r: RombelCol): string => {
    if (r.jurusanKode === 'DPB') return `${r.tingkat} FASHION ${r.nomor}`;
    if (r.jurusanKode === 'KUL') return `${r.tingkat} KULINER ${r.nomor}`;
    if (r.jurusanKode === 'LAS') return `${r.tingkat} LAS`;
    if (r.jurusanKode === 'APAT') return `${r.tingkat} APAT`;
    return r.nama;
  };

  // Helper kalkulasi status beban guru di SK (Over / Kurang / Pas):
  const getTeacherWorkloadInfo = (teacherId: string, currentMapelKode: string, allocatedJp: number) => {
    const dbG = dbGuruList.find((g) => g.id === teacherId);
    const targetJp = dbG?.setting_jp ?? 28;

    let otherJp = 0;
    const gGrid = matrixGrid.gridData[teacherId] || {};
    Object.values(gGrid).forEach((cell) => {
      if (!cell) return;
      const items = getCellItems(cell);
      items.forEach((it) => {
        if (it.mapelKode.toUpperCase() !== currentMapelKode.toUpperCase()) {
          otherJp += Number(it.jp) || 0;
        }
      });
    });

    const totalJp = otherJp + allocatedJp;
    const diff = targetJp - totalJp;

    if (diff < 0) {
      return {
        text: `Over: ${diff} JP`,
        totalJp,
        targetJp,
        diff,
        badgeClass: 'border-rose-300 bg-rose-50 text-rose-700',
      };
    } else if (diff === 0) {
      return {
        text: 'Pas: 28 JP (Tuntas)',
        totalJp,
        targetJp,
        diff: 0,
        badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-700',
      };
    } else {
      return {
        text: `Kurang: +${diff} JP`,
        totalJp,
        targetJp,
        diff,
        badgeClass: 'border-sky-300 bg-sky-50 text-sky-700',
      };
    }
  };

  // Helper mencari guru pengampu mapel yang sama (team teaching)
  const getTeachersForMapel = (mapelKode: string) => {
    const clean = (mapelKode || '').toUpperCase().trim();
    if (!clean) return allTeachers;
    const matchedGuruIds = new Set<string>();

    // 1. Dari teacherMapels (badge Matrix SK) - hanya jika kompatibel
    Object.entries(matrixGrid.teacherMapels).forEach(([gId, badges]) => {
      if (badges.some((b) => b.kode.toUpperCase() === clean)) {
        const gObj = allTeachers.find((g) => g.id === gId);
        if (gObj && isTeacherCompatibleWithMapel(gObj, clean)) {
          matchedGuruIds.add(gId);
        }
      }
    });

    // 2. Dari mapelList (m.guru & m.guruJp) - hanya jika kompatibel
    const mapelItem = mapelList.find((m) => m.kode.toUpperCase() === clean);
    if (mapelItem) {
      if (mapelItem.guruJp && typeof mapelItem.guruJp === 'object') {
        Object.keys(mapelItem.guruJp).forEach((name) => {
          const found = allTeachers.find((g) => isSameTeacher(g.nama, name));
          if (found && isTeacherCompatibleWithMapel(found, clean)) matchedGuruIds.add(found.id);
        });
      }
      if (mapelItem.guru) {
        const parts = mapelItem.guru.split(/[;\n]+/).map((s) => s.trim());
        parts.forEach((name) => {
          const found = allTeachers.find((g) => isSameTeacher(g.nama, name));
          if (found && isTeacherCompatibleWithMapel(found, clean)) matchedGuruIds.add(found.id);
        });
      }
    }

    // 3. Dari gridData - hanya jika kompatibel
    Object.entries(matrixGrid.gridData).forEach(([gId, cells]) => {
      if (cells) {
        const hasCell = Object.values(cells).some((cell) => cellContainsMapel(cell, clean));
        if (hasCell) {
          const gObj = allTeachers.find((g) => g.id === gId);
          if (gObj && isTeacherCompatibleWithMapel(gObj, clean)) {
            matchedGuruIds.add(gId);
          }
        }
      }
    });

    // 4. Dari SK_TEACHERS_DEFAULT (kurikulum SK resmi) - HANYA berdasarkan nama (isSameTeacher)
    SK_TEACHERS_DEFAULT.forEach((skT) => {
      if (skT.items && skT.items.some((it) => it.mapel.toUpperCase() === clean)) {
        const found = allTeachers.find((g) => isSameTeacher(g.nama, skT.nama));
        if (found) matchedGuruIds.add(found.id);
      }
    });

    const list = allTeachers.filter((g) => matchedGuruIds.has(g.id));
    return list;
  };

  // Handler: Modal Tambah Mapel Sederhana (dari Toolbar)
  const handleOpenAddMapelModal = () => {
    setEditingMapel(null);
    setModalNo(mapelList.length + 1);
    setModalKode('');
    setModalNama('');
    setModalJp(2);
    setModalKategori('UMUM');
    setModalTingkat('X');
    setIsMapelModalOpen(true);
  };

  // Buka Modal Edit Mata Pelajaran & Team Teaching (Sesuai Gambar 2)
  const handleOpenEditMapelModal = (m: DaftarMapelKodeItem) => {
    const cleanKode = m.kode.toUpperCase().trim();
    let jenjang: 'X' | 'XI' | 'XII' = m.tingkat || 'X';
    if (cleanKode.startsWith('PRO1') || cleanKode.includes('FASE E') || cleanKode.includes('1')) jenjang = 'X';
    else if (cleanKode.startsWith('PRO2') || cleanKode.includes('2')) jenjang = 'XI';
    else if (cleanKode.startsWith('PRO3') || cleanKode.includes('3')) jenjang = 'XII';

    const isProd = isMapelProduktif(m.kode, m.kategori);
    const jpPerRombel = isProd ? getProductiveStandardJp(jenjang, cleanKode) : (m.jp || 2);

    const jMatch = JURUSAN_GROUPS.find((j) => cleanKode.includes(j.kode));
    const program = jMatch ? jMatch.kode : (m.kategori === 'UMUM' ? 'ALL' : m.kategori || 'PSPT');

    const relevantRombels = ROMBELS_48.filter((r) => {
      const matchL = r.tingkat === jenjang;
      return program === 'ALL' ? matchL : matchL && r.jurusanKode === program;
    });
    const jumlahRombel = relevantRombels.length || 2;

    const teacherEntries: TeamTeachingTeacherEntry[] = [];

    // 1. Cek dari gridData (hanya guru yang kompatibel)
    Object.entries(matrixGrid.gridData).forEach(([gId, cells]) => {
      if (!cells) return;
      const gObj = allTeachers.find((g) => g.id === gId);
      if (!gObj || !isTeacherCompatibleWithMapel(gObj, cleanKode)) return;

      const assignedRombels: string[] = [];
      let foundJp = 0;
      Object.entries(cells).forEach(([rId, cell]) => {
        if (cellContainsMapel(cell, cleanKode)) {
          assignedRombels.push(rId);
          foundJp = getCellMapelJp(cell, cleanKode) || foundJp;
        }
      });
      if (assignedRombels.length > 0) {
        teacherEntries.push({
          id: gObj.id,
          nama: gObj.nama,
          kode: gObj.kode,
          jp: foundJp || (m.guruJp && m.guruJp[cleanTeacherName(gObj.nama)]) || jpPerRombel,
          selectedRombels: assignedRombels,
        });
      }
    });

    // 2. Cek apakah ada guru dari m.guru / m.guruJp yang belum masuk ke teacherEntries
    if (m.guruJp && typeof m.guruJp === 'object') {
      Object.entries(m.guruJp).forEach(([tName, customJp]) => {
        const found = allTeachers.find((g) => isSameTeacher(g.nama, tName));
        if (found && isTeacherCompatibleWithMapel(found, cleanKode) && !teacherEntries.some((t) => t.id === found.id)) {
          teacherEntries.push({
            id: found.id,
            nama: found.nama,
            kode: found.kode,
            jp: customJp || jpPerRombel,
            selectedRombels: [],
          });
        }
      });
    }

    // 3. Lengkapi guru dari kurikulum resmi SK_TEACHERS_DEFAULT jika belum ada di teacherEntries
    const skMatches = SK_TEACHERS_DEFAULT.filter(
      (skT) => skT.items && skT.items.some((it) => it.mapel.toUpperCase() === cleanKode)
    );
    if (skMatches.length > 0) {
      skMatches.forEach((skT) => {
        const gObj = allTeachers.find((g) => isSameTeacher(g.nama, skT.nama));
        if (gObj && isTeacherCompatibleWithMapel(gObj, cleanKode)) {
          const it = skT.items.find((item) => item.mapel.toUpperCase() === cleanKode);
          const defaultJp = it ? it.jp : Math.round(jpPerRombel / skMatches.length);
          const alreadyExists = teacherEntries.some((t) => t.id === gObj.id);
          if (!alreadyExists) {
            teacherEntries.push({
              id: gObj.id,
              nama: gObj.nama,
              kode: gObj.kode,
              jp: defaultJp,
              selectedRombels: [],
            });
          }
        }
      });
    }

    // 4. Jika masih kosong, beri default
    if (teacherEntries.length === 0) {
      const sameMapelTeachers = getTeachersForMapel(cleanKode);
      if (sameMapelTeachers.length > 0) {
        sameMapelTeachers.forEach((g) => {
          teacherEntries.push({
            id: g.id,
            nama: g.nama,
            kode: g.kode,
            jp: Math.round(jpPerRombel / sameMapelTeachers.length),
            selectedRombels: [],
          });
        });
      } else if (allTeachers.length > 0) {
        const firstGuru = allTeachers[0];
        if (firstGuru) {
          teacherEntries.push({
            id: firstGuru.id,
            nama: firstGuru.nama,
            kode: firstGuru.kode,
            jp: jpPerRombel,
            selectedRombels: [],
          });
        }
      }
    }

    setTeamTeachingModal({
      isOpen: true,
      mapelKode: m.kode,
      mapelNama: m.mapel,
      jenis: isProd ? 'PRODUKTIF' : 'REGULER',
      jenjang,
      program,
      jpPerRombel,
      jumlahRombel,
      teachers: teacherEntries,
      showAll48: false,
      filterOnlySameMapel: true,
    });
  };

  // Simpan / Terapkan Team Teaching ke Matriks & Daftar Mapel (Sesuai Gambar 2)
  const handleApplyTeamTeaching = async () => {
    const { mapelKode, mapelNama, jenis, jenjang, program, jpPerRombel, teachers } = teamTeachingModal;

    if (teachers.length === 0) {
      addToast({ type: 'warning', title: 'Belum Ada Guru', message: 'Tambahkan minimal 1 guru pengampu.' });
      return;
    }

    const cleanKode = mapelKode.toUpperCase().trim();
    const relevantRombels = ROMBELS_48.filter((r) => {
      const matchL = r.tingkat === jenjang;
      return program === 'ALL' ? matchL : matchL && r.jurusanKode === program;
    });
    const allRelevantRombelIds = relevantRombels.map((r) => r.id);

    // Kumpulkan seluruh rombel yang dipilih oleh guru manapun
    const allSelectedRombelIds = Array.from(
      new Set(teachers.flatMap((t) => t.selectedRombels))
    );

    // Guru yang tidak ada lagi di modal tetapi sebelumnya mengampu mapel ini
    const prevTeacherIds = Object.keys(matrixGrid.gridData).filter((gId) => {
      const cells = matrixGrid.gridData[gId] || {};
      return Object.values(cells).some((cell) => cellContainsMapel(cell, cleanKode));
    });
    const currentTeacherIds = new Set(teachers.map((t) => t.id));
    const removedGuruIds = prevTeacherIds.filter((gId) => !currentTeacherIds.has(gId));

    try {
      saveSnapshot(`Simpan penugasan guru mapel [${cleanKode}]`);
      const allocations = teachers.map((t) => ({
        guruId: t.id,
        guruNama: t.nama,
        guruKode: t.kode,
        jpPerRombel: Number(t.jp),
        rombelIds: t.selectedRombels,
      }));

      const res = await applyTeamTeachingSplitAutoSync({
        mapelKode: cleanKode,
        rombelIds: allSelectedRombelIds,
        unassignRombelIds: allRelevantRombelIds,
        removedGuruIds,
        standardJp: jpPerRombel,
        allocations,
      });

      // Pastikan nama, jenis, tingkat, kategori di daftar mapel terupdate jika diedit di modal
      const updatedMapels = res.updatedMapelList.map((m) => {
        if (m.kode.toUpperCase() !== cleanKode) return m;
        return {
          ...m,
          mapel: mapelNama.trim(),
          jenis,
          tingkat: jenjang,
          kategori: program === 'ALL' ? 'UMUM' : program,
        };
      });

      await db.setting.put({
        key: 'daftar_mapel_kode',
        value_json: JSON.stringify(updatedMapels),
        updated_at: new Date().toISOString(),
      });

      setMapelList(updatedMapels);
      setMatrixGrid(res.updatedMatrixGrid);
      setTeamTeachingModal((prev) => ({ ...prev, isOpen: false }));

      addToast({
        type: 'success',
        title: '✓ Perubahan Berhasil Disimpan',
        message: `Mata pelajaran [${cleanKode}] dan penugasan ${teachers.length} guru berhasil disimpan serentak ke Matrix SK & Menu Mapel!`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menyimpan', message: String(err) });
    }
  };

  const handleSaveMapelModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalKode.trim() || !modalNama.trim()) {
      addToast({ type: 'warning', title: 'Data Kurang', message: 'Kode dan Nama Mapel wajib diisi.' });
      return;
    }

    const cleanKode = modalKode.trim().toUpperCase();
    saveSnapshot(editingMapel ? `Edit mapel [${cleanKode}]` : `Tambah mapel [${cleanKode}]`);

    if (editingMapel) {
      const updated = mapelList.map((item) => {
        if (item.kode !== editingMapel.kode) return item;
        return {
          ...item,
          no: modalNo,
          kode: cleanKode,
          mapel: modalNama.trim(),
          jp: Number(modalJp) || 2,
          kategori: modalKategori,
          tingkat: modalTingkat,
        };
      });
      await persistMapelList(updated);
      await performFullTwoWaySync('MAPEL_TO_MATRIX');
      setIsMapelModalOpen(false);
      addToast({ type: 'success', title: 'Mapel Diperbarui', message: `[${cleanKode}] ${modalNama} berhasil disimpan.` });
    } else {
      if (mapelList.some((x) => x.kode === cleanKode)) {
        addToast({ type: 'error', title: 'Kode Duplikat', message: `Kode [${cleanKode}] sudah ada dalam daftar.` });
        return;
      }
      const newItem: DaftarMapelKodeItem = {
        no: modalNo,
        kode: cleanKode,
        mapel: modalNama.trim(),
        jp: Number(modalJp) || 2,
        kategori: modalKategori,
        tingkat: modalTingkat,
        guru: '',
        guruJp: {},
      };
      const updated = [...mapelList, newItem].sort((a, b) => a.no - b.no);
      await persistMapelList(updated);
      setIsMapelModalOpen(false);
      addToast({ type: 'success', title: 'Mapel Ditambahkan', message: `[${cleanKode}] ${modalNama} berhasil ditambahkan.` });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingKode) return;
    saveSnapshot(`Hapus mapel [${deletingKode}]`);
    const updated = mapelList.filter((x) => x.kode !== deletingKode);
    await persistMapelList(updated);
    await performFullTwoWaySync('MAPEL_TO_MATRIX');
    setDeletingKode(null);
    addToast({ type: 'info', title: 'Mapel Dihapus', message: `Mapel [${deletingKode}] telah dihapus dan disinkronkan. Tekan "Undo" (Ctrl+Z) untuk membatalkan.` });
  };

  if (loading) {
    return <div className="p-8 text-slate-500 font-semibold">Memuat Katalog Mata Pelajaran &amp; Beban SK Guru...</div>;
  }

  return (
    <div
      ref={containerRef}
      className={
        isFullScreen
          ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-100 p-2 md:p-3 flex flex-col min-h-0 space-y-1.5 font-sans select-none overflow-hidden'
          : 'w-full h-full flex flex-col min-h-0 space-y-2 font-sans select-none overflow-hidden'
      }
    >
      {/* 1. Header Toolbar Biru Royal */}
      <div className="bg-[#1b4cb4] rounded-xl px-4 py-2.5 text-white shadow-md border border-blue-400/30 flex flex-col gap-2 shrink-0">
        {!isFullScreen && (
          <div>
            <h2 className="text-base md:text-lg font-black uppercase tracking-wide text-white drop-shadow-xs">
              KATALOG MATA PELAJARAN &amp; BEBAN SK GURU
            </h2>
            <p className="text-[11px] md:text-xs text-blue-100 font-medium">
              Pengisian Guru Pengampu &amp; Rincian Jam (JP) Mengurangi Beban SK • Status 0 JP (Tuntas) Menandakan Beban Mengajar Terdistribusi Penuh
            </p>
          </div>
        )}

        {/* Toolbar Tombol Aksi Lengkap Persis Gambar */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Badge 1: 100% Sinkron & Terkunci */}
          <div className="bg-[#10b981] text-white font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm border border-emerald-400 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            <span>100% Sinkron &amp; Terkunci</span>
          </div>

          {/* Tombol 2: Kunci & Validasi */}
          <button
            type="button"
            onClick={handleLockAndValidate}
            className="bg-[#059669] hover:bg-[#047857] active:scale-95 text-white font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap border border-emerald-500"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Kunci &amp; Validasi</span>
          </button>

          {/* Badge 3: 0 / 0 Guru Tuntas (0 JP) */}
          <div className="bg-[#1d4ed8] text-white font-extrabold px-3 py-1.5 rounded-lg border border-blue-400/50 shadow-sm whitespace-nowrap">
            <span>
              {guruTuntasCount} / {allTeachers.length} Guru Tuntas ({totalSekolahJp} JP)
            </span>
          </div>

          {/* Tombol 4: Sinkronkan Kode (82 Mapel) */}
          <button
            type="button"
            onClick={async () => {
              const res = await performFullTwoWaySync('MAPEL_TO_MATRIX');
              setMatrixGrid(res.matrixGrid);
              addToast({
                type: 'success',
                title: '✓ Sinkronisasi Selesai',
                message: `Seluruh ${mapelList.length} mata pelajaran berhasil disinkronkan 2 arah ke Matrix SK!`,
              });
            }}
            className="bg-[#0284c7] hover:bg-[#0369a1] active:scale-95 text-white font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap border border-sky-400"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sinkronkan Kode ({mapelList.length} Mapel)</span>
          </button>

          {/* Tombol 5: Distribusi Otomatis (0 JP) */}
          <button
            type="button"
            onClick={() => setConfirmAutoDistributeOpen(true)}
            className="bg-[#10b981] hover:bg-[#059669] active:scale-95 text-white font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap border border-emerald-400"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Distribusi Otomatis (0 JP)</span>
          </button>

          {/* Tombol 6: Kosongkan Guru Pengampu */}
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="bg-slate-700/80 hover:bg-rose-700 active:scale-95 text-white font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap border border-slate-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Kosongkan Guru Pengampu</span>
          </button>

          {/* Tombol Action: Undo Satu Langkah Sebelumnya */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className={`font-black text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap border ${
              undoStack.length > 0
                ? 'bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 border-amber-500 shadow-md cursor-pointer ring-1 ring-amber-300'
                : 'bg-slate-700/40 text-slate-400 border-slate-600/50 cursor-not-allowed opacity-60'
            }`}
            title={
              undoStack.length > 0
                ? `Batalkan langkah: "${undoStack[undoStack.length - 1]?.description || ''}" (Ctrl+Z)`
                : 'Belum ada riwayat tindakan untuk di-undo (Ctrl+Z)'
            }
          >
            <RotateCcw
              className={`w-3.5 h-3.5 stroke-[2.5] ${
                undoStack.length > 0 ? 'text-slate-950' : 'text-slate-400'
              }`}
            />
            <span>Undo {undoStack.length > 0 ? `(${undoStack.length})` : ''}</span>
          </button>

          {/* Tombol Action: Redo (muncul jika ada yang di-undo) */}
          {redoStack.length > 0 && (
            <button
              type="button"
              onClick={handleRedo}
              className="bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-black text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap border border-sky-400 ring-1 ring-sky-300"
              title={`Ulangi langkah: "${redoStack[redoStack.length - 1]?.description || ''}" (Ctrl+Y)`}
            >
              <RotateCw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Redo ({redoStack.length})</span>
            </button>
          )}

          {/* Tombol 7: Matriks SK */}
          <button
            type="button"
            onClick={() => setActiveMenu(3)}
            className="bg-white hover:bg-slate-100 text-slate-800 font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap border border-slate-300 ml-auto"
            title="Buka Menu 3: Matrix SK"
          >
            <Search className="w-3.5 h-3.5 text-blue-600" />
            <span>Matriks SK</span>
          </button>

          {/* Tombol 8: + Tambah Mata Pelajaran */}
          <button
            type="button"
            onClick={handleOpenAddMapelModal}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-95 text-white font-black px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap border border-blue-400"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Tambah Mata Pelajaran</span>
          </button>

          {/* Tombol 9: Full Screen Toggle */}
          {isFullScreen ? (
            <button
              type="button"
              onClick={handleToggleFullScreen}
              className="bg-amber-400 hover:bg-amber-500 text-slate-950 border border-amber-500 font-black text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0 ring-2 ring-amber-300"
              title="Keluar Layar Penuh (ESC)"
            >
              <Minimize className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
              <span>Keluar Full Screen</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleFullScreen}
              className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-black text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Tampilkan Gambar 1 Secara Penuh (Full Screen)"
            >
              <Maximize className="w-3.5 h-3.5 text-blue-700" />
              <span>Full Screen</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Baris Filter Bersama (Filter Mapel di Kiri, Filter Guru di Kanan) */}
      <div className="bg-white border-2 border-b-0 border-black rounded-t-xl px-3 py-2 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 shadow-xs">
        {/* Sisi Kiri: Filter Mata Pelajaran */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <span className="text-xs font-black text-slate-900 uppercase tracking-tight whitespace-nowrap">
            FILTER MATA PELAJARAN:
          </span>
          <div className="relative min-w-[170px] max-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari mata pelajaran, kode..."
              value={searchMapel}
              onChange={(e) => setSearchMapel(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs font-bold border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select
            value={filterTipe}
            onChange={(e) => setFilterTipe(e.target.value as any)}
            className="text-xs font-bold border border-slate-300 rounded px-2 py-1 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Tipe</option>
            <option value="R">Reguler (R)</option>
            <option value="P">Produktif (P)</option>
          </select>
          <select
            value={filterJenjang}
            onChange={(e) => setFilterJenjang(e.target.value as any)}
            className="text-xs font-bold border border-slate-300 rounded px-2 py-1 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Jenj</option>
            <option value="X">Kelas X</option>
            <option value="XI">Kelas XI</option>
            <option value="XII">Kelas XII</option>
          </select>
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
            className="text-xs font-bold border border-slate-300 rounded px-2 py-1 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Prog</option>
            <option value="UMUM">UMUM</option>
            <option value="PSPT">PSPT</option>
            <option value="AK">AK</option>
            <option value="TKR">TKR</option>
            <option value="TKJ">TKJ</option>
            <option value="KULINER">KUL</option>
            <option value="DPB">DPB</option>
            <option value="LAS">LAS</option>
            <option value="APAT">APAT</option>
          </select>
        </div>

        {/* Sisi Kanan: Filter Guru */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-black text-slate-900 uppercase tracking-tight whitespace-nowrap">
            FILTER GURU:
          </span>
          <div className="relative min-w-[140px] max-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari guru / ID..."
              value={searchGuru}
              onChange={(e) => setSearchGuru(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs font-bold border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select
            value={filterGuruStatus}
            onChange={(e) => setFilterGuruStatus(e.target.value)}
            className="text-xs font-bold border border-slate-300 rounded px-2 py-1 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="TUNTAS">Beban SK Terpenuhi (✓)</option>
            <option value="OVER">Beban Berlebih / Over (⚠️)</option>
            <option value="ADA_BEBAN">Ada Beban (&gt;0 JP)</option>
            <option value="KOSONG">Belum Ada Beban (-)</option>
          </select>
        </div>
      </div>

      {/* 3. Main Dual-Pane Split Table (Persis Tampilan Gambar) */}
      <div className="flex-1 min-h-0 flex border-2 border-black rounded-b-xl overflow-hidden bg-white shadow-md">
        {/* =========================================================================
            PANE KIRI: TABEL KATALOG MATA PELAJARAN (Width ~60%)
           ========================================================================= */}
        <div className="flex-[1.4] min-w-0 border-r-2 border-black flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead className="sticky top-0 z-10 bg-[#8faadc] text-[#0d1f42] text-[11px] font-black uppercase tracking-wider border-b-2 border-black shadow-xs">
                <tr className="h-10">
                  <th className="py-2 px-1 text-center border-r-[1.5px] border-black w-10 bg-[#8faadc]">NO</th>
                  <th className="py-2 px-1 text-center border-r-[1.5px] border-black w-16 bg-[#8faadc]">KODE</th>
                  <th className="py-2 px-2 border-r-[1.5px] border-black min-w-[160px] bg-[#8faadc]">MATA PELAJARAN</th>
                  <th className="py-2 px-1 text-center border-r-[1.5px] border-black w-12 bg-[#8faadc]">TIPE</th>
                  <th className="py-2 px-1 text-center border-r-[1.5px] border-black w-14 bg-[#8faadc]">BEBAN</th>
                  <th className="py-2 px-1 text-center border-r-[1.5px] border-black w-16 bg-[#8faadc]">BEBAN TOTAL</th>
                  <th className="py-2 px-1 text-center border-r-[1.5px] border-black w-14 bg-[#8faadc]">JENJANG</th>
                  <th className="py-2 px-1 text-center border-r-[1.5px] border-black w-20 bg-[#8faadc]">PROGRAM</th>
                  <th className="py-2 px-2 border-r-[1.5px] border-black min-w-[200px] bg-[#8faadc]">GURU PENGAMPU</th>
                  <th className="py-2 px-1 text-center w-14 bg-[#8faadc]">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y-[1.5px] divide-black">
                {filteredMapel.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-slate-400 font-bold text-xs">
                      Tidak ada mata pelajaran yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredMapel.map((m, index) => {
                    const assignedTeachers = getAssignedTeachers(m);
                    const isProd = m.kategori.toUpperCase() !== 'UMUM';
                    const { program, rombelText, bebanTotal } = getMapelRombelAndBebanTotal(m);
                    const matchingSerombel = findMatchingTeachersForMapel(m, allTeachers);

                    return (
                      <tr key={m.kode} className="hover:bg-blue-50/40 transition-colors bg-white font-medium text-xs">
                        {/* NO */}
                        <td className="py-2 px-1 text-center font-bold text-black border-r-[1.5px] border-black align-middle">
                          {m.no || index + 1}
                        </td>

                        {/* KODE */}
                        <td className="py-2 px-1 text-center border-r-[1.5px] border-black align-middle">
                          <span className="inline-block px-1.5 py-0.5 text-[11px] font-black text-blue-600 bg-blue-50/80 border border-blue-300 rounded tracking-wider">
                            {m.kode}
                          </span>
                        </td>

                        {/* MATA PELAJARAN */}
                        <td className="py-2 px-2 font-black text-black border-r-[1.5px] border-black tracking-tight text-xs uppercase align-middle">
                          {m.mapel}
                        </td>

                        {/* TIPE (Bulat R hijau / P ungu) */}
                        <td className="py-2 px-1 text-center border-r-[1.5px] border-black align-middle">
                          {isProd ? (
                            <span
                              className="w-5 h-5 mx-auto rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-[10px] shadow-2xs border border-purple-700"
                              title="Produktif"
                            >
                              P
                            </span>
                          ) : (
                            <span
                              className="w-5 h-5 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[10px] shadow-2xs border border-emerald-700"
                              title="Reguler"
                            >
                              R
                            </span>
                          )}
                        </td>

                        {/* BEBAN */}
                        <td className="py-2 px-1 text-center font-bold text-black border-r-[1.5px] border-black align-middle whitespace-nowrap">
                          {m.jp} JP
                        </td>

                        {/* BEBAN TOTAL */}
                        <td className="py-2 px-1 text-center font-black text-black border-r-[1.5px] border-black align-middle whitespace-nowrap">
                          {bebanTotal} JP
                        </td>

                        {/* JENJANG (Lingkaran abu X / XI / XII) */}
                        <td className="py-2 px-1 text-center border-r-[1.5px] border-black align-middle">
                          <span className="w-6 h-6 mx-auto rounded-full border border-slate-300 bg-slate-50 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {m.tingkat}
                          </span>
                        </td>

                        {/* PROGRAM (Lingkaran abu ALL 16 Rombel / Jurusan 2 Rombel) */}
                        <td className="py-2 px-1 text-center border-r-[1.5px] border-black align-middle">
                          <div className="w-16 mx-auto rounded-lg border border-slate-300 bg-slate-50 py-1 flex flex-col items-center justify-center">
                            <span className="font-extrabold text-[10px] text-slate-800 uppercase">{program}</span>
                            <span className="text-[9px] text-slate-500 font-semibold">{rombelText}</span>
                          </div>
                        </td>

                        {/* GURU PENGAMPU (Kartu-kartu bertumpuk vertikal dengan Nama & Gelar) */}
                        <td className="py-2 px-2 border-r-[1.5px] border-black align-middle">
                          <div className="space-y-1.5">
                            {assignedTeachers.length === 0 ? (
                              <div className="text-slate-400 italic text-[11px] py-1">Belum ada pengampu</div>
                            ) : (
                              assignedTeachers
                                .filter((t) => !isDegreeOnly(t.nama))
                                .map((t, tIdx) => {
                                  const { baseName, degree } = splitTeacherNameAndDegree(t.nama);
                                  return (
                                    <div
                                      key={tIdx}
                                      className="flex items-center justify-between bg-white border border-slate-300 rounded p-1.5 shadow-2xs hover:border-slate-400 transition-colors"
                                    >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-black text-[11px] text-slate-900 uppercase">
                                        {baseName}
                                      </span>
                                      {degree && (
                                        <span className="bg-slate-100 text-slate-600 border border-slate-300 text-[9px] font-bold px-1 rounded">
                                          {degree}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSingleTeacher(m.kode, t.nama)}
                                      className="text-slate-400 hover:text-red-600 font-black text-xs ml-1"
                                      title={`Lepas ${t.nama} dari mapel [${m.kode}]`}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })
                            )}

                          </div>
                        </td>

                        {/* AKSI (Edit pensil oranye & hapus merah) */}
                        <td className="py-2 px-1 text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditMapelModal(m)}
                              className="p-1 rounded border border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 cursor-pointer shadow-2xs"
                              title="Edit Mapel"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingKode(m.kode)}
                              className="p-1 rounded border border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer shadow-2xs"
                              title="Hapus Mapel"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            PANE KANAN: TABEL BEBAN SK GURU (Width ~40%)
           ========================================================================= */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[360px]">
              <thead className="sticky top-0 z-10 bg-[#8faadc] text-[#0d1f42] text-[11px] font-black uppercase tracking-wider border-b-2 border-black shadow-xs">
                <tr className="h-10">
                  <th className="py-2 px-1 text-center border-r-[1.5px] border-black w-8 bg-[#8faadc]">NO.</th>
                  <th className="py-2 px-2 border-r-[1.5px] border-black min-w-[130px] bg-[#8faadc]">NAMA GURU</th>
                  <th
                    className="py-2 px-1 text-center border-r-[1.5px] border-black w-10 bg-[#8faadc] cursor-pointer hover:bg-blue-300 transition-colors"
                    onClick={() => setSortGuruOrder(sortGuruOrder === 'asc' ? 'desc' : 'asc')}
                    title="Klik untuk sortir ID"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span>ID</span>
                      <span className="text-[9px]">{sortGuruOrder === 'asc' ? '▲' : '▼'}</span>
                    </div>
                  </th>
                  <th className="py-2 px-2 border-r-[1.5px] border-black min-w-[150px] bg-[#8faadc]">MATA PELAJARAN</th>
                  <th className="py-2 px-1 text-center min-w-[76px] w-20 bg-[#8faadc]">BEBAN SK</th>
                </tr>
              </thead>
              <tbody className="divide-y-[1.5px] divide-black">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400 font-bold text-xs">
                      Tidak ada guru yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((g, index) => {
                    const w = teacherWorkloadCalculated[g.id] || {
                      mapels: [],
                      totalAllocatedJp: 0,
                      targetBebanSk: g.kode === '1' ? 0 : 28,
                      diff: g.kode === '1' ? 0 : 28,
                      isTuntas: false,
                      isOver: false,
                    };

                    return (
                      <tr key={g.id} className="hover:bg-blue-50/40 transition-colors bg-white font-medium text-xs">
                        {/* NO */}
                        <td className="py-2 px-1 text-center font-bold text-black border-r-[1.5px] border-black align-middle">
                          {index + 1}
                        </td>

                        {/* NAMA GURU */}
                        <td className="py-2 px-2 font-black text-black border-r-[1.5px] border-black tracking-tight text-xs uppercase align-middle">
                          {g.nama}
                        </td>

                        {/* ID */}
                        <td className="py-2 px-1 text-center font-bold text-black border-r-[1.5px] border-black align-middle">
                          {g.kode || g.numId}
                        </td>

                        {/* MATA PELAJARAN (List bertumpuk dengan Nama & JP di kanan) */}
                        <td className="py-2 px-2 border-r-[1.5px] border-black align-middle">
                          <div className="space-y-1">
                            {w.mapels.length === 0 ? (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            ) : (
                              w.mapels.map((badge, bIdx) => (
                                <div
                                  key={bIdx}
                                  className="flex items-center justify-between gap-1 text-[11px] font-bold text-slate-800"
                                >
                                  <span
                                    className="uppercase font-black text-slate-900 tracking-wide text-xs truncate max-w-[155px]"
                                    title={badge.mapel ? `${badge.kode}: ${badge.mapel}` : badge.kode}
                                  >
                                    {badge.kode || badge.mapel}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span
                                      className="bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-black px-1 rounded shadow-2xs"
                                      title={
                                        badge.rombelCount > 1
                                          ? `${badge.jpPerRombel} JP × ${badge.rombelCount} rombel = Total ${badge.totalJp} JP`
                                          : `${badge.jpPerRombel} JP (1 rombel)`
                                      }
                                    >
                                      {badge.jpPerRombel} JP
                                    </span>
                                    {badge.rombelCount > 1 && (
                                      <span
                                        className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-extrabold px-1 rounded shadow-2xs"
                                        title={`Mengajar di ${badge.rombelCount} Rombel Kelas (Total: ${badge.totalJp} JP)`}
                                      >
                                        ×{badge.rombelCount}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </td>

                        {/* BEBAN SK */}
                        <td className="py-2 px-1 text-center align-middle whitespace-nowrap">
                          {w.totalAllocatedJp === 0 ? (
                            <span
                              className="inline-block px-2 py-0.5 rounded border border-slate-300 text-slate-400 font-bold text-xs bg-slate-50"
                              title={
                                w.targetBebanSk > 0
                                  ? `Beban SK: ${w.targetBebanSk} JP (Belum ada rombel dialokasikan)`
                                  : 'Non-Pengajar / Kepala UPT'
                              }
                            >
                              -
                            </span>
                          ) : w.isOver ? (
                            <span
                              className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded border border-red-500 text-red-700 font-black text-xs bg-red-50 shadow-2xs"
                              title={`⚠️ Over Beban SK: ${w.totalAllocatedJp} JP melebihi target ${w.targetBebanSk} JP di Setting Utama Guru & JP (Lebih +${w.totalAllocatedJp - w.targetBebanSk} JP)`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600 stroke-[2.5] shrink-0" />
                              <span>+{w.totalAllocatedJp} JP</span>
                            </span>
                          ) : w.isTuntas ? (
                            <span
                              className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded border border-emerald-500 text-emerald-700 font-black text-xs bg-emerald-50 shadow-2xs"
                              title={`✓ Beban SK Terpenuhi: ${w.totalAllocatedJp} JP sesuai Beban SK (${w.targetBebanSk} JP) [Pas: ${w.targetBebanSk} JP (Tuntas)]`}
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] shrink-0" />
                              <span>+{w.totalAllocatedJp} JP</span>
                            </span>
                          ) : (
                            <span
                              className="inline-block px-2 py-0.5 rounded border border-blue-400 text-blue-700 font-black text-xs bg-blue-50 shadow-2xs"
                              title={`Beban SK: ${w.totalAllocatedJp} JP dari target ${w.targetBebanSk} JP di Matrix SK (Kurang +${w.diff} JP)`}
                            >
                              +{w.totalAllocatedJp} JP
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODALS & CONFIRM DIALOGS
         ========================================================================= */}

      {/* Modal Tambah Guru ke Mapel */}
      {isAddTeacherModalOpen && selectedMapelForTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3 text-white flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-wide">Tugaskan Guru Pengampu</h3>
              <button
                type="button"
                onClick={() => setIsAddTeacherModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200 font-bold">
                <div className="text-slate-500 text-[11px]">Mata Pelajaran:</div>
                <div className="text-blue-900 font-black text-sm uppercase">
                  [{selectedMapelForTeacher.kode}] {selectedMapelForTeacher.mapel}
                </div>
              </div>

              {/* Shortcut Guru Serombel di dalam Modal */}
              {(() => {
                const modalSerombel = findMatchingTeachersForMapel(selectedMapelForTeacher, allTeachers);
                if (modalSerombel.length === 0) return null;
                return (
                  <div className="p-3 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5 uppercase">
                        <Users className="w-4 h-4 text-indigo-600" />
                        Guru Serombel ({modalSerombel.length} Guru Terdeteksi)
                      </span>
                      <span className="text-[10px] bg-indigo-200 text-indigo-900 font-black px-2 py-0.5 rounded-full">
                        SK GURU
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 mb-2.5 line-clamp-2">
                      <span className="font-semibold">{modalSerombel.map((g) => g.nama).join(', ')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleAddSerombelTeachers(selectedMapelForTeacher);
                        setIsAddTeacherModalOpen(false);
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>+ Tambahkan Sekaligus Semua Guru Serombel ({modalSerombel.length} Guru)</span>
                    </button>
                  </div>
                );
              })()}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Guru</label>
                <TeacherSearchSelect
                  teachers={allTeachers}
                  selectedId={selectedTeacherId}
                  onSelect={(teach) => setSelectedTeacherId(teach.id)}
                  placeholder="Ketik untuk mencari nama guru..."
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Beban JP Pengampu</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={selectedTeacherJp}
                  onChange={(e) => setSelectedTeacherJp(Number(e.target.value) || 2)}
                  className="w-full font-bold px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddTeacherModalOpen(false)}
                  className="px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-100 rounded"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddTeacher}
                  className="px-4 py-1.5 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm"
                >
                  Tugaskan &amp; Alirkan ke Matrix SK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Mapel */}
      {isMapelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3 text-white flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-wide">
                {editingMapel ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMapelModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMapelModal} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">No. Urut</label>
                  <input
                    type="number"
                    value={modalNo}
                    onChange={(e) => setModalNo(Number(e.target.value) || 1)}
                    className="w-full text-xs font-bold px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kode Mapel</label>
                  <input
                    type="text"
                    value={modalKode}
                    onChange={(e) => setModalKode(e.target.value.toUpperCase())}
                    placeholder="Misal: PAI1"
                    className="w-full text-xs font-bold px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Mata Pelajaran</label>
                <input
                  type="text"
                  value={modalNama}
                  onChange={(e) => setModalNama(e.target.value)}
                  placeholder="Misal: PENDIDIKAN AGAMA ISLAM 1"
                  className="w-full text-xs font-bold px-2.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Beban JP</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={modalJp}
                    onChange={(e) => setModalJp(Number(e.target.value) || 2)}
                    className="w-full text-xs font-bold px-2 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none text-center"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={modalKategori}
                    onChange={(e) => setModalKategori(e.target.value)}
                    className="w-full text-xs font-bold px-1.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                  >
                    <option value="UMUM">UMUM</option>
                    <option value="AK">AK</option>
                    <option value="TKR">TKR</option>
                    <option value="TKJ">TKJ</option>
                    <option value="PSPT">PSPT</option>
                    <option value="KULINER">KUL</option>
                    <option value="DPB">DPB</option>
                    <option value="LAS">LAS</option>
                    <option value="APAT">APAT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tingkat</label>
                  <select
                    value={modalTingkat}
                    onChange={(e) => setModalTingkat(e.target.value as any)}
                    className="w-full text-xs font-bold px-1.5 py-1.5 border border-slate-300 rounded focus:border-blue-500 focus:outline-none text-center"
                  >
                    <option value="X">Kelas X</option>
                    <option value="XI">Kelas XI</option>
                    <option value="XII">Kelas XII</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsMapelModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 1: Edit Mata Pelajaran & Team Teaching (Sesuai Gambar 2) */}
      {teamTeachingModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                Edit Mata Pelajaran
              </h3>
              <button
                type="button"
                onClick={() => setTeamTeachingModal((prev) => ({ ...prev, isOpen: false }))}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs">
              {/* Row 1: Kode Mata Pelajaran & Nama Mata Pelajaran */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Kode Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    value={teamTeachingModal.mapelKode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setTeamTeachingModal((prev) => ({ ...prev, mapelKode: val }));
                    }}
                    className="w-full bg-white text-slate-800 font-semibold text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
                    placeholder="Contoh: PR03PSPT"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    value={teamTeachingModal.mapelNama}
                    onChange={(e) =>
                      setTeamTeachingModal((prev) => ({ ...prev, mapelNama: e.target.value }))
                    }
                    className="w-full bg-white text-slate-800 font-semibold text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
                    placeholder="Contoh: PRODUKTIF 3 FASE F PSPT"
                  />
                </div>
              </div>

              {/* Row 2: Jenis Mata Pelajaran & Box Beban Jam Total */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jenis Mata Pelajaran
                  </label>
                  <div className="relative">
                    <select
                      value={teamTeachingModal.jenis}
                      onChange={(e) =>
                        setTeamTeachingModal((prev) => ({
                          ...prev,
                          jenis: e.target.value as 'PRODUKTIF' | 'REGULER',
                        }))
                      }
                      className="w-full bg-white text-slate-800 font-medium text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-xs pr-8"
                    >
                      <option value="PRODUKTIF">🔵 Produktif (P) / Kejuruan</option>
                      <option value="REGULER">⚪ Umum / Muatan Nasional</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Box Beban Jam Total */}
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs">
                      <span>💼</span>
                      <span>Beban Jam Total</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                      {teamTeachingModal.jpPerRombel * teamTeachingModal.jumlahRombel} JP Total
                    </span>
                  </div>

                  {/* Kalkulator Beban / Rombel x Jumlah Rombel = Total */}
                  <div className="flex items-center justify-between gap-1.5 text-xs text-slate-600 font-medium pt-1">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 mb-1">Beban / Rombel</div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="48"
                          value={teamTeachingModal.jpPerRombel}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setTeamTeachingModal((prev) => ({ ...prev, jpPerRombel: val }));
                          }}
                          className="w-14 text-center font-bold text-xs bg-white border border-slate-300 rounded-md py-1 shadow-xs"
                        />
                        <span className="text-[11px] font-bold text-slate-500">JP</span>
                      </div>
                    </div>

                    <span className="text-slate-400 font-bold text-sm mt-3">×</span>

                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 mb-1">Jumlah Rombel</div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="48"
                          value={teamTeachingModal.jumlahRombel}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setTeamTeachingModal((prev) => ({ ...prev, jumlahRombel: val }));
                          }}
                          className="w-14 text-center font-bold text-xs bg-white border border-slate-300 rounded-md py-1 shadow-xs"
                        />
                        <span className="text-[11px] text-slate-500">Rombel</span>
                      </div>
                    </div>

                    <span className="text-slate-400 font-bold text-sm mt-3">=</span>

                    <div className="text-center">
                      <div className="text-[10px] font-bold text-blue-600 mb-1">Beban Jam Total</div>
                      <div className="px-3.5 py-1 rounded-lg border-2 border-blue-500 bg-white text-blue-600 font-black text-sm flex items-center justify-center gap-1 shadow-xs">
                        <span>{teamTeachingModal.jpPerRombel * teamTeachingModal.jumlahRombel}</span>
                        <span className="text-[10px] font-bold">JP</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-tight pt-1">
                    💡 <strong>Beban Jam Total:</strong> {teamTeachingModal.jpPerRombel} JP × {teamTeachingModal.jumlahRombel} rombel ={' '}
                    <strong>{teamTeachingModal.jpPerRombel * teamTeachingModal.jumlahRombel} JP</strong>. Beban {teamTeachingModal.jpPerRombel * teamTeachingModal.jumlahRombel} JP ini digunakan mengajar di {teamTeachingModal.jumlahRombel} rombel kelas (masing-masing {teamTeachingModal.jpPerRombel} JP).
                  </p>
                </div>
              </div>

              {/* Row 3: Jenjang Sasaran & Program Sasaran */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jenjang Sasaran
                  </label>
                  <div className="relative">
                    <select
                      value={teamTeachingModal.jenjang}
                      onChange={(e) => {
                        const nextJ = e.target.value as 'X' | 'XI' | 'XII';
                        const stdJp = getProductiveStandardJp(nextJ, teamTeachingModal.mapelKode);
                        const relRombels = ROMBELS_48.filter((r) => {
                          const mJ = r.tingkat === nextJ;
                          return teamTeachingModal.program === 'ALL'
                            ? mJ
                            : mJ && r.jurusanKode === teamTeachingModal.program;
                        });
                        setTeamTeachingModal((prev) => ({
                          ...prev,
                          jenjang: nextJ,
                          jpPerRombel: stdJp,
                          jumlahRombel: relRombels.length || 2,
                        }));
                      }}
                      className="w-full bg-white text-slate-800 font-medium text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-xs pr-8"
                    >
                      <option value="X">Kelas X (Standar: 12 JP)</option>
                      <option value="XI">Kelas XI (Standar: 18 JP)</option>
                      <option value="XII">Kelas XII (Standar: 22 JP)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Program Sasaran
                  </label>
                  <div className="relative">
                    <select
                      value={teamTeachingModal.program}
                      onChange={(e) => {
                        const nextP = e.target.value;
                        const relRombels = ROMBELS_48.filter((r) => {
                          const mJ = r.tingkat === teamTeachingModal.jenjang;
                          return nextP === 'ALL' ? mJ : mJ && r.jurusanKode === nextP;
                        });
                        setTeamTeachingModal((prev) => ({
                          ...prev,
                          program: nextP,
                          jumlahRombel: relRombels.length || 2,
                        }));
                      }}
                      className="w-full bg-white text-slate-800 font-medium text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-xs pr-8"
                    >
                      {JURUSAN_GROUPS.map((j) => (
                        <option key={j.kode} value={j.kode}>
                          {j.kode} — {j.nama}
                        </option>
                      ))}
                      <option value="ALL">Semua Program Keahlian (Lintas Jurusan)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Main Card: Guru Pengampu & Pemilihan Rombel Kelas yang Diajar */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3.5">
                {/* Header Card Section */}
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-xs sm:text-sm">
                    <span>👨‍🏫</span>
                    <span>Guru Pengampu & Pemilihan Rombel Kelas yang Diajar</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Pilih rombel kelas per nama guru. Tiap kelas mewakili beban JP mapel dan langsung memotong beban SK guru hingga 0 JP (Tuntas).
                  </p>
                </div>

                {/* Toolbar Aksi */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Toggle Tampilkan Semua 48 Kelas */}
                    <button
                      type="button"
                      onClick={() =>
                        setTeamTeachingModal((prev) => ({ ...prev, showAll48: !prev.showAll48 }))
                      }
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                        teamTeachingModal.showAll48
                          ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs'
                      }`}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${
                          teamTeachingModal.showAll48 ? 'rotate-180 text-blue-600' : 'text-slate-500'
                        }`}
                      />
                      <span>
                        {teamTeachingModal.showAll48 ? 'Tampilkan Kelas Sasaran Saja' : '▼ Tampilkan Semua 48 Kelas'}
                      </span>
                    </button>

                    {/* Tombol Bagi Rata Kelas */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetRombels = teamTeachingModal.showAll48
                          ? ROMBELS_48
                          : ROMBELS_48.filter((r) => {
                              const matchL = r.tingkat === teamTeachingModal.jenjang;
                              return teamTeachingModal.program === 'ALL'
                                ? matchL
                                : matchL && r.jurusanKode === teamTeachingModal.program;
                            });

                        const teacherCount = teamTeachingModal.teachers.length;
                        if (teacherCount === 0) return;

                        // Bagi rata rombel ke guru
                        const nextTeachers = teamTeachingModal.teachers.map((t, idx) => {
                          const assigned = targetRombels.filter(
                            (_, rIdx) => rIdx % teacherCount === idx
                          );
                          return {
                            ...t,
                            selectedRombels: assigned.map((r) => r.id),
                          };
                        });

                        setTeamTeachingModal((prev) => ({ ...prev, teachers: nextTeachers }));
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Bagi Rata Kelas</span>
                    </button>

                    {/* Preset Team Teaching */}
                    <button
                      type="button"
                      onClick={() => {
                        const std = teamTeachingModal.jpPerRombel;
                        const t0 = teamTeachingModal.teachers[0];
                        const t1 = teamTeachingModal.teachers[1];
                        const t2 = teamTeachingModal.teachers[2];
                        if (t0 && t1) {
                          const nextTeachers = teamTeachingModal.teachers.map((t, i) => {
                            let newJp = t.jp;
                            if (std === 12) {
                              if (i === 0) newJp = 9;
                              else if (i === 1) newJp = 3;
                            } else if (std === 18) {
                              if (t2) {
                                if (i === 0) newJp = 6;
                                else if (i === 1) newJp = 8;
                                else if (i === 2) newJp = 4;
                              } else {
                                if (i === 0) newJp = 10;
                                else if (i === 1) newJp = 8;
                              }
                            } else if (std === 22) {
                              if (t2) {
                                if (i === 0) newJp = 6;
                                else if (i === 1) newJp = 4;
                                else if (i === 2) newJp = 12;
                              } else {
                                if (i === 0) newJp = 12;
                                else if (i === 1) newJp = 10;
                              }
                            }
                            return { ...t, jp: newJp };
                          });
                          setTeamTeachingModal((prev) => ({ ...prev, teachers: nextTeachers }));
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>
                        Team Teaching ({teamTeachingModal.jpPerRombel === 12 ? '9 & 3 JP' : teamTeachingModal.jpPerRombel === 18 ? '6, 8 & 4 JP' : '6, 4 & 12 JP'})
                      </span>
                    </button>
                  </div>

                  {/* Tombol Tambah Guru (Hijau) */}
                  <button
                    type="button"
                    onClick={() => {
                      const availableGurus = allTeachers;
                      const unused = availableGurus.find(
                        (g) => !teamTeachingModal.teachers.some((t) => t.id === g.id)
                      ) || allTeachers[0];

                      if (unused) {
                        setTeamTeachingModal((prev) => ({
                          ...prev,
                          teachers: [
                            ...prev.teachers,
                            {
                              id: unused.id,
                              nama: unused.nama,
                              kode: unused.kode,
                              jp: Math.max(
                                1,
                                prev.jpPerRombel -
                                  prev.teachers.reduce((acc, cur) => acc + Number(cur.jp || 0), 0)
                              ) || Math.round(prev.jpPerRombel / (prev.teachers.length + 1)),
                              selectedRombels: [],
                            },
                          ],
                        }));
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Tambah Guru</span>
                  </button>
                </div>

                {/* Info Guru Pengampu */}
                <div className="bg-blue-50/70 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-900">
                      👥 Guru Pengampu ({teamTeachingModal.teachers.length} Guru Ditugaskan)
                    </span>
                    <span className="text-[11px] text-blue-700">
                      • Seluruh {allTeachers.length} guru sekolah dapat dicari langsung melalui kolom pencarian di setiap kartu guru
                    </span>
                  </div>
                </div>

                {/* Daftar Kartu Guru (Sesuai Gambar 2) */}
                <div className="space-y-3 pt-1">
                  {teamTeachingModal.teachers.map((teacher, idx) => {
                    const workload = getTeacherWorkloadInfo(
                      teacher.id,
                      teamTeachingModal.mapelKode,
                      Number(teacher.jp || 0) * teacher.selectedRombels.length
                    );

                    // Daftar rombel target yang ditampilkan
                    const displayRombels = teamTeachingModal.showAll48
                      ? ROMBELS_48
                      : ROMBELS_48.filter((r) => {
                          const matchL = r.tingkat === teamTeachingModal.jenjang;
                          return teamTeachingModal.program === 'ALL'
                            ? matchL
                            : matchL && r.jurusanKode === teamTeachingModal.program;
                        });

                    return (
                      <div
                        key={idx}
                        className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5 shadow-xs"
                      >
                        {/* Baris Atas Guru: Nomor + Dropdown Guru + Input JP + Badge Over + Tombol X */}
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 text-xs w-4 shrink-0">
                            {idx + 1}.
                          </span>

                          {/* Dropdown Guru dengan Search (Semua Guru Sekolah) */}
                          <div className="flex-1 min-w-[200px]">
                            <TeacherSearchSelect
                              teachers={allTeachers}
                              selectedId={teacher.id}
                              onSelect={(selTeacher) => {
                                const nextT = teamTeachingModal.teachers.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        id: selTeacher.id,
                                        nama: selTeacher.nama,
                                        kode: selTeacher.kode,
                                      }
                                    : item
                                );
                                setTeamTeachingModal((prev) => ({ ...prev, teachers: nextT }));
                              }}
                              placeholder="Ketik untuk mencari nama guru / ID..."
                              size="sm"
                            />
                          </div>

                          {/* Input JP */}
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min="1"
                              max={teamTeachingModal.jpPerRombel}
                              value={teacher.jp}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const nextT = teamTeachingModal.teachers.map((item, i) =>
                                  i === idx ? { ...item, jp: val } : item
                                );
                                setTeamTeachingModal((prev) => ({ ...prev, teachers: nextT }));
                              }}
                              className="w-14 text-center font-bold text-xs bg-white text-blue-700 border border-slate-300 rounded-lg py-1.5 shadow-xs focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs font-bold text-slate-600">JP</span>
                          </div>

                          {/* Badge Status Beban SK Guru (Over / Pas / Kurang) */}
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border shrink-0 ${workload.badgeClass}`}
                          >
                            {workload.text}
                          </span>

                          {/* Tombol Hapus Guru [X] */}
                          <button
                            type="button"
                            onClick={() => {
                              const nextT = teamTeachingModal.teachers.filter((_, i) => i !== idx);
                              setTeamTeachingModal((prev) => ({ ...prev, teachers: nextT }));
                            }}
                            className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer shrink-0"
                            title="Hapus Guru"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Garis Pemisah Putus-Putus */}
                        <div className="border-t border-dashed border-slate-200 pt-2 space-y-2">
                          {/* Info Pemilihan Rombel */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                              <span>💼</span>
                              <span>
                                Rombel Kelas & Alokasi Jam Diajar oleh{' '}
                                <strong className="text-blue-700">{teacher.nama}</strong>:
                              </span>
                            </div>
                            {teacher.selectedRombels.length === 0 ? (
                              <span className="text-amber-600 font-bold text-[11px]">
                                ⚠️ Belum memilih kelas (0 JP)
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold text-[11px]">
                                ✓ {teacher.selectedRombels.length} Kelas Terpilih ({Number(teacher.jp || 0) * teacher.selectedRombels.length} JP)
                              </span>
                            )}
                          </div>

                          {/* Checkbox Tombol Rombel Kelas */}
                          <div className="flex flex-wrap items-center gap-2">
                            {displayRombels.map((rombel) => {
                              const isChecked = teacher.selectedRombels.includes(rombel.id);
                              return (
                                <button
                                  key={rombel.id}
                                  type="button"
                                  onClick={() => {
                                    const nextT = teamTeachingModal.teachers.map((item, i) => {
                                      if (i !== idx) return item;
                                      const exists = item.selectedRombels.includes(rombel.id);
                                      return {
                                        ...item,
                                        selectedRombels: exists
                                          ? item.selectedRombels.filter((id) => id !== rombel.id)
                                          : [...item.selectedRombels, rombel.id],
                                      };
                                    });
                                    setTeamTeachingModal((prev) => ({ ...prev, teachers: nextT }));
                                  }}
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-xs ${
                                    isChecked
                                      ? 'bg-blue-50/80 border-blue-400 text-blue-900 ring-1 ring-blue-400'
                                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                                  />
                                  <span>{rombel.nama}</span>
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100/70 text-blue-700 border border-blue-200">
                                    {teamTeachingModal.jpPerRombel} JP
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Banner Status Keterisian Kelas Sasaran (Sesuai Gambar 2) */}
                {(() => {
                  const targetRombels = ROMBELS_48.filter((r) => {
                    const matchL = r.tingkat === teamTeachingModal.jenjang;
                    return teamTeachingModal.program === 'ALL'
                      ? matchL
                      : matchL && r.jurusanKode === teamTeachingModal.program;
                  });

                  // Hitung total JP per rombel dari seluruh guru yang memilih rombel tsb
                  const rombelStatusList = targetRombels.map((rombel) => {
                    let totalJp = 0;
                    const assignedTeachers: string[] = [];
                    teamTeachingModal.teachers.forEach((t) => {
                      if (t.selectedRombels.includes(rombel.id)) {
                        totalJp += Number(t.jp || 0);
                        assignedTeachers.push(t.nama);
                      }
                    });
                    const isFulfilled = totalJp === teamTeachingModal.jpPerRombel;
                    const isOver = totalJp > teamTeachingModal.jpPerRombel;
                    return {
                      rombel,
                      totalJp,
                      assignedTeachers,
                      isFulfilled,
                      isOver,
                    };
                  });

                  const fulfilledCount = rombelStatusList.filter((s) => s.isFulfilled).length;

                  return (
                    <div className="bg-amber-50/50 border border-amber-300/80 rounded-xl p-3.5 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-bold text-amber-900 flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>
                            Status Keterisian Kelas Sasaran ({fulfilledCount}/{targetRombels.length} Kelas Terpenuhi):
                          </span>
                        </div>
                        <span className="font-semibold text-slate-600 text-[11px]">
                          Standar Beban: {teamTeachingModal.jpPerRombel} JP/kelas
                        </span>
                      </div>

                      {/* Chips Status Rombel */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {rombelStatusList.map(({ rombel, totalJp, isFulfilled, isOver }) => {
                          if (totalJp === 0) {
                            return (
                              <div
                                key={rombel.id}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                              >
                                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                <span>
                                  {rombel.nama} : Belum Ada Guru (0/{teamTeachingModal.jpPerRombel} JP)
                                </span>
                              </div>
                            );
                          }

                          if (isFulfilled) {
                            return (
                              <div
                                key={rombel.id}
                                className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                              >
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span>
                                  {rombel.nama} : Terpenuhi ({totalJp}/{teamTeachingModal.jpPerRombel} JP)
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={rombel.id}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 shadow-xs ${
                                isOver
                                  ? 'border-red-300 bg-red-50 text-red-700'
                                  : 'border-amber-300 bg-amber-50 text-amber-800'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${isOver ? 'bg-red-500' : 'bg-amber-500'}`}
                              ></span>
                              <span>
                                {rombel.nama} : {totalJp}/{teamTeachingModal.jpPerRombel} JP ({isOver ? 'Kelebihan' : 'Belum Lengkap'})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer Modal Action (Sesuai Gambar 2) */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setTeamTeachingModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyTeamTeaching}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/20 transition-colors cursor-pointer"
              >
                <span>Simpan Mapel & Alokasi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog Kosongkan Guru Pengampu */}
      <ConfirmDialog
        isOpen={confirmClearOpen}
        title="Kosongkan Rencana Pengampu?"
        message="Tindakan ini akan mengosongkan seluruh rencana nama guru pengampu pada semua 82 mata pelajaran dan me-reset beban di Matrix SK. Apakah Anda yakin?"
        confirmLabel="Ya, Kosongkan"
        variant="danger"
        onConfirm={handleClearAllRencana}
        onCancel={() => setConfirmClearOpen(false)}
      />

      {/* Confirm Dialog Distribusi Otomatis */}
      <ConfirmDialog
        isOpen={confirmAutoDistributeOpen}
        title="Distribusi Otomatis Kurikulum SK?"
        message="Sistem akan memetakan rencana guru pengampu dari kurikulum resmi SK ke seluruh mata pelajaran dan otomatis menyinkronkannya ke Matrix SK. Lanjutkan?"
        confirmLabel="Ya, Terapkan Distribusi"
        variant="primary"
        onConfirm={handleAutoDistributeOfficialCurriculum}
        onCancel={() => setConfirmAutoDistributeOpen(false)}
      />

      {/* Confirm Dialog Hapus Satu Mapel */}
      <ConfirmDialog
        isOpen={!!deletingKode}
        title="Hapus Mata Pelajaran?"
        message={`Apakah Anda yakin ingin menghapus mapel [${deletingKode}] dari katalog kurikulum?`}
        confirmLabel="Ya, Hapus"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingKode(null)}
      />
    </div>
  );
};
