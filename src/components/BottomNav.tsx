import React, { useState } from 'react';
import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, BarChart2, FileText, Settings as SettingsIcon, Download, ChevronUp, ChevronDown, PieChart, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onInstall?: () => void;
  isSuperAdmin?: boolean;
}

export default function BottomNav({ activeTab, onTabChange, onInstall, isSuperAdmin }: BottomNavProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'lancamentos', label: 'Lançamentos', icon: FileText },
    { id: 'analise', label: 'Análise', icon: BarChart2 },
    { id: 'relatorios', label: 'Relatórios', icon: PieChart },
    ...(isSuperAdmin ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck }] : []),
    { id: 'configuracoes', label: 'Configurações', icon: SettingsIcon },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <AnimatePresence>
        {onInstall && !isMinimized && (
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
      
      <motion.div 
        initial={false}
        animate={{ 
          height: isMinimized ? '40px' : 'auto',
          paddingBottom: isMinimized ? '0px' : '32px'
        }}
        onClick={() => isMinimized && setIsMinimized(false)}
        className={`bg-proc-bg/95 backdrop-blur-xl border-t border-proc-border px-4 shadow-[0_-10px_20px_rgba(0,0,0,0.3)] relative overflow-hidden ${isMinimized ? 'cursor-pointer' : ''}`}
      >
        {/* Toggle Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(!isMinimized);
          }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-8 flex flex-col items-center justify-center text-proc-text-sec hover:text-proc-cyan transition-colors z-10"
        >
          <div className="w-8 h-1 bg-proc-text-sec/10 rounded-full mb-1" />
          {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <motion.nav 
          animate={{ 
            opacity: isMinimized ? 0 : 1,
            y: isMinimized ? 20 : 0,
            scale: isMinimized ? 0.95 : 1
          }}
          transition={{ duration: 0.2 }}
          className="pt-6 flex justify-between items-center"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  // Optional: auto-minimize after selection? 
                  // User didn't ask for it, so let's keep it manual.
                }}
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
        </motion.nav>
      </motion.div>
    </div>
  );
}
