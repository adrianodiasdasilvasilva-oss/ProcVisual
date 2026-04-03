import { ChevronDown, Filter, Calendar, Tag, Layers } from 'lucide-react';
import { useState } from 'react';

export default function Filters() {
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState('Abril');
  const [category, setCategory] = useState('Todas Categorias');

  const years = ['2024', '2025', '2026'];
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const categories = ['Todas Categorias', 'Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação'];

  return (
    <div className="px-0 md:px-0 py-2 flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2 mr-2 bg-proc-cyan/5 px-3 py-1.5 rounded-full border border-proc-cyan/10">
        <Filter size={14} className="text-proc-cyan" />
        <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">Filtros</span>
      </div>
      
      {/* Year Filter */}
      <div className="relative group">
        <Calendar size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proc-text-sec group-focus-within:text-proc-cyan transition-colors z-10" />
        <select 
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="appearance-none bg-proc-secondary/30 border border-white/5 rounded-2xl pl-9 pr-10 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-secondary/50 transition-all cursor-pointer min-w-[100px]"
        >
          {years.map(y => <option key={y} value={y} className="bg-proc-bg text-white">{y}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-proc-text-sec pointer-events-none" />
      </div>

      {/* Month Filter */}
      <div className="relative group">
        <Layers size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proc-text-sec group-focus-within:text-proc-cyan transition-colors z-10" />
        <select 
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="appearance-none bg-proc-secondary/30 border border-white/5 rounded-2xl pl-9 pr-10 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-secondary/50 transition-all cursor-pointer min-w-[120px]"
        >
          {months.map(m => <option key={m} value={m} className="bg-proc-bg text-white">{m}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-proc-text-sec pointer-events-none" />
      </div>

      {/* Category Filter */}
      <div className="relative group">
        <Tag size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proc-text-sec group-focus-within:text-proc-cyan transition-colors z-10" />
        <select 
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="appearance-none bg-proc-secondary/30 border border-white/5 rounded-2xl pl-9 pr-10 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-secondary/50 transition-all cursor-pointer min-w-[160px]"
        >
          {categories.map(c => <option key={c} value={c} className="bg-proc-bg text-white">{c}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-proc-text-sec pointer-events-none" />
      </div>
    </div>
  );
}
