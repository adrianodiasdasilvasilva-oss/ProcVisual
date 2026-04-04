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
            Veja sua <span className="text-proc-cyan">evolução financeira</span>
          </h3>
          <p className="text-proc-text-sec text-lg max-w-2xl mx-auto">
            Uma interface pensada para clareza e rapidez. Tudo o que importa em uma única tela.
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {[
                  { label: 'Receitas', value: 'R$ 8.200', icon: TrendingUp, color: 'text-proc-green' },
                  { label: 'Despesas', value: 'R$ 3.450', icon: TrendingDown, color: 'text-red-400' },
                  { label: 'Economia', value: 'R$ 4.750', icon: PiggyBank, color: 'text-proc-cyan' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-proc-secondary/40 p-6 rounded-3xl border border-white/5">
                    <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${stat.color} mb-4`}>
                      <stat.icon size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-xl font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="h-64 bg-proc-secondary/20 rounded-3xl border border-white/5 flex items-center justify-center overflow-hidden relative">
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-proc-cyan/10 to-transparent" />
                <div className="flex items-end gap-2 md:gap-4 h-32">
                  {[40, 60, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
                    <motion.div 
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05, duration: 1 }}
                      className="w-4 md:w-8 bg-proc-cyan/20 rounded-t-lg border-t border-proc-cyan/40"
                    />
                  ))}
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <LayoutDashboard size={40} className="text-proc-cyan/20 mb-2 mx-auto" />
                  <p className="text-xs font-bold text-proc-cyan/40 uppercase tracking-widest">Gráfico de Evolução</p>
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
