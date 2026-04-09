import React from 'react';
import { motion } from 'motion/react';
import { Play, ArrowRight } from 'lucide-react';

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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-proc-cyan/10 border border-proc-cyan/20 text-proc-cyan text-xs font-bold uppercase tracking-widest mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-proc-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-proc-cyan"></span>
            </span>
            Nova Versão 2.0 Disponível
          </div>
          
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
              Começar grátis
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

          <div className="mt-12 flex items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <img 
                  key={i}
                  src={`https://i.pravatar.cc/100?img=${i + 10}`} 
                  alt="User avatar" 
                  className="w-10 h-10 rounded-full border-2 border-proc-bg"
                />
              ))}
            </div>
            <p className="text-sm text-proc-text-sec">
              <span className="text-white font-bold">+2.000 usuários</span> já estão economizando hoje.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="relative"
        >
          {/* Mockup Frame */}
          <div className="relative z-10 bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-4 shadow-2xl backdrop-blur-sm">
            <div className="bg-proc-bg rounded-[1.5rem] overflow-hidden border border-white/5 shadow-inner aspect-[4/3]">
              <img 
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1000" 
                alt="Dashboard Preview" 
                className="w-full h-full object-cover opacity-80"
              />
              {/* Overlay UI elements */}
              <div className="absolute top-12 left-12 p-4 bg-proc-bg/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-proc-green/20 flex items-center justify-center text-proc-green">
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-xs text-proc-text-sec font-bold uppercase tracking-widest">Economia</span>
                </div>
                <p className="text-xl font-bold text-white">R$ 2.450,00</p>
              </div>
            </div>
          </div>

          {/* Floating elements */}
          <motion.div 
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-10 -right-10 p-6 bg-proc-secondary/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl z-20"
          >
            <div className="w-12 h-12 rounded-2xl bg-proc-cyan/20 flex items-center justify-center text-proc-cyan mb-4">
              <Camera size={24} />
            </div>
            <p className="text-sm font-bold text-white mb-1">OCR Ativo</p>
            <p className="text-[10px] text-proc-text-sec uppercase tracking-widest">Lendo comprovante...</p>
          </motion.div>

          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-proc-cyan/20 blur-[60px] rounded-full pointer-events-none" />
        </motion.div>
      </div>
    </section>
  );
}

import { TrendingUp, Camera } from 'lucide-react';
