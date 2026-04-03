import { ChevronDown, Filter } from 'lucide-react';
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
    <div className="px-6 py-4 flex flex-wrap gap-2 overflow-x-auto no-scrollbar items-center">
      <div className="flex items-center gap-2 mr-2">
        <Filter size={14} className="text-proc-cyan" />
        <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">Filtros</span>
      </div>
      
      {/* Year Filter */}
      <div className="relative group">
        <select 
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="appearance-none bg-proc-secondary/40 border border-white/10 rounded-full px-4 py-1.5 pr-8 text-xs font-semibold text-white focus:outline-none focus:border-proc-cyan/50 transition-colors cursor-pointer"
        >
          {years.map(y => <option key={y} value={y} className="bg-proc-secondary text-white">{y}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-proc-text-sec pointer-events-none" />
      </div>

      {/* Month Filter */}
      <div className="relative group">
        <select 
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="appearance-none bg-proc-secondary/40 border border-white/10 rounded-full px-4 py-1.5 pr-8 text-xs font-semibold text-white focus:outline-none focus:border-proc-cyan/50 transition-colors cursor-pointer"
        >
          {months.map(m => <option key={m} value={m} className="bg-proc-secondary text-white">{m}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-proc-text-sec pointer-events-none" />
      </div>

      {/* Category Filter */}
      <div className="relative group">
        <select 
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="appearance-none bg-proc-secondary/40 border border-white/10 rounded-full px-4 py-1.5 pr-8 text-xs font-semibold text-white focus:outline-none focus:border-proc-cyan/50 transition-colors cursor-pointer"
        >
          {categories.map(c => <option key={c} value={c} className="bg-proc-secondary text-white">{c}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-proc-text-sec pointer-events-none" />
      </div>
    </div>
  );
}
