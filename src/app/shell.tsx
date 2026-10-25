// src/app/shell.tsx
import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore, MENUS, getMenuFromUrl, getMenuUrl } from './store';
import { Sidebar } from './sidebar';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { ToastContainer } from '../ui/Toast';
import { initSeed } from '../db/seed';
import { integrityCheck } from '../db/integrity';
import { logger } from '../lib/logger';
import { db } from '../db/schema';
import { SettingSekolah } from '../domain/types';

// Menu Views
import { SettingView } from '../features/01-setting/SettingView';
import { MapelView } from '../features/02-mapel/MapelView';
import { MatrixSKView } from '../features/03-matrix-sk/MatrixSKView';
import { JurusanView } from '../features/04-jurusan/JurusanView';
import { MapelKelasView } from '../features/05-mapel-kelas/MapelKelasView';
import { GuruView } from '../features/06-guru/GuruView';
import { JamEfektifView } from '../features/07-jam-efektif/JamEfektifView';
import { TemplateJadwalView } from '../features/08-template-jadwal/TemplateJadwalView';
import { JadwalTotalView } from '../features/09-jadwal-total/JadwalTotalView';
import { JadwalJurusanView } from '../features/10-jadwal-jurusan/JadwalJurusanView';
import { JadwalKelasView } from '../features/11-jadwal-kelas/JadwalKelasView';
import { JadwalGuruView } from '../features/12-jadwal-guru/JadwalGuruView';

import { CheckCircle2, HardDrive, Layers } from 'lucide-react';

export const Shell: React.FC = () => {
  const { activeMenu, setActiveMenu, saveStatus, lastSavedAt, sekolah, setSekolah } = useAppStore();
  const [initDone, setInitDone] = useState(false);

  // Dexie live listener: otomatis sync jika db.setting.sekolah berubah dari menu manapun
  const liveSettingSekolah = useLiveQuery(() => db.setting.get('sekolah'));
  useEffect(() => {
    if (liveSettingSekolah?.value_json) {
      try {
        const parsed = JSON.parse(liveSettingSekolah.value_json) as SettingSekolah;
        setSekolah(parsed);
      } catch (err) {
        logger.error('SHELL_PARSE_SEKOLAH', 'Gagal memproses data sekolah', err);
      }
    }
  }, [liveSettingSekolah, setSekolah]);

  useEffect(() => {
    // Sinkronisasi rute URL saat pertama kali dimuat
    const initialMenu = getMenuFromUrl();
    const targetUrl = getMenuUrl(initialMenu);
    if (window.location.pathname !== targetUrl) {
      window.history.replaceState(null, '', targetUrl);
    }
    useAppStore.setState({ activeMenu: initialMenu });

    // Listener browser back/forward buttons
    const handlePopState = () => {
      const menu = getMenuFromUrl();
      useAppStore.setState({ activeMenu: menu });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    async function start() {
      try {
        await initSeed();
        await integrityCheck();
        const s = await db.setting.get('sekolah');
        if (s) setSekolah(JSON.parse(s.value_json));
      } catch (err) {
        logger.error('APP_BOOT', 'Gagal inisialisasi aplikasi', err);
      } finally {
        setInitDone(true);
      }
    }
    start();
  }, []);

  const activeMenuInfo = MENUS.find((m) => m.id === activeMenu) ?? MENUS[0]!;

  const renderActiveView = () => {
    if (activeMenu === 1) {
      return <SettingView onSekolahChange={setSekolah} />;
    }
    if (activeMenu === 2) {
      return <MapelView />;
    }
    if (activeMenu === 3) {
      return <MatrixSKView />;
    }
    if (activeMenu === 4) {
      return <JurusanView />;
    }
    if (activeMenu === 5) {
      return <MapelKelasView />;
    }
    if (activeMenu === 6) {
      return <GuruView />;
    }
    if (activeMenu === 7) {
      return <JamEfektifView />;
    }
    if (activeMenu === 8) {
      return <TemplateJadwalView />;
    }
    if (activeMenu === 9) {
      return <JadwalTotalView />;
    }
    if (activeMenu === 10) {
      return <JadwalJurusanView />;
    }
    if (activeMenu === 11) {
      return <JadwalKelasView />;
    }
    if (activeMenu === 12) {
      return <JadwalGuruView />;
    }

    return (
      <div className="w-full min-h-[460px] bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 flex flex-col items-center justify-center text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-[#1b4cb4] flex items-center justify-center mb-4 shadow-sm">
          <Layers className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider mb-2">
          {activeMenuInfo.title}
        </h3>
        <p className="text-xs font-bold text-slate-400 max-w-md leading-relaxed">
          Tampilan menu ini sementara dikosongkan sesuai instruksi. Tidak ada perintah otomatis untuk aliran data.
          Fokus saat ini berada pada penyempurnaan UI Menu Setting Utama Guru & JP.
        </p>
      </div>
    );
  };

  if (!initDone) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold tracking-wide">Memuat Penjadwal Blok SMK...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar (Fixed at top) */}
        <header className="h-14 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0 select-none print:hidden">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-slate-800">
              {sekolah?.nama && sekolah.nama.trim() ? sekolah.nama : 'SMK NEGERI IHYA ULUMMUDIN SINGOJURUH'}
            </h2>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500 font-semibold">
              T.A. {sekolah?.tahun_ajaran ?? '2026/2027'} ({sekolah?.semester ?? 'Ganjil'})
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Autosave Indicator */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <HardDrive className="w-4 h-4 text-emerald-600" />
              <span>Tersimpan lokal ({lastSavedAt ?? 'aktif'})</span>
            </div>
          </div>
        </header>

        {/* Dynamic View Body (Scrollable Height) */}
        <main className="flex-1 min-h-0 overflow-y-auto p-3.5 flex flex-col">
          <ErrorBoundary key={activeMenu} menuTitle={activeMenuInfo.title}>
            {renderActiveView()}
          </ErrorBoundary>
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};
