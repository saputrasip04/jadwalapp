// src/ui/Toast.tsx
import React from 'react';
import { create } from 'zustand';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useAppStore } from '../app/store';

export interface ToastItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
  duration?: number;
  position?: 'left' | 'right';
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    const duration = toast.duration ?? 4000;
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();
  const activeMenu = useAppStore((s) => s.activeMenu);

  if (toasts.length === 0) return null;

  // Cek apakah sedang berada di menu 2: DAFTAR MATA PELAJARAN DAN KODE
  const isDaftarMapel =
    activeMenu === 2 ||
    (typeof window !== 'undefined' &&
      (window.location.pathname.toLowerCase().includes('daftarmatapelajarandankode') ||
       window.location.pathname.toLowerCase().includes('katalogmapel') ||
       window.location.hash.toLowerCase().includes('daftarmatapelajarandankode')));

  return (
    <div
      className={`fixed bottom-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none transition-all duration-300 ${
        isDaftarMapel ? 'left-5' : 'right-5'
      }`}
    >
      {toasts.map((t) => {
        const bg =
          t.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : t.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-950'
            : t.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-950'
            : 'bg-sky-50 border-sky-200 text-sky-950';

        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : t.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          ) : t.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-sky-600 shrink-0" />
          );

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl transition-all animate-in ${
              isDaftarMapel ? 'slide-in-from-left-5' : 'slide-in-from-bottom-5'
            } ${bg}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold">{t.title}</h4>
              {t.message && (
                <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                  {t.message}
                </p>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors"
              title="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
