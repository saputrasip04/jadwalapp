// src/features/02-mapel/MapelView.tsx
import React, { useState, useEffect, useMemo } from 'react';
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
  isDegreeOnly,
  isSameTeacher,
  sanitizeMapelGuruData,
} from '../../domain/curriculum-data';
import {
  assignTeacherToMapelAutoSync,
  assignBatchTeachersToMapelAutoSync,
  autoAssignAllSerombelTeachers,
  removeTeacherFromMapelAutoSync,
  resetSingleMapelGuruAutoSync,
  getStoredMapelList,
  getStoredMatrixGrid,
  performFullTwoWaySync,
  MatrixGridStorage,
} from '../../domain/sync-mapel-matrix';
import * as XLSX from 'xlsx';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Download,
  RotateCcw,
  RotateCw,
  Lock,
  RefreshCw,
  Zap,
  X,
  Users,
} from 'lucide-react';

export const MapelView: React.FC = () => {
  const { addToast } = useToastStore();
  const { setActiveMenu } = useAppStore();

  // Load daftar guru dari database lokal Dexie
  const dbGuruList = useLiveQuery(() => db.guru.toArray()) ?? [];

  // Jika db.guru belum memiliki guru, gunakan daftar guru resmi sekolah
  const allTeachers = useMemo(() => {
    if (dbGuruList && dbGuruList.length > 0) {
      const list = dbGuruList
        .filter((g) => g.aktif !== 0)
        .map((g, idx) => {
          const skT = SK_TEACHERS_DEFAULT.find(
            (t) => isSameTeacher(t.nama, g.nama) || String(t.kode) === String(g.kode)
          );
          return {
            id: g.id,
            numId: Number(g.kode || g.id) || idx + 1,
            nama: g.nama,
            kode: g.kode || String(idx + 1),
            tipe: (g.tipe_guru === 'PRODUKTIF' ? 'P' : 'R') as 'R' | 'P',
            sk_guru: g.sk_guru || skT?.mapelUtama || '',
          };
        });

      // Lengkapi dengan guru resmi SK_TEACHERS_DEFAULT jika belum ada di db.guru
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
    }));
  }, [dbGuruList]);

  // State Daftar Mapel & Kode
  const [mapelList, setMapelList] = useState<DaftarMapelKodeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKategori, setFilterKategori] = useState('ALL');
  const [filterTingkat, setFilterTingkat] = useState('ALL');
  const [filterTipe, setFilterTipe] = useState<'ALL' | 'P' | 'R'>('ALL');

  // Modal Tambah / Edit Mapel
  const [isMapelModalOpen, setIsMapelModalOpen] = useState(false);
  const [editingMapel, setEditingMapel] = useState<DaftarMapelKodeItem | null>(null);
  const [modalNo, setModalNo] = useState<number>(1);
  const [modalKode, setModalKode] = useState('');
  const [modalNama, setModalNama] = useState('');
  const [modalJp, setModalJp] = useState<number>(2);
  const [modalKategori, setModalKategori] = useState('UMUM');
  const [modalTingkat, setModalTingkat] = useState<'X' | 'XI' | 'XII'>('X');

  // Modal Tambah Guru ke Mapel
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  const [selectedMapelForTeacher, setSelectedMapelForTeacher] = useState<DaftarMapelKodeItem | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedTeacherJp, setSelectedTeacherJp] = useState<number>(2);

  // Confirm Dialogs
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmAutoSerombelOpen, setConfirmAutoSerombelOpen] = useState(false);
  const [deletingKode, setDeletingKode] = useState<string | null>(null);

  // Load data awal dari storage
  const loadData = async () => {
    try {
      const raw = await getStoredMapelList();
      let needsPersist = false;
      const items = raw.map((m) => {
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
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Memuat Mapel', message: String(err) });
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

  // Helper mengekstrak daftar guru yang ditugaskan di suatu mapel
  const getAssignedTeachers = (m: DaftarMapelKodeItem) => {
    if (!m.guruJp || typeof m.guruJp !== 'object' || Object.keys(m.guruJp).length === 0) {
      if (!m.guru || m.guru.trim() === '') return [];
      const parts = m.guru.split(/[;\n]+/).map((s) => s.trim()).filter((s) => s && !isDegreeOnly(s));
      return parts.map((name) => {
        const match = allTeachers.find(
          (g) => g.nama.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        return {
          id: match ? match.id : '',
          kode: match ? match.kode : '',
          nama: match ? match.nama : name,
          jp: m.jp,
        };
      });
    }

    const res: { id: string; kode: string; nama: string; jp: number }[] = [];
    for (const [tName, jpVal] of Object.entries(m.guruJp)) {
      if (!tName || isDegreeOnly(tName)) continue;
      const match = allTeachers.find(
        (g) => g.nama.toLowerCase().replace(/[^a-z0-9]/g, '') === tName.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      res.push({
        id: match ? match.id : '',
        kode: match ? match.kode : '',
        nama: match ? match.nama : tName,
        jp: Number(jpVal) || m.jp,
      });
    }
    return res.filter((t) => !isDegreeOnly(t.nama));
  };

  // Helper badge kategori warna khas masing-masing
  const getKategoriBadgeStyle = (kategori: string) => {
    const k = (kategori || '').toUpperCase().trim();
    switch (k) {
      case 'UMUM':
        return { pill: 'bg-blue-50 text-blue-700 border-blue-300', dot: 'bg-blue-500' };
      case 'AK':
        return { pill: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' };
      case 'TKR':
        return { pill: 'bg-rose-50 text-rose-700 border-rose-300', dot: 'bg-rose-500' };
      case 'TKJ':
        return { pill: 'bg-indigo-50 text-indigo-700 border-indigo-300', dot: 'bg-indigo-500' };
      case 'PSPT':
        return { pill: 'bg-purple-50 text-purple-700 border-purple-300', dot: 'bg-purple-500' };
      case 'KULINER':
      case 'KUL':
        return { pill: 'bg-amber-50 text-amber-800 border-amber-300', dot: 'bg-amber-500' };
      case 'DPB':
      case 'FASHION':
        return { pill: 'bg-pink-50 text-pink-700 border-pink-300', dot: 'bg-pink-500' };
      case 'LAS':
        return { pill: 'bg-slate-100 text-slate-800 border-slate-400', dot: 'bg-slate-600' };
      case 'APAT':
        return { pill: 'bg-teal-50 text-teal-800 border-teal-300', dot: 'bg-teal-500' };
      default:
        return { pill: 'bg-cyan-50 text-cyan-800 border-cyan-300', dot: 'bg-cyan-500' };
    }
  };

  // 1. TAMBAH GURU KE MAPEL (OTOMATIS ALIRKAN KE MATRIX SK!)
  const handleOpenAddTeacherModal = (m: DaftarMapelKodeItem) => {
    setSelectedMapelForTeacher(m);
    setSelectedTeacherId(allTeachers[0]?.id || '');
    setSelectedTeacherJp(m.jp);
    setIsAddTeacherModalOpen(true);
  };

  // =========================================================================
  // SISTEM UNDO & REDO SATU LANGKAH / EKSEKUSI SEBELUMNYA
  // =========================================================================
  interface UndoStateItem {
    mapelList: DaftarMapelKodeItem[];
    matrixGrid: MatrixGridStorage;
    description: string;
    timestamp: number;
  }

  const [undoStack, setUndoStack] = useState<UndoStateItem[]>([]);
  const [redoStack, setRedoStack] = useState<UndoStateItem[]>([]);

  const saveSnapshot = async (description: string) => {
    try {
      const grid = await getStoredMatrixGrid();
      setUndoStack((prev) => [
        ...prev.slice(-29),
        {
          mapelList: JSON.parse(JSON.stringify(mapelList)),
          matrixGrid: JSON.parse(JSON.stringify(grid)),
          description,
          timestamp: Date.now(),
        },
      ]);
      setRedoStack([]);
    } catch {
      // fallback
    }
  };

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

    try {
      const currentGrid = await getStoredMatrixGrid();
      setRedoStack((prev) => [
        ...prev.slice(-29),
        {
          mapelList: JSON.parse(JSON.stringify(mapelList)),
          matrixGrid: JSON.parse(JSON.stringify(currentGrid)),
          description: previousState.description,
          timestamp: Date.now(),
        },
      ]);

      setMapelList(previousState.mapelList);
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
      addToast({ type: 'error', title: 'Gagal Melakukan Undo', message: String(err) });
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const newRedoStack = [...redoStack];
    const nextState = newRedoStack.pop()!;
    setRedoStack(newRedoStack);

    try {
      const currentGrid = await getStoredMatrixGrid();
      setUndoStack((prev) => [
        ...prev.slice(-29),
        {
          mapelList: JSON.parse(JSON.stringify(mapelList)),
          matrixGrid: JSON.parse(JSON.stringify(currentGrid)),
          description: nextState.description,
          timestamp: Date.now(),
        },
      ]);

      setMapelList(nextState.mapelList);
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
      addToast({ type: 'error', title: 'Gagal Melakukan Redo', message: String(err) });
    }
  };

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
  }, [undoStack, redoStack, mapelList]);

  const handleConfirmAddTeacher = async () => {
    if (!selectedMapelForTeacher || !selectedTeacherId) return;
    const targetGuru = allTeachers.find((g) => g.id === selectedTeacherId);
    if (!targetGuru) return;

    try {
      await saveSnapshot(`Tugaskan ${targetGuru.nama} ke [${selectedMapelForTeacher.kode}]`);
      const { updatedMapelList } = await assignTeacherToMapelAutoSync(
        selectedMapelForTeacher.kode,
        { id: targetGuru.id, nama: targetGuru.nama, kode: targetGuru.kode },
        selectedTeacherJp
      );
      setMapelList(updatedMapelList);
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

  // 2. LEPAS SATU GURU DARI MAPEL (OTOMATIS LEPAS DI MATRIX SK!)
  const handleRemoveSingleTeacher = async (kodeMapel: string, teacherName: string) => {
    try {
      await saveSnapshot(`Hapus guru ${teacherName} dari [${kodeMapel}]`);
      const { updatedMapelList } = await removeTeacherFromMapelAutoSync(kodeMapel, teacherName);
      setMapelList(updatedMapelList);
      addToast({
        type: 'info',
        title: '✓ Sinkron 2 Arah Otomatis',
        message: `${teacherName} dilepas dari [${kodeMapel}]. Tekan "Undo" (Ctrl+Z) jika ingin membatalkan.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Melepas Guru', message: String(err) });
    }
  };

  // 3. RESET RENCANA GURU DI SATU BARIS MAPEL (OTOMATIS BERSIHKAN DI MATRIX SK!)
  const handleResetSingleMapel = async (kodeMapel: string) => {
    try {
      await saveSnapshot(`Reset rencana guru mapel [${kodeMapel}]`);
      const { updatedMapelList } = await resetSingleMapelGuruAutoSync(kodeMapel);
      setMapelList(updatedMapelList);
      addToast({
        type: 'info',
        title: '✓ Sinkron 2 Arah Otomatis',
        message: `Rencana guru untuk mapel [${kodeMapel}] telah di-reset. Tekan "Undo" (Ctrl+Z) jika ingin membatalkan.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Reset Mapel', message: String(err) });
    }
  };

  // 4. TAMBAH GURU SEROMBEL KE SATU MAPEL (OTOMATIS ALIRKAN KE MATRIX SK!)
  const handleAddSerombelTeachers = async (m: DaftarMapelKodeItem) => {
    const matchingTeachers = findMatchingTeachersForMapel(m, allTeachers);
    if (matchingTeachers.length === 0) {
      addToast({
        type: 'warning',
        title: 'Guru Serombel Tidak Ditemukan',
        message: `Tidak ditemukan guru di Menu 1 Setting dengan kolom SK GURU yang cocok untuk mapel [${m.kode} - ${m.mapel}]. Periksa kembali isian kolom SK GURU di Menu 1.`,
      });
      return;
    }

    try {
      await saveSnapshot(`Tugaskan guru serombel untuk [${m.kode}]`);
      const { updatedMapelList } = await assignBatchTeachersToMapelAutoSync(
        m.kode,
        matchingTeachers.map((t) => ({ id: t.id, nama: t.nama, kode: t.kode, jp: m.jp })),
        m.jp
      );
      setMapelList(updatedMapelList);

      const names = matchingTeachers.map((t) => t.nama).join(', ');
      addToast({
        type: 'success',
        title: '✓ Guru Serombel Berhasil Ditugaskan',
        message: `${matchingTeachers.length} guru pengampu serombel (${names}) berhasil ditugaskan ke [${m.kode}] dan OTOMATIS terisi di Matrix SK!`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menugaskan Guru Serombel', message: String(err) });
    }
  };

  // 5. AUTO-ISI SEMUA GURU SEROMBEL UNTUK SELURUH MAPEL DARI SK GURU
  const handleAutoAssignAllSerombel = async () => {
    try {
      await saveSnapshot('Auto-Isi Semua Guru Serombel');
      const { updatedMapelList, totalAssignedCount, affectedMapelCount } =
        await autoAssignAllSerombelTeachers(allTeachers);
      setMapelList(updatedMapelList);
      setConfirmAutoSerombelOpen(false);

      if (totalAssignedCount === 0) {
        addToast({
          type: 'info',
          title: 'Guru Serombel Sudah Lengkap',
          message: 'Seluruh mata pelajaran telah memiliki guru serombel sesuai data SK GURU.',
        });
      } else {
        addToast({
          type: 'success',
          title: '✓ Auto-Isi Serombel Berhasil',
          message: `Berhasil menugaskan ${totalAssignedCount} guru serombel ke ${affectedMapelCount} mata pelajaran dan OTOMATIS disinkronkan ke Matrix SK!`,
        });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Auto-Isi Serombel', message: String(err) });
    }
  };

  // 6. KOSONGKAN SELURUH RENCANA GURU DI SEMUA MAPEL
  const handleClearAllRencana = async () => {
    try {
      await saveSnapshot('Kosongkan Seluruh Guru Pengampu');
      const updated = mapelList.map((m) => ({
        ...m,
        guru: '',
        guruJp: {},
      }));
      await persistMapelList(updated);
      await performFullTwoWaySync('MAPEL_TO_MATRIX');
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

  // 5. DISTRIBUSI OTOMATIS KE SELURUH MAPEL
  const handleAutoDistributeOfficialCurriculum = async () => {
    try {
      // Petakan dari kurikulum resmi SK
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
      await performFullTwoWaySync('MAPEL_TO_MATRIX');
      addToast({
        type: 'success',
        title: '✓ Distribusi Otomatis Selesai',
        message: 'Seluruh rencana guru pengampu telah dipetakan dan disinkronkan 2 arah ke Matrix SK!',
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Distribusi Otomatis', message: String(err) });
    }
  };

  // 6. VALIDASI & KUNCI
  const handleLockAndValidate = () => {
    let unassigned = 0;
    mapelList.forEach((m) => {
      const teachers = getAssignedTeachers(m);
      if (teachers.length === 0) unassigned++;
    });

    if (unassigned === 0) {
      addToast({
        type: 'success',
        title: 'Validasi Sempurna',
        message: '✓ 100% Seluruh 82 mata pelajaran telah terisi guru pengampu dan tersinkronisasi!',
      });
    } else {
      addToast({
        type: 'info',
        title: 'Status Validasi',
        message: `Terdapat ${unassigned} dari ${mapelList.length} mata pelajaran yang belum ditentukan guru pengampunya.`,
      });
    }
  };

  // 7. EXPORT EXCEL
  const handleExportExcel = () => {
    try {
      const exportRows = mapelList.map((m) => {
        const teachers = getAssignedTeachers(m);
        const teachersStr =
          teachers.length > 0
            ? teachers.map((t) => (t.kode ? `[${t.kode}] ${t.nama} (${t.jp} JP)` : `${t.nama} (${t.jp} JP)`)).join('; ')
            : 'Belum ditentukan';

        const tingkatStr =
          m.tingkat === 'X'
            ? 'Kelas X (Fase E)'
            : m.tingkat === 'XI'
            ? 'Kelas XI (Fase F)'
            : m.tingkat === 'XII'
            ? 'Kelas XII (Fase F)'
            : m.tingkat;

        return {
          NO: m.no,
          KODE: m.kode,
          'MATA PELAJARAN': m.mapel,
          JP: m.jp,
          KATEGORI: m.kategori,
          TINGKAT: tingkatStr,
          'RENCANA GURU PENGAMPU': teachersStr,
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 38 },
        { wch: 8 },
        { wch: 14 },
        { wch: 22 },
        { wch: 45 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Mapel & Kode');
      XLSX.writeFile(wb, `Daftar_Mata_Pelajaran_Kode_${new Date().toISOString().slice(0, 10)}.xlsx`);

      addToast({
        type: 'success',
        title: 'Ekspor Berhasil',
        message: 'File Excel Daftar Mata Pelajaran & Kode berhasil diunduh.',
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Ekspor', message: String(err) });
    }
  };

  // Modal Tambah / Edit Mapel Handlers
  const handleOpenAddMapelModal = () => {
    const nextNo =
      mapelList.length > 0
        ? Math.max(...mapelList.map((x) => Number(x.no) || 0)) + 1
        : 1;
    setEditingMapel(null);
    setModalNo(nextNo);
    setModalKode('');
    setModalNama('');
    setModalJp(2);
    setModalKategori('UMUM');
    setModalTingkat('X');
    setIsMapelModalOpen(true);
  };

  const handleOpenEditMapelModal = (m: DaftarMapelKodeItem) => {
    setEditingMapel(m);
    setModalNo(m.no);
    setModalKode(m.kode);
    setModalNama(m.mapel);
    setModalJp(m.jp);
    setModalKategori(m.kategori);
    setModalTingkat(m.tingkat);
    setIsMapelModalOpen(true);
  };

  const handleSaveMapelModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalKode.trim() || !modalNama.trim()) {
      addToast({ type: 'warning', title: 'Data Kurang', message: 'Kode dan Nama Mapel wajib diisi.' });
      return;
    }

    const cleanKode = modalKode.trim().toUpperCase();

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
    const updated = mapelList.filter((x) => x.kode !== deletingKode);
    await persistMapelList(updated);
    await performFullTwoWaySync('MAPEL_TO_MATRIX');
    setDeletingKode(null);
    addToast({ type: 'info', title: 'Mapel Dihapus', message: `Mapel [${deletingKode}] telah dihapus dan disinkronkan.` });
  };

  // Filter List
  const filteredMapel = useMemo(() => {
    return mapelList.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !searchQuery ||
        m.kode.toLowerCase().includes(q) ||
        m.mapel.toLowerCase().includes(q) ||
        (m.guru && m.guru.toLowerCase().includes(q));

      const matchKategori = filterKategori === 'ALL' || m.kategori.toUpperCase() === filterKategori.toUpperCase();
      const matchTingkat = filterTingkat === 'ALL' || m.tingkat === filterTingkat;
      const isProd = m.kategori.toUpperCase() !== 'UMUM';
      const matchTipe = filterTipe === 'ALL' || (filterTipe === 'P' ? isProd : !isProd);

      return matchSearch && matchKategori && matchTingkat && matchTipe;
    });
  }, [mapelList, searchQuery, filterKategori, filterTingkat, filterTipe]);

  if (loading) {
    return <div className="p-8 text-slate-500 font-semibold">Memuat Daftar Mata Pelajaran & Kode...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col min-h-0 space-y-2 font-sans select-none overflow-hidden">
      {/* 1. Header Toolbar Biru Royal (Persis Desain & Tombol Lengkap) */}
      <div className="bg-[#1b4cb4] rounded-xl px-4 py-3 text-white shadow-md border border-blue-400/30 space-y-2.5 shrink-0">
        {/* Row 1: Search & Filter Inputs */}
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari kode, mapel, atau nama guru pengampu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-slate-900 placeholder:text-slate-400 pl-9 pr-3 py-1.5 rounded-lg text-xs font-bold border border-transparent focus:border-blue-300 focus:ring-1 focus:ring-blue-400 focus:outline-none transition-all shadow-inner"
            />
          </div>

          {/* Kategori Filter */}
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="bg-white text-slate-900 text-xs font-bold rounded-lg px-3 py-1.5 border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 shadow-sm cursor-pointer"
          >
            <option value="ALL">Semua Kategori ({mapelList.length})</option>
            <option value="UMUM">🔵 Umum / Normatif-Adaptif (26)</option>
            <option value="AK">🟢 Akuntansi (AK - 7)</option>
            <option value="TKR">🔴 Teknik Otomotif (TKR - 7)</option>
            <option value="TKJ">🟣 Teknik Komputer &amp; Jaringan (TKJ - 7)</option>
            <option value="PSPT">🟪 Penyiaran TV (PSPT - 7)</option>
            <option value="KULINER">🟠 Kuliner (KUL - 7)</option>
            <option value="DPB">🌸 Desain &amp; Busana (DPB - 7)</option>
            <option value="LAS">⚪ Pengelasan (LAS - 7)</option>
            <option value="APAT">🐬 Perikanan (APAT - 7)</option>
          </select>

          {/* Tingkat Filter */}
          <select
            value={filterTingkat}
            onChange={(e) => setFilterTingkat(e.target.value)}
            className="bg-white text-slate-900 text-xs font-bold rounded-lg px-3 py-1.5 border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 shadow-sm cursor-pointer"
          >
            <option value="ALL">Semua Tingkat</option>
            <option value="X">Kelas X (Fase E)</option>
            <option value="XI">Kelas XI (Fase F)</option>
            <option value="XII">Kelas XII (Fase F)</option>
          </select>

          {/* Tipe Filter */}
          <select
            value={filterTipe}
            onChange={(e) => setFilterTipe(e.target.value as any)}
            className="bg-white text-slate-900 text-xs font-bold rounded-lg px-3 py-1.5 border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 shadow-sm cursor-pointer"
          >
            <option value="ALL">Semua Tipe</option>
            <option value="R">Reguler (R)</option>
            <option value="P">Produktif (P)</option>
          </select>
        </div>

        {/* Row 2: Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {/* Badge 1: 100% Sinkron & Terkunci */}
          <div className="bg-emerald-500/20 text-emerald-100 border border-emerald-400 font-extrabold text-[11px] px-2.5 py-1 rounded flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>100% Sinkron 2 Arah Aktif</span>
          </div>

          {/* Tombol 2: Kunci & Validasi */}
          <button
            type="button"
            onClick={handleLockAndValidate}
            className="bg-[#059669] hover:bg-[#047857] active:scale-95 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Kunci &amp; Validasi</span>
          </button>

          {/* Tombol 3: Distribusi Otomatis */}
          <button
            type="button"
            onClick={handleAutoDistributeOfficialCurriculum}
            className="bg-[#10b981] hover:bg-[#059669] active:scale-95 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap border border-emerald-600"
            title="Otomatis petakan rencana guru pengampu dan alirkan 2 arah ke Matrix SK"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Distribusi Otomatis (0 JP)</span>
          </button>

          {/* Tombol 4: Matriks SK (Menu 3) */}
          <button
            type="button"
            onClick={() => setActiveMenu(3)}
            className="bg-white hover:bg-slate-100 active:scale-95 text-slate-800 border border-slate-300 font-extrabold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Buka Menu 3: Matrix SK"
          >
            <Search className="w-3.5 h-3.5 text-blue-600" />
            <span>Matriks SK</span>
          </button>

          {/* Tombol 5: Tambah Mapel */}
          <button
            type="button"
            onClick={handleOpenAddMapelModal}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-95 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap border border-blue-400"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Tambah Mata Pelajaran</span>
          </button>

          {/* Tombol 6: Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Excel</span>
          </button>

          {/* Tombol Cepat: Auto-Isi Semua Guru Serombel */}
          <button
            type="button"
            onClick={() => setConfirmAutoSerombelOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white border border-indigo-700 font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Otomatis isi rencana guru pengampu untuk semua mata pelajaran berdasarkan data SK GURU di Menu Setting"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Auto-Isi Semua Guru Serombel</span>
          </button>

          {/* Tombol 7: Kosongkan Rencana */}
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="bg-[#dc2626] hover:bg-[#b91c1c] active:scale-95 text-white border border-red-700 font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap ml-auto"
            title="Kosongkan seluruh rencana nama guru pengampu dan bersihkan di Matrix SK"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Kosongkan Guru Pengampu</span>
          </button>

          {/* Tombol Action: Undo */}
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
            <RotateCcw className={`w-3.5 h-3.5 stroke-[2.5] ${undoStack.length > 0 ? 'text-slate-950' : 'text-slate-400'}`} />
            <span>Undo {undoStack.length > 0 ? `(${undoStack.length})` : ''}</span>
          </button>

          {/* Tombol Action: Redo */}
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
        </div>
      </div>

      {/* 2. Main Table Container: Tampilan Persis Gambar 1 */}
      <div className="flex-1 min-h-0 flex flex-col border-2 border-black rounded-xl overflow-hidden bg-white shadow-md">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead className="sticky top-0 z-20 bg-[#b6cce8] text-[#0d1f42] text-[12px] font-black uppercase tracking-wider border-b-2 border-black shadow-xs">
              <tr className="h-11">
                <th className="py-2.5 px-2 text-center border-r-[1.5px] border-black w-12 bg-[#b6cce8]">NO</th>
                <th className="py-2.5 px-2 text-center border-r-[1.5px] border-black w-24 bg-[#b6cce8]">KODE</th>
                <th className="py-2.5 px-3 border-r-[1.5px] border-black min-w-[220px] bg-[#b6cce8]">MATA PELAJARAN</th>
                <th className="py-2.5 px-2 text-center border-r-[1.5px] border-black w-14 bg-[#b6cce8]">JP</th>
                <th className="py-2.5 px-2 text-center border-r-[1.5px] border-black w-28 bg-[#b6cce8]">KATEGORI</th>
                <th className="py-2.5 px-3 text-center border-r-[1.5px] border-black w-36 bg-[#b6cce8]">TINGKAT</th>
                <th className="py-2.5 px-3 border-r-[1.5px] border-black min-w-[360px] bg-[#b6cce8]">
                  RENCANA GURU PENGAMPU
                </th>
                <th className="py-2.5 px-2 text-center w-24 bg-[#b6cce8]">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y-[1.5px] divide-black">
              {filteredMapel.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 font-bold text-sm">
                    Tidak ada mata pelajaran yang cocok dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                filteredMapel.map((m, index) => {
                  const assignedTeachers = getAssignedTeachers(m);
                  const tingkatStr =
                    m.tingkat === 'X'
                      ? 'Kelas X (Fase E)'
                      : m.tingkat === 'XI'
                      ? 'Kelas XI (Fase F)'
                      : m.tingkat === 'XII'
                      ? 'Kelas XII (Fase F)'
                      : m.tingkat;

                  return (
                    <tr
                      key={m.kode}
                      className="hover:bg-blue-50/50 transition-colors bg-white font-medium text-xs"
                    >
                      {/* NO */}
                      <td className="py-2.5 px-2 text-center font-black text-black border-r-[1.5px] border-black align-middle">
                        {m.no || index + 1}
                      </td>

                      {/* KODE */}
                      <td className="py-2.5 px-2 text-center border-r-[1.5px] border-black align-middle">
                        <span className="inline-block px-2.5 py-1 text-xs font-black text-blue-600 bg-blue-50/80 border border-blue-200 rounded-md tracking-wider">
                          {m.kode}
                        </span>
                      </td>

                      {/* MATA PELAJARAN */}
                      <td className="py-2.5 px-3 font-extrabold text-black border-r-[1.5px] border-black tracking-tight text-xs uppercase align-middle">
                        {m.mapel}
                      </td>

                      {/* JP */}
                      <td className="py-2.5 px-2 text-center border-r-[1.5px] border-black align-middle">
                        <span className="w-7 h-7 mx-auto rounded-full bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-center font-black text-xs shadow-2xs">
                          {m.jp}
                        </span>
                      </td>

                      {/* KATEGORI */}
                      <td className="py-2.5 px-2 text-center border-r-[1.5px] border-black align-middle">
                        {(() => {
                          const katStyle = getKategoriBadgeStyle(m.kategori);
                          return (
                            <span
                              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 text-[11px] font-black border rounded-full uppercase tracking-wider shadow-2xs ${katStyle.pill}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${katStyle.dot}`}></span>
                              <span>{m.kategori}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* TINGKAT */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 text-xs border-r-[1.5px] border-black whitespace-nowrap align-middle">
                        {tingkatStr}
                      </td>

                      {/* RENCANA GURU PENGAMPU (Persis Tampilan Gambar 1 dengan Chip ID + Nama + JP + Tombol X) */}
                      <td className="py-2 px-3 border-r-[1.5px] border-black align-middle">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          {/* List Chips Guru */}
                          <div className="flex flex-wrap items-center gap-1.5 flex-1">
                            {assignedTeachers.length === 0 ? (
                              <span className="text-slate-400 italic text-xs">Belum ada guru pengampu</span>
                            ) : (
                              assignedTeachers.map((t, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800 shadow-2xs"
                                >
                                  {t.kode && (
                                    <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-1 rounded">
                                      [{t.kode}]
                                    </span>
                                  )}
                                  <span className="uppercase text-[11px] font-extrabold">{t.nama}</span>
                                  <span className="text-slate-500 font-semibold text-[10px]">
                                    ({t.jp} JP)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSingleTeacher(m.kode, t.nama)}
                                    className="text-slate-400 hover:text-red-600 font-black ml-1 text-xs cursor-pointer"
                                    title={`Lepas ${t.nama} dari mapel [${m.kode}] (otomatis sinkron ke Matrix SK)`}
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))
                            )}
                          </div>

                          {/* Tombol + Serombel, + Tambah dan Tombol Reset ↺ */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Tombol Cepat Guru Serombel */}
                            {(() => {
                              const matchingSerombel = findMatchingTeachersForMapel(m, allTeachers);
                              const isComplete =
                                matchingSerombel.length > 0 &&
                                matchingSerombel.every((sg) =>
                                  assignedTeachers.some((at) => at.id === sg.id || at.nama === sg.nama)
                                );

                              return (
                                <button
                                  type="button"
                                  onClick={() => handleAddSerombelTeachers(m)}
                                  className={`border font-extrabold text-xs px-2.5 py-1 rounded flex items-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                    isComplete
                                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border-indigo-300'
                                  }`}
                                  title={
                                    matchingSerombel.length > 0
                                      ? isComplete
                                        ? `Semua guru serombel (${matchingSerombel.length} guru) sudah lengkap dari SK GURU`
                                        : `Tambah Cepat Guru Serombel: Otomatis tambahkan ${matchingSerombel.length} guru (${matchingSerombel.map((g) => g.nama).join(', ')}) berdasarkan data SK GURU`
                                      : `Tidak ada guru serombel otomatis yang cocok di kolom SK GURU untuk [${m.kode}]`
                                  }
                                >
                                  <Users className={`w-3.5 h-3.5 ${isComplete ? 'text-emerald-600' : 'text-indigo-600'}`} />
                                  <span>{isComplete ? '✓ Serombel' : '+ Serombel'}</span>
                                  {matchingSerombel.length > 0 && (
                                    <span
                                      className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ml-0.5 ${
                                        isComplete
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-indigo-600 text-white'
                                      }`}
                                    >
                                      {matchingSerombel.length}
                                    </span>
                                  )}
                                </button>
                              );
                            })()}

                            {/* + Tambah Guru */}
                            <button
                              type="button"
                              onClick={() => handleOpenAddTeacherModal(m)}
                              className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-400 font-bold text-xs px-2.5 py-1 rounded flex items-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                              title={`Tambah guru pengampu untuk [${m.kode}]`}
                            >
                              <Plus className="w-3 h-3 text-blue-600" />
                              <span>+ Tambah</span>
                            </button>

                            {/* Tombol Reset ↺ */}
                            {assignedTeachers.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleResetSingleMapel(m.kode)}
                                className="bg-rose-500 hover:bg-rose-600 active:scale-95 text-white p-1 rounded shadow-2xs transition-all cursor-pointer"
                                title={`Kosongkan guru pengampu untuk [${m.kode}] (otomatis sinkron ke Matrix SK)`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* AKSI */}
                      <td className="py-2.5 px-2 text-center align-middle">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditMapelModal(m)}
                            className="bg-white hover:bg-amber-50 text-amber-600 border border-slate-300 font-bold text-xs px-2 py-1 rounded flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                            title="Edit Mapel"
                          >
                            <Edit2 className="w-3 h-3 text-amber-600" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingKode(m.kode)}
                            className="bg-rose-500 hover:bg-rose-600 text-white p-1 rounded shadow-2xs transition-all cursor-pointer"
                            title="Hapus Mapel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal Tambah Guru ke Mapel */}
      {isAddTeacherModalOpen && selectedMapelForTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3 text-white flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-wide">
                Tugaskan Guru Pengampu
              </h3>
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
                  Simpan Mapel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog Kosongkan Rencana */}
      <ConfirmDialog
        isOpen={confirmClearOpen}
        title="Kosongkan Seluruh Guru Pengampu?"
        message="Tindakan ini akan mengosongkan seluruh rencana nama guru pengampu pada semua 82 mata pelajaran dan me-reset beban di Matrix SK. Apakah Anda yakin?"
        confirmLabel="Ya, Kosongkan"
        variant="danger"
        onConfirm={handleClearAllRencana}
        onCancel={() => setConfirmClearOpen(false)}
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

      {/* Confirm Dialog Auto-Isi Semua Guru Serombel */}
      <ConfirmDialog
        isOpen={confirmAutoSerombelOpen}
        title="Auto-Isi Seluruh Guru Serombel?"
        message="Sistem akan otomatis mencocokkan seluruh mata pelajaran dengan data SK GURU (contoh: semua guru pengampu PAI untuk PAI, semua pengampu produktif PSPT untuk PSPT, dll) dan otomatis menyinkronkan 2 arah ke Matrix SK. Lanjutkan?"
        confirmLabel="Ya, Auto-Isi Semua"
        variant="primary"
        onConfirm={handleAutoAssignAllSerombel}
        onCancel={() => setConfirmAutoSerombelOpen(false)}
      />
    </div>
  );
};
