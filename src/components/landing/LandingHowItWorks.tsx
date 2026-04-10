import React from 'react';
import { motion } from 'motion/react';
import { UserPlus, Camera, TrendingUp, ArrowRight } from 'lucide-react';

export default function LandingHowItWorks() {
  const steps = [
    {
      icon: UserPlus,
      title: 'Crie sua conta',
      description: 'Acesse instantaneamente com sua conta Google.',
      color: 'text-proc-cyan',
      bg: 'bg-proc-cyan/10',
    },
    {
      icon: Camera,
      title: 'Adicione lançamentos',
      description: 'Registre manualmente ou envie uma foto do seu comprovante.',
      color: 'text-proc-green',
      bg: 'bg-proc-green/10',
    },
    {
      icon: TrendingUp,
      title: 'Acompanhe sua saúde',
      description: 'Veja sua evolução financeira em tempo real com IA.',
      color: 'text-proc-cyan',
      bg: 'bg-proc-cyan/10',
    },
  ];

  return (
    <section id="como-funciona" className="py-32 bg-proc-secondary/10 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-24">
          <h2 className="text-[10px] font-bold text-proc-green uppercase tracking-[0.3em] mb-4">Processo</h2>
          <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Como a <span className="text-proc-green">ProcVisual</span> funciona
          </h3>
          <p className="text-proc-text-sec text-lg max-w-2xl mx-auto">
            Três passos simples para transformar sua gestão financeira pessoal.
          </p>
        </div>

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-12 md:gap-8">
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-proc-cyan/20 via-proc-green/20 to-proc-cyan/20 -translate-y-1/2 z-0" />

          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="relative z-10 flex flex-col items-center text-center max-w-[280px]"
            >
              <div className={`w-24 h-24 rounded-[2.5rem] ${step.bg} flex items-center justify-center ${step.color} mb-8 shadow-2xl border border-white/5 relative group`}>
                <div className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-proc-bg border border-white/10 flex items-center justify-center text-white font-bold shadow-xl">
                  {index + 1}
                </div>
                <step.icon size={40} className="group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="text-2xl font-bold text-white mb-4 leading-tight">
                {step.title}
              </h4>
              <p className="text-proc-text-sec text-sm leading-relaxed">
                {step.description}
              </p>
              
              {index < steps.length - 1 && (
                <div className="md:hidden mt-8 text-proc-text-sec/30">
                  <ArrowRight size={32} className="rotate-90" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
