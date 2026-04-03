import { Bell, Search, User as UserIcon } from 'lucide-react';
import { auth } from '../firebase';

interface HeaderProps {
  balance: number;
}

export default function Header({ balance }: HeaderProps) {
  const user = auth.currentUser;

  return (
    <header className="sticky top-0 z-40 bg-proc-bg/80 backdrop-blur-md px-6 md:px-8 py-4 flex justify-between items-center border-b border-white/5">
      <div className="flex flex-col md:hidden">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Proc<span className="text-proc-cyan">Visual</span>
        </h1>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-proc-text-sec uppercase tracking-widest font-semibold">Saldo</span>
          <span className="text-xs font-bold text-proc-cyan">
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-6 flex-1">
        <div className="relative max-w-md w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-proc-text-sec group-focus-within:text-proc-cyan transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar lançamentos, categorias..." 
            className="w-full bg-proc-secondary/30 border border-white/5 rounded-2xl py-2.5 pl-12 pr-4 text-sm text-white placeholder:text-proc-text-sec focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-secondary/50 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-proc-cyan/5 rounded-2xl border border-proc-cyan/10">
          <span className="text-[10px] text-proc-text-sec uppercase tracking-widest font-bold">Saldo Consolidado</span>
          <span className="text-sm font-bold text-proc-cyan">
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <button className="p-2.5 rounded-xl bg-proc-secondary/50 border border-white/5 text-proc-text-sec hover:text-white hover:border-white/10 transition-all relative">
          <Bell size={20} />
          <div className="absolute top-2 right-2 w-2 h-2 bg-proc-cyan rounded-full border-2 border-proc-bg shadow-[0_0_8px_#00D1FF]" />
        </button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-white/5">
          <div className="hidden md:block text-right">
            <p className="text-sm font-bold text-white leading-none">{user?.displayName || 'Usuário'}</p>
            <p className="text-[10px] text-proc-text-sec mt-1">Premium Plan</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-proc-cyan to-proc-green p-[1px] shadow-[0_0_15px_rgba(0,209,255,0.2)]">
            <div className="w-full h-full rounded-[11px] bg-proc-bg flex items-center justify-center overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={20} className="text-proc-cyan" />
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
