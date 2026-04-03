import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';

interface SummaryCardProps {
  income: number;
  expense: number;
}

export default function SummaryCard({ income, expense }: SummaryCardProps) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-proc-secondary/30 border border-white/5 p-5 rounded-[2rem] relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-16 h-16 bg-proc-green/10 blur-2xl rounded-full -mr-8 -mt-8 group-hover:bg-proc-green/20 transition-all" />
        <div className="w-10 h-10 rounded-xl bg-proc-green/10 flex items-center justify-center text-proc-green mb-3">
          <ArrowUpRight size={20} />
        </div>
        <p className="text-proc-text-sec text-[10px] font-bold uppercase tracking-widest mb-1">Receitas</p>
        <p className="text-white font-bold text-lg">R$ {income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-proc-secondary/30 border border-white/5 p-5 rounded-[2rem] relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 blur-2xl rounded-full -mr-8 -mt-8 group-hover:bg-red-500/20 transition-all" />
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 mb-3">
          <ArrowDownRight size={20} />
        </div>
        <p className="text-proc-text-sec text-[10px] font-bold uppercase tracking-widest mb-1">Despesas</p>
        <p className="text-white font-bold text-lg">R$ {expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      </motion.div>
    </div>
  );
}
