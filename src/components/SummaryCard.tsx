import { Calendar } from 'lucide-react';

export default function SummaryCard() {
  return (
    <div className="bg-proc-secondary/40 p-5 rounded-2xl border border-white/5 shadow-lg mb-6 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-proc-green to-proc-glow flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.3)]">
        <Calendar size={20} className="text-proc-bg" />
      </div>
      <div>
        <h3 className="text-base font-bold text-white">Resumo do mês</h3>
        <p className="text-xs text-proc-text-sec">Você economizou 15% a mais que o mês passado.</p>
      </div>
    </div>
  );
}
