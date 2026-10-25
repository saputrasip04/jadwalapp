// src/ui/TeacherSearchSelect.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface TeacherOption {
  id: string;
  kode: string;
  nama: string;
  numId?: number;
  sk_guru?: string | null;
  tipe?: 'R' | 'P';
  setting_jp?: number;
}

interface TeacherSearchSelectProps {
  teachers: TeacherOption[];
  selectedId: string;
  onSelect: (teacher: TeacherOption) => void;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const TeacherSearchSelect: React.FC<TeacherSearchSelectProps> = ({
  teachers,
  selectedId,
  onSelect,
  placeholder = 'Pilih atau cari nama guru...',
  className = '',
  size = 'md',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cari guru yang sedang terpilih
  const selectedTeacher = useMemo(() => {
    return teachers.find((t) => t.id === selectedId || t.kode === selectedId);
  }, [teachers, selectedId]);

  // Filter daftar guru berdasarkan input pencarian (nama, kode, id, sk)
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const q = searchQuery.toLowerCase().trim();
    return teachers.filter((t) => {
      const matchName = t.nama.toLowerCase().includes(q);
      const matchKode = t.kode.toLowerCase().includes(q) || `[${t.kode.toLowerCase()}]`.includes(q);
      const matchId = String(t.numId || '').includes(q) || t.id.toLowerCase().includes(q);
      const matchSk = (t.sk_guru || '').toLowerCase().includes(q);
      return matchName || matchKode || matchId || matchSk;
    });
  }, [teachers, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Auto focus input saat dropdown terbuka
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = (teacher: TeacherOption) => {
    onSelect(teacher);
    setIsOpen(false);
    setSearchQuery('');
  };

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg transition-all text-left cursor-pointer shadow-2xs ${
          isOpen
            ? 'border-blue-600 ring-2 ring-blue-100 bg-white'
            : 'border-slate-300 hover:border-blue-400 bg-white'
        } ${isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs sm:text-sm'}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedTeacher ? (
            <>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-1.5 py-0.5 rounded shrink-0">
                [{selectedTeacher.kode}]
              </span>
              <span className="font-extrabold text-slate-900 truncate">
                {selectedTeacher.nama}
              </span>
            </>
          ) : (
            <span className="text-slate-400 font-semibold truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Popover / Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Input Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-blue-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama guru atau kode [ID]..."
                className="w-full pl-8 pr-7 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs placeholder-slate-400"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                  } else if (e.key === 'Enter' && filteredTeachers.length > 0 && filteredTeachers[0]) {
                    e.preventDefault();
                    handleSelect(filteredTeachers[0]);
                  }
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* List Guru */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100/80 custom-scrollbar p-1">
            {filteredTeachers.length === 0 ? (
              <div className="py-6 text-center text-xs font-bold text-slate-400">
                Tidak ada guru yang cocok dengan "{searchQuery}"
              </div>
            ) : (
              filteredTeachers.map((t) => {
                const isSelected = selectedTeacher?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelect(t)}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? 'bg-blue-50/90 text-blue-900 font-black'
                        : 'hover:bg-slate-50 text-slate-800 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        [{t.kode}]
                      </span>
                      <div className="min-w-0">
                        <span className="truncate block uppercase">{t.nama}</span>
                        {t.sk_guru && (
                          <span className="text-[10px] text-slate-400 font-semibold block truncate">
                            {t.sk_guru}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-semibold flex items-center justify-between">
            <span>Ditemukan {filteredTeachers.length} guru</span>
            <span>Tekan Enter untuk pilih yang pertama</span>
          </div>
        </div>
      )}
    </div>
  );
};
