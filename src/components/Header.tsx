import { Menu } from 'lucide-react';

interface HeaderProps {
  balance: number;
}

export default function Header({ balance }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-proc-bg/80 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-white/5">
      <div className="flex flex-col">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Proc<span className="text-proc-green">Visual</span>
        </h1>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-proc-text-sec uppercase tracking-widest font-semibold">Saldo Total</span>
          <span className="text-xs font-bold text-proc-green">
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      <button className="p-2 rounded-xl bg-proc-secondary/50 border border-white/10 text-white active:scale-95 transition-transform">
        <Menu size={24} />
      </button>
    </header>
  );
}
