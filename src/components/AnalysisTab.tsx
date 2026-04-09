import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Area, 
  AreaChart,
  ReferenceLine,
  Dot
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
  Target
} from 'lucide-react';
import { Transaction } from '../App';

interface AnalysisTabProps {
  transactions: Transaction[];
}

type Period = '7d' | '30d' | '3m' | '1y';

export default function AnalysisTab({ transactions }: AnalysisTabProps) {
  const [period, setPeriod] = useState<Period>('30d');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // --- Chart Logic ---
  const chartData = useMemo(() => {
    if (transactions.length === 0) return [];

    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d': startDate.setDate(now.getDate() - 7); break;
      case '30d': startDate.setDate(now.getDate() - 30); break;
      case '3m': startDate.setMonth(now.getMonth() - 3); break;
      case '1y': startDate.setFullYear(now.getFullYear() - 1); break;
    }

    startDate.setHours(0, 0, 0, 0);

    // Get all transactions before startDate to calculate initial balance
    const initialBalance = transactions
      .filter(t => new Date(t.data) < startDate)
      .reduce((acc, t) => acc + (t.tipo === 'income' ? t.valor : -t.valor), 0);

    // Group transactions by date within the period
    const grouped = transactions
      .filter(t => new Date(t.data) >= startDate && new Date(t.data) <= now)
      .reduce((acc: any, t) => {
        const dateStr = t.data;
        if (!acc[dateStr]) acc[dateStr] = { income: 0, expense: 0 };
        if (t.tipo === 'income') acc[dateStr].income += t.valor;
        else acc[dateStr].expense += t.valor;
        return acc;
      }, {});

    // Generate all dates in the range
    const data = [];
    let currentBalance = initialBalance;
    const tempDate = new Date(startDate);
    
    while (tempDate <= now) {
      const dateStr = tempDate.toISOString().split('T')[0];
      const dayData = grouped[dateStr] || { income: 0, expense: 0 };
      currentBalance += dayData.income - dayData.expense;
      
      data.push({
        date: dateStr,
        displayDate: tempDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        balance: currentBalance,
        income: dayData.income,
        expense: dayData.expense
      });
      
      tempDate.setDate(tempDate.getDate() + 1);
    }

    return data;
  }, [transactions, period]);

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
          <p className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest mb-2">{new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-8">
              <span className="text-xs text-proc-text-sec">Saldo:</span>
              <span className={`text-xs font-bold ${data.balance < 0 ? 'text-red-500' : 'text-proc-cyan'}`}>{formatCurrency(data.balance)}</span>
            </div>
            {data.income > 0 && (
              <div className="flex justify-between gap-8">
                <span className="text-xs text-proc-text-sec">Receitas:</span>
                <span className="text-xs font-bold text-proc-green">+{formatCurrency(data.income)}</span>
              </div>
            )}
            {data.expense > 0 && (
              <div className="flex justify-between gap-8">
                <span className="text-xs text-proc-text-sec">Despesas:</span>
                <span className="text-xs font-bold text-red-500">-{formatCurrency(data.expense)}</span>
              </div>
            )}
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
        {/* Component 1: Balance Evolution Chart */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-12 bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
                <TrendingUp size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-proc-text-main">Evolução do Saldo</h3>
                <p className="text-xs text-proc-text-sec">Acompanhe o crescimento do seu patrimônio</p>
              </div>
            </div>

            <div className="flex bg-proc-bg/50 p-1 rounded-2xl border border-white/5">
              {(['7d', '30d', '3m', '1y'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                    period === p 
                      ? 'bg-proc-cyan text-proc-bg shadow-lg shadow-proc-cyan/20' 
                      : 'text-proc-text-sec hover:text-proc-text-main'
                  }`}
                >
                  {p === '7d' ? '7 Dias' : p === '30d' ? '30 Dias' : p === '3m' ? '3 Meses' : '1 Ano'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D1FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00D1FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
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
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0, 209, 255, 0.2)', strokeWidth: 2 }} />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#00D1FF" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorBalance)" 
                  animationDuration={1500}
                />
                {/* Mark points with income/expense */}
                {chartData.map((entry, index) => {
                  if (entry.income > 0 || entry.expense > 0) {
                    return (
                      <ReferenceLine 
                        key={index}
                        x={entry.displayDate} 
                        stroke="transparent"
                        label={(props) => {
                          const { viewBox } = props;
                          return (
                            <g>
                              {entry.income > 0 && (
                                <circle cx={viewBox.x} cy={viewBox.y - 10} r="3" fill="#00E676" />
                              )}
                              {entry.expense > 0 && (
                                <circle cx={viewBox.x} cy={viewBox.y + 10} r="3" fill="#F87171" />
                              )}
                            </g>
                          );
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </AreaChart>
            </ResponsiveContainer>
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
