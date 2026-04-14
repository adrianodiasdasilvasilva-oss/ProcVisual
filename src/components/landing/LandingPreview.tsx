import React from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';

export default function LandingPreview() {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-[10px] font-bold text-proc-cyan uppercase tracking-[0.3em] mb-4">Experiência</h2>
          <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Gestão que se <span className="text-proc-cyan">adapta a você</span>
          </h3>
          <p className="text-proc-text-sec text-lg max-w-2xl mx-auto">
            Esqueça planilhas complexas. Tenha o controle total das suas finanças e compromissos na palma da mão, com a simplicidade de uma conversa.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative z-10 bg-proc-secondary/20 border border-white/10 rounded-[3rem] p-4 md:p-8 shadow-2xl backdrop-blur-sm max-w-5xl mx-auto"
        >
          <div className="bg-proc-bg rounded-[2.5rem] overflow-hidden border border-white/5 shadow-inner relative">
            {/* Mockup Content */}
            <div className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div>
                  <h4 className="text-2xl font-bold text-white mb-1">Olá, Adriano!</h4>
                  <p className="text-sm text-proc-text-sec">Seu saldo consolidado hoje</p>
                </div>
                <div className="px-6 py-3 bg-proc-cyan/10 border border-proc-cyan/20 rounded-2xl">
                  <span className="text-2xl font-bold text-proc-cyan tracking-tight">R$ 12.450,80</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
                {/* Health Gauge Mockup */}
                <div className="md:col-span-4 bg-proc-secondary/40 p-8 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center text-center">
                  <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" strokeWidth="12" className="text-white/5" />
                      <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" strokeWidth="12" strokeDasharray="364" strokeDashoffset="72" className="text-proc-cyan" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-bold text-white">80%</span>
                    </div>
                  </div>
                  <h5 className="text-sm font-bold text-white uppercase tracking-widest mb-2">Saúde Financeira</h5>
                  <p className="text-[10px] text-proc-text-sec leading-relaxed">Sua gestão está excelente este mês!</p>
                </div>

                {/* Stats Cards Mockup */}
                <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { label: 'Receitas', value: 'R$ 8.200', icon: TrendingUp, color: 'text-proc-green', bg: 'bg-proc-green/10' },
                    { label: 'Despesas', value: 'R$ 3.450', icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-400/10' },
                    { label: 'Aniversários', value: '3 Próximos', icon: PiggyBank, color: 'text-proc-cyan', bg: 'bg-proc-cyan/10' },
                    { label: 'Economia', value: 'R$ 4.750', icon: LayoutDashboard, color: 'text-proc-green', bg: 'bg-proc-green/10' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-proc-secondary/40 p-6 rounded-3xl border border-white/5 flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                        <stat.icon size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-xl font-bold text-white">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transaction List Mockup */}
              <div className="bg-proc-secondary/20 rounded-[2.5rem] border border-white/5 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h5 className="text-lg font-bold text-white">Lançamentos Recentes</h5>
                  <span className="text-[10px] font-bold text-proc-cyan uppercase tracking-widest">Ver todos</span>
                </div>
                <div className="space-y-4">
                  {[
                    { desc: 'Supermercado Silva', cat: 'Alimentação', val: '- R$ 450,00', color: 'text-red-400', icon: '🛒' },
                    { desc: 'Salário Mensal', cat: 'Renda', val: '+ R$ 8.200,00', color: 'text-proc-green', icon: '💰' },
                    { desc: 'Aniversário da Maria', cat: 'Lembrete', val: '🎉 Hoje', color: 'text-proc-cyan', icon: '🎂' },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-proc-secondary/30 border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-lg">
                          {t.icon}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{t.desc}</p>
                          <p className="text-[10px] text-proc-text-sec uppercase tracking-widest">{t.cat}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${t.color}`}>{t.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Decorative elements */}
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-proc-cyan/10 blur-[100px] rounded-full -translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-proc-green/5 blur-[120px] rounded-full translate-x-1/2 pointer-events-none" />
      </div>
    </section>
  );
}
