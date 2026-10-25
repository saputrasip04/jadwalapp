// src/features/07-jam-efektif/JamEfektifView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useAppStore } from '../../app/store';
import { SettingSekolah } from '../../domain/types';
import { useToastStore } from '../../ui/Toast';
import {
  JamEfektifData,
  JamEfektifRow,
  DEFAULT_JAM_EFEKTIF,
  DEFAULT_JUMAT_XI_XII,
  getStoredJamEfektif,
  saveStoredJamEfektif,
  recalculateJamEfektifFromParams,
  toMin,
  toTimeDot,
} from '../../domain/jam-efektif-data';
import {
  Clock,
  Settings,
  Calculator,
  RotateCcw,
  Printer,
  CheckCircle2,
  Sparkles,
  Save,
  X,
  Calendar,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';

export const JamEfektifView: React.FC = () => {
  const { addToast } = useToastStore();
  const { sekolah, setSekolah } = useAppStore();

  // Dexie live listener: real-time sinkronisasi dari Setting Utama / Shell Header
  const liveSettingSekolah = useLiveQuery(() => db.setting.get('sekolah'));
  const liveSekolah: SettingSekolah | null = useMemo(() => {
    if (liveSettingSekolah?.value_json) {
      try {
        return JSON.parse(liveSettingSekolah.value_json) as SettingSekolah;
      } catch {
        return null;
      }
    }
    return null;
  }, [liveSettingSekolah]);

  const activeSekolah = liveSekolah || sekolah;

  const [je, setJe] = useState<JamEfektifData>(() =>
    JSON.parse(JSON.stringify(DEFAULT_JAM_EFEKTIF))
  );
  const [isLoaded, setIsLoaded] = useState(false);

  const displaySchoolName = (activeSekolah?.nama && activeSekolah.nama.trim())
    ? activeSekolah.nama.trim()
    : (je.schoolName || 'SMKN IHYA ULUMUDDIN SINGOJURUH');

  const displayAcademicYear = (activeSekolah?.tahun_ajaran && activeSekolah.tahun_ajaran.trim())
    ? activeSekolah.tahun_ajaran.trim()
    : (je.academicYear || '2026/2027');

  // Identitas Tanda Tangan Gambar 2: Real-time tersinkron dari Setting Utama (Gambar 1)
  const displayPrincipalName = (activeSekolah?.kepala_sekolah && activeSekolah.kepala_sekolah.trim())
    ? activeSekolah.kepala_sekolah.trim()
    : (je.principalName || 'MOHAMAD MALIKI, S.Pd');

  const displayPrincipalNip = (activeSekolah?.nip_kepala_sekolah && activeSekolah.nip_kepala_sekolah.trim())
    ? activeSekolah.nip_kepala_sekolah.trim()
    : (je.principalNip || '19820921 201407 1 001');

  const displaySignatureDateText = (activeSekolah?.tanggal_tertulis && activeSekolah.tanggal_tertulis.trim())
    ? activeSekolah.tanggal_tertulis.trim()
    : `${je.signatureCity || 'Singojuruh'}, ${je.signatureDate || '8 Agustus 2023'}`;

  // Nama Jabatan Kepala UPT SMK mengikuti form Setting Utama Guru & Alokasi JP (Gambar 2)
  const displayPrincipalTitle = useMemo(() => {
    const sName = displaySchoolName.trim();
    if (!sName) return 'Kepala UPT SMKN Ihya Ulumuddin Singojuruh';
    if (/^kepala\b/i.test(sName)) {
      return sName;
    }
    if (/^upt\b/i.test(sName)) {
      return `Kepala ${sName}`;
    }
    return `Kepala UPT ${sName}`;
  }, [displaySchoolName]);

  // Baris teks stempel resmi dinamis mengikuti nama SMK dari form Setting Utama
  const stampLines = useMemo<[string, string, string]>(() => {
    const sName = displaySchoolName.trim().toUpperCase();
    const words = sName.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      return [words[0] || 'SMKN', '', ''];
    }
    if (words.length === 2) {
      return [words[0] || 'SMKN', words[1] || '', ''];
    }
    if (words.length === 3) {
      return [words[0] || 'SMKN', words[1] || '', words[2] || ''];
    }
    const line1 = words.slice(0, 2).join(' ');
    const line2 = words.slice(2, words.length - 1).join(' ');
    const line3 = words[words.length - 1] || '';
    return [line1, line2, line3];
  }, [displaySchoolName]);

  // Quick toolbar inputs
  const [quickDurStandar, setQuickDurStandar] = useState<number>(35);
  const [quickDurJumat, setQuickDurJumat] = useState<number>(35);
  const [quickStartSenin, setQuickStartSenin] = useState<string>('06:30');
  const [quickStartSelasaKamis, setQuickStartSelasaKamis] = useState<string>('06:45');
  const [quickStartJumat, setQuickStartJumat] = useState<string>('06:45');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<
    'tab_params' | 'tab_senin' | 'tab_selasa' | 'tab_jumat' | 'tab_jumat_xi_xii'
  >('tab_params');
  const [modalDraft, setModalDraft] = useState<JamEfektifData>(() =>
    JSON.parse(JSON.stringify(DEFAULT_JAM_EFEKTIF))
  );
  const [manualRowEdited, setManualRowEdited] = useState(false);

  // Jumat View Mode (Gambar 2: Keduanya / Khusus Kelas X 6 JP / Khusus Kelas XI & XII 4 JP)
  const [jumatViewMode, setJumatViewMode] = useState<'ALL' | 'X' | 'XI_XII'>('ALL');

  // Load initial data
  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await getStoredJamEfektif();
      if (mounted) {
        setJe(stored);
        setQuickDurStandar(stored.cfgParams?.durStandar ?? 35);
        setQuickDurJumat(stored.cfgParams?.durJumat ?? 35);
        setQuickStartSenin(stored.cfgParams?.startSenin ?? '06:30');
        setQuickStartSelasaKamis(stored.cfgParams?.startSelasaKamis ?? '06:45');
        setQuickStartJumat(stored.cfgParams?.startJumat ?? '06:45');
        setIsLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Quick Controls: Apply & Update
  const handleApplyQuick = async () => {
    const updated = JSON.parse(JSON.stringify(je)) as JamEfektifData;
    if (!updated.cfgParams) {
      updated.cfgParams = JSON.parse(JSON.stringify(DEFAULT_JAM_EFEKTIF.cfgParams));
    }

    if (quickDurStandar > 0) updated.cfgParams.durStandar = Number(quickDurStandar);
    if (quickDurJumat > 0) updated.cfgParams.durJumat = Number(quickDurJumat);
    if (quickStartSenin.trim()) updated.cfgParams.startSenin = quickStartSenin.trim();
    if (quickStartSelasaKamis.trim()) updated.cfgParams.startSelasaKamis = quickStartSelasaKamis.trim();
    if (quickStartJumat.trim()) updated.cfgParams.startJumat = quickStartJumat.trim();

    recalculateJamEfektifFromParams(updated);
    await saveStoredJamEfektif(updated);
    setJe(updated);
    addToast({
      type: 'success',
      title: 'Pembaruan Berhasil',
      message: 'Berhasil menerapkan perubahan waktu! Tampilan dokumen resmi jam efektif telah di-update.',
    });
  };

  // Action: Hitung Otomatis
  const handleHitungOtomatis = async () => {
    const updated = JSON.parse(JSON.stringify(je)) as JamEfektifData;
    recalculateJamEfektifFromParams(updated);
    await saveStoredJamEfektif(updated);
    setJe(updated);
    addToast({
      type: 'success',
      title: 'Kalkulasi Berhasil',
      message: 'Berhasil menghitung ulang seluruh waktu jam efektif dari parameter durasi!',
    });
  };

  // Action: Reset Standar
  const handleResetStandar = async () => {
    if (!window.confirm('Kembalikan Template Jam Efektif ke format standar dokumen resmi sekolah?')) {
      return;
    }
    const fresh = JSON.parse(JSON.stringify(DEFAULT_JAM_EFEKTIF)) as JamEfektifData;
    fresh.schoolName = displaySchoolName;
    fresh.academicYear = displayAcademicYear;
    await saveStoredJamEfektif(fresh);
    setJe(fresh);
    setQuickDurStandar(fresh.cfgParams.durStandar);
    setQuickDurJumat(fresh.cfgParams.durJumat);
    setQuickStartSenin(fresh.cfgParams.startSenin);
    setQuickStartSelasaKamis(fresh.cfgParams.startSelasaKamis);
    setQuickStartJumat(fresh.cfgParams.startJumat);
    addToast({
      type: 'info',
      title: 'Reset Selesai',
      message: 'Template Jam Efektif telah di-reset ke standar dokumen resmi!',
    });
  };

  // Action: Cetak Dokumen
  const handlePrint = () => {
    window.print();
  };

  // Modal Open
  const handleOpenModal = () => {
    const draft = JSON.parse(JSON.stringify(je)) as JamEfektifData;
    draft.schoolName = displaySchoolName;
    draft.academicYear = displayAcademicYear;
    draft.principalName = displayPrincipalName;
    draft.principalNip = displayPrincipalNip;
    if (activeSekolah?.tanggal_tertulis) {
      const parts = activeSekolah.tanggal_tertulis.split(',');
      if (parts.length >= 2) {
        draft.signatureCity = parts[0]?.trim() || draft.signatureCity;
        draft.signatureDate = parts.slice(1).join(',').trim() || draft.signatureDate;
      } else {
        draft.signatureDate = activeSekolah.tanggal_tertulis.trim();
      }
    }
    if (!draft.jumat_xi_xii || draft.jumat_xi_xii.length === 0) {
      draft.jumat_xi_xii = JSON.parse(JSON.stringify(DEFAULT_JUMAT_XI_XII));
    }
    setModalDraft(draft);
    setModalTab('tab_params');
    setManualRowEdited(false);
    setIsModalOpen(true);
  };

  // Modal Close
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Auto-calculate single day row cascade in modal
  const autoCalculateDayRows = (
    dayKey: 'senin' | 'selasa_kamis' | 'jumat' | 'jumat_xi_xii',
    fromIdx: number,
    triggerField: 'start' | 'end' | 'dur' | 'type',
    rows: JamEfektifRow[]
  ): JamEfektifRow[] => {
    const updatedRows = [...rows];
    const target: JamEfektifRow = { ...updatedRows[fromIdx]! };

    if (target.type === '-' || target.type === 'empty') {
      target.end = '-';
      target.pukul = '-';
      target.dur = 0;
      updatedRows[fromIdx] = target;
      return updatedRows;
    }

    const clean = (val: string | undefined) => (val || '').trim().replace(':', '.');
    const isValid = (val: string | undefined) => {
      if (!val) return false;
      const parts = clean(val).split('.');
      if (parts.length !== 2) return false;
      const h = parseInt(parts[0]!, 10);
      const m = parseInt(parts[1]!, 10);
      return !isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60;
    };

    let curStart = clean(target.start);
    let curDur = Number(target.dur) || 0;

    if (triggerField === 'end') {
      const curEnd = clean(target.end);
      if (curEnd.toUpperCase() !== 'SELESAI' && isValid(curStart) && isValid(curEnd)) {
        const sMin = toMin(curStart);
        const eMin = toMin(curEnd);
        if (eMin > sMin) {
          curDur = eMin - sMin;
          target.dur = curDur;
        }
      }
    } else {
      if (isValid(curStart)) {
        if (target.end?.trim().toUpperCase() !== 'SELESAI') {
          const sMin = toMin(curStart);
          const eMin = sMin + curDur;
          target.end = toTimeDot(eMin);
        }
      }
    }

    if (target.type === 'break' || (target.jamKe && target.jamKe.toUpperCase().includes('ISTIRAHAT'))) {
      if (target.jamKe && /^ISTIRAHAT\s+\d+'/i.test(target.jamKe.trim())) {
        target.jamKe = `ISTIRAHAT ${curDur}'`;
        target.labelJam = target.jamKe;
      }
    }
    target.pukul = `${target.start} - ${target.end}`;
    updatedRows[fromIdx] = target;

    // Cascade to subsequent rows
    let k = fromIdx + 1;
    while (k < updatedRows.length) {
      const prev = updatedRows[k - 1]!;
      const cur: JamEfektifRow = { ...updatedRows[k]! };

      if (cur.type === '-' || cur.type === 'empty') {
        cur.end = '-';
        cur.pukul = '-';
        cur.dur = 0;
        updatedRows[k] = cur;
        k++;
        continue;
      }

      const prevEnd = clean(prev.end);
      if (!isValid(prevEnd)) break;

      cur.start = prevEnd;
      let kDur = Number(cur.dur) || 35;

      if (cur.end?.trim().toUpperCase() !== 'SELESAI') {
        const kStartMin = toMin(prevEnd);
        const kEndMin = kStartMin + kDur;
        cur.end = toTimeDot(kEndMin);
      }

      if (cur.type === 'break' || (cur.jamKe && cur.jamKe.toUpperCase().includes('ISTIRAHAT'))) {
        if (cur.jamKe && /^ISTIRAHAT\s+\d+'/i.test(cur.jamKe.trim())) {
          cur.jamKe = `ISTIRAHAT ${kDur}'`;
          cur.labelJam = cur.jamKe;
        }
      }
      cur.pukul = `${cur.start} - ${cur.end}`;
      updatedRows[k] = cur;
      k++;
    }

    return updatedRows;
  };

  // Form Baris: Hapus baris per item
  const handleDeleteRow = (
    dayKey: 'senin' | 'selasa_kamis' | 'jumat' | 'jumat_xi_xii',
    idx: number
  ) => {
    const currentRows = modalDraft[dayKey] || [];
    const updated = currentRows.filter((_, i) => i !== idx);
    setModalDraft({ ...modalDraft, [dayKey]: updated });
    setManualRowEdited(true);
  };

  // Form Baris: Tambah baris baru / slot kosong (-)
  const handleAddRow = (
    dayKey: 'senin' | 'selasa_kamis' | 'jumat' | 'jumat_xi_xii',
    asEmpty = false
  ) => {
    const currentRows = modalDraft[dayKey] || [];
    const lastRow = currentRows[currentRows.length - 1];
    const prevEnd =
      lastRow?.end && lastRow.end !== '-' && lastRow.end !== 'SELESAI'
        ? lastRow.end
        : '12.00';
    const dur = modalDraft.cfgParams?.durStandar || 35;
    const sMin = toMin(prevEnd);
    const eMin = sMin + dur;
    const nextEnd = toTimeDot(eMin);

    let nextNum = currentRows.length + 1;
    for (let i = currentRows.length - 1; i >= 0; i--) {
      const n = parseInt(currentRows[i]?.jamKe || '', 10);
      if (!isNaN(n)) {
        nextNum = n + 1;
        break;
      }
    }

    const newRow: JamEfektifRow = asEmpty
      ? {
          type: '-',
          jamKe: String(nextNum),
          labelJam: String(nextNum),
          start: prevEnd,
          end: '-',
          dur: 0,
          pukul: '-',
          ket: 'KOSONG / PULANG',
        }
      : {
          type: 'jam',
          jamKe: String(nextNum),
          labelJam: String(nextNum),
          start: prevEnd,
          end: nextEnd,
          dur,
          pukul: `${prevEnd} - ${nextEnd}`,
          ket: `JAM KE ${nextNum}`,
        };

    setModalDraft({ ...modalDraft, [dayKey]: [...currentRows, newRow] });
    setManualRowEdited(true);
  };

  // Modal Save
  const handleSaveModal = async () => {
    const finalData = JSON.parse(JSON.stringify(modalDraft)) as JamEfektifData;

    if (!manualRowEdited) {
      recalculateJamEfektifFromParams(finalData);
    } else {
      if (finalData.senin && finalData.senin[0]?.start) {
        finalData.cfgParams.startSenin = finalData.senin[0].start.replace('.', ':');
      }
      if (finalData.selasa_kamis && finalData.selasa_kamis[0]?.start) {
        finalData.cfgParams.startSelasaKamis = finalData.selasa_kamis[0].start.replace('.', ':');
      }
      if (finalData.jumat && finalData.jumat[0]?.start) {
        finalData.cfgParams.startJumat = finalData.jumat[0].start.replace('.', ':');
      }
    }

    await saveStoredJamEfektif(finalData);
    setJe(finalData);
    setQuickDurStandar(finalData.cfgParams.durStandar);
    setQuickDurJumat(finalData.cfgParams.durJumat);
    setQuickStartSenin(finalData.cfgParams.startSenin);
    setQuickStartSelasaKamis(finalData.cfgParams.startSelasaKamis);
    setQuickStartJumat(finalData.cfgParams.startJumat);

    // Sinkronkan nama sekolah, tahun ajaran, kepala sekolah, NIP, tanggal ttd balik ke db.setting.sekolah & useAppStore (Header App Gambar 2)
    try {
      const sName = (finalData.schoolName || '').trim();
      const aYear = (finalData.academicYear || '').trim();
      const pName = (finalData.principalName || '').trim();
      const pNip = (finalData.principalNip || '').trim();
      const sCity = (finalData.signatureCity || '').trim();
      const sDate = (finalData.signatureDate || '').trim();
      const tglTertulis = sCity && sDate ? `${sCity}, ${sDate}` : (sDate || sCity);

      const sRec = await db.setting.get('sekolah');
      const baseSekolah: SettingSekolah = sRec
        ? JSON.parse(sRec.value_json)
        : { nama: '', tahun_ajaran: '2026/2027', semester: 'Ganjil' };

      if (sName) baseSekolah.nama = sName;
      if (aYear) baseSekolah.tahun_ajaran = aYear;
      if (pName) baseSekolah.kepala_sekolah = pName;
      if (pNip) baseSekolah.nip_kepala_sekolah = pNip;
      if (tglTertulis) baseSekolah.tanggal_tertulis = tglTertulis;

      await db.setting.put({
        key: 'sekolah',
        value_json: JSON.stringify(baseSekolah),
        updated_at: new Date().toISOString(),
      });
      setSekolah(baseSekolah);
    } catch (errSekolah) {
      console.warn('Gagal sinkronkan setting sekolah dari modal:', errSekolah);
    }

    setIsModalOpen(false);

    addToast({
      type: 'success',
      title: 'Pondasi Disimpan',
      message: 'Pondasi Template Jam Efektif & Identitas Sekolah berhasil disimpan & disinkronkan!',
    });
  };

  // Helper render rows for the 3 tables
  const renderDayTableRows = (rows: JamEfektifRow[]) => {
    return rows.map((r, idx) => {
      const isBreak = r.type === 'break';
      const isEmpty = r.type === '-' || r.type === 'empty';
      const isSpecial = r.type === 'pre' || r.type === 'piket' || r.type === 'extra';

      if (isEmpty) {
        return (
          <tr key={idx} style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>
            <td
              style={{
                border: '1.5px solid #000',
                padding: '6px 4px',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '13px',
                color: '#64748b',
                backgroundColor: '#f8fafc',
              }}
            >
              {r.jamKe || '-'}
            </td>
            <td
              style={{
                border: '1.5px solid #000',
                padding: '6px 4px',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '13px',
                color: '#64748b',
                backgroundColor: '#f8fafc',
                letterSpacing: '2px',
              }}
            >
              -
            </td>
          </tr>
        );
      }

      if (isBreak) {
        return (
          <tr key={idx} style={{ backgroundColor: '#374151', color: '#ffffff' }}>
            <td
              style={{
                border: '1.5px solid #000',
                padding: '6px 4px',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '12px',
                backgroundColor: '#374151',
                color: '#ffffff',
              }}
            >
              {r.jamKe || 'ISTIRAHAT'}
            </td>
            <td
              style={{
                border: '1.5px solid #000',
                padding: '6px 4px',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '12px',
                backgroundColor: '#374151',
                color: '#ffffff',
              }}
            >
              {r.pukul || (r.start && r.end ? `${r.start} - ${r.end}` : '')}
            </td>
          </tr>
        );
      }

      return (
        <tr
          key={idx}
          style={{
            backgroundColor: isSpecial ? '#f8fafc' : '#ffffff',
          }}
        >
          <td
            style={{
              border: '1.5px solid #000',
              padding: '6px 4px',
              textAlign: 'center',
              fontWeight: 800,
              fontSize: '13px',
              color: '#000000',
            }}
          >
            {r.jamKe}
          </td>
          <td
            style={{
              border: '1.5px solid #000',
              padding: '6px 4px',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '13px',
              color: '#000000',
            }}
          >
            {r.pukul || (r.start && r.end ? `${r.start} - ${r.end}` : '')}
          </td>
        </tr>
      );
    });
  };

  if (!isLoaded) {
    return (
      <div className="p-8 text-center text-slate-500 font-semibold">
        Memuat data Template Jam Efektif...
      </div>
    );
  }

  // Live summary for modal tab 1
  const lastSenin = modalDraft.senin?.[modalDraft.senin.length - 1];
  const lastSelasa = modalDraft.selasa_kamis?.[modalDraft.selasa_kamis.length - 1];
  const lastJumat = modalDraft.jumat?.[modalDraft.jumat.length - 1];

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto pb-16 select-text" style={{ padding: '16px 20px' }}>
      {/* Action Toolbar (Hidden when printing) */}
      <div className="no-print" style={{ marginBottom: '20px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#ffffff',
            padding: '16px 20px',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock className="w-6 h-6 text-yellow-300" />
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  margin: 0,
                  color: '#ffffff',
                  letterSpacing: '0.3px',
                }}
              >
                TEMPLATE JAM EFEKTIF
              </h2>
              <span
                style={{
                  background: '#facc15',
                  color: '#854d0e',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                }}
              >
                Pondasi Jadwal Sekolah
              </span>
            </div>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '0.85rem',
                color: '#e0e7ff',
                maxWidth: '650px',
              }}
            >
              Kustomisasi waktu dalam 1 JP, jam mulai, durasi istirahat, serta upacara/yasin.
              Alokasi ini menjadi pondasi dasar perhitungan seluruh jadwal sekolah.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleOpenModal}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
              style={{
                background: '#ffffff',
                color: '#1e3a8a',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Settings className="w-4 h-4" />
              Kustomisasi & Edit Waktu
            </button>
            <button
              type="button"
              onClick={handleHitungOtomatis}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-white/25"
              style={{
                background: 'rgba(255,255,255,0.18)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Hitung ulang otomatis berdasarkan menit parameter"
            >
              <Calculator className="w-4 h-4" />
              Hitung Otomatis
            </button>
            <button
              type="button"
              onClick={handleResetStandar}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-white/25"
              style={{
                background: 'rgba(255,255,255,0.18)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Kembalikan ke data standar foto SK"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Standar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm hover:brightness-105"
              style={{
                background: '#facc15',
                color: '#78350f',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Printer className="w-4 h-4" />
              Cetak Dokumen Resmi
            </button>
          </div>
        </div>
      </div>

      {/* Live Notification Banner */}
      <div
        className="no-print"
        style={{
          marginBottom: '16px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '0.82rem',
          color: '#166534',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <strong>Status Pondasi Aktif:</strong> Jam pembelajaran di bawah ini terhubung langsung ke
          perhitungan <code>times()</code> dan <code>getBreaks()</code>. Seluruh jadwal di menu Jadwal Total,
          Jadwal Jurusan, Jadwal Kelas, Jadwal Guru, dan Template Jadwal secara otomatis menggunakan
          alokasi waktu ini.
        </div>
      </div>

      {/* Quick Control Toolbar (Instantly Update Document) */}
      <div
        className="no-print"
        style={{
          marginBottom: '20px',
          background: '#ffffff',
          border: '1.5px solid #cbd5e1',
          borderRadius: '10px',
          padding: '16px 20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                Kustomisasi Waktu 1 JP & Jam Mulai:
              </strong>
              <span
                style={{
                  fontSize: '0.74rem',
                  background: '#eff6ff',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  marginLeft: '6px',
                }}
              >
                Langsung Mengubah Tampilan Dokumen di Bawah
              </span>
            </div>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Ubah angka menit atau jam mulai di bawah, lalu klik{' '}
            <strong>Terapkan & Update Dokumen</strong>
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div>
            <label
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#334155',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              ⏱ Durasi 1 JP (Senin-Kamis):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                value={quickDurStandar}
                onChange={(e) => setQuickDurStandar(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg border text-sm font-extrabold text-blue-700 bg-slate-50 border-slate-400 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>menit</span>
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#334155',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              ⏱ Durasi 1 JP (Jum'at):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                value={quickDurJumat}
                onChange={(e) => setQuickDurJumat(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg border text-sm font-extrabold text-blue-700 bg-slate-50 border-slate-400 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>menit</span>
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#334155',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              🌅 Jam Mulai Senin:
            </label>
            <input
              type="text"
              value={quickStartSenin}
              onChange={(e) => setQuickStartSenin(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border text-sm font-bold text-slate-800 bg-white border-slate-300 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#334155',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              🌅 Jam Mulai Selasa-Kamis:
            </label>
            <input
              type="text"
              value={quickStartSelasaKamis}
              onChange={(e) => setQuickStartSelasaKamis(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border text-sm font-bold text-slate-800 bg-white border-slate-300 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#334155',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              🌅 Jam Mulai Jum'at:
            </label>
            <input
              type="text"
              value={quickStartJumat}
              onChange={(e) => setQuickStartJumat(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border text-sm font-bold text-slate-800 bg-white border-slate-300 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleApplyQuick}
              className="w-full py-2 px-3 rounded-lg text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Terapkan & Update Dokumen
            </button>
          </div>
        </div>
      </div>

      {/* Pilihan Tampilan Hari Jumat (Gambar 2: Kelas X 6 JP vs Kelas XI & XII 4 JP) */}
      <div
        className="no-print"
        style={{
          maxWidth: '980px',
          margin: '0 auto 14px auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '10px 16px',
          backgroundColor: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: '10px',
          boxShadow: '0 2px 6px rgba(37,99,235,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar className="w-4 h-4 text-blue-600" />
          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e40af' }}>
            Format Hari Jum'at di Dokumen:
          </span>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            (Kelas X: 6 JP | Kelas XI & XII: 4 JP)
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setJumatViewMode('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              jumatViewMode === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Tampilkan Keduanya (Kelas X & XI-XII)
          </button>
          <button
            type="button"
            onClick={() => setJumatViewMode('X')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              jumatViewMode === 'X'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Khusus Kelas X (6 JP)
          </button>
          <button
            type="button"
            onClick={() => setJumatViewMode('XI_XII')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              jumatViewMode === 'XI_XII'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Khusus Kelas XI & XII (4 JP)
          </button>
        </div>
      </div>

      {/* Official Paper Sheet Container (Matches the Uploaded Official Document) */}
      <div
        id="jamEfektifPaper"
        className="jam-efektif-sheet"
        style={{
          maxWidth: '980px',
          margin: '0 auto 30px auto',
          background: '#ffffff',
          padding: '36px 42px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          borderRadius: '6px',
          fontFamily: "'Arial', sans-serif",
          color: '#000000',
          boxSizing: 'border-box',
        }}
      >
        {/* Header (Gambar 1) - Tersinkronkan otomatis dengan Header Aplikasi (Gambar 2) */}
        <div
          onClick={handleOpenModal}
          title="Klik untuk kustomisasi judul, nama sekolah & tahun pelajaran"
          style={{ textAlign: 'center', marginBottom: '22px', cursor: 'pointer' }}
          className="group hover:opacity-95 transition-opacity"
        >
          <div
            style={{
              fontSize: '19px',
              fontWeight: 900,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: '#000000',
              marginBottom: '2px',
            }}
          >
            {je.docTitle || 'JAM PEMBELAJARAN EFEKTIF'}
          </div>
          <div
            style={{
              fontSize: '21px',
              fontWeight: 900,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: '#000000',
              marginBottom: '2px',
            }}
          >
            {displaySchoolName}
          </div>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 800,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              color: '#000000',
            }}
          >
            TAHUN AJARAN {displayAcademicYear}
          </div>
        </div>

        {/* 3 Columns Table Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px',
            alignItems: 'start',
          }}
        >
          {/* Column 1: SENIN */}
          <div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '2px solid #000000',
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr>
                  <th
                    colSpan={2}
                    className="header-day"
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: '14px',
                      padding: '8px 4px',
                      border: '1.5px solid #000000',
                      letterSpacing: '0.5px',
                    }}
                  >
                    SENIN
                  </th>
                </tr>
                <tr>
                  <th
                    className="header-sub"
                    style={{
                      backgroundColor: '#facc15',
                      color: '#000000',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: '12px',
                      padding: '6px 2px',
                      border: '1.5px solid #000000',
                      width: '44%',
                    }}
                  >
                    JAM KE
                  </th>
                  <th
                    className="header-sub"
                    style={{
                      backgroundColor: '#facc15',
                      color: '#000000',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: '12px',
                      padding: '6px 2px',
                      border: '1.5px solid #000000',
                      width: '56%',
                    }}
                  >
                    WAKTU
                  </th>
                </tr>
              </thead>
              <tbody>{renderDayTableRows(je.senin || [])}</tbody>
            </table>
          </div>

          {/* Column 2: SELASA s/d KAMIS */}
          <div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '2px solid #000000',
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr>
                  <th
                    colSpan={2}
                    className="header-day"
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: '14px',
                      padding: '8px 4px',
                      border: '1.5px solid #000000',
                      letterSpacing: '0.5px',
                    }}
                  >
                    SELASA s/d KAMIS
                  </th>
                </tr>
                <tr>
                  <th
                    className="header-sub"
                    style={{
                      backgroundColor: '#facc15',
                      color: '#000000',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: '12px',
                      padding: '6px 2px',
                      border: '1.5px solid #000000',
                      width: '44%',
                    }}
                  >
                    JAM KE
                  </th>
                  <th
                    className="header-sub"
                    style={{
                      backgroundColor: '#facc15',
                      color: '#000000',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: '12px',
                      padding: '6px 2px',
                      border: '1.5px solid #000000',
                      width: '56%',
                    }}
                  >
                    WAKTU
                  </th>
                </tr>
              </thead>
              <tbody>{renderDayTableRows(je.selasa_kamis || [])}</tbody>
            </table>
          </div>

          {/* Column 3: JUMAT (2 Tampilan: Kelas X 6 JP & Kelas XI-XII 4 JP) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Tampilan Kelas X (6 JP) */}
            {(jumatViewMode === 'ALL' || jumatViewMode === 'X') && (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '2px solid #000000',
                  tableLayout: 'fixed',
                }}
              >
                <thead>
                  <tr>
                    <th
                      colSpan={2}
                      className="header-day"
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '14px',
                        padding: '8px 4px',
                        border: '1.5px solid #000000',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {jumatViewMode === 'ALL' ? "JUM'AT — KELAS X (6 JP)" : "JUM'AT"}
                    </th>
                  </tr>
                  <tr>
                    <th
                      className="header-sub"
                      style={{
                        backgroundColor: '#facc15',
                        color: '#000000',
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '12px',
                        padding: '6px 2px',
                        border: '1.5px solid #000000',
                        width: '44%',
                      }}
                    >
                      JAM KE
                    </th>
                    <th
                      className="header-sub"
                      style={{
                        backgroundColor: '#facc15',
                        color: '#000000',
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '12px',
                        padding: '6px 2px',
                        border: '1.5px solid #000000',
                        width: '56%',
                      }}
                    >
                      WAKTU
                    </th>
                  </tr>
                </thead>
                <tbody>{renderDayTableRows(je.jumat || [])}</tbody>
              </table>
            )}

            {/* Tampilan Kelas XI & XII (4 JP) */}
            {(jumatViewMode === 'ALL' || jumatViewMode === 'XI_XII') && (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '2px solid #000000',
                  tableLayout: 'fixed',
                }}
              >
                <thead>
                  <tr>
                    <th
                      colSpan={2}
                      className="header-day"
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '14px',
                        padding: '8px 4px',
                        border: '1.5px solid #000000',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {jumatViewMode === 'ALL' ? "JUM'AT — KELAS XI & XII (4 JP)" : "JUM'AT"}
                    </th>
                  </tr>
                  <tr>
                    <th
                      className="header-sub"
                      style={{
                        backgroundColor: '#facc15',
                        color: '#000000',
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '12px',
                        padding: '6px 2px',
                        border: '1.5px solid #000000',
                        width: '44%',
                      }}
                    >
                      JAM KE
                    </th>
                    <th
                      className="header-sub"
                      style={{
                        backgroundColor: '#facc15',
                        color: '#000000',
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '12px',
                        padding: '6px 2px',
                        border: '1.5px solid #000000',
                        width: '56%',
                      }}
                    >
                      WAKTU
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {renderDayTableRows(je.jumat_xi_xii || DEFAULT_JUMAT_XI_XII)}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Signature Block (Bottom Right) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '32px',
            pageBreakInside: 'avoid',
          }}
        >
          <div
            style={{
              width: '290px',
              textAlign: 'left',
              fontSize: '13px',
              color: '#000000',
              lineHeight: 1.4,
            }}
          >
            <div>
              {displaySignatureDateText}
            </div>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>
              {displayPrincipalTitle}
            </div>

            {/* Stamp & Signature Container */}
            <div style={{ position: 'relative', height: '100px', margin: '4px 0' }}>
              {/* Official Round Seal SVG */}
              <svg
                width="115"
                height="115"
                viewBox="0 0 120 120"
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '-5px',
                  opacity: 0.82,
                  transform: 'rotate(-8deg)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              >
                <defs>
                  <path id="jeCircleTop" d="M 18,60 A 42,42 0 0,1 102,60" />
                  <path id="jeCircleBottom" d="M 102,60 A 42,42 0 0,1 18,60" />
                </defs>
                <circle cx="60" cy="60" r="56" fill="none" stroke="#2546a3" strokeWidth="2.6" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#2546a3" strokeWidth="1.2" />
                <circle cx="60" cy="60" r="33" fill="none" stroke="#2546a3" strokeWidth="1.2" />

                <text
                  fontFamily="'Arial', sans-serif"
                  fontSize="6.2"
                  fontWeight="bold"
                  fill="#2546a3"
                  letterSpacing="0.7"
                >
                  <textPath href="#jeCircleTop" startOffset="50%" textAnchor="middle">
                    PEMERINTAH PROVINSI JAWA TIMUR
                  </textPath>
                </text>
                <text
                  fontFamily="'Arial', sans-serif"
                  fontSize="6.4"
                  fontWeight="bold"
                  fill="#2546a3"
                  letterSpacing="0.7"
                >
                  <textPath href="#jeCircleBottom" startOffset="50%" textAnchor="middle">
                    DINAS PENDIDIKAN
                  </textPath>
                </text>

                <polygon
                  points="15,60 17,62 20,62 18,64 19,67 15,65 11,67 12,64 10,62 13,62"
                  fill="#2546a3"
                />
                <polygon
                  points="105,60 107,62 110,62 108,64 109,67 105,65 101,67 102,64 100,62 103,62"
                  fill="#2546a3"
                />

                <text
                  x="60"
                  y="53"
                  fontFamily="'Arial', sans-serif"
                  fontSize={(stampLines[0] || '').length > 12 ? '4.8' : (stampLines[0] || '').length > 8 ? '5.4' : '6.2'}
                  fontWeight="900"
                  fill="#2546a3"
                  textAnchor="middle"
                >
                  {stampLines[0]}
                </text>
                <text
                  x="60"
                  y="61"
                  fontFamily="'Arial', sans-serif"
                  fontSize={(stampLines[1] || '').length > 14 ? '4.2' : (stampLines[1] || '').length > 10 ? '4.8' : '5.2'}
                  fontWeight="900"
                  fill="#2546a3"
                  textAnchor="middle"
                >
                  {stampLines[1]}
                </text>
                <text
                  x="60"
                  y="69"
                  fontFamily="'Arial', sans-serif"
                  fontSize={(stampLines[2] || '').length > 14 ? '4.0' : (stampLines[2] || '').length > 10 ? '4.5' : '4.8'}
                  fontWeight="800"
                  fill="#2546a3"
                  textAnchor="middle"
                >
                  {stampLines[2]}
                </text>
              </svg>

              {/* Ink Signature SVG */}
              <svg
                width="150"
                height="75"
                viewBox="0 0 150 75"
                style={{
                  position: 'absolute',
                  left: '35px',
                  top: '12px',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                <path
                  d="M 12,52 Q 32,5 52,48 T 76,32 Q 92,18 108,46 Q 124,53 140,22"
                  fill="none"
                  stroke="#1e40af"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 32,40 Q 58,36 122,38"
                  fill="none"
                  stroke="#1e40af"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M 44,25 Q 54,16 68,22"
                  fill="none"
                  stroke="#1e40af"
                  strokeWidth="2.0"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div
              style={{
                fontWeight: 900,
                fontSize: '13.5px',
                textDecoration: 'underline',
                textTransform: 'uppercase',
              }}
            >
              {displayPrincipalName}
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 600 }}>
              NIP. {displayPrincipalNip}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Kustomisasi & Edit Waktu */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  Kustomisasi Template Jam Efektif
                  <span className="bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    Pondasi Jadwal
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ubah alokasi menit dalam 1 JP, jam mulai, durasi istirahat, atau kustomisasi tabel
                  per-baris. Setiap perubahan akan langsung otomatis meng-update tampilan dokumen resmi.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subtabs Navigation */}
            <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex gap-2 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalTab('tab_params')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === 'tab_params'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Parameter & Durasi 1 JP
              </button>
              <button
                type="button"
                onClick={() => setModalTab('tab_senin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === 'tab_senin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Tabel Senin ({modalDraft.senin?.length || 0} Baris)
              </button>
              <button
                type="button"
                onClick={() => setModalTab('tab_selasa')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === 'tab_selasa'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Tabel Selasa-Kamis ({modalDraft.selasa_kamis?.length || 0} Baris)
              </button>
              <button
                type="button"
                onClick={() => setModalTab('tab_jumat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === 'tab_jumat'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Tabel Jumat - Kelas X (6 JP) ({modalDraft.jumat?.length || 0} Baris)
              </button>
              <button
                type="button"
                onClick={() => setModalTab('tab_jumat_xi_xii')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === 'tab_jumat_xi_xii'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Tabel Jumat - Kelas XI & XII (4 JP) ({modalDraft.jumat_xi_xii?.length || 0} Baris)
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {modalTab === 'tab_params' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 leading-relaxed">
                    <strong>Cara Kerja Perhitungan Otomatis:</strong> Masukkan durasi 1 JP (misal 35 menit)
                    serta jam mulai dan durasi istirahat. Sistem akan secara otomatis menghitung ulang
                    seluruh waktu di tabel dokumen secara matematis ketika disimpan.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Card 1: Identitas Dokumen */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        Identitas & Tanda Tangan Dokumen
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="font-bold text-slate-600 block mb-1">Judul Dokumen:</label>
                          <input
                            type="text"
                            value={modalDraft.docTitle}
                            onChange={(e) =>
                              setModalDraft({ ...modalDraft, docTitle: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-600 block mb-1">Nama Sekolah:</label>
                          <input
                            type="text"
                            value={modalDraft.schoolName}
                            onChange={(e) =>
                              setModalDraft({ ...modalDraft, schoolName: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-600 block mb-1">Tahun Ajaran:</label>
                          <input
                            type="text"
                            value={modalDraft.academicYear}
                            onChange={(e) =>
                              setModalDraft({ ...modalDraft, academicYear: e.target.value })
                            }
                            placeholder="Contoh: 2026/2027"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                          />
                          <span className="text-[10px] text-blue-600 font-medium block mt-1">
                            *Tersinkron otomatis dengan identitas & header aplikasi.
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Kota TTD:</label>
                            <input
                              type="text"
                              value={modalDraft.signatureCity}
                              onChange={(e) =>
                                setModalDraft({ ...modalDraft, signatureCity: e.target.value })
                              }
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Tanggal TTD:</label>
                            <input
                              type="text"
                              value={modalDraft.signatureDate}
                              onChange={(e) =>
                                setModalDraft({ ...modalDraft, signatureDate: e.target.value })
                              }
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="font-bold text-slate-600 block mb-1">Nama Kepala Sekolah:</label>
                          <input
                            type="text"
                            value={modalDraft.principalName}
                            onChange={(e) =>
                              setModalDraft({ ...modalDraft, principalName: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-600 block mb-1">NIP Kepala Sekolah:</label>
                          <input
                            type="text"
                            value={modalDraft.principalNip}
                            onChange={(e) =>
                              setModalDraft({ ...modalDraft, principalNip: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-600 block mb-1">Jabatan TTD:</label>
                          <input
                            type="text"
                            value={modalDraft.principalTitle}
                            onChange={(e) =>
                              setModalDraft({ ...modalDraft, principalTitle: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Durasi 1 JP & Jam Mulai */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Durasi 1 JP & Jam Mulai
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">1 JP Std (Sen-Kam):</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.durStandar}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, durStandar: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-700 text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">1 JP Jumat:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.durJumat}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, durJumat: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-700 text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="font-bold text-slate-600 block mb-1">Jam Mulai Senin:</label>
                          <input
                            type="text"
                            value={modalDraft.cfgParams.startSenin}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = {
                                ...modalDraft,
                                cfgParams: { ...modalDraft.cfgParams, startSenin: val },
                              };
                              recalculateJamEfektifFromParams(updated);
                              setModalDraft(updated);
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center font-bold"
                            placeholder="06:30"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-600 block mb-1">Jam Mulai Selasa-Kamis:</label>
                          <input
                            type="text"
                            value={modalDraft.cfgParams.startSelasaKamis}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = {
                                ...modalDraft,
                                cfgParams: { ...modalDraft.cfgParams, startSelasaKamis: val },
                              };
                              recalculateJamEfektifFromParams(updated);
                              setModalDraft(updated);
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center font-bold"
                            placeholder="06:45"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-600 block mb-1">Jam Mulai Jumat:</label>
                          <input
                            type="text"
                            value={modalDraft.cfgParams.startJumat}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = {
                                ...modalDraft,
                                cfgParams: { ...modalDraft.cfgParams, startJumat: val },
                              };
                              recalculateJamEfektifFromParams(updated);
                              setModalDraft(updated);
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center font-bold"
                            placeholder="06:45"
                          />
                        </div>

                        {/* Live Summary Box */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-900 space-y-1">
                          <div>
                            <strong>Kalkulasi Langsung:</strong> 1 JP Standar ={' '}
                            <strong>{modalDraft.cfgParams.durStandar} menit</strong>, 1 JP Jum'at ={' '}
                            <strong>{modalDraft.cfgParams.durJumat} menit</strong>.
                          </div>
                          <div className="text-[11px] text-blue-900">
                            • Senin Selesai Pk <strong>{lastSenin?.end || '-'}</strong> | • Sel-Kam Selesai Pk{' '}
                            <strong>{lastSelasa?.end || '-'}</strong> | • Jum'at Pramuka Pk{' '}
                            <strong>{lastJumat?.start || '-'}</strong>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = JSON.parse(JSON.stringify(modalDraft));
                              recalculateJamEfektifFromParams(updated);
                              setModalDraft(updated);
                              addToast({
                                type: 'info',
                                title: 'Kalkulasi Ulang Selesai',
                                message: 'Berhasil menghitung ulang seluruh waktu jam efektif dari parameter durasi!',
                              });
                            }}
                            className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            Hitung Waktu Otomatis Semua Hari
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Kegiatan Khusus & Istirahat */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        Kegiatan Khusus & Istirahat
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Upacara Senin:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.upacaraSenin}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, upacaraSenin: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Event Jumat:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.eventJumat}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, eventJumat: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Yasinan Sel-Kam:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.yasinSelasaKamis}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, yasinSelasaKamis: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Yasinan Jumat:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.yasinJumat}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, yasinJumat: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Istirahat 1 Senin:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.break1Senin}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, break1Senin: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Istirahat 2 Senin:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.break2Senin}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, break2Senin: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Ist 1 Sel-Kam:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.break1SelasaKamis}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, break1SelasaKamis: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Ist 2 Sel-Kam:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.break2SelasaKamis}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, break2SelasaKamis: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Sholat Jumat:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.breakJumat}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, breakJumat: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                          <div>
                            <label className="font-bold text-slate-600 block mb-1">Piket Kelas:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={modalDraft.cfgParams.piketSelasaKamis}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = {
                                    ...modalDraft,
                                    cfgParams: { ...modalDraft.cfgParams, piketSelasaKamis: val },
                                  };
                                  recalculateJamEfektifFromParams(updated);
                                  setModalDraft(updated);
                                }}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center"
                              />
                              <span className="text-[11px] text-slate-500">mnt</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2, 3, 4, 5: Table Edit */}
              {(modalTab === 'tab_senin' ||
                modalTab === 'tab_selasa' ||
                modalTab === 'tab_jumat' ||
                modalTab === 'tab_jumat_xi_xii') && (
                <div className="space-y-3">
                  {(() => {
                    const dayKey =
                      modalTab === 'tab_senin'
                        ? 'senin'
                        : modalTab === 'tab_selasa'
                        ? 'selasa_kamis'
                        : modalTab === 'tab_jumat'
                        ? 'jumat'
                        : 'jumat_xi_xii';
                    const rows = modalDraft[dayKey] || [];

                    return (
                      <>
                        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <div>
                            <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-emerald-600" />
                              Kalkulasi Waktu Otomatis Aktif
                            </div>
                            <div className="text-[11px] text-emerald-700">
                              Ubah waktu mulai atau durasi di baris manapun, waktu selesai & seluruh baris
                              di bawahnya akan otomatis terkalkulasi. Anda juga dapat menambah atau menghapus baris tabel.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const recalculated = autoCalculateDayRows(dayKey, 0, 'start', rows);
                              setModalDraft({ ...modalDraft, [dayKey]: recalculated });
                              setManualRowEdited(true);
                              addToast({
                                type: 'info',
                                title: 'Kalkulasi Tabel Selesai',
                                message: `Urutan waktu tabel ${dayKey} berhasil dihitung ulang!`,
                              });
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
                          >
                            Hitung Berurutan Tabel Ini
                          </button>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                                <th className="p-2.5 text-center w-10">No</th>
                                <th className="p-2.5 w-32">Jam Ke / Label</th>
                                <th className="p-2.5 w-24">Mulai</th>
                                <th className="p-2.5 w-24">Selesai</th>
                                <th className="p-2.5 w-20">Durasi (m)</th>
                                <th className="p-2.5 w-44">Tipe</th>
                                <th className="p-2.5">Keterangan</th>
                                <th className="p-2.5 text-center w-14">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {rows.map((r, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80">
                                  <td className="p-2 text-center font-bold text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="p-1.5">
                                    <input
                                      type="text"
                                      value={r.jamKe}
                                      onChange={(e) => {
                                        setManualRowEdited(true);
                                        const updatedRows = [...rows];
                                        updatedRows[idx] = {
                                          ...r,
                                          jamKe: e.target.value,
                                          labelJam: e.target.value,
                                        };
                                        setModalDraft({ ...modalDraft, [dayKey]: updatedRows });
                                      }}
                                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                                    />
                                  </td>
                                  <td className="p-1.5">
                                    <input
                                      type="text"
                                      value={r.start}
                                      onChange={(e) => {
                                        setManualRowEdited(true);
                                        const updatedRows = [...rows];
                                        updatedRows[idx] = { ...r, start: e.target.value };
                                        const recalculated = autoCalculateDayRows(
                                          dayKey,
                                          idx,
                                          'start',
                                          updatedRows
                                        );
                                        setModalDraft({ ...modalDraft, [dayKey]: recalculated });
                                      }}
                                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-center font-bold"
                                    />
                                  </td>
                                  <td className="p-1.5">
                                    <input
                                      type="text"
                                      value={r.end}
                                      onChange={(e) => {
                                        setManualRowEdited(true);
                                        const updatedRows = [...rows];
                                        updatedRows[idx] = { ...r, end: e.target.value };
                                        const recalculated = autoCalculateDayRows(
                                          dayKey,
                                          idx,
                                          'end',
                                          updatedRows
                                        );
                                        setModalDraft({ ...modalDraft, [dayKey]: recalculated });
                                      }}
                                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-center font-bold"
                                    />
                                  </td>
                                  <td className="p-1.5">
                                    <input
                                      type="number"
                                      value={r.dur}
                                      onChange={(e) => {
                                        setManualRowEdited(true);
                                        const updatedRows = [...rows];
                                        updatedRows[idx] = {
                                          ...r,
                                          dur: Number(e.target.value) || 0,
                                        };
                                        const recalculated = autoCalculateDayRows(
                                          dayKey,
                                          idx,
                                          'dur',
                                          updatedRows
                                        );
                                        setModalDraft({ ...modalDraft, [dayKey]: recalculated });
                                      }}
                                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-center font-bold"
                                    />
                                  </td>
                                  <td className="p-1.5">
                                    <select
                                      value={r.type}
                                      onChange={(e) => {
                                        setManualRowEdited(true);
                                        const val = e.target.value as JamEfektifRow['type'];
                                        const updatedRows = [...rows];
                                        if (val === '-') {
                                          updatedRows[idx] = {
                                            ...r,
                                            type: '-',
                                            dur: 0,
                                            end: '-',
                                            pukul: '-',
                                            ket:
                                              r.ket && r.ket !== 'JAM KE ' + r.jamKe
                                                ? r.ket
                                                : 'KOSONG / PULANG',
                                          };
                                          setModalDraft({ ...modalDraft, [dayKey]: updatedRows });
                                        } else {
                                          updatedRows[idx] = {
                                            ...r,
                                            type: val,
                                          };
                                          const recalculated = autoCalculateDayRows(
                                            dayKey,
                                            idx,
                                            'type',
                                            updatedRows
                                          );
                                          setModalDraft({ ...modalDraft, [dayKey]: recalculated });
                                        }
                                      }}
                                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                                    >
                                      <option value="jam">Jam Pelajaran</option>
                                      <option value="break">Istirahat</option>
                                      <option value="pre">Kegiatan Awal</option>
                                      <option value="piket">Piket Kelas</option>
                                      <option value="extra">Ekstra / Pramuka</option>
                                      <option value="-">- (Sudah Kosong / Pulang)</option>
                                    </select>
                                  </td>
                                  <td className="p-1.5">
                                    <input
                                      type="text"
                                      value={r.ket}
                                      onChange={(e) => {
                                        setManualRowEdited(true);
                                        const updatedRows = [...rows];
                                        updatedRows[idx] = { ...r, ket: e.target.value };
                                        setModalDraft({ ...modalDraft, [dayKey]: updatedRows });
                                      }}
                                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                                    />
                                  </td>
                                  <td className="p-1.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRow(dayKey, idx)}
                                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                                      title="Hapus baris ini"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Tombol Tambah Baris / Slot Kosong */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleAddRow(dayKey, false)}
                            className="px-3 py-1.5 bg-blue-50 border border-blue-300 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            + Tambah Baris / Jam Baru
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddRow(dayKey, true)}
                            className="px-3 py-1.5 bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            + Tambah Slot Kosong (-)
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                Simpan & Terapkan Sebagai Pondasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
