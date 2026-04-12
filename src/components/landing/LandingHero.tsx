import React from 'react';
import { motion } from 'motion/react';
import { Play, ArrowRight, TrendingUp, TrendingDown, Camera } from 'lucide-react';

interface LandingHeroProps {
  onStart: () => void;
}

export default function LandingHero({ onStart }: LandingHeroProps) {
  return (
    <section className="relative pt-40 pb-20 md:pt-56 md:pb-32 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-proc-cyan/10 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-proc-green/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.1] mb-8 tracking-tight">
            Controle suas finanças com <span className="text-proc-cyan">inteligência</span>
          </h1>
          
          <p className="text-lg md:text-xl text-proc-text-sec leading-relaxed mb-10 max-w-xl">
            Registre despesas, envie comprovantes e acompanhe sua saúde financeira automaticamente com a tecnologia OCR e IA da ProcVisual.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button 
              onClick={onStart}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-proc-green text-proc-bg font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.3)] hover:shadow-[0_0_40px_rgba(0,230,118,0.5)] hover:scale-105 transition-all"
            >
              Registrar
              <ArrowRight size={20} />
            </button>
            <button 
              onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-proc-secondary/50 border border-white/10 text-white font-bold flex items-center justify-center gap-2 hover:bg-proc-secondary transition-all"
            >
              <Play size={18} className="fill-current" />
              Ver como funciona
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="relative"
        >
          {/* Mockup Frame simulating the real Dashboard */}
          <div className="relative z-10 bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-4 shadow-2xl backdrop-blur-sm">
            <div className="bg-proc-bg rounded-[1.5rem] overflow-hidden border border-white/5 shadow-inner aspect-[4/3] p-6 flex flex-col gap-6">
              {/* Simulated Header */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xl font-bold text-white">Olá, Adriano!</p>
                  <p className="text-[10px] text-proc-text-sec uppercase tracking-widest">Seu saldo hoje</p>
                </div>
                <div className="px-4 py-2 bg-proc-cyan/10 border border-proc-cyan/20 rounded-xl">
                  <span className="text-lg font-bold text-proc-cyan">R$ 12.450,80</span>
                </div>
              </div>

              {/* Simulated Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-proc-secondary/40 p-4 rounded-2xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-proc-green/10 flex items-center justify-center text-proc-green mb-3">
                    <TrendingUp size={16} />
                  </div>
                  <p className="text-[8px] font-bold text-proc-text-sec uppercase tracking-widest mb-1">Receitas</p>
                  <p className="text-sm font-bold text-white">R$ 8.200</p>
                </div>
                <div className="bg-proc-secondary/40 p-4 rounded-2xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 mb-3">
                    <TrendingDown size={16} />
                  </div>
                  <p className="text-[8px] font-bold text-proc-text-sec uppercase tracking-widest mb-1">Despesas</p>
                  <p className="text-sm font-bold text-white">R$ 3.450</p>
                </div>
              </div>

              {/* Simulated Chart Area */}
              <div className="flex-1 bg-proc-secondary/20 rounded-2xl border border-white/5 flex items-end justify-around p-4">
                {[30, 50, 40, 70, 45, 90, 60].map((h, i) => (
                  <div 
                    key={i}
                    className="w-4 bg-proc-cyan/20 rounded-t-md border-t border-proc-cyan/40"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-proc-cyan/20 blur-[60px] rounded-full pointer-events-none" />
        </motion.div>
      </div>
    </section>
  );
}

