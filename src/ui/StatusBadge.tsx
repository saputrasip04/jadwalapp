// src/ui/StatusBadge.tsx
import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Clock } from 'lucide-react';

export type BadgeStatus = 'lengkap' | 'belum_diisi' | 'peringatan' | 'error';

interface StatusBadgeProps {
  status: BadgeStatus;
  count?: number;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  count,
  label,
  size = 'md',
}) => {
  const isSm = size === 'sm';

  switch (status) {
    case 'lengkap':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <CheckCircle2 className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          {label ?? 'Lengkap'}
        </span>
      );
    case 'peringatan':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <AlertTriangle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          {label ?? `Peringatan (${count ?? 0})`}
        </span>
      );
    case 'error':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <AlertCircle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          {label ?? `Kendala (${count ?? 0})`}
        </span>
      );
    case 'belum_diisi':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <Clock className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          {label ?? 'Belum diisi'}
        </span>
      );
  }
};
