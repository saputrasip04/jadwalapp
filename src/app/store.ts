// src/app/store.ts
import { create } from 'zustand';
import { SettingSekolah } from '../domain/types';

export type MenuId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface MenuInfo {
  id: MenuId;
  title: string;
  shortTitle: string;
  phase: number;
  path: string;
}

export const MENUS: MenuInfo[] = [
  { id: 1, title: 'SETTING UTAMA GURU & JP', shortTitle: 'Setting Utama', phase: 1, path: 'settingutamagurudanjp' },
  { id: 2, title: 'DAFTAR MATA PELAJARAN DAN KODE', shortTitle: 'Daftar Mapel', phase: 1, path: 'daftarmatapelajarandankode' },
  { id: 3, title: 'MATRIX SK', shortTitle: 'Matrix SK', phase: 1, path: 'matrixsk' },
  { id: 4, title: 'MENU JURUSAN', shortTitle: 'Menu Jurusan', phase: 2, path: 'menujurusan' },
  { id: 5, title: 'MENU MATA PELAJARAN', shortTitle: 'Menu Mapel', phase: 2, path: 'menumatapelajaran' },
  { id: 6, title: 'DAFTAR GURU DAN JURUSAN KELAS', shortTitle: 'Guru & Jurusan', phase: 2, path: 'daftargurudanjurusankelas' },
  { id: 7, title: 'TEMPLATE JAM EFEKTIF', shortTitle: 'Jam Efektif', phase: 2, path: 'templatejamefektif' },
  { id: 8, title: 'TEMPLATE JADWAL', shortTitle: 'Template Jadwal', phase: 4, path: 'templatejadwal' },
  { id: 9, title: 'JADWAL TOTAL', shortTitle: 'Jadwal Total', phase: 5, path: 'jadwaltotal' },
  { id: 10, title: 'JADWAL PERJURUSAN', shortTitle: 'Jadwal Perjurusan', phase: 5, path: 'jadwalperjurusan' },
  { id: 11, title: 'JADWAL PERKELAS', shortTitle: 'Jadwal Perkelas', phase: 5, path: 'jadwalperkelas' },
  { id: 12, title: 'JADWAL PERGURU', shortTitle: 'Jadwal Perguru', phase: 5, path: 'jadwalperguru' },
];

export function getMenuUrl(menuId: MenuId): string {
  const menu = MENUS.find((m) => m.id === menuId) || MENUS[0]!;
  const hasJadwalappPrefix =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/jadwalapp');
  const base = hasJadwalappPrefix ? '/jadwalapp' : '';
  return `${base}/${menu.path}`;
}

export function getMenuFromUrl(): MenuId {
  if (typeof window === 'undefined') return 1;

  const rawPath = window.location.pathname
    .toLowerCase()
    .replace(/^\/jadwalapp\/?/, '')
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/[^a-z0-9]/g, '');

  const rawHash = window.location.hash
    .toLowerCase()
    .replace(/^#\/?/, '')
    .replace(/[^a-z0-9]/g, '');

  const slug = rawPath || rawHash;

  if (slug) {
    if (slug === 'mapel' || slug === 'katalogmapel' || slug === 'daftarmatapelajarandankode') return 2;
    if (slug === 'matrix' || slug === 'matriks' || slug === 'matrixsk') return 3;
    if (slug === 'jurusan' || slug === 'menujurusan') return 4;
    if (slug === 'menumatapelajaran' || slug === 'matapelajaran' || slug === 'menumapel' || slug === 'mapelkelas') return 5;
    if (slug === 'guru' || slug === 'daftarguru' || slug === 'gurujurusan' || slug === 'gurudanjurusan' || slug === 'daftargurudanjurusankelas') return 6;
    if (slug === 'jamefektif' || slug === 'templatejamefektif' || slug === 'jam' || slug === 'templatejam' || slug === 'jampembelajaran') return 7;
    if (slug === 'templatejadwal') return 8;
    if (slug === 'jadwaltotal') return 9;
    if (slug === 'jadwalperjurusan' || slug === 'jadwaljurusan') return 10;
    if (slug === 'jadwalperkelas' || slug === 'jadwalkelas') return 11;
    if (slug === 'jadwalperguru' || slug === 'jadwalguru') return 12;
    const found = MENUS.find((m) => m.path === slug);
    if (found) return found.id;
  }

  return 1;
}

interface AppState {
  activeMenu: MenuId;
  activeBlock: 1 | 2;
  saveStatus: 'saved' | 'saving' | 'error';
  lastSavedAt: string | null;
  readinessGatePassed: boolean;
  readinessIssues: string[];
  filterGuruJurusan: string;
  selectedGuruIdForSchedule: string | null;
  sekolah: SettingSekolah | null;
  setActiveMenu: (menu: MenuId) => void;
  setActiveBlock: (block: 1 | 2) => void;
  setSaveStatus: (status: 'saved' | 'saving' | 'error') => void;
  setReadinessStatus: (passed: boolean, issues: string[]) => void;
  setFilterGuruJurusan: (jurusan: string) => void;
  setSelectedGuruIdForSchedule: (id: string | null) => void;
  setSekolah: (sekolah: SettingSekolah | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeMenu: getMenuFromUrl(),
  activeBlock: 1,
  saveStatus: 'saved',
  lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  readinessGatePassed: false,
  readinessIssues: [],
  filterGuruJurusan: 'ALL',
  selectedGuruIdForSchedule: null,
  sekolah: null,
  setActiveMenu: (menu) => {
    set({ activeMenu: menu });
    if (typeof window !== 'undefined') {
      const targetUrl = getMenuUrl(menu);
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    }
  },
  setActiveBlock: (block) => set({ activeBlock: block }),
  setSaveStatus: (status) =>
    set({
      saveStatus: status,
      lastSavedAt:
        status === 'saved'
          ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined,
    }),
  setReadinessStatus: (passed, issues) =>
    set({ readinessGatePassed: passed, readinessIssues: issues }),
  setFilterGuruJurusan: (jurusan) => set({ filterGuruJurusan: jurusan }),
  setSelectedGuruIdForSchedule: (id) => set({ selectedGuruIdForSchedule: id }),
  setSekolah: (sekolah) => set({ sekolah }),
}));
