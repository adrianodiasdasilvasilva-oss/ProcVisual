import React from 'react';
import { LayoutDashboard, PieChart, Wallet, Settings, LogOut, Download, BarChart2 } from 'lucide-react';
import { auth } from '../firebase';
import Logo from './Logo';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onInstall?: () => void;
}

export default function Sidebar({ activeTab, onTabChange, onInstall }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'lancamentos', label: 'Lançamentos', icon: Wallet },
    { id: 'analise', label: 'Análise', icon: PieChart },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart2 },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-proc-secondary/20 border-r border-white/10 h-screen sticky top-0 p-6">
      <div className="mb-10 flex items-center gap-3">
        <Logo size="small" className="h-8" />
        <div>
          <h1 className="text-xl font-bold text-proc-text-main tracking-tighter leading-none">
            Proc<span className="text-proc-cyan">Visual</span>
          </h1>
          <p className="text-[8px] text-proc-text-sec uppercase tracking-[0.2em] font-bold mt-0.5">Intelligence Finance</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
              activeTab === item.id 
                ? 'bg-proc-cyan/10 text-proc-cyan shadow-[0_0_20px_rgba(0,209,255,0.1)]' 
                : 'text-proc-text-sec hover:bg-proc-text-main/5 hover:text-proc-text-main'
            }`}
          >
            <item.icon size={20} className={activeTab === item.id ? 'text-proc-cyan' : 'group-hover:text-proc-text-main'} />
            <span className="font-medium text-sm">{item.label}</span>
            {activeTab === item.id && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-proc-cyan shadow-[0_0_8px_#00D1FF]" />
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-white/10 space-y-2">
        {onInstall && (
          <button 
            onClick={onInstall}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-proc-cyan bg-proc-cyan/10 hover:bg-proc-cyan/20 transition-all duration-300 group"
          >
            <Download size={20} />
            <span className="font-medium text-sm">Instalar App</span>
          </button>
        )}
        <button 
          onClick={() => auth.signOut()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all duration-300 group"
        >
          <LogOut size={20} />
          <span className="font-medium text-sm">Sair da conta</span>
        </button>
      </div>
    </aside>
  );
}
