import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../../db/schema';
import { useToastStore } from '../../ui/Toast';
import { useAppStore } from '../../app/store';
import { Guru, SettingSekolah } from '../../domain/types';
import { exportBackupJSON, importBackupJSON } from '../../db/snapshot';
import { ulid } from 'ulid';
import * as XLSX from 'xlsx';
import {
  Search,
  Plus,
  Save,
  ArrowRight,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  X,
  School,
  Calendar,
  Clock,
  Folder,
  FileSpreadsheet,
  FileText,
  Check,
  UserCheck,
} from 'lucide-react';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

interface SettingViewProps {
  onSekolahChange?: (sekolah: SettingSekolah) => void;
}

export const SettingView: React.FC<SettingViewProps> = ({ onSekolahChange }) => {
  const { addToast } = useToastStore();
  const { setActiveMenu } = useAppStore();

  // State Identitas Sekolah (Termasuk Kepala Sekolah, NIP, Tanggal Dokumen)
  const [sekolah, setSekolah] = useState<SettingSekolah>({
    nama: '',
    tahun_ajaran: '2026/2027',
    semester: 'Ganjil',
    kepala_sekolah: 'MOHAMAD MALIKI, S.Pd',
    nip_kepala_sekolah: '19820921 201407 1 001',
    tanggal_tertulis: 'Singojuruh, 8 Agustus 2023',
  });

  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSK, setFilterSK] = useState('ALL');
  const [filterTipe, setFilterTipe] = useState<'ALL' | 'REGULER' | 'PRODUKTIF'>('ALL');

  // Modal tambah guru
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newKode, setNewKode] = useState('');
  const [newSK, setNewSK] = useState('');
  const [newTipe, setNewTipe] = useState<'REGULER' | 'PRODUKTIF'>('REGULER');
  const [newJP, setNewJP] = useState(0);

  // Modal Import Excel Sesuai Teknologi http://localhost/jadwalsmk/#daftar_guru
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    records: {
      rawNo: number | string;
      id: string;
      nama: string;
      mapel: string;
      tipe: 'P' | 'R';
      jp: number;
    }[];
    totalJp: number;
    countP: number;
    countR: number;
  } | null>(null);
  const [importMode, setImportMode] = useState<'replace_all' | 'update_merge'>('replace_all');
  const [isDragging, setIsDragging] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // Dialog konfirmasi kosongkan
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Load data sekolah & guru
  const loadData = async () => {
    try {
      const s = await db.setting.get('sekolah');
      if (s) {
        const parsed = JSON.parse(s.value_json);
        if (parsed.nama === 'SMK Negeri 1' || parsed.nama === 'SMK NEGERI 1') {
          parsed.nama = '';
        }

        // Fallback jika field identitas baru belum ada di database setting
        if (!parsed.kepala_sekolah || !parsed.nip_kepala_sekolah || !parsed.tanggal_tertulis) {
          try {
            const jeRec = await db.setting.get('jam_efektif');
            if (jeRec?.value_json) {
              const jeParsed = JSON.parse(jeRec.value_json);
              if (!parsed.kepala_sekolah && jeParsed.principalName) {
                parsed.kepala_sekolah = jeParsed.principalName;
              }
              if (!parsed.nip_kepala_sekolah && jeParsed.principalNip) {
                parsed.nip_kepala_sekolah = jeParsed.principalNip;
              }
              if (!parsed.tanggal_tertulis && (jeParsed.signatureCity || jeParsed.signatureDate)) {
                parsed.tanggal_tertulis = `${jeParsed.signatureCity || 'Singojuruh'}, ${jeParsed.signatureDate || '8 Agustus 2023'}`;
              }
            }
          } catch (e) {
            console.warn('Fallback jam_efektif err:', e);
          }
          parsed.kepala_sekolah = parsed.kepala_sekolah || 'MOHAMAD MALIKI, S.Pd';
          parsed.nip_kepala_sekolah = parsed.nip_kepala_sekolah || '19820921 201407 1 001';
          parsed.tanggal_tertulis = parsed.tanggal_tertulis || 'Singojuruh, 8 Agustus 2023';
        }

        setSekolah(parsed);
        useAppStore.getState().setSekolah(parsed);
      }

      const data = await db.guru.toArray();
      data.sort((a, b) => {
        const numA = parseInt(a.kode, 10);
        const numB = parseInt(b.kode, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.kode.localeCompare(b.kode);
      });
      setGuruList(data);
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Memuat Data', message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  // Simpan Identitas Sekolah
  const handleSaveSekolah = async () => {
    try {
      const now = new Date().toISOString();
      await db.setting.put({
        key: 'sekolah',
        value_json: JSON.stringify(sekolah),
        updated_at: now,
      });
      useAppStore.getState().setSekolah(sekolah);
      if (onSekolahChange) {
        onSekolahChange(sekolah);
      }

      // Sinkronisasi otomatis ke Template Jam Efektif (Pondasi Jadwal & Dokumen Resmi)
      try {
        const jeRec = await db.setting.get('jam_efektif');
        if (jeRec?.value_json) {
          const parsedJe = JSON.parse(jeRec.value_json);
          parsedJe.schoolName = sekolah.nama;
          parsedJe.academicYear = sekolah.tahun_ajaran;
          if (sekolah.kepala_sekolah) parsedJe.principalName = sekolah.kepala_sekolah;
          if (sekolah.nip_kepala_sekolah) parsedJe.principalNip = sekolah.nip_kepala_sekolah;
          if (sekolah.tanggal_tertulis) {
            const parts = sekolah.tanggal_tertulis.split(',');
            if (parts.length >= 2) {
              parsedJe.signatureCity = parts[0]?.trim() || parsedJe.signatureCity;
              parsedJe.signatureDate = parts.slice(1).join(',').trim() || parsedJe.signatureDate;
            } else {
              parsedJe.signatureDate = sekolah.tanggal_tertulis.trim();
            }
          }
          await db.setting.put({
            key: 'jam_efektif',
            value_json: JSON.stringify(parsedJe),
            updated_at: now,
          });
          localStorage.setItem('jadwalapp_jam_efektif_v1', JSON.stringify(parsedJe));
          localStorage.setItem('jbsmk_jam_efektif', JSON.stringify(parsedJe));
        }
      } catch (jeErr) {
        console.warn('Gagal sinkronisasi ke jam_efektif:', jeErr);
      }

      addToast({
        type: 'success',
        title: 'Identitas Sekolah Disimpan',
        message: `${sekolah.nama || 'Sekolah'} • Kepala Sekolah: ${sekolah.kepala_sekolah || '-'} berhasil disimpan & disinkronkan ke dokumen resmi.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menyimpan Identitas', message: String(err) });
    }
  };

  // Ekspor & Sinkronisasi Database ke Repositori Git / Backup JSON
  const handleSyncToGit = async () => {
    try {
      addToast({
        type: 'info',
        title: 'Mengekstrak Database',
        message: 'Mengumpulkan seluruh data dari IndexedDB...',
      });
      const jsonStr = await exportBackupJSON();

      // 1. Download berkas cadangan JSON ke PC pengguna
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_jadwalapp_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // 2. Kirim otomatis ke save_backup.php jika berjalan di server lokal (XAMPP / Apache)
      try {
        const res = await fetch('save_backup.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: jsonStr,
        });
        if (res.ok) {
          addToast({
            type: 'success',
            title: 'Tersimpan di Repositori Git',
            message: '✓ Berhasil menyimpan data ke folder repositori data/backup_database.json!',
          });
          return;
        }
      } catch (_) {}

      addToast({
        type: 'success',
        title: 'Backup Berhasil',
        message: '✓ Berkas cadangan database JSON berhasil diunduh ke komputer Anda.',
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal Ekspor Data', message: String(err?.message || err) });
    }
  };

  // Pulihkan Database dari Berkas JSON
  const handleFileImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await importBackupJSON(text);
      await loadData();
      addToast({
        type: 'success',
        title: 'Database Berhasil Dipulihkan',
        message: `✓ Berhasil memulihkan data dari ${file.name}. Silakan muat ulang halaman jika diperlukan.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Gagal Memulihkan Database',
        message: String(err?.message || err),
      });
    } finally {
      if (jsonFileInputRef.current) {
        jsonFileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter & Search
  const filteredGuru = useMemo(() => {
    return guruList.filter((g) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        g.nama.toLowerCase().includes(q) ||
        g.kode.toLowerCase().includes(q) ||
        (g.sk_guru && g.sk_guru.toLowerCase().includes(q));

      const matchSK = filterSK === 'ALL' || g.sk_guru === filterSK;
      const matchTipe = filterTipe === 'ALL' || (g.tipe_guru ?? 'REGULER') === filterTipe;

      return matchSearch && matchSK && matchTipe;
    });
  }, [guruList, searchQuery, filterSK, filterTipe]);

  // Statistik KPI
  const stats = useMemo(() => {
    const totalGuru = guruList.length;
    let totalJam = 0;
    let totalP = 0;
    let totalR = 0;

    for (const g of guruList) {
      totalJam += g.setting_jp ?? 0;
      if (g.tipe_guru === 'PRODUKTIF') totalP++;
      else totalR++;
    }

    return { totalGuru, totalJam, totalP, totalR };
  }, [guruList]);

  // Daftar opsi SK unik untuk dropdown filter
  const uniqueSKOptions = useMemo(() => {
    const setSK = new Set<string>();
    guruList.forEach((g) => {
      if (g.sk_guru && g.sk_guru.trim() !== '') {
        setSK.add(g.sk_guru.trim());
      }
    });
    return Array.from(setSK).sort();
  }, [guruList]);

  // Handle in-place row edits
  const handleFieldChange = (id: string, field: keyof Guru, value: any) => {
    setGuruList((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        return { ...g, [field]: value };
      })
    );
  };

  // Simpan 1 baris guru
  const handleSaveSingle = async (guru: Guru) => {
    try {
      await db.guru.put(guru);
      addToast({
        type: 'success',
        title: 'Berhasil Disimpan',
        message: `Data guru ${guru.nama} berhasil diperbarui secara permanen.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menyimpan', message: String(err) });
    }
  };

  // Simpan permanen semua guru
  const handleSaveAll = async () => {
    try {
      await db.guru.bulkPut(guruList);
      addToast({
        type: 'success',
        title: 'Semua Data Tersimpan',
        message: `${guruList.length} data guru berhasil disimpan ke database lokal.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menyimpan Semua', message: String(err) });
    }
  };

  // Tambah guru baru
  const handleAddGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNama.trim()) {
      addToast({ type: 'error', title: 'Validasi Gagal', message: 'Nama guru wajib diisi.' });
      return;
    }

    const nextIdNumber =
      guruList.length > 0
        ? Math.max(
            ...guruList.map((g) => {
              const n = parseInt(g.kode, 10);
              return isNaN(n) ? 0 : n;
            })
          ) + 1
        : 1;

    const newGuru: Guru = {
      id: ulid(),
      kode: newKode.trim() ? newKode.trim() : String(nextIdNumber),
      nama: newNama.trim(),
      sk_guru: newSK.trim() ? newSK.trim() : 'Umum',
      tipe_guru: newTipe,
      setting_jp: Number(newJP) || 0,
      nip_nik: null,
      jp_min: null,
      jp_maks: null,
      maks_jp_hari: 6,
      min_hari_bebas: 1,
      maks_gap: 1,
      aktif: 1,
    };

    try {
      await db.guru.put(newGuru);
      setGuruList((prev) => [...prev, newGuru]);
      setShowAddModal(false);
      setNewNama('');
      setNewKode('');
      setNewSK('');
      setNewJP(0);
      addToast({
        type: 'success',
        title: 'Guru Ditambahkan',
        message: `${newGuru.nama} berhasil ditambahkan.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menambah Guru', message: String(err) });
    }
  };

  // Hapus guru
  const handleDeleteGuru = async (id: string, nama: string) => {
    try {
      await db.guru.delete(id);
      setGuruList((prev) => prev.filter((g) => g.id !== id));
      addToast({
        type: 'success',
        title: 'Guru Dihapus',
        message: `Data guru ${nama} telah dihapus.`,
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Menghapus', message: String(err) });
    }
  };

  // Kosongkan semua data guru
  const handleClearAll = async () => {
    try {
      await db.guru.clear();
      setGuruList([]);
      setConfirmClearOpen(false);
      addToast({
        type: 'success',
        title: 'Data Dikosongkan',
        message: 'Seluruh data guru berhasil dikosongkan.',
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Mengosongkan', message: String(err) });
    }
  };

  // Ekspor Excel
  const handleExportExcel = () => {
    try {
      const exportRows = guruList.map((g, idx) => ({
        NO: idx + 1,
        NAMA_GURU: g.nama,
        ID: g.kode,
        SK_GURU: g.sk_guru ?? '',
        TIPE: g.tipe_guru ?? 'REGULER',
        SETTING_JP: g.setting_jp ?? 0,
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Guru & JP');
      XLSX.writeFile(wb, `Setting_Utama_Guru_JP_${new Date().toISOString().slice(0, 10)}.xlsx`);

      addToast({
        type: 'success',
        title: 'Ekspor Berhasil',
        message: 'File Excel berhasil diunduh.',
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Gagal Ekspor', message: String(err) });
    }
  };

  // Deteksi Kolom Excel Otomatis (Sesuai jadwalsmk detectExcelColumns)
  const detectExcelColumns = (headers: any[]) => {
    const map = { no: -1, nama: -1, id: -1, mapel: -1, tipe: -1, jp: -1 };
    headers.forEach((h, idx) => {
      const clean = String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean === 'no' || clean === 'nomor') {
        if (map.no === -1) map.no = idx;
      } else if (clean.includes('nama') || clean === 'guru' || clean === 'teacher' || clean === 'namaguru') {
        if (map.nama === -1) map.nama = idx;
      } else if (clean === 'id' || clean === 'kode' || clean === 'noid' || clean === 'idguru' || clean === 'kodeguru') {
        if (map.id === -1) map.id = idx;
      } else if (
        clean.includes('mapel') ||
        clean.includes('pelajaran') ||
        clean.includes('matapelajaran') ||
        clean === 'subject' ||
        clean.includes('skguru') ||
        clean === 'sk' ||
        clean.startsWith('sk') ||
        clean.includes('rujukan')
      ) {
        if (map.mapel === -1) map.mapel = idx;
      } else if (
        clean.includes('tipe') ||
        clean.includes('jenis') ||
        clean.includes('kategori') ||
        clean === 'pr' ||
        clean.includes('produktif') ||
        clean.includes('reguler')
      ) {
        if (map.tipe === -1) map.tipe = idx;
      } else if (
        clean.includes('settingjp') ||
        clean.includes('alokasijp') ||
        clean.includes('bebanjp') ||
        clean.includes('totaljp') ||
        clean.includes('jp') ||
        clean.includes('jam') ||
        clean === 'total'
      ) {
        if (map.jp === -1) map.jp = idx;
      }
    });
    return map;
  };

  // Unduh Template Kosong (.xlsx)
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      const headers = ['NO', 'NAMA GURU', 'ID', 'SK GURU', 'TIPE', 'SETTING JP'];
      const sampleRows = [
        [1, 'Hartono, S.Pd., M.Pd.', 1, 'Kepala UPT', 'Reguler', 0],
        [2, 'Mashuri, S.Pd.I.', 2, 'PAI', 'Reguler', 28],
        [3, 'Dadang Hendra Kusuma, S.Pd.I.', 3, 'PAI', 'Reguler', 28],
        [4, 'Imam Hambali, S.Pd.', 4, 'PAI', 'Reguler', 28],
        [8, 'Nur Hidayat, S.Sos.', 8, 'Pancasila', 'Reguler', 30],
        [9, 'Irka Vianata, S.Pd.', 12, 'Bahasa Indonesia', 'Reguler', 32],
        [26, 'Muchlisin, S.T.', 37, 'Produktif TKR', 'Produktif', 36],
        [38, 'M. Irfan Maulana, S.Kom.', 53, 'Produktif TKJ', 'Produktif', 36],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 34 },
        { wch: 8 },
        { wch: 30 },
        { wch: 16 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Template Guru');
      XLSX.writeFile(wb, 'template_import_guru_smk.xlsx');
      addToast({
        type: 'success',
        title: 'Template Diunduh',
        message: 'Template Excel berhasil diunduh.',
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal Unduh Template', message: String(err?.message || err) });
    }
  };

  // Unduh Data Guru Saat Ini (.xlsx)
  const handleDownloadCurrentData = () => {
    try {
      const wb = XLSX.utils.book_new();
      const headers = ['NO', 'NAMA GURU', 'ID', 'SK GURU', 'TIPE', 'SETTING JP'];
      const rows = guruList.map((t, idx) => [
        idx + 1,
        t.nama,
        t.kode || t.id,
        t.sk_guru || '',
        t.tipe_guru === 'PRODUKTIF' ? 'Produktif' : 'Reguler',
        t.setting_jp ?? 0,
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 36 },
        { wch: 8 },
        { wch: 32 },
        { wch: 16 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Guru & JP');
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `data_guru_smk_${dateStr}.xlsx`);
      addToast({
        type: 'success',
        title: 'Data Guru Diunduh',
        message: `Berhasil mengekspor ${guruList.length} data guru ke Excel.`,
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal Unduh Data', message: String(err?.message || err) });
    }
  };

  // Proses file excel (Smart Parsing sesuai jadwalsmk)
  const processExcelFile = (file: File) => {
    const fileName = file.name.toLowerCase();
    const isValidExtension =
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.csv');

    if (!isValidExtension) {
      addToast({
        type: 'error',
        title: 'Format File Tidak Didukung',
        message: `File "${file.name}" tidak didukung. Harap pilih file berekstensi .xlsx, .xls, atau .csv.`,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error('Lembar kerja Excel kosong');
        const worksheet = workbook.Sheets[firstSheetName]!;
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawRows || rawRows.length < 2) {
          throw new Error('File Excel kosong atau tidak memiliki data.');
        }

        // 1. Smart Header Detection (Cari baris header di 10 baris pertama)
        let headerRowIdx = 0;
        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
          const row = rawRows[r];
          if (Array.isArray(row)) {
            const rowStr = row.map((c) => String(c).toLowerCase()).join(' ');
            if (rowStr.includes('nama') || rowStr.includes('guru') || (rowStr.includes('id') && rowStr.includes('mapel'))) {
              headerRowIdx = r;
              break;
            }
          }
        }

        const headers = rawRows[headerRowIdx] || [];
        const colMap = detectExcelColumns(headers);

        if (colMap.nama === -1 && colMap.id === -1) {
          throw new Error("Format kolom tidak dikenali. Pastikan tabel memiliki kolom 'NAMA GURU' atau 'ID'.");
        }

        const parsedRecords: {
          rawNo: number | string;
          id: string;
          nama: string;
          mapel: string;
          tipe: 'P' | 'R';
          jp: number;
        }[] = [];

        let currentSeq = 0;

        for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
          const r = rawRows[i];
          if (!r || r.length === 0) continue;

          const nama = colMap.nama !== -1 ? String(r[colMap.nama] || '').trim() : '';
          const idRaw = colMap.id !== -1 ? r[colMap.id] : '';
          let idVal = String(idRaw !== undefined && idRaw !== null ? idRaw : '').trim();
          idVal = idVal.replace(/\.0+$/, ''); // Bersihkan format pecahan Excel
          const mapel = colMap.mapel !== -1 ? String(r[colMap.mapel] || '').trim() : '';
          const tipeRaw = colMap.tipe !== -1 ? String(r[colMap.tipe] || '').trim().toUpperCase() : '';
          const jpRaw = colMap.jp !== -1 ? r[colMap.jp] : '';

          // Abaikan baris kosong
          if (!nama && !idVal && !mapel) continue;

          // Abaikan baris ringkasan / total footer dari spreadsheet
          const upperNama = nama.toUpperCase();
          const upperId = idVal.toUpperCase();
          if (upperNama.startsWith('TOTAL') || upperNama.startsWith('JUMLAH') || upperId.startsWith('TOTAL')) {
            continue;
          }

          // Deteksi Tipe Guru (P = Produktif, R = Reguler)
          let tipe: 'P' | 'R' = 'R';
          if (tipeRaw === 'P' || tipeRaw.includes('PROD') || tipeRaw.includes('KEJUR') || mapel.toUpperCase().includes('PROD')) {
            tipe = 'P';
          }

          // Parsing Setting JP (angka)
          let jp = 0;
          if (jpRaw !== undefined && jpRaw !== null && String(jpRaw).trim() !== '') {
            const jpStr = String(jpRaw).replace(/,/g, '.');
            const match = jpStr.match(/\d+(\.\d+)?/);
            if (match) {
              const parsedNum = Math.round(parseFloat(match[0]));
              if (!isNaN(parsedNum) && parsedNum >= 0) {
                jp = parsedNum;
              }
            }
          }

          currentSeq++;
          parsedRecords.push({
            rawNo: (colMap.no !== -1 && r[colMap.no]) ? r[colMap.no] : currentSeq,
            id: idVal,
            nama: nama || `GURU #${idVal || currentSeq}`,
            mapel: mapel,
            tipe: tipe,
            jp: jp,
          });
        }

        if (parsedRecords.length === 0) {
          throw new Error('Tidak ditemukan baris data guru yang valid dalam file Excel.');
        }

        const sumJp = parsedRecords.reduce((acc, r) => acc + (r.jp || 0), 0);
        const countP = parsedRecords.filter((r) => r.tipe === 'P').length;
        const countR = parsedRecords.filter((r) => r.tipe === 'R').length;

        setPendingImport({
          fileName: file.name,
          records: parsedRecords,
          totalJp: sumJp,
          countP: countP,
          countR: countR,
        });

        addToast({
          type: 'success',
          title: 'File Terbaca',
          message: `${parsedRecords.length} data guru berhasil dibaca dan siap dipratinjau.`,
        });
      } catch (err: any) {
        setPendingImport(null);
        addToast({ type: 'error', title: 'Gagal Membaca File', message: String(err?.message || err) });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Buka dialog file Windows secara instan & responsif tanpa freeze/lag COM shell
  const handleOpenPicker = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    // 1. Prioritas Utama: File System Access API (showOpenFilePicker)
    // Membuka dialog file picker OS asli secara instan (< 50ms) di browser Chromium (Chrome/Edge)
    // tanpa memblokir thread UI atau memicu delay shell COM / registry Windows
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'File Excel & Spreadsheet (*.xlsx, *.xls, *.csv)',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'application/vnd.ms-excel': ['.xls'],
                'text/csv': ['.csv'],
              },
            },
          ],
        });
        if (handle) {
          const file = await handle.getFile();
          if (file) {
            processExcelFile(file);
            return;
          }
        }
      } catch (err: any) {
        // Jika user klik tombol 'Cancel' atau silang pada dialog Windows, abaikan
        if (err.name === 'AbortError') {
          return;
        }
        console.warn('showOpenFilePicker fallback to standard file input:', err);
      }
    }

    // 2. Fallback input file konvensional (terisolasi di luar dropzone agar tidak ada double-trigger)
    if (modalFileInputRef.current) {
      modalFileInputRef.current.value = '';
      modalFileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
    // Bersihkan nilai input agar user bisa memilih file yang sama berulang kali
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  // Terapkan Import Data Guru (Mendukung Replace All & Update/Merge)
  const handleApplyImport = async () => {
    if (!pendingImport || pendingImport.records.length === 0) {
      addToast({ type: 'error', title: 'Belum Ada Data', message: 'Silakan pilih file Excel terlebih dahulu.' });
      return;
    }

    const records = pendingImport.records;

    try {
      if (importMode === 'replace_all') {
        const newGuruList: Guru[] = [];
        const usedIds = new Set<number>();

        // Kumpulkan ID numerik yang eksplisit dari Excel
        records.forEach((rec) => {
          const rawId = String(rec.id || '').trim();
          const parsed = parseInt(rawId, 10);
          if (!isNaN(parsed) && parsed > 0 && String(parsed) === rawId) {
            usedIds.add(parsed);
          }
        });

        let fallbackSeqId = 1;
        records.forEach((rec) => {
          let assignedId: number;
          const rawId = String(rec.id || '').trim();
          const parsed = parseInt(rawId, 10);

          if (!isNaN(parsed) && parsed > 0 && String(parsed) === rawId) {
            assignedId = parsed;
          } else {
            while (usedIds.has(fallbackSeqId)) {
              fallbackSeqId++;
            }
            assignedId = fallbackSeqId;
            usedIds.add(assignedId);
          }

          const assignedKode = rawId || String(assignedId);
          const assignedNama = (rec.nama || '').trim() || `Guru #${assignedKode}`;
          const assignedSk = (rec.mapel || '').trim() || 'Umum';
          const assignedTipe = rec.tipe === 'P' ? 'PRODUKTIF' : 'REGULER';
          const assignedJp = rec.jp;

          newGuruList.push({
            id: ulid(),
            kode: assignedKode,
            nama: assignedNama,
            sk_guru: assignedSk,
            tipe_guru: assignedTipe,
            setting_jp: assignedJp,
            nip_nik: null,
            jp_min: null,
            jp_maks: null,
            maks_jp_hari: 6,
            min_hari_bebas: 1,
            maks_gap: 1,
            aktif: 1,
          });
        });

        await db.guru.clear();
        await db.guru.bulkPut(newGuruList);
        await loadData();

        setShowImportModal(false);
        setPendingImport(null);
        setImportMode('replace_all');

        addToast({
          type: 'success',
          title: 'Import Berhasil (Replace All)',
          message: `✓ Seluruh data lama digantikan dengan ${newGuruList.length} data guru baru dari Excel.`,
        });
      } else {
        // Mode UPDATE / MERGE
        let updatedCount = 0;
        let addedCount = 0;
        const currentList = [...guruList];

        records.forEach((rec) => {
          const rawId = String(rec.id || '').trim();
          const rawNama = (rec.nama || '').trim();
          const sk = (rec.mapel || '').trim() || 'Umum';
          const tipe = rec.tipe === 'P' ? 'PRODUKTIF' : 'REGULER';
          const jp = rec.jp;

          const matchedIdx = currentList.findIndex(
            (g) => (rawId && g.kode === rawId) || (rawNama && g.nama.toLowerCase() === rawNama.toLowerCase())
          );

          if (matchedIdx !== -1 && currentList[matchedIdx]) {
            const existing = currentList[matchedIdx]!;
            currentList[matchedIdx] = {
              ...existing,
              nama: rawNama || existing.nama,
              sk_guru: sk,
              tipe_guru: tipe,
              setting_jp: jp,
            };
            updatedCount++;
          } else {
            currentList.push({
              id: ulid(),
              kode: rawId || String(currentList.length + 1),
              nama: rawNama || `Guru #${currentList.length + 1}`,
              sk_guru: sk,
              tipe_guru: tipe,
              setting_jp: jp,
              nip_nik: null,
              jp_min: null,
              jp_maks: null,
              maks_jp_hari: 6,
              min_hari_bebas: 1,
              maks_gap: 1,
              aktif: 1,
            });
            addedCount++;
          }
        });

        await db.guru.clear();
        await db.guru.bulkPut(currentList);
        await loadData();

        setShowImportModal(false);
        setPendingImport(null);
        setImportMode('replace_all');

        addToast({
          type: 'success',
          title: 'Import Berhasil (Merge)',
          message: `✓ Penggabungan selesai: ${updatedCount} guru diperbarui dan ${addedCount} guru baru ditambahkan.`,
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal Menerapkan Data', message: String(err?.message || err) });
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500 font-semibold">Memuat Data Guru & Alokasi JP...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col min-h-0 space-y-2.5 font-sans select-none">
      {/* 0. Form Identitas Sekolah, Kepala Sekolah, NIP & Tanggal Tertulis (Fixed at Top - Sesuai Gambar 1 & 2) */}
      <div className="bg-white rounded-xl p-2.5 border border-slate-300 shadow-sm flex flex-col gap-2.5 shrink-0">
        {/* Baris 1: Nama Sekolah, Tahun Pelajaran & Semester */}
        <div className="flex flex-col md:flex-row md:items-end gap-2.5">
          <div className="flex-1">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-blue-600" />
              Nama Sekolah
            </label>
            <input
              type="text"
              value={sekolah.nama}
              onChange={(e) => setSekolah({ ...sekolah, nama: e.target.value })}
              placeholder="Contoh: SMK NEGERI IHYA ULUMMUDIN SINGOJURUH"
              className="w-full border border-slate-300 focus:border-blue-600 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 outline-none transition-all shadow-inner"
            />
          </div>

          <div className="w-full md:w-48">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Tahun Pelajaran
            </label>
            <input
              type="text"
              value={sekolah.tahun_ajaran}
              onChange={(e) => setSekolah({ ...sekolah, tahun_ajaran: e.target.value })}
              placeholder="Contoh: 2026/2027"
              className="w-full border border-slate-300 focus:border-blue-600 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 outline-none transition-all shadow-inner"
            />
          </div>

          <div className="w-full md:w-40">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Semester
            </label>
            <select
              value={sekolah.semester}
              onChange={(e) => setSekolah({ ...sekolah, semester: e.target.value as 'Ganjil' | 'Genap' })}
              className="w-full border border-slate-300 focus:border-blue-600 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 outline-none transition-all cursor-pointer shadow-inner bg-white"
            >
              <option value="Ganjil">Semester Ganjil</option>
              <option value="Genap">Semester Genap</option>
            </select>
          </div>
        </div>

        {/* Baris 2: Nama Kepala Sekolah, NIP, Tanggal Tertulis (TTD Gambar 2) & Tombol Simpan */}
        <div className="flex flex-col md:flex-row md:items-end gap-2.5 pt-1.5 border-t border-slate-100">
          <div className="flex-1">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              Nama Kepala Sekolah
            </label>
            <input
              type="text"
              value={sekolah.kepala_sekolah ?? ''}
              onChange={(e) => setSekolah({ ...sekolah, kepala_sekolah: e.target.value })}
              placeholder="Contoh: MOHAMAD MALIKI, S.Pd"
              className="w-full border border-slate-300 focus:border-blue-600 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 uppercase outline-none transition-all shadow-inner"
            />
          </div>

          <div className="w-full md:w-52">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              NIP Kepala Sekolah
            </label>
            <input
              type="text"
              value={sekolah.nip_kepala_sekolah ?? ''}
              onChange={(e) => setSekolah({ ...sekolah, nip_kepala_sekolah: e.target.value })}
              placeholder="Contoh: 19820921 201407 1 001"
              className="w-full border border-slate-300 focus:border-blue-600 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 outline-none transition-all shadow-inner"
            />
          </div>

          <div className="w-full md:w-60">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Tanggal Tertulis (Dokumen / TTD)
            </label>
            <input
              type="text"
              value={sekolah.tanggal_tertulis ?? ''}
              onChange={(e) => setSekolah({ ...sekolah, tanggal_tertulis: e.target.value })}
              placeholder="Contoh: Singojuruh, 8 Agustus 2023"
              className="w-full border border-slate-300 focus:border-blue-600 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 outline-none transition-all shadow-inner"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveSekolah}
              className="w-full md:w-auto bg-[#1b4cb4] hover:bg-[#143a8c] text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Identitas</span>
            </button>

            <button
              onClick={handleSyncToGit}
              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap cursor-pointer"
              title="Cadangkan dan sinkronkan seluruh database jadwal, guru, mapel ke repositori Git / unduh JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sinkron ke Git / Backup JSON</span>
            </button>

            <button
              onClick={() => jsonFileInputRef.current?.click()}
              className="w-full md:w-auto bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap cursor-pointer"
              title="Pulihkan database dari berkas cadangan JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Pulihkan JSON</span>
            </button>

            <input
              type="file"
              ref={jsonFileInputRef}
              onChange={handleFileImportJSON}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* 1. Header Banner & 4 Stat KPI Cards (Fixed) */}
      <div className="bg-[#1b4cb4] rounded-xl px-4 py-2.5 text-white shadow-md border border-blue-400/30 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h1 className="text-base md:text-lg font-black tracking-wide uppercase drop-shadow-sm">
              SETTING UTAMA: DAFTAR GURU & ALOKASI JAM (JP)
            </h1>
            <p className="text-[11px] text-blue-100/90 leading-tight font-medium">
              Langkah 1: Mengisi Nama Guru (beserta Gelar), ID/Kode, Rujukan SK Awal, Tipe (R/P) & Setting JP.
            </p>
          </div>
        </div>

        {/* 4 Stat KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          <div className="bg-white/10 backdrop-blur-md rounded-lg py-1 px-3 border border-white/20 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 block">
              TOTAL GURU
            </span>
            <span className="text-base md:text-lg font-black text-white block tracking-tight">
              {stats.totalGuru} Guru
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg py-1 px-3 border border-white/20 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 block">
              TOTAL JAM SETTING
            </span>
            <span className="text-base md:text-lg font-black text-white block tracking-tight">
              {stats.totalJam} JP
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg py-1 px-3 border border-white/20 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 block">
              GURU PRODUKTIF (P)
            </span>
            <span className="text-base md:text-lg font-black text-white block tracking-tight">
              {stats.totalP} Guru
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg py-1 px-3 border border-white/20 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 block">
              GURU REGULER (R)
            </span>
            <span className="text-base md:text-lg font-black text-white block tracking-tight">
              {stats.totalR} Guru
            </span>
          </div>
        </div>
      </div>

      {/* 2. Search, Filter, & Actions Box (Fixed) */}
      <div className="bg-[#1b4cb4] rounded-xl p-2.5 text-white shadow-md border border-blue-400/30 flex flex-col lg:flex-row lg:items-center justify-between gap-2 shrink-0">
        {/* Left: Search & Filter */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama guru, gelar, ID, atau rujukan SK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-slate-900 placeholder:text-slate-400 pl-9 pr-3 py-1.5 rounded-lg text-xs font-semibold border border-transparent focus:border-blue-300 focus:ring-1 focus:ring-blue-400 focus:outline-none transition-all shadow-inner"
            />
          </div>

          <select
            value={filterSK}
            onChange={(e) => setFilterSK(e.target.value)}
            className="bg-white text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 shadow-sm cursor-pointer"
          >
            <option value="ALL">Semua Rujukan SK</option>
            {uniqueSKOptions.map((sk) => (
              <option key={sk} value={sk}>
                {sk}
              </option>
            ))}
          </select>

          <select
            value={filterTipe}
            onChange={(e) => setFilterTipe(e.target.value as any)}
            className="bg-white text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 shadow-sm cursor-pointer"
          >
            <option value="ALL">Semua Tipe (P/R)</option>
            <option value="REGULER">Reguler (R)</option>
            <option value="PRODUKTIF">Produktif (P)</option>
          </select>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="bg-[#059669] hover:bg-[#047857] active:scale-95 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Tambah 1 baris guru baru"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Guru</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPendingImport(null);
              setImportMode('replace_all');
              setShowImportModal(true);
            }}
            className="bg-[#0284c7] hover:bg-[#0369a1] active:scale-95 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Import data guru dari file Excel"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Excel</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="bg-[#10b981] hover:bg-[#059669] active:scale-95 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Simpan seluruh perubahan pada tabel ke database lokal"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Semua</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-[#6366f1] hover:bg-[#4f46e5] active:scale-95 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Ekspor daftar guru saat ini ke file Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="bg-[#ef4444] hover:bg-[#dc2626] active:scale-95 text-white font-extrabold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Kosongkan seluruh data guru"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Kosongkan</span>
          </button>
        </div>
      </div>

      {/* 3. Main Table Layout (Fixed Container with Internal Scroll & Sticky Header) */}
      <div className="flex-1 min-h-0 flex flex-col border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-md">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-[#b6cce8] text-[#0d1f42] text-[12px] font-black uppercase tracking-wider border-b-2 border-slate-900 shadow-sm">
              <tr>
                <th className="py-2.5 px-3 text-center border-r-2 border-slate-900 w-12 bg-[#b6cce8]">NO.</th>
                <th className="py-2.5 px-4 border-r-2 border-slate-900 w-80 bg-[#b6cce8]">NAMA GURU (BESERTA GELAR)</th>
                <th className="py-2.5 px-3 text-center border-r-2 border-slate-900 w-16 bg-[#b6cce8]">ID</th>
                <th className="py-2.5 px-4 border-r-2 border-slate-900 bg-[#b6cce8]">
                  SK GURU (REFERENSI TEKS AWAL)
                </th>
                <th className="py-2.5 px-3 text-center border-r-2 border-slate-900 w-44 bg-[#b6cce8]">
                  TIPE (PRODUKTIF / REGULER)
                </th>
                <th className="py-2.5 px-3 text-center border-r-2 border-slate-900 w-28 bg-[#b6cce8]">
                  SETTING JP
                </th>
                <th className="py-2.5 px-3 text-center w-24 bg-[#b6cce8]">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-900">
              {filteredGuru.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 font-bold text-sm">
                    {guruList.length === 0
                      ? 'Belum ada data guru. Klik "+ Tambah Guru" atau gunakan "Import Excel".'
                      : 'Tidak ada data guru yang cocok dengan pencarian / filter.'}
                  </td>
                </tr>
              ) : (
                filteredGuru.map((guru, index) => {
                  const isProduktif = guru.tipe_guru === 'PRODUKTIF';

                  return (
                    <tr
                      key={guru.id}
                      className="hover:bg-blue-50/60 transition-colors bg-white font-medium text-xs"
                    >
                      {/* NO */}
                      <td className="py-2 px-3 text-center font-black text-slate-900 border-r-2 border-slate-900">
                        {index + 1}
                      </td>

                      {/* NAMA GURU & GELAR (Case-sensitive / Huruf Kapital & Kecil) */}
                      <td className="py-2 px-4 font-bold text-slate-900 border-r-2 border-slate-900 tracking-tight">
                        <input
                          type="text"
                          value={guru.nama}
                          onChange={(e) =>
                            handleFieldChange(guru.id, 'nama', e.target.value)
                          }
                          placeholder="Nama guru & gelar (contoh: Drs. Supriyanto, M.Pd.)"
                          className="w-full bg-transparent font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-400 rounded px-1.5 py-0.5 outline-none"
                        />
                      </td>

                      {/* ID */}
                      <td className="py-2 px-3 text-center font-black text-slate-900 border-r-2 border-slate-900">
                        <input
                          type="text"
                          value={guru.kode}
                          onChange={(e) => handleFieldChange(guru.id, 'kode', e.target.value)}
                          className="w-12 text-center bg-transparent font-black text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5 outline-none"
                        />
                      </td>

                      {/* SK GURU (REFERENSI TEKS AWAL) */}
                      <td className="py-1.5 px-4 border-r-2 border-slate-900">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={guru.sk_guru ?? ''}
                            onChange={(e) =>
                              handleFieldChange(guru.id, 'sk_guru', e.target.value)
                            }
                            placeholder="Teks referensi SK..."
                            className="flex-1 border-2 border-slate-800 rounded-md px-2.5 py-1 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                          <button
                            onClick={() => handleSaveSingle(guru)}
                            className="bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0 shadow-sm transition-all"
                            title="Simpan baris ini"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Simpan</span>
                          </button>
                        </div>
                      </td>

                      {/* TIPE (PRODUKTIF / REGULER) */}
                      <td className="py-1.5 px-3 text-center border-r-2 border-slate-900">
                        <select
                          value={guru.tipe_guru ?? 'REGULER'}
                          onChange={(e) =>
                            handleFieldChange(guru.id, 'tipe_guru', e.target.value as any)
                          }
                          className={`w-full border-2 rounded-lg px-2.5 py-1 text-xs font-extrabold cursor-pointer transition-all outline-none ${
                            isProduktif
                              ? 'border-amber-500 bg-amber-50 text-amber-900'
                              : 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          }`}
                        >
                          <option value="REGULER">🟢 Reguler (R)</option>
                          <option value="PRODUKTIF">🟠 Produktif (P)</option>
                        </select>
                      </td>

                      {/* SETTING JP */}
                      <td className="py-1.5 px-3 text-center border-r-2 border-slate-900">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={guru.setting_jp ?? 0}
                            onChange={(e) =>
                              handleFieldChange(guru.id, 'setting_jp', parseInt(e.target.value, 10) || 0)
                            }
                            className="w-14 text-center border-2 border-slate-800 rounded-md py-0.5 px-1.5 text-xs font-black text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                          <span className="text-xs font-black text-slate-800">JP</span>
                        </div>
                      </td>

                      {/* AKSI */}
                      <td className="py-1.5 px-3 text-center">
                        <button
                          onClick={() => handleDeleteGuru(guru.id, guru.nama)}
                          className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-extrabold text-[11px] px-2.5 py-1 rounded-md flex items-center justify-center gap-1 mx-auto shadow-sm transition-all"
                          title="Hapus guru"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info Counter */}
        <div className="shrink-0 bg-slate-100 border-t-2 border-slate-900 px-3 py-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
          <span>Menampilkan {filteredGuru.length} dari {guruList.length} guru</span>
          <span className="text-slate-500 font-semibold">Tabel scroll mandiri • Header tetap terkunci di posisi atas</span>
        </div>
      </div>

      {/* Modal Tambah Guru */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 uppercase">Tambah Guru Baru</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddGuru} className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nama Guru Lengkap (beserta Gelar) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Drs. Supriyanto, M.Pd."
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  className="w-full border-2 border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ID / Kode Guru
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1 atau G01"
                    value={newKode}
                    onChange={(e) => setNewKode(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Setting JP</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={newJP}
                    onChange={(e) => setNewJP(parseInt(e.target.value, 10) || 0)}
                    className="w-full border-2 border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  SK Guru (Referensi Teks Awal)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pendidikan Agama Islam"
                  value={newSK}
                  onChange={(e) => setNewSK(e.target.value)}
                  className="w-full border-2 border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tipe Guru (P/R)
                </label>
                <select
                  value={newTipe}
                  onChange={(e) => setNewTipe(e.target.value as any)}
                  className="w-full border-2 border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold focus:border-blue-600 focus:outline-none"
                >
                  <option value="REGULER">🟢 Reguler (R)</option>
                  <option value="PRODUKTIF">🟠 Produktif (P)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 shadow-md"
                >
                  Simpan Guru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Data Guru & Alokasi JP dari Excel (Sesuai Teknologi http://localhost/jadwalsmk/#daftar_guru) */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Import Data Guru & Alokasi JP dari Excel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setPendingImport(null);
                  setImportMode('replace_all');
                }}
                className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body Modal */}
            <div className="overflow-y-auto pr-1 py-3 space-y-4 flex-1">
              {/* Kotak Petunjuk Format Kolom Excel */}
              <div className="bg-[#eff6ff] border border-blue-200 rounded-xl p-4 space-y-3">
                <div>
                  <span className="font-black text-xs md:text-sm text-blue-950 flex items-center gap-1.5">
                    <span>💡</span> Petunjuk Format Kolom Excel:
                  </span>
                  <p className="text-xs text-blue-900 leading-relaxed font-semibold mt-1">
                    Format kolom tabel yang didukung:{' '}
                    <strong className="text-blue-950 font-black">NO</strong>,{' '}
                    <strong className="text-blue-950 font-black">NAMA GURU</strong>,{' '}
                    <strong className="text-blue-950 font-black">ID/KODE</strong>,{' '}
                    <strong className="text-blue-950 font-black">SK GURU</strong>,{' '}
                    <strong className="text-blue-950 font-black">TIPE (Produktif/Reguler)</strong>, dan{' '}
                    <strong className="text-blue-950 font-black">SETTING JP</strong>. Sistem otomatis mendeteksi nama kolom meskipun urutannya berbeda.
                  </p>
                </div>

                {/* Dashed Warning Ketentuan Import */}
                <div className="border border-dashed border-blue-300 rounded-lg p-2.5 bg-white/70 flex items-start gap-2">
                  <span className="text-blue-600 text-sm mt-0.5">ℹ️</span>
                  <p className="text-[11px] md:text-xs text-blue-900 leading-relaxed font-semibold">
                    <strong className="text-blue-950 font-black">Ketentuan Import:</strong> Saat data diimpor, data lama akan{' '}
                    <strong className="text-blue-950 font-black underline">digantikan sepenuhnya dengan data baru</strong> dari file Excel.
                    Nama guru, ID, SK guru, tipe (reguler/produktif), dan setting JP akan di-replace semuanya.
                  </p>
                </div>

                {/* Tombol Unduh Template Kosong & Unduh Data Guru Saat Ini */}
                <div className="flex flex-wrap items-center gap-3 pt-0.5">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="bg-white hover:bg-blue-50/80 border border-blue-300 text-blue-600 font-extrabold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Unduh Template Kosong (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCurrentData}
                    className="bg-white hover:bg-blue-50/80 border border-blue-300 text-blue-600 font-extrabold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Unduh Data Guru Saat Ini (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Dropzone Upload File */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleOpenPicker}
                className={`border-2 border-dashed rounded-2xl py-6 px-6 text-center space-y-2.5 transition-all cursor-pointer relative select-none ${
                  isDragging
                    ? 'border-blue-600 bg-blue-100/60'
                    : 'border-blue-400 bg-[#f8faff] hover:bg-blue-50/50'
                }`}
              >
                <Folder className="w-10 h-10 text-amber-400 fill-amber-300 mx-auto drop-shadow-sm pointer-events-none" />

                <div className="pointer-events-none">
                  <span className="text-sm md:text-base font-extrabold text-[#0d1f44] block">
                    Pilih File Excel atau Tarik & Lepaskan ke Sini
                  </span>
                  <span className="text-xs text-slate-500 font-bold block mt-0.5">
                    Mendukung file berekstensi .xlsx, .xls, atau .csv
                  </span>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleOpenPicker}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-95 text-white font-black text-xs py-2 px-5 rounded-xl shadow-md shadow-blue-500/25 transition-all inline-block cursor-pointer select-none"
                  >
                    Pilih File dari Komputer...
                  </button>
                </div>
              </div>

              {/* Input file diletakkan di luar kontainer dropzone agar event bubbling tidak memicu klik ganda */}
              <input
                id="modal-excel-file-input"
                type="file"
                ref={modalFileInputRef}
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Preview Container Saat File Terbaca */}
              {pendingImport && (
                <div className="bg-[#f8fafc] border border-slate-300 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-200">
                  {/* Top Stats & File Info */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                      <span>📄 File:</span>
                      <span className="text-sky-700 underline font-black">{pendingImport.fileName}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-[11px] font-black">
                        ✓ {pendingImport.records.length} Guru Terbaca
                      </span>
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-[11px] font-black">
                        ⚡ Total: {pendingImport.totalJp} JP
                      </span>
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-black">
                        🔵 {pendingImport.countP} Produktif
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-black">
                        🟢 {pendingImport.countR} Reguler
                      </span>
                    </div>
                  </div>

                  {/* Opsi Penerapan Data Guru (Radio Cards) */}
                  <div className="bg-sky-50/60 border border-sky-300 rounded-xl p-3 space-y-2">
                    <span className="font-black text-xs text-sky-950 flex items-center gap-1.5">
                      <span>⚙️</span> Opsi Penerapan Data Guru:
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      {/* Opsi Replace All */}
                      <label
                        className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex items-start gap-2.5 bg-white ${
                          importMode === 'replace_all'
                            ? 'border-sky-600 shadow-sm ring-1 ring-sky-500/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          value="replace_all"
                          checked={importMode === 'replace_all'}
                          onChange={() => setImportMode('replace_all')}
                          className="mt-0.5 text-sky-600 focus:ring-sky-500"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-xs text-sky-950">
                              🔄 Gantikan Sepenuhnya (Replace All)
                            </span>
                            <span className="bg-sky-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                              Rekomendasi
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            Data guru lama ({guruList.length} guru) dihapus total dan digantikan seutuhnya dengan {pendingImport.records.length} guru baru dari Excel.
                          </p>
                        </div>
                      </label>

                      {/* Opsi Merge */}
                      <label
                        className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex items-start gap-2.5 bg-white ${
                          importMode === 'update_merge'
                            ? 'border-sky-600 shadow-sm ring-1 ring-sky-500/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          value="update_merge"
                          checked={importMode === 'update_merge'}
                          onChange={() => setImportMode('update_merge')}
                          className="mt-0.5 text-sky-600 focus:ring-sky-500"
                        />
                        <div className="space-y-1">
                          <span className="font-black text-xs text-slate-800 block">
                            ➕ Gabungkan / Update Data (Merge)
                          </span>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            Hanya memperbarui guru yang cocok (ID/Nama) dan menambahkan yang belum ada, tanpa menghapus guru lama.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Scrollable Mockup Preview Table */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-100 text-slate-700 font-black text-[11px] border-b border-slate-300 z-10">
                          <tr>
                            <th className="py-2 px-2 text-center w-10">NO</th>
                            <th className="py-2 px-2 text-center w-12">ID</th>
                            <th className="py-2 px-3">NAMA GURU</th>
                            <th className="py-2 px-3">SK GURU</th>
                            <th className="py-2 px-2 text-center w-24">TIPE</th>
                            <th className="py-2 px-2 text-center w-20">SETTING JP</th>
                            <th className="py-2 px-2 text-center w-20">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-[11px]">
                          {pendingImport.records.slice(0, 20).map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-1.5 px-2 text-center text-slate-500">{idx + 1}</td>
                              <td className="py-1.5 px-2 text-center font-bold text-slate-700">{r.id || idx + 1}</td>
                              <td className="py-1.5 px-3 font-bold text-slate-900">{r.nama}</td>
                              <td className="py-1.5 px-3 text-slate-600">{r.mapel || '-'}</td>
                              <td className="py-1.5 px-2 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                    r.tipe === 'P'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {r.tipe === 'P' ? 'Produktif' : 'Reguler'}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 text-center font-extrabold text-blue-950">
                                {r.jp} JP
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <span className="bg-sky-100 text-sky-800 text-[10px] font-black px-1.5 py-0.5 rounded">
                                  Data Baru
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {pendingImport.records.length > 20 && (
                      <div className="py-1.5 text-center text-[11px] text-slate-500 font-semibold bg-slate-50 border-t border-slate-200">
                        ... dan {pendingImport.records.length - 20} baris data guru lainnya.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal: Batal & Terapkan */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setPendingImport(null);
                  setImportMode('replace_all');
                }}
                className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleApplyImport}
                disabled={!pendingImport || pendingImport.records.length === 0}
                className="bg-[#0284c7] hover:bg-[#0369a1] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {pendingImport
                    ? importMode === 'replace_all'
                      ? `✓ Gantikan Sepenuhnya (${pendingImport.records.length} Guru Baru)`
                      : `✓ Gabungkan Data (${pendingImport.records.length} Guru)`
                    : '✓ Terapkan Import Data'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Kosongkan Data */}
      <ConfirmDialog
        isOpen={confirmClearOpen}
        title="Kosongkan Semua Data Guru?"
        message="Tindakan ini akan menghapus seluruh data guru di tabel setting utama. Tindakan ini tidak dapat dibatalkan kecuali Anda memiliki backup."
        confirmLabel="Ya, Kosongkan Semua"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleClearAll}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
};
