// src/features/03-matrix-sk/MatrixSKView.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useToastStore } from '../../ui/Toast';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import {
  DAFTAR_MAPEL_KODE_DEFAULT,
  DaftarMapelKodeItem,
  normTeacherName,
  SK_TEACHERS_DEFAULT,
} from '../../domain/curriculum-data';
import {
  assignMapelToGuruAutoSync,
  removeMapelFromGuruAutoSync,
  performFullTwoWaySync,
  getStoredMapelList,
  getCellItems,
  cellContainsMapel,
  getCellMapelJp,
  MatrixCellData,
  isMapelProduktif,
  applyTeamTeachingSplitAutoSync,
  getProductiveStandardJp,
  isSameTeacher,
  isTeacherCompatibleWithMapel,
} from '../../domain/sync-mapel-matrix';
import { TeacherSearchSelect } from '../../ui/TeacherSearchSelect';
import {
  Search,
  Download,
  Trash2,
  Lock,
  Save,
  Printer,
  Maximize,
  Minimize,
  Plus,
  X,
  CheckCircle2,
  Sparkles,
  Users,
  Sliders,
  Check,
  AlertTriangle,
  HelpCircle,
  Info,
  ChevronDown,
  Zap,
} from 'lucide-react';

// Definisi 48 Rombel Sekolah
export interface RombelCol {
  id: string;
  nama: string;
  tingkat: 'X' | 'XI' | 'XII';
  jurusanKode: string;
  jurusanNama: string;
  nomor: number;
}

export const ROMBELS_48: RombelCol[] = [
  // 1. AKUNTANSI (9 Rombel: 3 X, 3 XI, 3 XII)
  { id: 'X_AK_1', nama: 'X AK 1', tingkat: 'X', jurusanKode: 'AK', jurusanNama: 'AKUNTANSI', nomor: 1 },
  { id: 'X_AK_2', nama: 'X AK 2', tingkat: 'X', jurusanKode: 'AK', jurusanNama: 'AKUNTANSI', nomor: 2 },
  { id: 'X_AK_3', nama: 'X AK 3', tingkat: 'X', jurusanKode: 'AK', jurusanNama: 'AKUNTANSI', nomor: 3 },
  { id: 'XI_AK_1', nama: 'XI AK 1', tingkat: 'XI', jurusanKode: 'AK', jurusanNama: 'AKUNTANSI', nomor: 1 },
  { id: 'XI_AK_2', nama: 'XI AK 2', tingkat: 'XI', jurusanKode: 'AK', jurusanNama: 'AKUNTANSI', nomor: 2 },
  { id: 'XI_AK_3', nama: 'XI AK 3', tingkat: 'XI', jurusanKode: 'AK', jurusanNama: 'AKUNTANSI', nomor: 3 },
  { id: 'XII_AK_1', nama: 'XII AK 1', tingkat: 'XII', jurusanKode: 'AK', jurusanNama: 'AKUNTANSI', nomor: 1 },
  { id: 'XII_AK_2', nama: 'XII AK 2', tingkat: 'XII', jurusanKode: 'AK', jurusanNama: 'AKUNTANSI', nomor: 2 },
  { id: 'XII_AK_3', nama: 'XII AK 3', tingkat: 'XII', jurusanKode: 'AK', jurusanNama: 'AKUNTANSI', nomor: 3 },

  // 2. TKJ (6 Rombel: 2 X, 2 XI, 2 XII)
  { id: 'X_TKJ_1', nama: 'X TKJ 1', tingkat: 'X', jurusanKode: 'TKJ', jurusanNama: 'TKJ', nomor: 1 },
  { id: 'X_TKJ_2', nama: 'X TKJ 2', tingkat: 'X', jurusanKode: 'TKJ', jurusanNama: 'TKJ', nomor: 2 },
  { id: 'XI_TKJ_1', nama: 'XI TKJ 1', tingkat: 'XI', jurusanKode: 'TKJ', jurusanNama: 'TKJ', nomor: 1 },
  { id: 'XI_TKJ_2', nama: 'XI TKJ 2', tingkat: 'XI', jurusanKode: 'TKJ', jurusanNama: 'TKJ', nomor: 2 },
  { id: 'XII_TKJ_1', nama: 'XII TKJ 1', tingkat: 'XII', jurusanKode: 'TKJ', jurusanNama: 'TKJ', nomor: 1 },
  { id: 'XII_TKJ_2', nama: 'XII TKJ 2', tingkat: 'XII', jurusanKode: 'TKJ', jurusanNama: 'TKJ', nomor: 2 },

  // 3. PSPT (6 Rombel: 2 X, 2 XI, 2 XII)
  { id: 'X_PSPT_1', nama: 'X PSPT 1', tingkat: 'X', jurusanKode: 'PSPT', jurusanNama: 'PSPT', nomor: 1 },
  { id: 'X_PSPT_2', nama: 'X PSPT 2', tingkat: 'X', jurusanKode: 'PSPT', jurusanNama: 'PSPT', nomor: 2 },
  { id: 'XI_PSPT_1', nama: 'XI PSPT 1', tingkat: 'XI', jurusanKode: 'PSPT', jurusanNama: 'PSPT', nomor: 1 },
  { id: 'XI_PSPT_2', nama: 'XI PSPT 2', tingkat: 'XI', jurusanKode: 'PSPT', jurusanNama: 'PSPT', nomor: 2 },
  { id: 'XII_PSPT_1', nama: 'XII PSPT 1', tingkat: 'XII', jurusanKode: 'PSPT', jurusanNama: 'PSPT', nomor: 1 },
  { id: 'XII_PSPT_2', nama: 'XII PSPT 2', tingkat: 'XII', jurusanKode: 'PSPT', jurusanNama: 'PSPT', nomor: 2 },

  // 4. TKR (9 Rombel: 3 X, 3 XI, 3 XII)
  { id: 'X_TKR_1', nama: 'X TKR 1', tingkat: 'X', jurusanKode: 'TKR', jurusanNama: 'TKR', nomor: 1 },
  { id: 'X_TKR_2', nama: 'X TKR 2', tingkat: 'X', jurusanKode: 'TKR', jurusanNama: 'TKR', nomor: 2 },
  { id: 'X_TKR_3', nama: 'X TKR 3', tingkat: 'X', jurusanKode: 'TKR', jurusanNama: 'TKR', nomor: 3 },
  { id: 'XI_TKR_1', nama: 'XI TKR 1', tingkat: 'XI', jurusanKode: 'TKR', jurusanNama: 'TKR', nomor: 1 },
  { id: 'XI_TKR_2', nama: 'XI TKR 2', tingkat: 'XI', jurusanKode: 'TKR', jurusanNama: 'TKR', nomor: 2 },
  { id: 'XI_TKR_3', nama: 'XI TKR 3', tingkat: 'XI', jurusanKode: 'TKR', jurusanNama: 'TKR', nomor: 3 },
  { id: 'XII_TKR_1', nama: 'XII TKR 1', tingkat: 'XII', jurusanKode: 'TKR', jurusanNama: 'TKR', nomor: 1 },
  { id: 'XII_TKR_2', nama: 'XII TKR 2', tingkat: 'XII', jurusanKode: 'TKR', jurusanNama: 'TKR', nomor: 2 },
  { id: 'XII_TKR_3', nama: 'XII TKR 3', tingkat: 'XII', jurusanKode: 'TKR', jurusanNama: 'TKR', nomor: 3 },

  // 5. KULINER (6 Rombel: 2 X, 2 XI, 2 XII)
  { id: 'X_KUL_1', nama: 'X KUL 1', tingkat: 'X', jurusanKode: 'KUL', jurusanNama: 'KULINER', nomor: 1 },
  { id: 'X_KUL_2', nama: 'X KUL 2', tingkat: 'X', jurusanKode: 'KUL', jurusanNama: 'KULINER', nomor: 2 },
  { id: 'XI_KUL_1', nama: 'XI KUL 1', tingkat: 'XI', jurusanKode: 'KUL', jurusanNama: 'KULINER', nomor: 1 },
  { id: 'XI_KUL_2', nama: 'XI KUL 2', tingkat: 'XI', jurusanKode: 'KUL', jurusanNama: 'KULINER', nomor: 2 },
  { id: 'XII_KUL_1', nama: 'XII KUL 1', tingkat: 'XII', jurusanKode: 'KUL', jurusanNama: 'KULINER', nomor: 1 },
  { id: 'XII_KUL_2', nama: 'XII KUL 2', tingkat: 'XII', jurusanKode: 'KUL', jurusanNama: 'KULINER', nomor: 2 },

  // 6. DPB (6 Rombel: 2 X, 2 XI, 2 XII)
  { id: 'X_DPB_1', nama: 'X DPB 1', tingkat: 'X', jurusanKode: 'DPB', jurusanNama: 'DPB', nomor: 1 },
  { id: 'X_DPB_2', nama: 'X DPB 2', tingkat: 'X', jurusanKode: 'DPB', jurusanNama: 'DPB', nomor: 2 },
  { id: 'XI_DPB_1', nama: 'XI DPB 1', tingkat: 'XI', jurusanKode: 'DPB', jurusanNama: 'DPB', nomor: 1 },
  { id: 'XI_DPB_2', nama: 'XI DPB 2', tingkat: 'XI', jurusanKode: 'DPB', jurusanNama: 'DPB', nomor: 2 },
  { id: 'XII_DPB_1', nama: 'XII DPB 1', tingkat: 'XII', jurusanKode: 'DPB', jurusanNama: 'DPB', nomor: 1 },
  { id: 'XII_DPB_2', nama: 'XII DPB 2', tingkat: 'XII', jurusanKode: 'DPB', jurusanNama: 'DPB', nomor: 2 },

  // 7. LAS (3 Rombel: 1 X, 1 XI, 1 XII - Sesuai Menu Jurusan)
  { id: 'X_LAS', nama: 'X LAS', tingkat: 'X', jurusanKode: 'LAS', jurusanNama: 'LAS', nomor: 1 },
  { id: 'XI_LAS', nama: 'XI LAS', tingkat: 'XI', jurusanKode: 'LAS', jurusanNama: 'LAS', nomor: 1 },
  { id: 'XII_LAS', nama: 'XII LAS', tingkat: 'XII', jurusanKode: 'LAS', jurusanNama: 'LAS', nomor: 1 },

  // 8. APAT (3 Rombel: 1 X, 1 XI, 1 XII - Sesuai Menu Jurusan)
  { id: 'X_APAT', nama: 'X APAT', tingkat: 'X', jurusanKode: 'APAT', jurusanNama: 'APAT', nomor: 1 },
  { id: 'XI_APAT', nama: 'XI APAT', tingkat: 'XI', jurusanKode: 'APAT', jurusanNama: 'APAT', nomor: 1 },
  { id: 'XII_APAT', nama: 'XII APAT', tingkat: 'XII', jurusanKode: 'APAT', jurusanNama: 'APAT', nomor: 1 },
];

export const JURUSAN_GROUPS = [
  { nama: 'AKUNTANSI', kode: 'AK', colSpan: 9, bgClass: 'bg-[#5b21b6] text-white' },
  { nama: 'TKJ', kode: 'TKJ', colSpan: 6, bgClass: 'bg-[#0284c7] text-white' },
  { nama: 'PSPT', kode: 'PSPT', colSpan: 6, bgClass: 'bg-[#0d9488] text-white' },
  { nama: 'TKR', kode: 'TKR', colSpan: 9, bgClass: 'bg-[#d97706] text-white' },
  { nama: 'KULINER', kode: 'KUL', colSpan: 6, bgClass: 'bg-[#c2410c] text-white' },
  { nama: 'DPB', kode: 'DPB', colSpan: 6, bgClass: 'bg-[#db2777] text-white' },
  { nama: 'LAS', kode: 'LAS', colSpan: 3, bgClass: 'bg-[#475569] text-white' },
  { nama: 'APAT', kode: 'APAT', colSpan: 3, bgClass: 'bg-[#0891b2] text-white' },
];

export interface MapelBadgeItem {
  kode: string;
  mapel: string;
  jp: number;
  tingkat: 'X' | 'XI' | 'XII';
  kategori: string;
}

export interface TeamTeachingTeacherEntry {
  id: string;
  nama: string;
  kode?: string;
  jp: number;
  selectedRombels: string[];
}

export const MatrixSKView: React.FC = () => {
  const { addToast } = useToastStore();

  // Load Data Guru dari Dexie
  const guruListRaw = useLiveQuery(async () => {
    const all = await db.guru.toArray();
    // Tampilkan semua guru yang tidak dinonaktifkan secara eksplisit (aktif !== 0)
    return all.filter((g) => g.aktif !== 0);
  }) ?? [];
  const guruList = useMemo(() => {
    return [...guruListRaw].sort((a, b) => {
      const numA = parseInt(a.kode || a.id, 10);
      const numB = parseInt(b.kode || b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return (a.kode || a.id).localeCompare(b.kode || b.id);
    });
  }, [guruListRaw]);

  // State Matrix
  const [gridData, setGridData] = useState<Record<string, Record<string, MatrixCellData>>>({});
  const [teacherMapels, setTeacherMapels] = useState<Record<string, MapelBadgeItem[]>>({});
  const [loading, setLoading] = useState(true);

  // Active Mapel yang sedang dipilih untuk assignment
  const [activeMapel, setActiveMapel] = useState<{
    guruId: string;
    kode: string;
    tingkat: 'X' | 'XI' | 'XII';
    jp: number;
  } | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Tambah Mapel ke Guru (Gambar 2)
  const [isAddMapelModalOpen, setIsAddMapelModalOpen] = useState(false);
  const [selectedGuruForMapel, setSelectedGuruForMapel] = useState<{ id: string; nama: string; kode: string } | null>(null);
  const [availableMapels, setAvailableMapels] = useState<DaftarMapelKodeItem[]>(DAFTAR_MAPEL_KODE_DEFAULT);
  const [modalSearchMapel, setModalSearchMapel] = useState('');

  // Confirm Clear
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Full Screen State
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Modal Peringatan Kuota Terlampaui (Cell Quota Exceeded)
  const [cellQuotaModal, setCellQuotaModal] = useState<{
    isOpen: boolean;
    guruId: string;
    guruNama: string;
    rombel: RombelCol | null;
    mapelKode: string;
    baseJp: number;
    takenJp: number;
    remainingJp: number;
    activeJp: number;
    otherTeachers: { guruNama: string; jp: number }[];
  }>({
    isOpen: false,
    guruId: '',
    guruNama: '',
    rombel: null,
    mapelKode: '',
    baseJp: 12,
    takenJp: 0,
    remainingJp: 0,
    activeJp: 0,
    otherTeachers: [],
  });

  // Modal Ubah/Lepas JP pada Cell yang Sudah Terisi (Cell Action)
  const [cellActionModal, setCellActionModal] = useState<{
    isOpen: boolean;
    guruId: string;
    guruNama: string;
    rombel: RombelCol | null;
    mapelKode: string;
    currentJp: number;
    customJp: number;
    isProduktif: boolean;
  }>({
    isOpen: false,
    guruId: '',
    guruNama: '',
    rombel: null,
    mapelKode: '',
    currentJp: 0,
    customJp: 0,
    isProduktif: false,
  });

  // 1. Load Data Grid & Teacher Mapels dari db.setting
  const loadData = async () => {
    try {
      const s = await db.setting.get('matrix_sk_grid');
      let loadedGrid: Record<string, Record<string, MatrixCellData>> = {};
      let loadedMapels: Record<string, MapelBadgeItem[]> = {};

      if (s && s.value_json) {
        const parsed = JSON.parse(s.value_json);
        if (parsed.gridData) loadedGrid = parsed.gridData;
        if (parsed.teacherMapels && Object.keys(parsed.teacherMapels).length > 0) {
          loadedMapels = parsed.teacherMapels;
        }
      }

      // Jika teacherMapels belum ada, otomatis alirkan 2 arah dari Menu 2 (daftar_mapel_kode)
      if (Object.keys(loadedMapels).length === 0) {
        const synced = await performFullTwoWaySync('MAPEL_TO_MATRIX');
        loadedMapels = synced.matrixGrid.teacherMapels;
      }

      // Muat daftar mata pelajaran terbaru
      const storedMapels = await getStoredMapelList();
      if (storedMapels && storedMapels.length > 0) {
        setAvailableMapels(storedMapels);
      }

      // Normalisasi & migrasi otomatis: pindahkan cell dari ID rombel lama ke ID rombel resmi Menu Jurusan
      let migrated = false;
      const keyReplacements: Record<string, string> = {
        'X_LAS_1': 'X_LAS',
        'XI_LAS_1': 'XI_LAS',
        'XII_LAS_1': 'XII_LAS',
        'X_APAT_1': 'X_APAT',
        'XI_APAT_1': 'XI_APAT',
        'XII_APAT_1': 'XII_APAT',
        'XII_APAT_2': 'XII_APAT',
      };

      Object.keys(loadedGrid).forEach((gId) => {
        const row = loadedGrid[gId];
        if (!row) return;
        Object.entries(keyReplacements).forEach(([oldKey, newKey]) => {
          if (row[oldKey]) {
            if (!row[newKey]) {
              row[newKey] = row[oldKey];
            }
            delete row[oldKey];
            migrated = true;
          }
        });
      });
      if (migrated) {
        await persistGrid(loadedGrid, loadedMapels);
      }

      setGridData(loadedGrid);
      setTeacherMapels(loadedMapels);
    } catch (err) {
      console.error('Failed to load matrix_sk_grid', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Simpan permanen perubahan gridData & teacherMapels ke db.setting
  const persistGrid = async (
    nextGrid: Record<string, Record<string, MatrixCellData>>,
    nextMapels: Record<string, MapelBadgeItem[]>
  ) => {
    try {
      await db.setting.put({
        key: 'matrix_sk_grid',
        value_json: JSON.stringify({
          gridData: nextGrid,
          teacherMapels: nextMapels,
          updated_at: new Date().toISOString(),
        }),
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to persist matrix_sk_grid', err);
    }
  };

  // 2. Tarik Aliran dari Rencana Guru (Menu 2: daftar_mapel_kode)
  const handlePullFromRencanaGuru = async () => {
    try {
      const s = await db.setting.get('daftar_mapel_kode');
      let mapelItems: DaftarMapelKodeItem[] = [];
      if (s && s.value_json) {
        mapelItems = JSON.parse(s.value_json);
      } else {
        mapelItems = DAFTAR_MAPEL_KODE_DEFAULT;
      }

      if (!mapelItems || mapelItems.length === 0) {
        addToast({
          type: 'warning',
          title: 'Data Mapel Kosong',
          message: 'Daftar Mapel & Kode belum diisi.',
        });
        return;
      }

      const nextTeacherMapels: Record<string, MapelBadgeItem[]> = { ...teacherMapels };
      let connectedCount = 0;

      guruList.forEach((guru) => {
        const gNamaNorm = normTeacherName(guru.nama);
        const matchedMapels: MapelBadgeItem[] = [];

        mapelItems.forEach((m) => {
          let match = false;
          if (m.guruJp && typeof m.guruJp === 'object') {
            for (const tName of Object.keys(m.guruJp)) {
              if (normTeacherName(tName) === gNamaNorm) {
                match = true;
                break;
              }
            }
          }
          if (!match && m.guru) {
            const parts = m.guru.split(';').map((x) => x.trim());
            if (parts.some((p) => normTeacherName(p) === gNamaNorm)) {
              match = true;
            }
          }

          if (match) {
            matchedMapels.push({
              kode: m.kode,
              mapel: m.mapel,
              jp: m.jp,
              tingkat: m.tingkat,
              kategori: m.kategori,
            });
          }
        });

        if (matchedMapels.length > 0) {
          nextTeacherMapels[guru.id] = matchedMapels;
          connectedCount++;
        }
      });

      setTeacherMapels(nextTeacherMapels);
      await persistGrid(gridData, nextTeacherMapels);
      addToast({
        type: 'success',
        title: 'Tarik Aliran Berhasil',
        message: `✓ Berhasil menarik aliran rencana guru dari Daftar Mapel & Kode! (${connectedCount} guru terhubung).`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menarik Aliran', message: String(err) });
    }
  };

  // List mapel berkategori produktif yang tersedia
  const productiveMapels = useMemo(() => {
    return availableMapels.filter((m) => isMapelProduktif(m.kode, m.kategori));
  }, [availableMapels]);

  // Cari base JP standar dari mapel (Aturan: X = 12 JP, XI = 18 JP, XII = 22 JP)
  const getMapelBaseJp = (kode: string, tingkat?: string): number => {
    return getProductiveStandardJp(tingkat || '', kode);
  };

  // Helper mencari guru pengampu mapel yang sama (team teaching)
  const getTeachersForMapel = (mapelKode: string) => {
    const clean = (mapelKode || '').toUpperCase().trim();
    if (!clean) return guruList;
    const matchedGuruIds = new Set<string>();

    // 1. Dari teacherMapels (badge Matrix SK) - hanya jika kompatibel
    Object.entries(teacherMapels).forEach(([gId, badges]) => {
      if (badges.some((b) => b.kode.toUpperCase() === clean)) {
        const gObj = guruList.find((g) => g.id === gId);
        if (gObj && isTeacherCompatibleWithMapel(gObj, clean)) {
          matchedGuruIds.add(gId);
        }
      }
    });

    // 2. Dari availableMapels (m.guru & m.guruJp) - hanya jika kompatibel
    const mapelItem = availableMapels.find((m) => m.kode.toUpperCase() === clean);
    if (mapelItem) {
      if (mapelItem.guruJp && typeof mapelItem.guruJp === 'object') {
        Object.keys(mapelItem.guruJp).forEach((name) => {
          const found = guruList.find((g) => isSameTeacher(g.nama, name));
          if (found && isTeacherCompatibleWithMapel(found, clean)) matchedGuruIds.add(found.id);
        });
      }
      if (mapelItem.guru) {
        const parts = mapelItem.guru.split(/[;\n]+/).map((s) => s.trim());
        parts.forEach((name) => {
          const found = guruList.find((g) => isSameTeacher(g.nama, name));
          if (found && isTeacherCompatibleWithMapel(found, clean)) matchedGuruIds.add(found.id);
        });
      }
    }

    // 3. Dari gridData - hanya jika kompatibel
    Object.entries(gridData).forEach(([gId, cells]) => {
      if (cells) {
        const hasCell = Object.values(cells).some((cell) => cellContainsMapel(cell, clean));
        if (hasCell) {
          const gObj = guruList.find((g) => g.id === gId);
          if (gObj && isTeacherCompatibleWithMapel(gObj, clean)) {
            matchedGuruIds.add(gId);
          }
        }
      }
    });

    // 4. Dari SK_TEACHERS_DEFAULT (kurikulum SK resmi) - HANYA berdasarkan nama (isSameTeacher)
    SK_TEACHERS_DEFAULT.forEach((skT) => {
      if (skT.items && skT.items.some((it) => it.mapel.toUpperCase() === clean)) {
        const found = guruList.find((g) => isSameTeacher(g.nama, skT.nama));
        if (found) matchedGuruIds.add(found.id);
      }
    });

    const list = guruList.filter((g) => matchedGuruIds.has(g.id));
    return list;
  };

  // Helper info beban SK guru
  const getTeacherWorkloadInfo = (teacherId: string, currentMapelKode: string, allocatedJp: number) => {
    const dbG = guruList.find((g) => g.id === teacherId);
    const targetJp = dbG?.setting_jp ?? 28;

    let otherJp = 0;
    const gGrid = gridData[teacherId] || {};
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

  // Cari alokasi guru lain pada rombel untuk suatu mapel
  const getOtherTeachersInRombel = (rombelId: string, mapelKode: string, excludeGuruId: string) => {
    const clean = mapelKode.toUpperCase();
    const result: { guruId: string; guruNama: string; jp: number }[] = [];
    Object.entries(gridData).forEach(([gId, gGrid]) => {
      if (gId !== excludeGuruId && gGrid && gGrid[rombelId]) {
        const items = getCellItems(gGrid[rombelId]);
        const found = items.find((it) => it.mapelKode.toUpperCase() === clean);
        if (found && found.jp > 0) {
          const guru = guruList.find((g) => g.id === gId);
          result.push({
            guruId: gId,
            guruNama: guru ? guru.nama : gId,
            jp: found.jp,
          });
        }
      }
    });
    return result;
  };

  // Buka Modal Team Teaching / Edit Mapel (Sesuai Gambar 2)
  const handleOpenTeamTeachingModal = (
    guru?: { id: string; nama: string; kode?: string },
    initialMapel?: MapelBadgeItem
  ) => {
    let targetMapel = initialMapel;
    if (!targetMapel) {
      const first = productiveMapels[0];
      if (first) {
        targetMapel = {
          kode: first.kode,
          mapel: first.mapel,
          jp: first.jp,
          tingkat: first.tingkat,
          kategori: first.kategori,
        };
      } else {
        targetMapel = {
          kode: 'PRO3PSPT',
          mapel: 'PRODUKTIF 3 FASE F PSPT',
          jp: 22,
          tingkat: 'XII',
          kategori: 'PRODUKTIF',
        };
      }
    }

    const cleanKode = targetMapel.kode.toUpperCase().trim();
    // Tentukan jenjang sasaran
    let jenjang: 'X' | 'XI' | 'XII' = targetMapel.tingkat || 'X';
    if (cleanKode.startsWith('PRO1') || cleanKode.includes('FASE E') || cleanKode.includes('1')) jenjang = 'X';
    else if (cleanKode.startsWith('PRO2') || cleanKode.includes('2')) jenjang = 'XI';
    else if (cleanKode.startsWith('PRO3') || cleanKode.includes('3')) jenjang = 'XII';

    // Peraturan Standar: X = 12 JP, XI = 18 JP, XII = 22 JP
    const jpPerRombel = getProductiveStandardJp(jenjang, cleanKode);

    // Tentukan program keahlian
    const jMatch = JURUSAN_GROUPS.find((j) => cleanKode.includes(j.kode));
    const program = jMatch ? jMatch.kode : 'PSPT';

    // Rombel kelas sasaran
    const relevantRombels = ROMBELS_48.filter((r) => {
      const matchL = r.tingkat === jenjang;
      return program === 'ALL' ? matchL : matchL && r.jurusanKode === program;
    });
    const jumlahRombel = relevantRombels.length || 2;

    // Cari guru pengampu mapel ini
    const sameMapelTeachers = getTeachersForMapel(cleanKode);
    const teacherEntries: TeamTeachingTeacherEntry[] = [];

    // 1. Cek apakah sudah ada guru yang mengampu di gridData (hanya guru yang kompatibel dengan mapel ini)
    Object.entries(gridData).forEach(([gId, cells]) => {
      if (!cells) return;
      const gObj = guruList.find((g) => g.id === gId);
      // Cegah bug guru salah jurusan (misal Nurul Lailiyah dari AK tidak boleh masuk ke PSPT)
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
          jp: foundJp || jpPerRombel,
          selectedRombels: assignedRombels,
        });
      }
    });

    // 2. Lengkapi guru dari kurikulum resmi SK_TEACHERS_DEFAULT jika belum ada di teacherEntries
    const skMatches = SK_TEACHERS_DEFAULT.filter(
      (skT) => skT.items && skT.items.some((it) => it.mapel.toUpperCase() === cleanKode)
    );

    if (skMatches.length > 0) {
      skMatches.forEach((skT) => {
        // Cari guru HANYA berdasarkan nama (isSameTeacher), JANGAN berdasarkan kode angka
        const gObj = guruList.find((g) => isSameTeacher(g.nama, skT.nama));
        if (gObj) {
          const it = skT.items.find((item) => item.mapel.toUpperCase() === cleanKode);
          const defaultJp = it ? it.jp : Math.round(jpPerRombel / skMatches.length);
          const alreadyExists = teacherEntries.some((t) => t.id === gObj.id);
          if (!alreadyExists) {
            teacherEntries.push({
              id: gObj.id,
              nama: gObj.nama,
              kode: gObj.kode,
              jp: defaultJp,
              selectedRombels: [], // Awalnya belum dicentang jika baru dimuat dari SK
            });
          }
        }
      });
    }

    // 3. Jika masih kosong, masukkan guru yang diklik atau default guru
    if (teacherEntries.length === 0) {
      const clickedGuru = guru ? guruList.find((g) => g.id === guru.id) : null;
      if (clickedGuru) {
        teacherEntries.push({
          id: clickedGuru.id,
          nama: clickedGuru.nama,
          kode: clickedGuru.kode,
          jp: jpPerRombel,
          selectedRombels: [],
        });
      } else if (sameMapelTeachers.length > 0) {
        sameMapelTeachers.forEach((g) => {
          teacherEntries.push({
            id: g.id,
            nama: g.nama,
            kode: g.kode,
            jp: Math.round(jpPerRombel / sameMapelTeachers.length),
            selectedRombels: [],
          });
        });
      } else if (guruList.length > 0) {
        const firstGuru = guruList[0];
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
      mapelKode: targetMapel.kode,
      mapelNama: targetMapel.mapel,
      jenis: 'PRODUKTIF',
      jenjang,
      program,
      jpPerRombel,
      jumlahRombel,
      teachers: teacherEntries,
      showAll48: false,
      filterOnlySameMapel: true,
    });
  };

  // Simpan / Terapkan Team Teaching ke Matriks & Daftar Mapel
  const handleApplyTeamTeaching = async () => {
    const { mapelKode, jenjang, program, jpPerRombel, teachers } = teamTeachingModal;

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
    const prevTeacherIds = Object.keys(gridData).filter((gId) => {
      const cells = gridData[gId] || {};
      return Object.values(cells).some((cell) => cellContainsMapel(cell, cleanKode));
    });
    const currentTeacherIds = new Set(teachers.map((t) => t.id));
    const removedGuruIds = prevTeacherIds.filter((gId) => !currentTeacherIds.has(gId));

    try {
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

      setGridData(res.updatedMatrixGrid.gridData);
      setTeacherMapels(res.updatedMatrixGrid.teacherMapels);
      setTeamTeachingModal((prev) => ({ ...prev, isOpen: false }));

      addToast({
        type: 'success',
        title: '✓ Alokasi Team Teaching Disimpan',
        message: `Mata pelajaran [${cleanKode}] berhasil dialokasikan ke ${teachers.length} guru pengampu (${allSelectedRombelIds.length} rombel kelas). Matriks & Rencana Guru tersinkronisasi!`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menyimpan Alokasi', message: String(err) });
    }
  };

  // Pasang sisa kuota langsung dari dialog peringatan kuota
  const handleAssignRemainingQuota = () => {
    const { guruId, guruNama, rombel, mapelKode, remainingJp, baseJp } = cellQuotaModal;
    if (!rombel || remainingJp <= 0) return;

    const currentGuruGrid = { ...(gridData[guruId] || {}) };
    const currentCell = currentGuruGrid[rombel.id];
    const items = getCellItems(currentCell);
    const nextItems = [...items, { mapelKode, jp: remainingJp }];
    const nextJp = nextItems.reduce((acc, curr) => acc + curr.jp, 0);
    const nextKode = nextItems.map((it) => it.mapelKode).join(' + ');

    currentGuruGrid[rombel.id] = {
      mapelKode: nextKode,
      jp: nextJp,
      items: nextItems,
    };

    // Pastikan badge guru memiliki JP yang sesuai jika belum
    const nextTeacherMapels = { ...teacherMapels };
    const curBadges = [...(nextTeacherMapels[guruId] || [])];
    const bIdx = curBadges.findIndex((b) => b.kode.toUpperCase() === mapelKode.toUpperCase());
    const bMatch = curBadges[bIdx];
    if (bIdx >= 0 && bMatch) {
      curBadges[bIdx] = {
        kode: bMatch.kode,
        mapel: bMatch.mapel,
        tingkat: bMatch.tingkat,
        kategori: bMatch.kategori,
        jp: remainingJp,
      };
    }
    nextTeacherMapels[guruId] = curBadges;

    const nextGrid = { ...gridData, [guruId]: currentGuruGrid };
    setGridData(nextGrid);
    setTeacherMapels(nextTeacherMapels);
    persistGrid(nextGrid, nextTeacherMapels);

    setCellQuotaModal((prev) => ({ ...prev, isOpen: false }));
    addToast({
      type: 'success',
      title: '✓ Sisa Kuota Terpasang',
      message: `[${mapelKode}] ${remainingJp} JP berhasil ditugaskan ke ${rombel.nama} untuk ${guruNama}. Total rombel pas ${baseJp} JP!`,
    });
  };

  // Aksi dari modal Cell Action: Lepas Mapel dari cell
  const handleRemoveCellItem = () => {
    const { guruId, rombel, mapelKode } = cellActionModal;
    if (!rombel) return;

    const currentGuruGrid = { ...(gridData[guruId] || {}) };
    const currentCell = currentGuruGrid[rombel.id];
    const items = getCellItems(currentCell);
    const remainingItems = items.filter((it) => it.mapelKode.toUpperCase() !== mapelKode.toUpperCase());

    if (remainingItems.length === 0) {
      delete currentGuruGrid[rombel.id];
    } else {
      const nextJp = remainingItems.reduce((acc, curr) => acc + curr.jp, 0);
      const nextKode = remainingItems.map((it) => it.mapelKode).join(' + ');
      currentGuruGrid[rombel.id] = {
        mapelKode: nextKode,
        jp: nextJp,
        items: remainingItems,
      };
    }

    const nextGrid = { ...gridData, [guruId]: currentGuruGrid };
    setGridData(nextGrid);
    persistGrid(nextGrid, teacherMapels);

    setCellActionModal((prev) => ({ ...prev, isOpen: false }));
    addToast({
      type: 'info',
      title: 'Penugasan Dilepas',
      message: `[${mapelKode}] dilepas dari ${rombel.nama}.`,
    });
  };

  // Aksi dari modal Cell Action: Ubah JP khusus di cell ini
  const handleUpdateCellJp = () => {
    const { guruId, rombel, mapelKode, customJp } = cellActionModal;
    if (!rombel) return;
    const numJp = Number(customJp);
    if (isNaN(numJp) || numJp <= 0) {
      addToast({ type: 'warning', title: 'JP Tidak Valid', message: 'Masukkan nilai JP lebih dari 0.' });
      return;
    }

    const currentGuruGrid = { ...(gridData[guruId] || {}) };
    const currentCell = currentGuruGrid[rombel.id];
    const items = getCellItems(currentCell);
    const nextItems = items.map((it) => {
      if (it.mapelKode.toUpperCase() === mapelKode.toUpperCase()) {
        return { ...it, jp: numJp };
      }
      return it;
    });
    const nextJp = nextItems.reduce((acc, curr) => acc + curr.jp, 0);
    const nextKode = nextItems.map((it) => it.mapelKode).join(' + ');

    currentGuruGrid[rombel.id] = {
      mapelKode: nextKode,
      jp: nextJp,
      items: nextItems,
    };

    const nextGrid = { ...gridData, [guruId]: currentGuruGrid };
    setGridData(nextGrid);
    persistGrid(nextGrid, teacherMapels);

    setCellActionModal((prev) => ({ ...prev, isOpen: false }));
    addToast({
      type: 'success',
      title: '✓ JP Diperbarui',
      message: `[${mapelKode}] di ${rombel.nama} diubah menjadi ${numJp} JP.`,
    });
  };

  // 3. Toggle Cell Assignment (Klik kolom kelas saat badge mapel aktif)
  const handleToggleCell = (guruId: string, rombel: RombelCol) => {
    const guru = guruList.find((g) => g.id === guruId);
    const guruNama = guru ? guru.nama : guruId;
    const currentGuruGrid = { ...(gridData[guruId] || {}) };
    const currentCell = currentGuruGrid[rombel.id];

    // Jika cell sudah terisi dan user mengklik tanpa active mapel
    if (!activeMapel) {
      if (currentCell) {
        const items = getCellItems(currentCell);
        const firstItem = items[0];
        const isProd = isMapelProduktif(firstItem?.mapelKode || currentCell.mapelKode);
        setCellActionModal({
          isOpen: true,
          guruId,
          guruNama,
          rombel,
          mapelKode: firstItem?.mapelKode || currentCell.mapelKode,
          currentJp: currentCell.jp,
          customJp: currentCell.jp,
          isProduktif: isProd,
        });
        return;
      }
      addToast({
        type: 'info',
        title: 'Pilih Badge Mapel',
        message: 'Klik salah satu Badge Mapel pada guru ini terlebih dahulu sebelum memilih kelas!',
      });
      return;
    }

    if (activeMapel.guruId !== guruId) {
      addToast({
        type: 'info',
        title: 'Pilih Badge Guru Ini',
        message: `Badge mapel yang aktif milik guru lain. Klik salah satu badge pada ${guruNama} terlebih dahulu.`,
      });
      return;
    }

    // Kunci jenjang: Hanya izinkan kelas yang sesuai tingkat mapel
    if (rombel.tingkat !== activeMapel.tingkat) {
      addToast({
        type: 'warning',
        title: 'Jenjang Terkunci',
        message: `Mapel [${activeMapel.kode}] hanya untuk jenjang Kelas ${activeMapel.tingkat}. Tidak dapat ditugaskan pada ${rombel.nama}!`,
      });
      return;
    }

    const items = getCellItems(currentCell);
    const existingItem = items.find(
      (it) => it.mapelKode.toUpperCase() === activeMapel.kode.toUpperCase()
    );

    // Jika mapel ini SUDAH ada di cell guru ini:
    if (existingItem) {
      // Jika mapel produktif: buka dialog aksi cell (bisa ubah JP, lepas jam, atau buka team teaching)
      if (isMapelProduktif(activeMapel.kode)) {
        setCellActionModal({
          isOpen: true,
          guruId,
          guruNama,
          rombel,
          mapelKode: activeMapel.kode,
          currentJp: existingItem.jp,
          customJp: existingItem.jp,
          isProduktif: true,
        });
        return;
      }

      // Untuk mapel umum: toggle off langsung
      const remainingItems = items.filter(
        (it) => it.mapelKode.toUpperCase() !== activeMapel.kode.toUpperCase()
      );
      if (remainingItems.length === 0) {
        delete currentGuruGrid[rombel.id];
      } else {
        const nextJp = remainingItems.reduce((acc, curr) => acc + curr.jp, 0);
        const nextKode = remainingItems.map((it) => it.mapelKode).join(' + ');
        currentGuruGrid[rombel.id] = {
          mapelKode: nextKode,
          jp: nextJp,
          items: remainingItems,
        };
      }
      const nextGrid = { ...gridData, [guruId]: currentGuruGrid };
      setGridData(nextGrid);
      persistGrid(nextGrid, teacherMapels);
      addToast({
        type: 'info',
        title: 'Penugasan Dilepas',
        message: `[${activeMapel.kode}] dilepas dari ${rombel.nama}.`,
      });
      return;
    }

    // Mapel BELUM ada di cell guru ini:
    const isProduktif = isMapelProduktif(activeMapel.kode);

    if (isProduktif) {
      const baseJp = getMapelBaseJp(activeMapel.kode);
      const otherTeachers = getOtherTeachersInRombel(rombel.id, activeMapel.kode, guruId);
      const takenJp = otherTeachers.reduce((sum, o) => sum + o.jp, 0);

      // Cek apakah kuota rombel sudah penuh atau akan terlampaui
      if (takenJp + activeMapel.jp > baseJp) {
        const remainingJp = Math.max(0, baseJp - takenJp);
        setCellQuotaModal({
          isOpen: true,
          guruId,
          guruNama,
          rombel,
          mapelKode: activeMapel.kode,
          baseJp,
          takenJp,
          remainingJp,
          activeJp: activeMapel.jp,
          otherTeachers,
        });
        return;
      }
    }

    // Pasang penugasan mapel ini ke cell
    const nextItems = [
      ...items,
      { mapelKode: activeMapel.kode, jp: activeMapel.jp },
    ];
    const nextJp = nextItems.reduce((acc, curr) => acc + curr.jp, 0);
    const nextKode = nextItems.map((it) => it.mapelKode).join(' + ');
    currentGuruGrid[rombel.id] = {
      mapelKode: nextKode,
      jp: nextJp,
      items: nextItems,
    };

    const nextGrid = {
      ...gridData,
      [guruId]: currentGuruGrid,
    };
    setGridData(nextGrid);
    persistGrid(nextGrid, teacherMapels);

    addToast({
      type: 'success',
      title: 'Kelas Ditugaskan',
      message: `[${activeMapel.kode}] ${activeMapel.jp} JP ditugaskan ke ${rombel.nama}.${
        isProduktif ? ' (Mapel Produktif)' : ''
      }`,
    });
  };

  // 4. Hitung Total JP per Guru
  const getGuruTotalJp = (guruId: string): number => {
    const gGrid = gridData[guruId];
    if (!gGrid) return 0;
    return Object.values(gGrid).reduce((sum, item) => sum + (Number(item?.jp) || 0), 0);
  };

  // 4b. Hitung Total JP per Rombel (Kolom Kelas)
  const getRombelTotalJp = (rombelId: string): number => {
    let sum = 0;
    Object.values(gridData).forEach((gGrid) => {
      if (!gGrid) return;
      const cell = gGrid[rombelId] ||
        (rombelId === 'X_LAS' ? gGrid['X_LAS_1'] : undefined) ||
        (rombelId === 'XI_LAS' ? gGrid['XI_LAS_1'] : undefined) ||
        (rombelId === 'XII_LAS' ? gGrid['XII_LAS_1'] : undefined) ||
        (rombelId === 'X_APAT' ? gGrid['X_APAT_1'] : undefined) ||
        (rombelId === 'XI_APAT' ? gGrid['XI_APAT_1'] : undefined) ||
        (rombelId === 'XII_APAT' ? (gGrid['XII_APAT_1'] || gGrid['XII_APAT_2']) : undefined);
      if (cell) {
        sum += Number(cell.jp) || 0;
      }
    });
    return sum;
  };

  // 5. Total Statistik Global
  const totalTerisi = useMemo(() => {
    let sum = 0;
    Object.values(gridData).forEach((gGrid) => {
      Object.values(gGrid).forEach((cell) => {
        sum += Number(cell?.jp) || 0;
      });
    });
    return sum;
  }, [gridData]);

  // Total Akumulasi Beban JP (Setting JP) dari seluruh Guru di db.guru (dialirkan dari settingutamagurudanjp)
  const totalBebanJp = useMemo(() => {
    return guruList.reduce((acc, g) => acc + (Number(g.setting_jp) || 0), 0);
  }, [guruList]);

  // 6. Kosongkan Matriks
  const handleConfirmClear = async () => {
    setGridData({});
    await persistGrid({}, teacherMapels);
    setConfirmClearOpen(false);
    setActiveMapel(null);
    addToast({
      type: 'info',
      title: 'Matriks Dikosongkan',
      message: 'Seluruh penugasan jam pada 48 rombel telah dikosongkan.',
    });
  };

  // 7. Kunci & Validasi Matriks
  const handleLockAndValidate = () => {
    if (totalTerisi === 0) {
      addToast({
        type: 'info',
        title: 'Matriks Masih Kosong',
        message: 'Tarik aliran dari rencana guru atau klik badge mapel lalu pilih rombel kelas.',
      });
    } else {
      addToast({
        type: 'success',
        title: 'Validasi Selesai',
        message: `✓ Terisi ${totalTerisi} JP pada 48 Rombel. Matriks valid dan siap disimpan secara permanen!`,
      });
    }
  };

  // 8. Simpan Permanen SK
  const handleSavePermanentSK = async () => {
    try {
      await persistGrid(gridData, teacherMapels);
      addToast({
        type: 'success',
        title: 'Simpan Permanen Berhasil',
        message: `✓ Seluruh data Matrix SK (${totalTerisi} JP) berhasil tersimpan permanen ke Database.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menyimpan', message: String(err) });
    }
  };

  // 9. Full Screen Toggle
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

  // Helper warna badge & JP untuk kartu mapel di modal (Gambar 2)
  const getMapelCardColors = (kode: string, kategori?: string) => {
    const upper = kode.toUpperCase();
    if (upper.startsWith('PAI')) {
      return {
        codeBg: 'bg-[#6366f1]', // purple/indigo
        jpBadge: 'border-purple-300 bg-purple-50 text-purple-700',
      };
    }
    if (upper.startsWith('PANC')) {
      return {
        codeBg: 'bg-[#ef4444]', // red
        jpBadge: 'border-red-300 bg-red-50 text-red-700',
      };
    }
    if (upper.startsWith('BIN') && !upper.startsWith('BING')) {
      return {
        codeBg: 'bg-[#0d9488]', // teal
        jpBadge: 'border-teal-300 bg-teal-50 text-teal-700',
      };
    }
    if (upper.startsWith('BING')) {
      return {
        codeBg: 'bg-[#2563eb]', // blue
        jpBadge: 'border-blue-300 bg-blue-50 text-blue-700',
      };
    }
    if (upper.startsWith('MTK')) {
      return {
        codeBg: 'bg-[#d97706]', // amber
        jpBadge: 'border-amber-300 bg-amber-50 text-amber-700',
      };
    }
    if (upper.startsWith('SB') || upper.startsWith('SENI')) {
      return {
        codeBg: 'bg-[#c026d3]', // fuchsia
        jpBadge: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700',
      };
    }
    if (upper.startsWith('IPAS') || upper.startsWith('IPA')) {
      return {
        codeBg: 'bg-[#059669]', // emerald
        jpBadge: 'border-emerald-300 bg-emerald-50 text-emerald-700',
      };
    }
    if (upper.startsWith('PENJAS') || upper.startsWith('PJOK')) {
      return {
        codeBg: 'bg-[#65a30d]', // lime
        jpBadge: 'border-lime-300 bg-lime-50 text-lime-700',
      };
    }
    if (upper.startsWith('SI') || upper.startsWith('SEJ')) {
      return {
        codeBg: 'bg-[#db2777]', // pink
        jpBadge: 'border-pink-300 bg-pink-50 text-pink-700',
      };
    }
    if (upper.startsWith('INF') || upper.startsWith('KKA')) {
      return {
        codeBg: 'bg-[#0284c7]', // sky
        jpBadge: 'border-sky-300 bg-sky-50 text-sky-700',
      };
    }
    if (upper.startsWith('MULOK')) {
      return {
        codeBg: 'bg-[#4f46e5]', // indigo
        jpBadge: 'border-indigo-300 bg-indigo-50 text-indigo-700',
      };
    }
    if (upper.startsWith('PRO') || upper.startsWith('MINAT') || (kategori && kategori !== 'UMUM')) {
      return {
        codeBg: 'bg-[#7c3aed]', // violet
        jpBadge: 'border-purple-300 bg-purple-50 text-purple-700',
      };
    }
    return {
      codeBg: 'bg-[#475569]', // slate
      jpBadge: 'border-slate-300 bg-slate-50 text-slate-700',
    };
  };

  // 10. Buka Modal Pilih Mapel untuk Guru (Gambar 2)
  const handleOpenAddMapelModal = async (guru: { id: string; nama: string; kode: string }) => {
    setSelectedGuruForMapel(guru);
    setModalSearchMapel('');
    try {
      const stored = await getStoredMapelList();
      if (stored && stored.length > 0) {
        setAvailableMapels(stored);
      }
    } catch {}
    setIsAddMapelModalOpen(true);
  };

  // Pilih langsung mapel ketika kartu diklik
  const handleSelectMapelForGuru = async (targetMapel: DaftarMapelKodeItem) => {
    if (!selectedGuruForMapel) return;

    try {
      const res = await assignMapelToGuruAutoSync(
        selectedGuruForMapel,
        {
          kode: targetMapel.kode,
          mapel: targetMapel.mapel,
          jp: targetMapel.jp,
          tingkat: targetMapel.tingkat,
          kategori: targetMapel.kategori,
        }
      );

      setTeacherMapels(res.updatedMatrixGrid.teacherMapels);
      setIsAddMapelModalOpen(false);
      addToast({
        type: 'success',
        title: '✓ Mapel Berhasil Ditambahkan',
        message: `[${targetMapel.kode}] ${targetMapel.mapel} (${targetMapel.jp} JP) berhasil ditambahkan ke ${selectedGuruForMapel.nama} dan OTOMATIS terisi di Menu Daftar Mapel & Kode!`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menambah Mapel', message: String(err) });
    }
  };

  // Filter pencarian mapel di dalam modal
  const filteredModalMapels = useMemo(() => {
    if (!modalSearchMapel.trim()) return availableMapels;
    const q = modalSearchMapel.toLowerCase();
    return availableMapels.filter(
      (m) =>
        m.kode.toLowerCase().includes(q) ||
        m.mapel.toLowerCase().includes(q) ||
        (m.kategori && m.kategori.toLowerCase().includes(q)) ||
        m.tingkat.toLowerCase().includes(q)
    );
  }, [availableMapels, modalSearchMapel]);

  const handleRemoveMapelFromGuru = async (
    guru: { id: string; nama: string; kode?: string },
    kodeMapel: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    try {
      const res = await removeMapelFromGuruAutoSync(guru, kodeMapel);
      setTeacherMapels(res.updatedMatrixGrid.teacherMapels);
      setGridData(res.updatedMatrixGrid.gridData);
      if (activeMapel?.guruId === guru.id && activeMapel?.kode === kodeMapel) {
        setActiveMapel(null);
      }
      addToast({
        type: 'info',
        title: '✓ Sinkron 2 Arah Otomatis',
        message: `[${kodeMapel}] dilepas dari ${guru.nama} dan OTOMATIS dilepas dari Menu Daftar Mapel & Kode.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Melepas Mapel', message: String(err) });
    }
  };

  // Filter Guru berdasarkan input pencarian
  const filteredGurus = useMemo(() => {
    if (!searchQuery.trim()) return guruList;
    const q = searchQuery.toLowerCase().trim();
    return guruList.filter((g) => {
      const matchNama = g.nama.toLowerCase().includes(q);
      const matchKode = (g.kode || g.id).toLowerCase().includes(q);
      const mapels = teacherMapels[g.id] || [];
      const matchMapel = mapels.some(
        (m) => m.kode.toLowerCase().includes(q) || m.mapel.toLowerCase().includes(q)
      );
      return matchNama || matchKode || matchMapel;
    });
  }, [guruList, searchQuery, teacherMapels]);

  if (loading) {
    return <div className="p-8 text-slate-500 font-semibold">Memuat Matriks SK Pembagian Jam...</div>;
  }

  return (
    <div
      ref={containerRef}
      className={
        isFullScreen
          ? 'fixed inset-0 z-50 w-screen h-screen bg-[#2463eb] p-2 md:p-3 flex flex-col min-h-0 space-y-2 select-none overflow-hidden font-sans'
          : 'w-full h-full flex flex-col min-h-0 space-y-2.5 font-sans select-none bg-slate-50 p-2 md:p-3 rounded-2xl'
      }
    >
      {/* Unified Royal Blue Header & Controls Panel */}
      <div className="bg-[#2463eb] rounded-2xl p-2.5 md:p-3 text-white shadow-md border border-blue-400/40 shrink-0 space-y-2">
        {/* 1. Header Banner (Disembunyikan saat Full Screen persis seperti di gambar) */}
        {!isFullScreen && (
          <div className="text-center pb-1">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase drop-shadow-xs">
              MATRIX SK PEMBAGIAN JAM ({ROMBELS_48.length} ROMBEL)
            </h1>
            <p className="text-xs md:text-sm font-bold text-blue-100 tracking-tight mt-0.5">
              Langkah 3: Tinjau Nama Guru, Beban JP & Mata Pelajaran • {guruList.length} Guru • {ROMBELS_48.length} Rombel •
              Beban SK: {totalBebanJp} JP • Terisi: {totalTerisi} JP • Kelas X: 50 JP, Kelas XI & XII: 48 JP
            </p>
          </div>
        )}

        {/* 2. Petunjuk Penugasan Cepat (Yellow Box) */}
        <div className="bg-[#fffbeb] border border-[#fef08a] rounded-xl px-3.5 py-2 text-xs text-slate-800 shadow-xs flex items-start gap-2">
          <span className="text-base leading-none">💡</span>
          <div className="leading-snug">
            <strong className="font-black text-slate-900">Petunjuk Penugasan Cepat & Team Teaching: </strong>
            <span>
              Klik salah satu <strong>Badge Mapel</strong> pada guru untuk aktifkan penugasan per rombel. Khusus <strong>Mapel Produktif</strong> (beban 12/18/22 JP), jam mengajar dapat dibagi antar guru serombel (contoh: Bu Latifah 9 JP & Pak Nanda 3 JP = 12 JP untuk 1 rombel, atau 18 JP & 6 JP untuk 2 rombel). Klik tombol <strong>'Bagi'</strong> pada badge atau tombol <strong>'Team Teaching Produktif'</strong> untuk membagi jam dengan mudah tanpa bingung.
            </span>
          </div>
        </div>

        {/* 3. Toolbar Controls Row 1: Search & Nav & Tarik Aliran on left, System Actions on right */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-0.5 pb-0.5">
          {/* Left: Search & Nav & Tarik Aliran */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-44 sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari guru, kode atau mapel resmi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-slate-900 placeholder:text-slate-400 pl-8 pr-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 focus:outline-none transition-all shadow-inner"
              />
            </div>

            {/* Tarik Aliran dari Rencana Guru (Pada Row 1 persis di gambar) */}
            <button
              type="button"
              onClick={handlePullFromRencanaGuru}
              className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white border border-blue-300/60 font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Tarik seluruh rencana nama guru dari Daftar Mapel & Kode"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tarik Aliran dari Rencana Guru</span>
            </button>

            {/* Team Teaching Produktif */}
            <button
              type="button"
              onClick={() => handleOpenTeamTeachingModal()}
              className="bg-indigo-700 hover:bg-indigo-800 text-white border border-indigo-400/60 font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Buka Pengaturan Pembagian Jam Team Teaching Guru Produktif"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team Teaching Produktif</span>
            </button>
          </div>

          {/* Right: Status & Actions (ALWAYS visible on the right, never hidden or wrapped) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* Status Badge */}
            <div className="bg-emerald-500/20 text-emerald-100 border border-emerald-400/50 font-black text-[11px] px-2 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>100% Sinkron & Terkunci</span>
            </div>

            {/* Kunci & Validasi */}
            <button
              type="button"
              onClick={handleLockAndValidate}
              className="bg-[#059669] hover:bg-[#047857] text-white border border-emerald-400/50 font-extrabold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kunci & Validasi</span>
            </button>

            {/* Simpan Permanen SK */}
            <button
              type="button"
              onClick={handleSavePermanentSK}
              className="bg-[#10b981] hover:bg-[#059669] text-white border border-emerald-300/60 font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Simpan permanen seluruh data Matriks SK"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Permanen SK</span>
            </button>

            {/* Cetak Matriks */}
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-extrabold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Cetak Matriks SK"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Cetak Matriks</span>
            </button>

            {/* Full Screen Toggle (Warna Amber dengan teks 'Keluar Full Screen' saat aktif) */}
            {isFullScreen ? (
              <button
                type="button"
                onClick={handleToggleFullScreen}
                className="bg-[#f59e0b] hover:bg-[#d97706] text-black border border-amber-600 font-black text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Keluar Layar Penuh"
              >
                <X className="w-4 h-4 text-black stroke-[3]" />
                <span>Keluar Full Screen</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleFullScreen}
                className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-extrabold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Layar Penuh"
              >
                <Maximize className="w-3.5 h-3.5 text-slate-600" />
                <span>Full Screen</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. Toolbar Controls Row 2: Kosongkan Matriks & Info */}
        <div className="flex items-center gap-2 pt-0.5">
          {/* Kosongkan Matriks */}
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="bg-[#dc2626] hover:bg-[#b91c1c] text-white border border-red-400/50 font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Kosongkan seluruh penugasan matriks"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Kosongkan Matriks (Reset ke Kosong)</span>
          </button>
          <span className="text-[11px] font-semibold text-blue-100 hidden sm:inline-flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-blue-200" />
            Mapel Produktif mendukung Team Teaching (pembagian jam antar guru serombel hingga total 12/18/22 JP).
          </span>
        </div>
      </div>

      {/* 4. Main Matrix Table Layout (Sticky Header, Left Columns, and Right TOTAL Column) */}
      <div className="flex-1 min-h-0 flex flex-col border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-md">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="border-separate border-spacing-0 table-fixed min-w-max text-left">
            {/* Colgroup untuk menjamin lebar kolom tepat dan tidak goyang saat scroll */}
            <colgroup>
              <col style={{ width: '52px' }} />
              <col style={{ width: '220px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '78px' }} />
              <col style={{ width: '280px' }} />
              {ROMBELS_48.map((r) => (
                <col key={r.id} style={{ width: '44px' }} />
              ))}
              <col style={{ width: '70px' }} />
            </colgroup>
            <thead className="sticky top-0 z-30 shadow-sm">
              {/* Row 1: Group Headers */}
              <tr className="bg-[#b6cce8] text-[#0d1f42] text-[12px] font-black uppercase tracking-wider">
                <th
                  rowSpan={2}
                  className="py-2.5 px-1 text-center border-r-2 border-b-2 border-slate-900 w-[52px] min-w-[52px] max-w-[52px] bg-[#b6cce8] sticky top-0 left-0 z-50"
                >
                  No
                </th>
                <th
                  rowSpan={2}
                  className="py-2.5 px-3 border-r-2 border-b-2 border-slate-900 w-[220px] min-w-[220px] max-w-[220px] bg-[#b6cce8] sticky top-0 left-[52px] z-50 truncate"
                >
                  Nama Guru
                </th>
                <th
                  rowSpan={2}
                  className="py-2.5 px-1 text-center border-r-2 border-b-2 border-slate-900 w-[58px] min-w-[58px] max-w-[58px] bg-[#b6cce8] sticky top-0 left-[272px] z-50"
                >
                  ID
                </th>
                <th
                  rowSpan={2}
                  className="py-2.5 px-1 text-center border-r-2 border-b-2 border-slate-900 w-[78px] min-w-[78px] max-w-[78px] bg-[#b6cce8] sticky top-0 left-[330px] z-50"
                >
                  BEBAN JP
                </th>
                <th
                  rowSpan={2}
                  className="py-2.5 px-3 border-r-2 border-b-2 border-slate-900 w-[280px] min-w-[280px] max-w-[280px] bg-[#b6cce8] sticky top-0 left-[408px] z-50 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.25)]"
                >
                  Mata Pelajaran (Klik Badge untuk Pilih Kelas)
                </th>

                {/* Jurusan Group Headers */}
                {JURUSAN_GROUPS.map((jg) => (
                  <th
                    key={jg.kode}
                    colSpan={jg.colSpan}
                    className={`py-2 px-1 text-center border-r border-b-2 border-slate-900 text-xs font-black tracking-wider ${jg.bgClass}`}
                  >
                    {jg.nama}
                  </th>
                ))}

                {/* TOTAL Column (Fix Position on the Right) */}
                <th
                  rowSpan={2}
                  className="py-2.5 px-2 text-center border-l-2 border-b-2 border-slate-900 w-[70px] min-w-[70px] max-w-[70px] bg-[#0f172a] text-white font-black sticky top-0 right-0 z-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.25)]"
                >
                  TOTAL
                </th>
              </tr>

              {/* Row 2: Sub-headers (The 48 Rombels) */}
              <tr className="bg-white text-slate-800 text-[10px] font-black">
                {ROMBELS_48.map((r) => (
                  <th
                    key={r.id}
                    className="py-1.5 px-1 text-center border-r border-b-2 border-slate-900 w-[44px] min-w-[44px] max-w-[44px] bg-white hover:bg-blue-50/60 leading-tight"
                    title={`${r.nama} (${r.jurusanNama})`}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span>{r.tingkat}</span>
                      <span className="text-[9px] text-slate-600">{r.jurusanKode}</span>
                      {r.nama.endsWith(` ${r.nomor}`) ? <span>{r.nomor}</span> : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="bg-white">
              {filteredGurus.length === 0 ? (
                <tr>
                  <td colSpan={6 + ROMBELS_48.length} className="text-center py-12 text-slate-500 font-bold text-sm bg-white border-b border-slate-200">
                    Tidak ada guru yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredGurus.map((guru, index) => {
                  const teacherMapelList = teacherMapels[guru.id] || [];
                  const totalGuruJp = getGuruTotalJp(guru.id);
                  const guruGrid = gridData[guru.id] || {};

                  return (
                    <tr
                      key={guru.id}
                      className="hover:bg-blue-50/40 transition-colors bg-white font-medium text-xs group"
                    >
                      {/* 1. NO (Fixed Position) */}
                      <td className="py-2 px-1 text-center font-black text-slate-900 border-r-2 border-b border-slate-300 w-[52px] min-w-[52px] max-w-[52px] sticky left-0 z-20 bg-white group-hover:bg-blue-50/60">
                        {guru.kode || index + 1}
                      </td>

                      {/* 2. NAMA GURU (Fixed Position) */}
                      <td
                        className="py-2 px-3 font-extrabold text-slate-900 border-r-2 border-b border-slate-300 w-[220px] min-w-[220px] max-w-[220px] sticky left-[52px] z-20 bg-white group-hover:bg-blue-50/60 truncate"
                        title={guru.nama}
                      >
                        {guru.nama}
                      </td>

                      {/* 3. ID (Fixed Position) */}
                      <td className="py-2 px-1 text-center font-bold text-slate-800 border-r-2 border-b border-slate-300 w-[58px] min-w-[58px] max-w-[58px] sticky left-[272px] z-20 bg-white group-hover:bg-blue-50/60">
                        {guru.kode || guru.id}
                      </td>

                      {/* 4. BEBAN JP (Fixed Position) - dialirkan dari settingutamagurudanjp (setting_jp) */}
                      <td
                        className="py-2 px-1 text-center border-r-2 border-b border-slate-300 w-[78px] min-w-[78px] max-w-[78px] sticky left-[330px] z-20 bg-white group-hover:bg-blue-50/60"
                        title={`Beban JP SK Guru: ${guru.setting_jp ?? 0} JP (Terisi di Matriks: ${totalGuruJp} JP)`}
                      >
                        <span className="inline-block px-2 py-0.5 rounded border border-slate-300 bg-slate-50 font-black text-xs text-slate-800 shadow-2xs">
                          {guru.setting_jp ?? 0} JP
                        </span>
                      </td>

                      {/* 5. MATA PELAJARAN (Fixed Position) */}
                      <td className="py-2 px-3 border-r-2 border-b border-slate-300 w-[280px] min-w-[280px] max-w-[280px] sticky left-[408px] z-20 bg-white group-hover:bg-blue-50/60 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)]">
                        {teacherMapelList.length === 0 ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-400 italic">Belum ada mapel</span>
                            <button
                              type="button"
                              onClick={() => handleOpenAddMapelModal(guru)}
                              className="text-blue-600 bg-white hover:bg-blue-50 border border-blue-400 rounded-md px-2 py-0.5 font-bold text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                            >
                              <Plus className="w-3 h-3 text-blue-600" />
                              <span>Mapel</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {teacherMapelList.map((m) => {
                              const isActive =
                                activeMapel?.guruId === guru.id && activeMapel?.kode === m.kode;
                              const isProduktif = isMapelProduktif(m.kode, m.kategori);
                              return (
                                <div key={m.kode} className="inline-flex items-center shadow-xs">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveMapel(
                                        isActive
                                          ? null
                                          : {
                                              guruId: guru.id,
                                              kode: m.kode,
                                              tingkat: m.tingkat,
                                              jp: m.jp,
                                            }
                                      )
                                    }
                                    className={`px-2 py-0.5 rounded-l text-[11px] font-black border border-r-0 transition-all cursor-pointer flex items-center gap-1 ${
                                      isActive
                                        ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400 scale-105 shadow-md z-10'
                                        : isProduktif
                                        ? 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100'
                                        : 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
                                    }`}
                                    title={`Klik untuk aktifkan ${m.kode} (${m.jp} JP - Kelas ${m.tingkat})${
                                      isProduktif ? ' [Mapel Produktif - Team Teaching]' : ''
                                    }`}
                                  >
                                    <span>{m.kode}</span>
                                    <span className="text-[10px] opacity-80">({m.jp} JP)</span>
                                  </button>
                                  {isProduktif && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenTeamTeachingModal(guru, m);
                                      }}
                                      className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer border-t border-b border-indigo-700 transition-colors"
                                      title={`Atur Team Teaching / Bagi Jam untuk [${m.kode}] (Contoh: 9 JP & 3 JP = 12 JP per rombel)`}
                                    >
                                      <Users className="w-2.5 h-2.5" />
                                      <span>Bagi</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleRemoveMapelFromGuru(
                                        { id: guru.id, nama: guru.nama, kode: guru.kode },
                                        m.kode,
                                        e
                                      )
                                    }
                                    className={`px-1.5 py-0.5 rounded-r border border-l-0 text-[10px] font-black cursor-pointer transition-colors ${
                                      isActive
                                        ? 'bg-blue-700 text-white border-blue-700 hover:bg-red-600'
                                        : isProduktif
                                        ? 'bg-indigo-50 text-slate-400 border-indigo-300 hover:text-red-600 hover:bg-red-50'
                                        : 'bg-blue-50 text-slate-400 border-blue-300 hover:text-red-600 hover:bg-red-50'
                                    }`}
                                    title={`Lepas mapel [${m.kode}] dari ${guru.nama} (otomatis sinkron ke Daftar Mapel)`}
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => handleOpenAddMapelModal(guru)}
                              className="text-blue-600 bg-white hover:bg-blue-50 border border-blue-400 rounded-md px-2 py-0.5 font-bold text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                              title="Tambah mapel lain untuk guru ini"
                            >
                              <Plus className="w-3 h-3 text-blue-600" />
                              <span>Mapel</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 6. Rombel Cells (Scrollable in between) */}
                      {ROMBELS_48.map((r) => {
                        const cell = guruGrid[r.id] ||
                          (r.id === 'X_LAS' ? guruGrid['X_LAS_1'] : undefined) ||
                          (r.id === 'XI_LAS' ? guruGrid['XI_LAS_1'] : undefined) ||
                          (r.id === 'XII_LAS' ? guruGrid['XII_LAS_1'] : undefined) ||
                          (r.id === 'X_APAT' ? guruGrid['X_APAT_1'] : undefined) ||
                          (r.id === 'XI_APAT' ? guruGrid['XI_APAT_1'] : undefined) ||
                          (r.id === 'XII_APAT' ? (guruGrid['XII_APAT_1'] || guruGrid['XII_APAT_2']) : undefined);
                        const items = getCellItems(cell);
                        const isGuruActive = activeMapel?.guruId === guru.id;
                        const isMatchLevel = isGuruActive && activeMapel?.tingkat === r.tingkat;
                        const hasActiveMapel = activeMapel ? cellContainsMapel(cell, activeMapel.kode) : false;

                        return (
                          <td
                            key={r.id}
                            onClick={() => handleToggleCell(guru.id, r)}
                            className={`py-1 px-0.5 text-center border-r border-b border-slate-200 w-[44px] min-w-[44px] max-w-[44px] transition-colors select-none ${
                              cell
                                ? hasActiveMapel
                                  ? 'bg-blue-100 font-black text-blue-950 cursor-pointer hover:bg-blue-200 ring-1 ring-inset ring-blue-400'
                                  : 'bg-blue-50/80 font-black text-blue-950 cursor-pointer hover:bg-blue-100'
                                : isMatchLevel
                                ? 'bg-emerald-100/80 hover:bg-emerald-200 cursor-pointer ring-1 ring-inset ring-emerald-300/60'
                                : isGuruActive
                                ? 'bg-red-100/75 hover:bg-red-100 cursor-not-allowed ring-1 ring-inset ring-red-300/40'
                                : 'hover:bg-slate-50 cursor-pointer'
                            }`}
                            title={
                              cell
                                ? items.length > 1
                                  ? `${items.map((it) => `[${it.mapelKode}] ${it.jp} JP`).join(' + ')} (Total: ${cell.jp} JP) ditugaskan ke ${r.nama}${hasActiveMapel ? ' (Klik untuk melepas mapel aktif)' : isMatchLevel ? ' (Klik untuk menambahkan mapel aktif)' : ''}`
                                  : `[${cell.mapelKode}] ${cell.jp} JP ditugaskan ke ${r.nama}${hasActiveMapel ? ' (Klik untuk melepas)' : ''}`
                                : isMatchLevel
                                ? `Klik untuk tugaskan [${activeMapel?.kode}] (${activeMapel?.jp} JP) ke ${r.nama}`
                                : isGuruActive
                                ? `Terkunci: Mapel [${activeMapel?.kode}] tingkat ${activeMapel?.tingkat} tidak dapat ditugaskan ke ${r.nama} (${r.tingkat})`
                                : `Klik untuk tugaskan ke ${r.nama}`
                            }
                          >
                            {cell ? (
                              items.length > 1 ? (
                                <div className="flex flex-col items-center justify-center gap-0.5 py-0.5 mx-auto">
                                  {items.map((it, idx) => (
                                    <span
                                      key={idx}
                                      className={`w-6 h-5 rounded text-xs font-black flex items-center justify-center bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs transition-all ${
                                        activeMapel && it.mapelKode.toUpperCase() === activeMapel.kode.toUpperCase()
                                          ? 'ring-2 ring-blue-600 bg-blue-200 text-blue-950 scale-105'
                                          : ''
                                      }`}
                                      title={`[${it.mapelKode}] ${it.jp} JP ditugaskan ke ${r.nama}`}
                                    >
                                      {it.jp}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span
                                  className={`mx-auto w-6 h-6 rounded text-xs font-black flex items-center justify-center bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs transition-all ${
                                    hasActiveMapel ? 'ring-2 ring-blue-600 ring-offset-0.5 font-black scale-105' : ''
                                  }`}
                                >
                                  {cell.jp}
                                </span>
                              )
                            ) : null}
                          </td>
                        );
                      })}

                      {/* 7. TOTAL (Fixed Position on the Right) */}
                      <td className="py-2 px-2 text-center font-black text-xs text-slate-900 bg-[#f8fafc] border-l-2 border-b border-slate-300 w-[70px] min-w-[70px] max-w-[70px] sticky right-0 z-20 group-hover:bg-blue-50/60 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.15)]">
                        {totalGuruJp}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Sticky Table Footer: Total Beban SK & Total JP per Rombel persis seperti di gambar */}
            <tfoot className="sticky bottom-0 z-30 shadow-lg">
              <tr className="bg-[#1e40af] text-white font-black text-xs">
                {/* 1. Col 1 (No) - Seamless with Col 2 */}
                <td className="py-2.5 px-1 border-t-2 border-slate-900 bg-[#1e40af] w-[52px] min-w-[52px] max-w-[52px] sticky bottom-0 left-0 z-50"></td>

                {/* 2. Col 2 (Nama Guru) - TOTAL BEBAN SK: */}
                <td className="py-2.5 px-2 text-center uppercase tracking-wider border-t-2 border-slate-900 bg-[#1e40af] text-white w-[220px] min-w-[220px] max-w-[220px] sticky bottom-0 left-[52px] z-50 truncate">
                  TOTAL BEBAN SK:
                </td>

                {/* 3. Col 3 (ID) - Seamless with Col 2 */}
                <td className="py-2.5 px-1 border-r-2 border-t-2 border-slate-900 bg-[#1e40af] w-[58px] min-w-[58px] max-w-[58px] sticky bottom-0 left-[272px] z-50"></td>

                {/* 4. Col 4 (Beban JP) - Pill Total Akumulasi Beban SK Guru dari settingutamagurudanjp */}
                <td
                  className="py-2.5 px-1 text-center border-r-2 border-t-2 border-slate-900 bg-[#1e40af] w-[78px] min-w-[78px] max-w-[78px] sticky bottom-0 left-[330px] z-50"
                  title={`Total Seluruh Beban SK Guru: ${totalBebanJp} JP`}
                >
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#0f172a] text-white font-black text-xs border border-blue-300/40 shadow-xs">
                    {totalBebanJp} JP
                  </span>
                </td>

                {/* 5. Col 5 (Mata Pelajaran) - TOTAL JP PER ROMBEL -> */}
                <td className="py-2.5 px-3 text-right uppercase tracking-wider border-r-2 border-t-2 border-slate-900 bg-[#1e40af] text-white w-[280px] min-w-[280px] max-w-[280px] sticky bottom-0 left-[408px] z-50 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.25)]">
                  TOTAL JP PER ROMBEL ➔
                </td>

                {/* 6. 48 Rombels */}
                {ROMBELS_48.map((r) => {
                  const rombelJp = getRombelTotalJp(r.id);
                  return (
                    <td
                      key={r.id}
                      className="py-2 px-1 text-center border-r border-t-2 border-slate-900 w-[44px] min-w-[44px] max-w-[44px] bg-white text-slate-900 font-black text-xs hover:bg-blue-50"
                      title={`Total JP ${r.nama}: ${rombelJp} JP`}
                    >
                      {rombelJp}
                    </td>
                  );
                })}

                {/* 7. Col 54 (TOTAL) - Fixed Position on the Right */}
                <td className="py-2.5 px-2 text-center bg-[#0f172a] text-white font-black text-xs border-l-2 border-t-2 border-slate-900 w-[70px] min-w-[70px] max-w-[70px] sticky bottom-0 right-0 z-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.25)]">
                  {totalTerisi}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Info Counter */}
        <div className="shrink-0 bg-slate-100 border-t-2 border-slate-900 px-3 py-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-3">
            <span>
              Menampilkan {filteredGurus.length} dari {guruList.length} Guru
            </span>
            <span className="text-slate-300">|</span>
            <span>{ROMBELS_48.length} Rombel Sekolah</span>
            <span className="text-slate-300">|</span>
            <span className="text-indigo-800 font-extrabold">
              Total Beban SK: {totalBebanJp} JP
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-700 font-extrabold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Total Terisi: {totalTerisi} JP
            </span>
          </div>
          <span className="text-slate-500 font-semibold">Tabel scroll mandiri • Header & Guru tetap terkunci di posisi</span>
        </div>
      </div>

      {/* Modal Pilih Mapel untuk Guru (Gambar 2) */}
      {isAddMapelModalOpen && selectedGuruForMapel && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            {/* Header Gelap dengan Gradien & Tombol Tutup (Gambar 2) */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 border-b border-slate-800/80 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Plus className="w-5 h-5 text-purple-400 stroke-[3] mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Pilih Mapel untuk {selectedGuruForMapel.nama}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Pilih mata pelajaran yang akan diampu oleh guru ini pada matriks pembagian jam.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMapelModalOpen(false)}
                className="bg-slate-100 hover:bg-white text-slate-700 hover:text-slate-900 rounded-xl p-2 shadow-sm transition-all shrink-0 cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Kotak Pencarian Mapel (Gambar 2) */}
            <div className="p-4 bg-slate-900/90 border-b border-slate-800/80">
              <div className="relative">
                <Search className="w-4 h-4 text-cyan-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={modalSearchMapel}
                  onChange={(e) => setModalSearchMapel(e.target.value)}
                  placeholder="Cari mapel atau kode..."
                  className="w-full bg-white text-slate-900 placeholder-slate-400 text-sm font-semibold pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
                {modalSearchMapel && (
                  <button
                    type="button"
                    onClick={() => setModalSearchMapel('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Daftar Kartu Mapel (Gambar 2) */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 max-h-[56vh] bg-slate-900/60 custom-scrollbar">
              {filteredModalMapels.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">
                  Tidak ada mata pelajaran yang cocok dengan "{modalSearchMapel}".
                </div>
              ) : (
                filteredModalMapels.map((m) => {
                  const colors = getMapelCardColors(m.kode, m.kategori);
                  const isAssigned = (teacherMapels[selectedGuruForMapel.id] || []).some(
                    (item) => item.kode === m.kode
                  );

                  return (
                    <div
                      key={m.kode}
                      onClick={() => handleSelectMapelForGuru(m)}
                      className={`bg-white rounded-xl border p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 group shadow-sm ${
                        isAssigned
                          ? 'border-emerald-300 ring-1 ring-emerald-300 hover:shadow-md'
                          : 'border-slate-200/90 hover:border-indigo-400 hover:shadow-md'
                      }`}
                    >
                      {/* Bagian Kiri: Badge Kode & Judul Mapel */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-black text-white shrink-0 shadow-sm ${colors.codeBg}`}
                        >
                          {m.kode}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight uppercase group-hover:text-indigo-600 transition-colors truncate">
                            {m.mapel}
                          </div>
                          <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                            Tingkat {m.tingkat} • Kategori: {m.kategori || 'UMUM'}
                          </div>
                        </div>
                      </div>

                      {/* Bagian Kanan: Badge JP & Status */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isAssigned && (
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md hidden sm:inline-block">
                            ✓ Terdaftar
                          </span>
                        )}
                        <span
                          className={`px-3 py-1 rounded-lg border text-xs font-black ${colors.jpBadge}`}
                        >
                          {m.jp} JP
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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
                      const availableGurus = guruList;
                      const unused = availableGurus.find(
                        (g) => !teamTeachingModal.teachers.some((t) => t.id === g.id)
                      ) || guruList[0];

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
                      • Seluruh {guruList.length} guru sekolah dapat dicari langsung melalui kolom pencarian di setiap kartu guru
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
                              teachers={guruList}
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

      {/* Modal 2: Peringatan & Penyesuaian Kuota Rombel (Cell Quota Exceeded) */}
      {cellQuotaModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-amber-500/50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/80 border-b border-amber-500/30 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Kuota Beban Rombel Terbatas</h3>
                <p className="text-xs text-amber-200/80">
                  {cellQuotaModal.rombel?.nama} • Mapel [{cellQuotaModal.mapelKode}]
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs text-slate-200">
              <p className="leading-relaxed">
                Mata pelajaran <strong>[{cellQuotaModal.mapelKode}]</strong> memiliki beban standar{' '}
                <strong className="text-amber-300">{cellQuotaModal.baseJp} JP</strong> untuk 1 rombel.
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-extrabold text-slate-400 uppercase text-[10px]">
                  Kondisi Penugasan Saat Ini di {cellQuotaModal.rombel?.nama}:
                </div>
                <div className="space-y-1">
                  {cellQuotaModal.otherTeachers.map((o, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span>• {o.guruNama}:</span>
                      <span className="font-black text-emerald-400">{o.jp} JP</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800 font-bold">
                    <span>Sudah Terisi oleh Guru Lain:</span>
                    <span className="text-amber-400">{cellQuotaModal.takenJp} JP</span>
                  </div>
                  <div className="flex justify-between items-center font-black text-sm text-cyan-300">
                    <span>Sisa Kuota yang Tersedia:</span>
                    <span>{cellQuotaModal.remainingJp} JP</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-snug">
                Guru <strong>{cellQuotaModal.guruNama}</strong> memiliki pengaturan badge {cellQuotaModal.activeJp} JP. Anda dapat memasang sisa kuota ({cellQuotaModal.remainingJp} JP) secara instan, atau membuka wizard Team Teaching untuk membagi rombel ini bersama guru lain.
              </p>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCellQuotaModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              {cellQuotaModal.remainingJp > 0 && (
                <button
                  type="button"
                  onClick={handleAssignRemainingQuota}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Pasang Sisa {cellQuotaModal.remainingJp} JP</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const guruObj = guruList.find((g) => g.id === cellQuotaModal.guruId);
                  const mObj = (teacherMapels[cellQuotaModal.guruId] || []).find(
                    (b) => b.kode.toUpperCase() === cellQuotaModal.mapelKode.toUpperCase()
                  );
                  setCellQuotaModal((prev) => ({ ...prev, isOpen: false }));
                  handleOpenTeamTeachingModal(guruObj, mObj);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Atur Team Teaching</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Kelola / Ubah Jam di Cell (Cell Action) */}
      {cellActionModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-750 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-850 border-b border-slate-750 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-indigo-400 stroke-[2.5]" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Kelola Jam di {cellActionModal.rombel?.nama}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Guru: {cellActionModal.guruNama}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCellActionModal((prev) => ({ ...prev, isOpen: false }))}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs text-slate-200">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Mata Pelajaran:</span>
                  <span className="font-black text-indigo-300 text-sm">[{cellActionModal.mapelKode}]</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Beban Jam di Rombel Ini:</span>
                  <span className="font-black text-white text-sm">{cellActionModal.currentJp} JP</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Ubah Beban Jam (JP) untuk Rombel Ini:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={cellActionModal.customJp}
                    onChange={(e) =>
                      setCellActionModal((prev) => ({
                        ...prev,
                        customJp: Number(e.target.value) || 0,
                      }))
                    }
                    className="flex-1 bg-slate-950 text-white font-black text-center text-sm p-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleUpdateCellJp}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer shadow-sm"
                  >
                    Simpan JP
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleRemoveCellItem}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Lepas Jam</span>
              </button>

              {cellActionModal.isProduktif && (
                <button
                  type="button"
                  onClick={() => {
                    const guruObj = guruList.find((g) => g.id === cellActionModal.guruId);
                    const mObj = (teacherMapels[cellActionModal.guruId] || []).find(
                      (b) => b.kode.toUpperCase() === cellActionModal.mapelKode.toUpperCase()
                    );
                    setCellActionModal((prev) => ({ ...prev, isOpen: false }));
                    handleOpenTeamTeachingModal(guruObj, mObj);
                  }}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Team Teaching</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCellActionModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog Kosongkan Matriks */}
      <ConfirmDialog
        isOpen={confirmClearOpen}
        title="Kosongkan Seluruh Matriks SK?"
        message="Tindakan ini akan mengosongkan seluruh jam terisi pada 48 rombel di Matriks SK. Apakah Anda yakin ingin melanjutkan?"
        confirmLabel="Ya, Kosongkan"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
};
