import { ChevronDown, Filter, Calendar, Tag, Layers, Sun, Moon, CheckSquare, Square } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface FiltersProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  years: string[];
  months: string[];
  category: string;
  availableYears?: string[];
  availableCategories?: string[];
  onFilterChange: (filters: { years?: string[]; months?: string[]; category?: string }) => void;
}

export default function Filters({ theme, onToggleTheme, years: selectedYears, months: selectedMonths, category, availableYears, availableCategories, onFilterChange }: FiltersProps) {
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const monthDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  const years = availableYears || ['2024', '2025', '2026'];
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const categories = availableCategories || ['Todas Categorias', 'Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setIsYearDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMonth = (m: string) => {
    const newMonths = selectedMonths.includes(m)
      ? selectedMonths.filter(month => month !== m)
      : [...selectedMonths, m];
    onFilterChange({ months: newMonths });
  };

  const toggleYear = (y: string) => {
    const newYears = selectedYears.includes(y)
      ? selectedYears.filter(year => year !== y)
      : [...selectedYears, y];
    onFilterChange({ years: newYears });
  };

  const getMonthLabel = () => {
    if (selectedMonths.length === 0) return 'Selecione';
    if (selectedMonths.length === 1) return selectedMonths[0];
    if (selectedMonths.length === 12) return 'Todos os Meses';
    return `${selectedMonths.length} Meses`;
  };

  const getYearLabel = () => {
    if (selectedYears.length === 0) return 'Selecione';
    if (selectedYears.length === 1) return selectedYears[0];
    if (selectedYears.length === years.length) return 'Todos os Anos';
    return `${selectedYears.length} Anos`;
  };

  return (
    <div className="px-0 md:px-0 py-2 flex flex-wrap gap-3 items-center">
      {/* Year Filter (Multi-select) */}
      <div className="relative" ref={yearDropdownRef}>
        <button
          onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
          className="flex items-center gap-2 bg-proc-secondary/30 border border-white/10 rounded-2xl pl-9 pr-4 py-2.5 text-xs font-semibold text-proc-text-main focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-secondary/50 transition-all cursor-pointer min-w-[120px] relative group"
        >
          <Calendar size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proc-text-sec group-hover:text-proc-cyan transition-colors" />
          <span className="truncate max-w-[80px]">{getYearLabel()}</span>
          <ChevronDown size={14} className={`ml-auto text-proc-text-sec transition-transform ${isYearDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isYearDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-40 bg-proc-secondary border border-white/10 rounded-2xl shadow-2xl z-50 py-2 max-h-64 overflow-y-auto custom-scrollbar">
            <div className="px-3 py-1 border-b border-white/5 mb-1 flex justify-between items-center">
              <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">Anos</span>
              <button 
                onClick={() => onFilterChange({ years: selectedYears.length === years.length ? [] : years })}
                className="text-[10px] text-proc-cyan hover:underline"
              >
                {selectedYears.length === years.length ? 'Limpar' : 'Todos'}
              </button>
            </div>
            {years.map(y => (
              <button
                key={y}
                onClick={() => toggleYear(y)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-proc-text-main hover:bg-white/5 transition-colors text-left"
              >
                {selectedYears.includes(y) ? (
                  <CheckSquare size={14} className="text-proc-cyan" />
                ) : (
                  <Square size={14} className="text-proc-text-sec" />
                )}
                <span className={selectedYears.includes(y) ? 'text-proc-text-main font-bold' : 'text-proc-text-sec'}>
                  {y}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Month Filter (Multi-select) */}
      <div className="relative" ref={monthDropdownRef}>
        <button
          onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
          className="flex items-center gap-2 bg-proc-secondary/30 border border-white/10 rounded-2xl pl-9 pr-4 py-2.5 text-xs font-semibold text-proc-text-main focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-secondary/50 transition-all cursor-pointer min-w-[140px] relative group"
        >
          <Layers size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proc-text-sec group-hover:text-proc-cyan transition-colors" />
          <span className="truncate max-w-[100px]">{getMonthLabel()}</span>
          <ChevronDown size={14} className={`ml-auto text-proc-text-sec transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isMonthDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-proc-secondary border border-white/10 rounded-2xl shadow-2xl z-50 py-2 max-h-64 overflow-y-auto custom-scrollbar">
            <div className="px-3 py-1 border-b border-white/5 mb-1 flex justify-between items-center">
              <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">Meses</span>
              <button 
                onClick={() => onFilterChange({ months: selectedMonths.length === 12 ? [] : months })}
                className="text-[10px] text-proc-cyan hover:underline"
              >
                {selectedMonths.length === 12 ? 'Limpar' : 'Todos'}
              </button>
            </div>
            {months.map(m => (
              <button
                key={m}
                onClick={() => toggleMonth(m)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-proc-text-main hover:bg-white/5 transition-colors text-left"
              >
                {selectedMonths.includes(m) ? (
                  <CheckSquare size={14} className="text-proc-cyan" />
                ) : (
                  <Square size={14} className="text-proc-text-sec" />
                )}
                <span className={selectedMonths.includes(m) ? 'text-proc-text-main font-bold' : 'text-proc-text-sec'}>
                  {m}
                </span>
              </button>
            ))}
          </div>
        )}
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
