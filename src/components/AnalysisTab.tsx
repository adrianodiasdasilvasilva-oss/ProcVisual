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
  Line
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

    const source = filteredTransactions.length > 0 ? filteredTransactions : transactions;
    
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

    return result.map(d => ({
      ...d,
      displayDate: `${d.month.substring(0, 3)}/${String(d.year).substring(2)}`
    }));
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
    return transactions.filter(t => t.data === dateStr);
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

  const selectedDayData = useMemo(() => {
    if (!selectedDay) return null;
    const dateStr = selectedDay.toISOString().split('T')[0];
    const events = transactions.filter(t => t.data === dateStr);
    
    // Calculate balance before and after
    const balanceBefore = transactions
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
  }, [selectedDay, transactions]);

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
        {/* Component 1: Daily Cash Flow Chart */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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

          <div className="h-[350px] w-full relative">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--proc-text-sec)', fontSize: 10, fontWeight: 'bold' }}
                    minTickGap={30}
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
                  <Bar
                    dataKey="balance"
                    name="Saldo Líquido"
                    fill="#00D1FF"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl">
                <Info className="text-proc-text-sec mb-2" size={32} />
                <p className="text-proc-text-sec text-sm font-medium">Sem dados para o período selecionado</p>
                <p className="text-proc-text-sec/50 text-xs mt-1">Tente ajustar os filtros de data no topo da página</p>
              </div>
            )}
          </div>
        </motion.section>

        {/* Component 2: Financial Calendar */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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
                  selectedDayData.events.map((event, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-proc-bg/30 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          event.tipo === 'income' ? 'bg-proc-green/10 text-proc-green' : 
                          event.pago ? 'bg-proc-cyan/10 text-proc-cyan' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {event.tipo === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-proc-text-main leading-none">{event.descricao || event.estabelecimento}</p>
                          <p className="text-[10px] text-proc-text-sec mt-1">{event.categoria}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${event.tipo === 'income' ? 'text-proc-green' : 'text-red-500'}`}>
                          {event.tipo === 'income' ? '+' : '-'} {formatCurrency(event.valor)}
                        </p>
                        {event.tipo === 'expense' && (
                          <span className={`text-[8px] font-bold uppercase tracking-widest ${event.pago ? 'text-proc-cyan' : 'text-amber-500'}`}>
                            {event.pago ? 'Pago' : 'Pendente'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
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
