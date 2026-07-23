import React from 'react';
import { motion } from 'motion/react';
import { UserPlus, MessageSquare, Brain, Bell, ArrowRight, Mic, Camera, Cake } from 'lucide-react';

export default function LandingHowItWorks() {
  const steps = [
    {
      icon: UserPlus,
      title: 'Acesso Rápido',
      subtitle: 'Comece em segundos',
      description: 'Crie sua conta instantaneamente usando seu e-mail de preferência. Sem formulários extensos ou processos complicados para começar.',
      color: 'text-proc-cyan',
      bg: 'bg-proc-cyan/10',
    },
    {
      icon: MessageSquare,
      title: 'Registro Inteligente',
      subtitle: 'Via WhatsApp ou Web',
      description: 'Envie um áudio, uma foto do comprovante ou apenas um texto no WhatsApp. Nossa IA entende tudo e organiza para você. Ou adicione suas despesas pelo próprio dashboard.',
      color: 'text-proc-green',
      bg: 'bg-proc-green/10',
    },
    {
      icon: Brain,
      title: 'Processamento IA',
      subtitle: 'Categorização Automática',
      description: 'O sistema identifica o valor, a data e a categoria da despesa sozinho. Ele aprende com seus hábitos para ser cada vez mais preciso.',
      color: 'text-proc-cyan',
      bg: 'bg-proc-cyan/10',
    },
    {
      icon: Bell,
      title: 'Gestão Proativa',
      subtitle: 'Lembretes e Alertas',
      description: 'Receba avisos de contas a vencer e notificações de aniversários. O ProcVisual cuida dos prazos para você focar no que importa.',
      color: 'text-proc-green',
      bg: 'bg-proc-green/10',
    },
  ];

  return (
    <section id="como-funciona" className="py-32 bg-proc-secondary/5 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[10px] font-bold text-proc-green uppercase tracking-[0.3em] mb-4"
          >
            Fluxo de Trabalho
          </motion.h2>
          <motion.h3 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight"
          >
            Sua jornada para um <br /> <span className="text-proc-green">melhor controle financeiro</span>
          </motion.h3>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-proc-text-sec text-lg max-w-2xl mx-auto"
          >
            Entenda como a tecnologia da ProcVisual simplifica cada etapa do seu controle financeiro e pessoal.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-12 left-24 right-24 h-0.5 bg-gradient-to-r from-proc-cyan/20 via-proc-green/20 to-proc-cyan/20 z-0" />

          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative z-10 flex flex-col items-center lg:items-start text-center lg:text-left"
            >
              <div className={`w-24 h-24 rounded-[2.5rem] ${step.bg} flex items-center justify-center ${step.color} mb-8 shadow-2xl border border-white/5 relative group hover:scale-105 transition-transform duration-500`}>
                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-2xl bg-proc-bg border border-white/10 flex items-center justify-center text-white text-sm font-bold shadow-xl z-20">
                  {index + 1}
                </div>
                <step.icon size={40} className="group-hover:rotate-12 transition-transform duration-500" />
                
                {/* Decorative icons for step 2 */}
                {index === 1 && (
                  <>
                    <Mic size={14} className="absolute bottom-4 right-4 opacity-40" />
                    <Camera size={14} className="absolute top-4 left-4 opacity-40" />
                  </>
                )}
                {/* Decorative icon for step 4 */}
                {index === 3 && (
                  <Cake size={14} className="absolute bottom-4 right-4 opacity-40" />
                )}
              </div>

              <div className="space-y-2">
                <p className={`text-[10px] font-bold uppercase tracking-widest ${step.color}`}>
                  {step.subtitle}
                </p>
                <h4 className="text-2xl font-bold text-white leading-tight">
                  {step.title}
                </h4>
                <p className="text-proc-text-sec text-sm leading-relaxed pt-2">
                  {step.description}
                </p>
              </div>
              
              {index < steps.length - 1 && (
                <div className="lg:hidden mt-8 text-proc-text-sec/20">
                  <ArrowRight size={32} className="rotate-90" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA or Info */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-24 p-8 rounded-[2.5rem] bg-proc-secondary/20 border border-white/5 text-center max-w-3xl mx-auto"
        >
          <p className="text-proc-text-sec text-sm italic">
            "A inteligência artificial da ProcVisual não apenas registra, ela entende o contexto das suas finanças para te dar insights reais sobre economia."
          </p>
        </motion.div>
      </div>
    </section>
  );
}
