import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Area, 
  ReferenceLine,
  Legend,
  Bar,
  ComposedChart,
  Line,
  Cell
} from 'recharts';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown, 
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  BarChart3
} from 'lucide-react';
import { Transaction } from '../App';

interface AnalysisTabProps {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  selectedYears: string[];
  selectedMonths: string[];
}

export default function AnalysisTab({ transactions, filteredTransactions, selectedYears, selectedMonths }: AnalysisTabProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthMap: { [key: string]: number } = {
    'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3, 'Maio': 4, 'Junho': 5,
    'Julho': 6, 'Agosto': 7, 'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11
  };

  React.useEffect(() => {
    if (selectedYears.length === 1 && selectedMonths.length === 1) {
      const year = parseInt(selectedYears[0]);
      const monthIdx = monthMap[selectedMonths[0]];
      if (!isNaN(year) && monthIdx !== undefined) {
        setCurrentMonth(new Date(year, monthIdx, 1));
      }
    }
  }, [selectedYears, selectedMonths]);

  // Helper to format date consistently
  const toDateStr = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // --- Chart Logic ---
  const chartData = useMemo(() => {
    // We'll group by month for the comparative chart
    const monthlyData: { [key: string]: { month: string, year: number, income: number, expense: number, balance: number, sortKey: number } } = {};

    const source = filteredTransactions;
    
    source.forEach(t => {
      try {
        const d = new Date(t.data + 'T12:00:00');
        if (isNaN(d.getTime())) return;
        
        const year = d.getFullYear();
        const monthIdx = d.getMonth();
        const monthName = Object.keys(monthMap).find(key => monthMap[key] === monthIdx) || '';
        const key = `${year}-${monthIdx}`;

        if (!monthlyData[key]) {
          monthlyData[key] = {
            month: monthName,
            year: year,
            income: 0,
            expense: 0,
            balance: 0,
            sortKey: year * 100 + monthIdx
          };
        }

        if (t.tipo === 'income') monthlyData[key].income += t.valor;
        else monthlyData[key].expense += t.valor;
        monthlyData[key].balance = monthlyData[key].income - monthlyData[key].expense;
      } catch (e) {
        console.error('Error processing transaction for chart:', t);
      }
    });

    // Convert to array and sort by date
    let result = Object.values(monthlyData).sort((a, b) => a.sortKey - b.sortKey);

    // Filter based on selected years and months if applicable
    if (selectedYears.length > 0) {
      result = result.filter(d => selectedYears.includes(String(d.year)));
    }
    if (selectedMonths.length > 0) {
      result = result.filter(d => selectedMonths.includes(d.month));
    }

    // If no filters and too much data, maybe limit to last 12 months
    if (selectedYears.length === 0 && selectedMonths.length === 0 && result.length > 12) {
      result = result.slice(-12);
    }

    let accumulated = 0;
    return result.map(d => {
      accumulated += d.balance;
      return {
        ...d,
        accumulatedBalance: accumulated,
        displayDate: `${d.month.substring(0, 3)}/${String(d.year).substring(2)}`
      };
    });
  }, [transactions, filteredTransactions, selectedYears, selectedMonths]);

  // --- Calendar Logic ---
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    
    const days = [];
    
    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        month: month - 1,
        year,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonthLastDay - i)
      });
    }
    
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        month,
        year,
        isCurrentMonth: true,
        date: new Date(year, month, i)
      });
    }
    
    // Next month padding
    const remainingDays = 42 - days.length; // 6 rows of 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        month: month + 1,
        year,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i)
      });
    }
    
    return days;
  }, [currentMonth]);

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return filteredTransactions.filter(t => t.data === dateStr);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-proc-secondary/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl">
          <p className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest mb-2">
            {data.month} de {data.year}
          </p>
          <div className="space-y-2">
            <div className="flex justify-between gap-8">
              <span className="text-xs text-proc-text-sec">Resultado:</span>
              <span className={`text-xs font-bold ${data.balance < 0 ? 'text-red-500' : 'text-proc-cyan'}`}>{formatCurrency(data.balance)}</span>
            </div>
            <div className="border-t border-white/5 pt-2 space-y-1">
              <div className="flex justify-between gap-8">
                <span className="text-xs text-proc-green">Total Receitas:</span>
                <span className="text-xs font-bold text-proc-green">+{formatCurrency(data.income)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-xs text-red-500">Total Despesas:</span>
                <span className="text-xs font-bold text-red-500">-{formatCurrency(data.expense)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomEvolutionTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPositive = data.balance >= 0;
      const isAccumulatedPositive = data.accumulatedBalance >= 0;

      return (
        <div className="bg-proc-secondary/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl space-y-2 min-w-[210px]">
          <p className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest border-b border-white/10 pb-1.5">
            {data.month} de {data.year}
          </p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center gap-6">
              <span className="text-proc-text-sec">Resultado do Mês:</span>
              <span className={`font-bold ${isPositive ? 'text-proc-green' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{formatCurrency(data.balance)}
              </span>
            </div>
            <div className="flex justify-between items-center gap-6">
              <span className="text-proc-text-sec">Saldo Acumulado:</span>
              <span className={`font-bold ${isAccumulatedPositive ? 'text-proc-cyan' : 'text-red-500'}`}>
                {formatCurrency(data.accumulatedBalance)}
              </span>
            </div>
          </div>
          <div className={`mt-2 pt-2 border-t border-white/10 text-[10px] font-bold flex items-center gap-1.5 ${isAccumulatedPositive ? 'text-proc-green' : 'text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${isAccumulatedPositive ? 'bg-proc-green' : 'bg-red-500'}`} />
            <span>{isAccumulatedPositive ? 'Caixa Positivo (Margem OK)' : 'Atenção: Caixa no Vermelho!'}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const evolutionMetrics = useMemo(() => {
    if (chartData.length === 0) return { finalAccumulated: 0, avgMonthly: 0, isHealthy: true };
    const finalAccumulated = chartData[chartData.length - 1].accumulatedBalance;
    const totalMonthlyBalance = chartData.reduce((acc, curr) => acc + curr.balance, 0);
    const avgMonthly = totalMonthlyBalance / chartData.length;
    return {
      finalAccumulated,
      avgMonthly,
      isHealthy: finalAccumulated >= 0
    };
  }, [chartData]);

  const selectedDayData = useMemo(() => {
    if (!selectedDay) return null;
    const dateStr = selectedDay.toISOString().split('T')[0];
    const events = filteredTransactions.filter(t => t.data === dateStr);
    
    // Calculate balance before and after
    const balanceBefore = filteredTransactions
      .filter(t => new Date(t.data) < selectedDay)
      .reduce((acc, t) => acc + (t.tipo === 'income' ? t.valor : -t.valor), 0);
      
    const dayIncome = events.filter(e => e.tipo === 'income').reduce((acc, e) => acc + e.valor, 0);
    const dayExpense = events.filter(e => e.tipo === 'expense').reduce((acc, e) => acc + e.valor, 0);
    
    return {
      date: selectedDay,
      events,
      balanceBefore,
      balanceAfter: balanceBefore + dayIncome - dayExpense,
      totalIncome: dayIncome,
      totalExpense: dayExpense
    };
  }, [selectedDay, filteredTransactions]);

  return (
    <div className="space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-proc-text-main tracking-tight">Análise Financeira</h2>
          <p className="text-proc-text-sec text-sm mt-1">Visualize sua evolução e planeje seu futuro.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Component 1: Financial Calendar */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-12 bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-proc-green/10 flex items-center justify-center text-proc-green">
                <CalendarIcon size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-proc-text-main">Calendário Financeiro</h3>
                <p className="text-xs text-proc-text-sec">Planeje seus vencimentos e recebimentos</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-proc-bg/50 p-2 rounded-2xl border border-white/5">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-proc-text-sec">
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm font-bold text-proc-text-main min-w-[140px] text-center uppercase tracking-widest">
                {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={handleNextMonth} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-proc-text-sec">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 md:gap-4">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-[10px] font-bold text-proc-text-sec uppercase tracking-widest pb-2">
                {day}
              </div>
            ))}
            
            {calendarDays.map((dateObj, idx) => {
              const events = getEventsForDate(dateObj.date);
              const isToday = new Date().toDateString() === dateObj.date.toDateString();
              const isSelected = selectedDay?.toDateString() === dateObj.date.toDateString();
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(dateObj.date)}
                  className={`relative aspect-square md:aspect-auto md:h-24 p-2 rounded-2xl border transition-all flex flex-col items-center md:items-start gap-1 ${
                    dateObj.isCurrentMonth 
                      ? 'bg-proc-secondary/30 border-white/5 hover:border-proc-cyan/30' 
                      : 'bg-transparent border-transparent opacity-20'
                  } ${isSelected ? 'border-proc-cyan bg-proc-cyan/5 shadow-[0_0_15px_rgba(0,209,255,0.1)]' : ''} ${isToday ? 'ring-1 ring-proc-cyan ring-offset-2 ring-offset-proc-bg' : ''}`}
                >
                  <span className={`text-xs font-bold ${isToday ? 'text-proc-cyan' : 'text-proc-text-main'}`}>
                    {dateObj.day}
                  </span>
                  
                  <div className="flex flex-wrap gap-1 mt-auto justify-center md:justify-start">
                    {events.map((event, eIdx) => (
                      <div 
                        key={eIdx} 
                        className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
                          event.tipo === 'income' ? 'bg-proc-green' : 
                          event.tipo === 'birthday' ? 'bg-pink-500' :
                          event.pago ? 'bg-proc-cyan' : 'bg-red-500'
                        }`}
                        title={event.descricao}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap gap-6 justify-center md:justify-start">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-proc-green" />
              <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">Receita</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">Despesa Pendente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-proc-cyan" />
              <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">Despesa Paga</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pink-500" />
              <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">Aniversário</span>
            </div>
          </div>
        </motion.section>

        {/* Component 2: Daily Cash Flow Chart */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-12 bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
                <BarChart3 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-proc-text-main">Receita vs Despesa</h3>
                <p className="text-xs text-proc-text-sec">Comparativo mensal de entradas e saídas</p>
              </div>
            </div>
          </div>

          <div className="w-full relative">
            {chartData.length > 0 ? (
              <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
                <div style={{ minWidth: `${Math.max(100, chartData.length * 65)}px`, height: '350px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="displayDate" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--proc-text-sec)', fontSize: 10, fontWeight: 'bold' }}
                        interval={0}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--proc-text-sec)', fontSize: 10, fontWeight: 'bold' }}
                        tickFormatter={(value) => `R$ ${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                      <Legend 
                        verticalAlign="top" 
                        align="right" 
                        iconType="circle"
                        content={(props) => {
                          const { payload } = props;
                          return (
                            <div className="flex justify-end gap-6 mb-4">
                              {payload?.map((entry: any, index: number) => (
                                <div key={`item-${index}`} className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Bar 
                        dataKey="income" 
                        name="Receitas" 
                        fill="#00E676" 
                        radius={[4, 4, 0, 0]} 
                        barSize={20}
                      />
                      <Bar 
                        dataKey="expense" 
                        name="Despesas" 
                        fill="#F87171" 
                        radius={[4, 4, 0, 0]} 
                        barSize={20}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl">
                <Info className="text-proc-text-sec mb-2" size={32} />
                <p className="text-proc-text-sec text-sm font-medium">Sem dados para o período selecionado</p>
                <p className="text-proc-text-sec/50 text-xs mt-1">Tente ajustar os filtros de data no topo da página</p>
              </div>
            )}
          </div>
        </motion.section>

        {/* Component 3: Financial Evolution & Cash Flow Health Chart */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-12 bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${evolutionMetrics.isHealthy ? 'bg-proc-green/10 text-proc-green' : 'bg-red-500/10 text-red-500'}`}>
                <TrendingUp size={24} />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-bold text-proc-text-main">Evolução Financeira & Saúde do Caixa</h3>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${
                    evolutionMetrics.isHealthy ? 'bg-proc-green/10 text-proc-green border border-proc-green/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}>
                    {evolutionMetrics.isHealthy ? 'Saúde Financeira OK' : 'No Vermelho'}
                  </span>
                </div>
                <p className="text-xs text-proc-text-sec mt-0.5">Resultado mensal líquido e trajetória do saldo acumulado</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-proc-bg/50 px-4 py-2.5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-bold text-proc-text-sec uppercase tracking-widest">Média Líquida Mensal</p>
                <p className={`text-sm font-bold ${evolutionMetrics.avgMonthly >= 0 ? 'text-proc-green' : 'text-red-400'}`}>
                  {evolutionMetrics.avgMonthly >= 0 ? '+' : ''}{formatCurrency(evolutionMetrics.avgMonthly)}
                </p>
              </div>
              <div className="bg-proc-bg/50 px-4 py-2.5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-bold text-proc-text-sec uppercase tracking-widest">Saldo Acumulado Final</p>
                <p className={`text-sm font-bold ${evolutionMetrics.isHealthy ? 'text-proc-cyan' : 'text-red-400'}`}>
                  {formatCurrency(evolutionMetrics.finalAccumulated)}
                </p>
              </div>
            </div>
          </div>

          <div className="w-full relative">
            {chartData.length > 0 ? (
              <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
                <div style={{ minWidth: `${Math.max(100, chartData.length * 65)}px`, height: '350px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAccumulated" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00D1FF" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00D1FF" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="displayDate" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--proc-text-sec)', fontSize: 10, fontWeight: 'bold' }}
                        interval={0}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--proc-text-sec)', fontSize: 10, fontWeight: 'bold' }}
                        tickFormatter={(value) => `R$ ${Math.abs(value) >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                      />
                      <Tooltip content={<CustomEvolutionTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                      <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Linha Zero (No Vermelho)', fill: '#EF4444', fontSize: 10, position: 'insideTopLeft' }} />
                      <Legend 
                        verticalAlign="top" 
                        align="right" 
                        iconType="circle"
                        content={(props) => {
                          const { payload } = props;
                          return (
                            <div className="flex justify-end gap-6 mb-4">
                              {payload?.map((entry: any, index: number) => (
                                <div key={`item-${index}`} className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Bar 
                        dataKey="balance" 
                        name="Resultado do Mês" 
                        barSize={16}
                        radius={[4, 4, 0, 0]}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.balance >= 0 ? '#00E676' : '#EF4444'} />
                        ))}
                      </Bar>
                      <Area 
                        type="monotone" 
                        dataKey="accumulatedBalance" 
                        name="Saldo Acumulado" 
                        stroke="#00D1FF" 
                        fill="url(#colorAccumulated)" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#00D1FF', strokeWidth: 2, stroke: '#0B132B' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl py-12">
                <Info className="text-proc-text-sec mb-2" size={32} />
                <p className="text-proc-text-sec text-sm font-medium">Sem dados para o período selecionado</p>
              </div>
            )}
          </div>
        </motion.section>
      </div>

      {/* Day Details Modal */}
      <AnimatePresence>
        {selectedDayData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDay(null)}
              className="absolute inset-0 bg-proc-bg/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-proc-secondary border border-white/10 p-8 rounded-[2.5rem] max-w-lg w-full shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-proc-text-main">
                    {selectedDayData.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                  </h3>
                  <p className="text-xs text-proc-text-sec uppercase tracking-widest font-bold">Detalhamento do Dia</p>
                </div>
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors text-proc-text-sec"
                >
                  <ChevronRight className="rotate-90 md:rotate-0" />
                </button>
              </div>

              {/* Balance Summary */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-proc-bg/50 p-4 rounded-2xl border border-white/5">
                  <p className="text-[8px] font-bold text-proc-text-sec uppercase tracking-widest mb-1">Saldo Anterior</p>
                  <p className={`text-sm font-bold ${selectedDayData.balanceBefore < 0 ? 'text-red-500' : 'text-proc-text-main'}`}>
                    {formatCurrency(selectedDayData.balanceBefore)}
                  </p>
                </div>
                <div className="bg-proc-cyan/5 p-4 rounded-2xl border border-proc-cyan/10">
                  <p className="text-[8px] font-bold text-proc-cyan uppercase tracking-widest mb-1">Saldo Final</p>
                  <p className={`text-sm font-bold ${selectedDayData.balanceAfter < 0 ? 'text-red-500' : 'text-proc-cyan'}`}>
                    {formatCurrency(selectedDayData.balanceAfter)}
                  </p>
                </div>
              </div>

              {/* Events List */}
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                <h4 className="text-[10px] font-bold text-proc-text-sec uppercase tracking-[0.2em] mb-2">Lançamentos</h4>
                {selectedDayData.events.length > 0 ? (
                  selectedDayData.events.map((event, idx) => {
                    const rawTitle = event.estabelecimento || event.descricao || 'Sem descrição';
                    const cleanTitle = rawTitle.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, '').trim() || rawTitle;

                    let parcela = event.parcela;
                    let totalParcelas = event.totalParcelas;
                    if (!parcela || !totalParcelas) {
                      const textToSearch = `${event.descricao || ''} ${event.estabelecimento || ''}`;
                      const match = textToSearch.match(/\((\d+)\/(\d+)\)/);
                      if (match) {
                        parcela = parseInt(match[1], 10);
                        totalParcelas = parseInt(match[2], 10);
                      }
                    }
                    const hasInstallments = Boolean(parcela && totalParcelas && totalParcelas > 1);
                    const installmentText = hasInstallments ? `Parcela ${parcela} de ${totalParcelas}` : null;

                    return (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-proc-bg/30 border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            event.tipo === 'income' ? 'bg-proc-green/10 text-proc-green' : 
                            event.tipo === 'birthday' ? 'bg-pink-500/10 text-pink-500' :
                            event.pago ? 'bg-proc-cyan/10 text-proc-cyan' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {event.tipo === 'income' ? <ArrowUpRight size={16} /> : event.tipo === 'birthday' ? '🎂' : <ArrowDownRight size={16} />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-proc-text-main leading-none">{cleanTitle}</p>
                            <p className="text-[10px] text-proc-text-sec mt-1">{event.categoria}</p>
                            {installmentText && (
                              <p className="text-[10px] text-proc-cyan font-semibold mt-0.5">{installmentText}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${
                            event.tipo === 'income' ? 'text-proc-green' : 
                            event.tipo === 'birthday' ? 'text-pink-500' :
                            'text-red-500'
                          }`}>
                            {event.tipo === 'income' ? '+' : event.tipo === 'birthday' ? '🎉' : '-'} {event.tipo === 'birthday' ? 'Aniversário' : formatCurrency(event.valor)}
                          </p>
                          {event.tipo === 'expense' && (
                            <span className={`text-[8px] font-bold uppercase tracking-widest ${event.pago ? 'text-proc-cyan' : 'text-amber-500'}`}>
                              {event.pago ? 'Pago' : 'Pendente'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl">
                    <p className="text-proc-text-sec text-xs italic">Nenhum lançamento para este dia.</p>
                  </div>
                )}
              </div>

              {/* Day Totals */}
              <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-[8px] font-bold text-proc-green uppercase tracking-widest leading-none mb-1">Entradas</p>
                    <p className="text-xs font-bold text-proc-text-main">{formatCurrency(selectedDayData.totalIncome)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-bold text-red-500 uppercase tracking-widest leading-none mb-1">Saídas</p>
                    <p className="text-xs font-bold text-proc-text-main">{formatCurrency(selectedDayData.totalExpense)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="px-6 py-3 rounded-xl bg-proc-cyan text-proc-bg font-bold text-xs uppercase tracking-widest hover:shadow-lg hover:shadow-proc-cyan/20 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
