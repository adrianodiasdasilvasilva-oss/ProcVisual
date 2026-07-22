import React from 'react';
import { motion } from 'motion/react';
import { Check, Zap } from 'lucide-react';

interface LandingPricingProps {
  onSignUp: () => void;
}

export default function LandingPricing({ onSignUp }: LandingPricingProps) {
  return (
    <section id="precos" className="py-24 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-proc-green/10 blur-[120px] rounded-full -z-10" />

      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold tracking-tighter mb-4"
          >
            Preço Transparente — <span className="text-proc-green">Com 7 Dias Grátis</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-proc-text-sec text-lg max-w-2xl mx-auto"
          >
            Aproveite 7 dias de teste gratuito com acesso total a todas as ferramentas. Só pague R$ 29,90/mês se aprovar!
          </motion.p>
        </div>

        <div className="max-w-md mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative p-8 rounded-[2.5rem] bg-proc-secondary/20 border border-amber-500/30 backdrop-blur-xl shadow-[0_0_50px_rgba(245,158,11,0.1)]"
          >
            {/* Promotion Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-amber-500 to-red-500 text-white text-[10px] sm:text-xs font-black rounded-full uppercase tracking-widest shadow-[0_0_25px_rgba(245,158,11,0.5)] whitespace-nowrap flex items-center gap-1.5 animate-pulse">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              Tempo Determinado
            </div>

            <div className="text-center mb-8">
              <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
                🔥 Promoção Especial de Lançamento
              </p>
              
              <div className="flex items-center justify-center gap-1 text-proc-text-sec text-sm mb-1">
                <span>De</span>
                <span className="line-through decoration-red-500/80 decoration-2 font-medium">R$ 49,90</span>
                <span>por apenas:</span>
              </div>

              <div className="flex items-center justify-center gap-1 mb-2">
                <span className="text-2xl font-bold text-proc-text-sec">R$</span>
                <span className="text-6xl font-black text-white tracking-tighter">29,90</span>
                <span className="text-proc-text-sec font-medium">/mês</span>
              </div>
              
              <div className="mt-3 p-3 bg-gradient-to-r from-proc-cyan/10 to-proc-green/10 border border-proc-cyan/30 rounded-xl text-left">
                <p className="text-proc-cyan text-xs font-bold flex items-center gap-1.5 mb-1">
                  🎁 7 Dias de Teste Grátis Inclusos
                </p>
                <p className="text-proc-text-sec text-[11px] leading-tight">
                  Cadastre-se agora e use todas as funções no WhatsApp e Web gratuitamente por 7 dias sem compromisso.
                </p>
              </div>
              
              <p className="text-proc-text-sec text-xs mt-3">Acesso total e ilimitado durante e após o teste</p>
            </div>

            <ul className="space-y-4 mb-8">
              {[
                '🎁 7 Dias Grátis com Acesso Total',
                'Lançamentos ilimitados via WhatsApp',
                'Processamento de Áudio e Fotos com IA',
                'Analista Pessoal Financeiro via Chat IA',
                'Gráficos e Análises Avançadas',
                'Calendário Financeiro Interativo',
                'Notificações e Lembretes de Vencimento'
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-proc-text-main">
                  <div className="w-5 h-5 rounded-full bg-proc-green/20 flex items-center justify-center text-proc-green shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-medium">{feature}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={onSignUp}
              className="w-full py-4 rounded-2xl bg-proc-green text-proc-bg font-bold text-lg shadow-[0_0_30px_rgba(0,230,118,0.3)] hover:shadow-[0_0_50px_rgba(0,230,118,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Zap size={20} fill="currentColor" />
              Começar Meu Teste Grátis de 7 Dias
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
