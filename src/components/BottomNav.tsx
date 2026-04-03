import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, BarChart2, FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'income', label: 'Receitas', icon: ArrowUpCircle },
    { id: 'expenses', label: 'Despesas', icon: ArrowDownCircle },
    { id: 'analysis', label: 'Análises', icon: BarChart2 },
    { id: 'reports', label: 'Relatórios', icon: FileText },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-proc-bg/95 backdrop-blur-xl border-t border-white/5 px-4 py-3 pb-8 flex justify-between items-center z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="relative flex flex-col items-center gap-1 min-w-[60px]"
          >
            <div className={`p-1.5 transition-all duration-300 ${isActive ? 'text-proc-green scale-110' : 'text-proc-text-sec'}`}>
              <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={`text-[8px] font-bold uppercase tracking-tighter transition-colors ${isActive ? 'text-proc-green' : 'text-proc-text-sec'}`}>
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="activeGlow"
                className="absolute -top-3 w-8 h-1 bg-proc-green rounded-full blur-[2px]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
