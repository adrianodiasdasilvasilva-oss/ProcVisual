import { ChevronDown, Filter, Calendar, Tag, Layers, Sun, Moon } from 'lucide-react';
import { useState } from 'react';

interface FiltersProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  year: string;
  month: string;
  category: string;
  onFilterChange: (filters: { year?: string; month?: string; category?: string }) => void;
}

export default function Filters({ theme, onToggleTheme, year, month, category, onFilterChange }: FiltersProps) {
  const years = ['2024', '2025', '2026'];
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const categories = ['Todas Categorias', 'Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação'];

  return (
    <div className="px-0 md:px-0 py-2 flex flex-wrap gap-3 items-center">
      {/* Year Filter */}
      <div className="relative group">
        <Calendar size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proc-text-sec group-focus-within:text-proc-cyan transition-colors z-10" />
        <select 
          value={year}
          onChange={(e) => onFilterChange({ year: e.target.value })}
          className="appearance-none bg-proc-secondary/30 border border-white/10 rounded-2xl pl-9 pr-10 py-2.5 text-xs font-semibold text-proc-text-main focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-secondary/50 transition-all cursor-pointer min-w-[100px]"
        >
          {years.map(y => <option key={y} value={y} className="bg-proc-bg text-proc-text-main">{y}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-proc-text-sec pointer-events-none" />
      </div>

      {/* Month Filter */}
      <div className="relative group">
        <Layers size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proc-text-sec group-focus-within:text-proc-cyan transition-colors z-10" />
        <select 
          value={month}
          onChange={(e) => onFilterChange({ month: e.target.value })}
          className="appearance-none bg-proc-secondary/30 border border-white/10 rounded-2xl pl-9 pr-10 py-2.5 text-xs font-semibold text-proc-text-main focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-secondary/50 transition-all cursor-pointer min-w-[120px]"
        >
          {months.map(m => <option key={m} value={m} className="bg-proc-bg text-proc-text-main">{m}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-proc-text-sec pointer-events-none" />
      </div>

      {/* Category Filter */}
      <div className="relative group">
        <Tag size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proc-text-sec group-focus-within:text-proc-cyan transition-colors z-10" />
        <select 
          value={category}
          onChange={(e) => onFilterChange({ category: e.target.value })}
          className="appearance-none bg-proc-secondary/30 border border-white/10 rounded-2xl pl-9 pr-10 py-2.5 text-xs font-semibold text-proc-text-main focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-secondary/50 transition-all cursor-pointer min-w-[160px]"
        >
          {categories.map(c => <option key={c} value={c} className="bg-proc-bg text-proc-text-main">{c}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-proc-text-sec pointer-events-none" />
      </div>

      {/* Theme Toggle */}
      <button
        onClick={onToggleTheme}
        className="ml-auto md:ml-2 p-2.5 rounded-2xl bg-proc-secondary/30 border border-white/10 text-proc-text-sec hover:text-proc-cyan hover:border-proc-cyan/30 transition-all flex items-center gap-2"
        title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      >
        {theme === 'dark' ? (
          <>
            <Sun size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Modo Claro</span>
          </>
        ) : (
          <>
            <Moon size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Modo Escuro</span>
          </>
        )}
      </button>
    </div>
  );
}
