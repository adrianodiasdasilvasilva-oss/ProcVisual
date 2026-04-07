import { Plus, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface ActionButtonsProps {
  onNewTransaction: () => void;
  onEditTransactions: () => void;
}

export default function ActionButtons({ onNewTransaction, onEditTransactions }: ActionButtonsProps) {
  return (
    <div className="flex flex-row gap-3 md:gap-4 mb-0 md:mb-0">
      <motion.button 
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onNewTransaction}
        className="flex-1 md:flex-none md:px-8 flex items-center justify-center gap-2 bg-proc-green text-proc-bg py-3.5 md:py-3 rounded-2xl font-bold shadow-[0_0_20px_rgba(0,230,118,0.2)] hover:shadow-[0_0_30px_rgba(0,230,118,0.3)] transition-all"
      >
        <Plus size={20} strokeWidth={3} />
        <span className="text-sm">Novo lançamento</span>
      </motion.button>
      
      <motion.button 
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onEditTransactions}
        className="flex-1 md:flex-none md:px-8 flex items-center justify-center gap-2 bg-proc-secondary/50 border border-white/10 text-proc-text-main py-3.5 md:py-3 rounded-2xl font-bold hover:bg-proc-secondary/80 hover:border-white/20 transition-all"
      >
        <RefreshCw size={18} strokeWidth={2.5} className="text-proc-cyan" />
        <span className="text-sm">Editar lançamentos</span>
      </motion.button>
    </div>
  );
}
