import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, BarChart2, FileText, Settings as SettingsIcon, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onInstall?: () => void;
}

export default function BottomNav({ activeTab, onTabChange, onInstall }: BottomNavProps) {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'lancamentos', label: 'Lançamentos', icon: FileText },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart2 },
    { id: 'configuracoes', label: 'Configurações', icon: SettingsIcon },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <AnimatePresence>
        {onInstall && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-4 pb-2"
          >
            <button
              onClick={onInstall}
              className="w-full bg-proc-cyan text-proc-bg font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,209,255,0.3)]"
            >
              <Download size={18} />
              <span className="text-sm">Instalar ProcVisual</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <nav className="bg-proc-bg/95 backdrop-blur-xl border-t border-white/5 px-4 py-3 pb-8 flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
        {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="relative flex flex-col items-center gap-1 min-w-[60px]"
          >
            <div className={`p-1.5 transition-all duration-300 ${isActive ? 'text-proc-cyan scale-110' : 'text-proc-text-sec'}`}>
              <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={`text-[8px] font-bold uppercase tracking-tighter transition-colors ${isActive ? 'text-proc-cyan' : 'text-proc-text-sec'}`}>
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="activeGlow"
                className="absolute -top-3 w-8 h-1 bg-proc-cyan rounded-full blur-[2px]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
      </nav>
    </div>
  );
}
