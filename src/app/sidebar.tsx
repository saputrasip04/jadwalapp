// src/app/sidebar.tsx
import React from 'react';
import { useAppStore, MENUS, getMenuUrl } from './store';
import { FileText } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeMenu, setActiveMenu } = useAppStore();

  return (
    <aside className="w-[285px] bg-[#e9eef7] border-r border-slate-300 flex flex-col shrink-0 select-none h-screen p-2.5 overflow-y-auto">
      {/* Navigation Card */}
      <div className="w-full rounded-lg overflow-hidden border-2 border-[#163777] shadow-sm bg-[#163777] flex flex-col">
        {/* Header: NAVIGASI MENU */}
        <div className="bg-[#163777] px-4 py-3 flex items-center gap-2.5 text-white border-b border-[#102756]">
          <FileText className="w-5 h-5 text-amber-300 shrink-0" />
          <span className="font-black text-sm tracking-wider uppercase text-white drop-shadow-sm">
            NAVIGASI MENU
          </span>
        </div>

        {/* Menu Items List (1-12) */}
        <div className="flex flex-col bg-[#85a4d6]">
          {MENUS.map((menu, index) => {
            const isActive = activeMenu === menu.id;
            const isLast = index === MENUS.length - 1;
            const menuUrl = getMenuUrl(menu.id);

            return (
              <a
                key={menu.id}
                href={menuUrl}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveMenu(menu.id);
                }}
                className={`w-full py-3 px-3 min-h-[48px] flex items-center justify-center text-center transition-colors duration-150 no-underline cursor-pointer ${
                  !isLast ? 'border-b border-[#163777]' : ''
                } ${
                  isActive
                    ? 'bg-[#163777] text-white shadow-inner font-black'
                    : 'bg-[#85a4d6] text-[#0c1f44] hover:bg-[#97b5e3] hover:text-[#050f24] active:bg-[#7292c4]'
                }`}
              >
                <span className="font-black text-xs tracking-wide uppercase leading-tight select-none">
                  {menu.title}
                </span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Subtle school indicator at bottom */}
      <div className="mt-auto pt-3 text-center">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
          Penjadwal Blok SMK
        </span>
        <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">
          Sistem 8 Jurusan • Bebas Bentrok
        </span>
      </div>
    </aside>
  );
};
