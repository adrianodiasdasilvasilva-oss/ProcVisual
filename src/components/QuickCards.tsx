import { TrendingUp, TrendingDown, PiggyBank, PieChart } from 'lucide-react';
import { motion } from 'motion/react';

interface QuickCardsProps {
  income: number;
  expense: number;
}

export default function QuickCards({ income, expense }: QuickCardsProps) {
  const savings = income - expense;
  const displaySavings = Math.max(0, savings);
  const expensePercent = income > 0 ? Math.round((expense / income) * 100) : (expense > 0 ? 100 : 0);

  const cards = [
    { title: 'Receita', value: `R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-proc-green', glow: 'shadow-[0_0_15px_rgba(0,230,118,0.15)]' },
    { title: 'Despesa', value: `R$ ${expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingDown, color: 'text-red-400', glow: 'shadow-[0_0_15px_rgba(248,113,113,0.1)]' },
    { title: 'Economia', value: `R$ ${displaySavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: PiggyBank, color: 'text-proc-cyan', glow: 'shadow-[0_0_15px_rgba(0,209,255,0.15)]' },
    { title: '% Despesas', value: `${expensePercent}%`, icon: PieChart, color: expensePercent > 100 ? 'text-red-500' : 'text-proc-cyan', glow: expensePercent > 100 ? 'shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'shadow-[0_0_15px_rgba(0,209,255,0.15)]' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-1 gap-4 mb-0">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          whileHover={{ scale: 1.02, x: 5 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`bg-proc-secondary/20 p-4 rounded-3xl border border-proc-border ${card.glow} flex items-center gap-4 hover:bg-proc-secondary/40 transition-all`}
        >
          <div className={`w-10 h-10 rounded-xl bg-proc-secondary/50 flex items-center justify-center ${card.color} shrink-0`}>
            <card.icon size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest leading-none mb-1">{card.title}</p>
            <p className="text-sm font-bold text-proc-text-main leading-none">{card.value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
