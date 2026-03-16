import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ComponentType<{ size: number; className?: string }>;
  rightSlot?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ title, children, className, icon: Icon, rightSlot }) => (
  <div className={cn("bg-[#141414] border border-[#262626] rounded-xl flex flex-col overflow-hidden h-full shadow-2xl", className)}>
    <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between bg-[#1a1a1a]">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-blue-400" />}
        <h2 className="text-[11px] font-bold text-gray-400 tracking-[0.2em] uppercase">{title}</h2>
      </div>
      <div className="flex gap-2 items-center">
        {rightSlot}
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/20" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
          <div className="w-2 h-2 rounded-full bg-green-500/20" />
        </div>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0d0d0d]/50">
      {children}
    </div>
  </div>
);
