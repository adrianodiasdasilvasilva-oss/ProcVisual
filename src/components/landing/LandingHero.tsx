import React from 'react';
import { motion } from 'motion/react';
import { Play, ArrowRight, TrendingUp, TrendingDown, Camera } from 'lucide-react';

interface LandingHeroProps {
  onStart: () => void;
  onLogin: () => void;
}

export default function LandingHero({ onStart, onLogin }: LandingHeroProps) {
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-proc-cyan/20 to-proc-green/20 border border-proc-cyan/30 text-proc-cyan text-xs font-bold mb-6 shadow-lg shadow-proc-cyan/10">
            <span className="text-base">🎁</span>
            <span>7 DIAS GRÁTIS DE TESTE • ACESSO TOTAL ILIMITADO</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.1] mb-8 tracking-tight">
            Controle suas finanças com <span className="text-proc-cyan">IA e WhatsApp</span>
          </h1>
          
          <p className="text-lg md:text-xl text-proc-text-sec leading-relaxed mb-8 max-w-xl">
            Converse com seu Analista Financeiro IA, registre despesas por áudio ou foto e controle seus gastos de forma simples no WhatsApp. <strong className="text-white">Experimente gratuitamente por 7 dias!</strong>
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex flex-col w-full sm:w-auto gap-3">
              <button 
                onClick={onStart}
                className="w-full px-8 py-4 rounded-2xl bg-proc-green text-proc-bg font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,230,118,0.3)] hover:shadow-[0_0_40px_rgba(0,230,118,0.5)] hover:scale-105 transition-all text-base"
              >
                Testar 7 Dias Grátis
                <ArrowRight size={20} />
              </button>
              <button 
                onClick={onLogin}
                className="w-full px-8 py-4 rounded-2xl bg-proc-secondary/30 border border-white/10 text-white font-bold flex items-center justify-center gap-2 hover:bg-proc-secondary transition-all"
              >
                Já tenho conta (Login)
              </button>
            </div>
            <button 
              onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-proc-secondary/50 border border-white/10 text-white font-bold flex items-center justify-center gap-2 hover:bg-proc-secondary transition-all self-start sm:self-auto"
            >
              <Play size={18} className="fill-current" />
              Ver como funciona
            </button>
          </div>

          <p className="mt-4 text-xs text-proc-text-sec/80 flex items-center gap-2">
            <span className="text-proc-green font-bold">✓</span> Teste todas as funções no WhatsApp e Web durante 7 dias sem compromisso.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="relative hidden lg:block"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-proc-cyan/20 blur-[120px] rounded-full pointer-events-none" />
          <div className="relative z-10 flex items-center justify-center">
             <div className="w-full aspect-square max-w-md bg-gradient-to-br from-proc-cyan/20 to-proc-green/20 rounded-full border border-white/10 flex items-center justify-center animate-pulse">
                <div className="w-3/4 h-3/4 bg-proc-bg rounded-full border border-white/5 flex items-center justify-center">
                   <div className="w-1/2 h-1/2 bg-proc-cyan/10 rounded-full blur-xl" />
                </div>
             </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

