import { Plus, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface ActionButtonsProps {
  onNewTransaction: () => void;
}

export default function ActionButtons({ onNewTransaction }: ActionButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onNewTransaction}
        className="flex items-center justify-center gap-2 bg-proc-green text-proc-bg py-3.5 rounded-2xl font-bold shadow-[0_0_15px_rgba(0,230,118,0.2)] active:shadow-none transition-all"
      >
        <Plus size={20} strokeWidth={3} />
        <span className="text-sm">Novo lançamento</span>
      </motion.button>
      
      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center justify-center gap-2 bg-proc-secondary/50 border border-white/10 text-white py-3.5 rounded-2xl font-bold hover:bg-proc-secondary transition-all"
      >
        <RefreshCw size={18} strokeWidth={2.5} className="text-proc-cyan" />
        <span className="text-sm">Atualizar</span>
      </motion.button>
    </div>
  );
}
