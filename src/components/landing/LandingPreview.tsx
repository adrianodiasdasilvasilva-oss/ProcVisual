import React from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';

export default function LandingPreview() {
  return (
    <section className="py-16 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-[10px] font-bold text-proc-cyan uppercase tracking-[0.3em] mb-4">Experiência</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
              Gestão que se <span className="text-proc-cyan">adapta a você</span>
            </h3>
            <p className="text-proc-text-sec text-lg max-w-2xl mx-auto">
              Esqueça planilhas complexas. Tenha o controle total das suas finanças e compromissos na palma da mão, com a simplicidade de uma conversa.
            </p>
          </motion.div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-proc-cyan/5 blur-[120px] rounded-full pointer-events-none" />
      </div>
    </section>
  );
}
