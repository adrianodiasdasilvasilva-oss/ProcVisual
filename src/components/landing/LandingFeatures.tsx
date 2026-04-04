import React from 'react';
import { motion } from 'motion/react';
import { Camera, LayoutDashboard, Wallet, BarChart3 } from 'lucide-react';

export default function LandingFeatures() {
  const features = [
    {
      icon: Camera,
      title: 'Leitura automática de comprovantes',
      description: 'Envie uma foto e nossa IA extrai valor, data e estabelecimento instantaneamente.',
      color: 'text-proc-cyan',
      bg: 'bg-proc-cyan/10',
      glow: 'shadow-[0_0_30px_rgba(0,209,255,0.15)]',
    },
    {
      icon: LayoutDashboard,
      title: 'Dashboard inteligente',
      description: 'Visualize sua saúde financeira em tempo real com gráficos e indicadores modernos.',
      color: 'text-proc-green',
      bg: 'bg-proc-green/10',
      glow: 'shadow-[0_0_30px_rgba(0,230,118,0.15)]',
    },
    {
      icon: Wallet,
      title: 'Controle de receitas e despesas',
      description: 'Gerencie seu fluxo de caixa de forma simples e intuitiva, sem planilhas complexas.',
      color: 'text-proc-cyan',
      bg: 'bg-proc-cyan/10',
      glow: 'shadow-[0_0_30px_rgba(0,209,255,0.15)]',
    },
    {
      icon: BarChart3,
      title: 'Análises financeiras visuais',
      description: 'Entenda para onde seu dinheiro está indo com categorização automática inteligente.',
      color: 'text-proc-green',
      bg: 'bg-proc-green/10',
      glow: 'shadow-[0_0_30px_rgba(0,230,118,0.15)]',
    },
  ];

  return (
    <section id="recursos" className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-[10px] font-bold text-proc-cyan uppercase tracking-[0.3em] mb-4">Diferenciais</h2>
          <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Tudo o que você precisa para <br /> <span className="text-proc-cyan">dominar suas finanças</span>
          </h3>
          <p className="text-proc-text-sec text-lg max-w-2xl mx-auto">
            O ProcVisual combina tecnologia de ponta com design intuitivo para transformar sua relação com o dinheiro.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
