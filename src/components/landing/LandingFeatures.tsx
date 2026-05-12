import React from 'react';
import { motion } from 'motion/react';
import { Camera, LayoutDashboard, Wallet, BarChart3, MessageCircle, Cake, Mic, Brain, Zap } from 'lucide-react';

export default function LandingFeatures() {
  const features = [
    {
      icon: Brain,
      title: 'Analista Financeiro IA',
      description: 'Converse com sua IA no WhatsApp. Pergunte sobre gastos, peça resumos ou dicas para economizar.',
      color: 'text-proc-cyan',
      bg: 'bg-proc-cyan/10',
      glow: 'shadow-[0_0_30px_rgba(0,209,255,0.15)]',
    },
    {
      icon: Zap,
      title: 'Recorrência Inteligente',
      description: 'Nossa IA identifica padrões e sugere automatizar lançamentos frequentes para você.',
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      glow: 'shadow-[0_0_30px_rgba(250,204,21,0.15)]',
    },
    {
      icon: Mic,
      title: 'Registro via WhatsApp',
      description: 'Envie áudios, textos ou fotos de comprovantes. Nossa IA processa tudo instantaneamente.',
      color: 'text-proc-cyan',
      bg: 'bg-proc-cyan/10',
      glow: 'shadow-[0_0_30px_rgba(0,209,255,0.15)]',
    },
    {
      icon: MessageCircle,
      title: 'Lembretes & Notificações',
      description: 'Receba alertas de vencimentos e lembretes de aniversários direto no WhatsApp.',
      color: 'text-[#25D366]',
      bg: 'bg-[#25D366]/10',
      glow: 'shadow-[0_0_30px_rgba(37,211,102,0.15)]',
    },
    {
      icon: LayoutDashboard,
      title: 'Dashboard Completo',
      description: 'Visualize sua saúde financeira em tempo real com gráficos modernos e intuitivos.',
      color: 'text-proc-cyan',
      bg: 'bg-proc-cyan/10',
      glow: 'shadow-[0_0_30px_rgba(0,209,255,0.15)]',
    },
  ];

  return (
    <section id="recursos" className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-[10px] font-bold text-proc-cyan uppercase tracking-[0.3em] mb-4">Diferenciais</h2>
          <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Gestão financeira <br /> <span className="text-proc-cyan">turbinada por IA</span>
          </h3>
          <p className="text-proc-text-sec text-lg max-w-2xl mx-auto">
            A ProcVisual combina inteligência artificial com a praticidade do WhatsApp para você nunca mais perder o controle do seu dinheiro.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className={`bg-proc-secondary/20 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group hover:bg-proc-secondary/40 transition-all ${feature.glow}`}
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center ${feature.color} mb-8 group-hover:scale-110 transition-transform`}>
                <feature.icon size={28} />
              </div>
              <h4 className="text-xl font-bold text-white mb-4 leading-tight group-hover:text-proc-cyan transition-colors">
                {feature.title}
              </h4>
              <p className="text-proc-text-sec text-sm leading-relaxed">
                {feature.description}
              </p>
              
              {/* Subtle background glow on hover */}
              <div className={`absolute -bottom-10 -right-10 w-32 h-32 blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity rounded-full ${feature.bg}`} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
