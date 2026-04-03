import { TrendingUp, TrendingDown, PiggyBank, Target } from 'lucide-react';
import { motion } from 'motion/react';

interface QuickCardsProps {
  income: number;
  expense: number;
}

export default function QuickCards({ income, expense }: QuickCardsProps) {
  const savings = income - expense;
  const savingsPercent = income > 0 ? Math.round((savings / income) * 100) : 0;

  const cards = [
    { title: 'Receita', value: `R$ ${income.toLocaleString('pt-BR')}`, icon: TrendingUp, color: 'text-proc-green', glow: 'shadow-[0_0_15px_rgba(0,230,118,0.15)]' },
    { title: 'Despesa', value: `R$ ${expense.toLocaleString('pt-BR')}`, icon: TrendingDown, color: 'text-red-400', glow: 'shadow-[0_0_15px_rgba(248,113,113,0.1)]' },
    { title: 'Economia', value: `R$ ${savings.toLocaleString('pt-BR')}`, icon: PiggyBank, color: 'text-proc-cyan', glow: 'shadow-[0_0_15px_rgba(0,209,255,0.15)]' },
    { title: 'Meta', value: `${savingsPercent}%`, icon: Target, color: 'text-proc-green', glow: 'shadow-[0_0_15px_rgba(0,230,118,0.15)]' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 mb-8">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          className={`bg-proc-secondary/30 p-5 rounded-2xl border border-white/5 ${card.glow} flex flex-col gap-3`}
        >
          <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${card.color}`}>
            <card.icon size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">{card.title}</p>
            <p className="text-lg font-bold text-white">{card.value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
