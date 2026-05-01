import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, CreditCard, Loader2, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import Logo from './Logo';

interface SubscriptionPaywallProps {
  user: any;
  profile: any;
  onSignOut: () => void;
}

export default function SubscriptionPaywall({ user, profile, onSignOut }: SubscriptionPaywallProps) {
  const [isLoading, setIsLoading] = useState(false);

  const assinarPlano = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          phone: profile?.telefone || '',
          priceId: (import.meta as any).env.VITE_STRIPE_PRICE_ID || "SEU_PRICE_ID"
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Erro ${response.status}: Falha na requisição`);
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Erro ao criar sessão de checkout');
      }
    } catch (error: any) {
      console.error('Erro ao iniciar checkout:', error);
      const message = error.message === 'Rate exceeded.' 
        ? 'O servidor está temporariamente sobrecarregado. Por favor, aguarde alguns segundos e tente novamente.'
        : `Erro ao iniciar o processo de pagamento: ${error.message}`;
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  const [isVerifying, setIsVerifying] = useState(false);

  const verificarPagamento = async () => {
    setIsVerifying(true);
    try {
      console.log('>>> [PAYWALL] Verificando pagamento manualmente...');
      const response = await fetch(`/api/subscription-details?userId=${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        console.log('>>> [PAYWALL] Resultado da verificação:', data);
        if (data.status === 'active' || data.isActive) {
          // O onSnapshot no App.tsx deve capturar a mudança no Firestore e liberar o acesso
          // mas vamos recarregar para garantir
          setTimeout(() => window.location.reload(), 1000);
        } else {
          alert('Ainda não detectamos seu pagamento no Stripe. Se você acabou de pagar, aguarde 1 minuto e tente novamente.');
        }
      }
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const benefits = [
    { title: 'Controle Ilimitado', desc: 'Lance quantas despesas e receitas desejar sem restrições.' },
    { title: 'IA & OCR Avançado', desc: 'Leitura automática de comprovantes via foto ou PDF.' },
    { title: 'Alertas WhatsApp', desc: 'Receba lembretes de vencimento diretamente no seu celular.' },
    { title: 'Relatórios Detalhados', desc: 'Análises profundas da sua saúde financeira mensal.' },
  ];

  return (
    <div className="min-h-screen bg-proc-bg flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(0,209,255,0.05),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(0,230,118,0.05),transparent_50%)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-proc-secondary/30 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,209,255,0.1)]"
      >
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left Side: Info */}
          <div className="p-8 md:p-12 border-b md:border-b-0 md:border-r border-white/5">
            <div className="mb-8">
              <Logo size="medium" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
              Desbloqueie seu <span className="text-proc-cyan">Potencial Financeiro</span>
            </h2>
            
            <p className="text-proc-text-sec text-sm mb-8">
              Sua conta está quase pronta. Assine o plano Premium para liberar o acesso total ao seu Dashboard e todas as ferramentas de IA.
            </p>

            <div className="space-y-4">
              {benefits.map((b, i) => (
                <div key={i} className="flex gap-3">
                  <div className="shrink-0 w-5 h-5 rounded-full bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
                    <CheckCircle2 size={12} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{b.title}</p>
                    <p className="text-[10px] text-proc-text-sec">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Action */}
          <div className="p-8 md:p-12 bg-proc-bg/40 flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan mb-6">
              <Sparkles size={32} />
            </div>

            <div className="mb-8">
              <p className="text-[10px] font-bold text-proc-cyan uppercase tracking-widest mb-2">Plano Premium</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-white">R$ 29,90</span>
                <span className="text-proc-text-sec text-sm">/mês</span>
              </div>
              <p className="text-[10px] text-proc-text-sec mt-2 italic">Cancele a qualquer momento</p>
            </div>

            <button
              onClick={assinarPlano}
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-proc-cyan text-proc-bg font-bold flex items-center justify-center gap-3 hover:bg-proc-cyan/90 transition-all shadow-[0_0_20px_rgba(0,209,255,0.3)] disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Assinar Agora
                  <Zap size={18} />
                </>
              )}
            </button>

            <div className="mt-4 flex flex-col gap-2">
              <p className="text-[10px] text-proc-text-sec">
                Já realizou o pagamento? O acesso é liberado automaticamente em instantes.
              </p>
              <button 
                onClick={verificarPagamento}
                disabled={isVerifying}
                className="text-[10px] font-bold text-proc-cyan hover:underline uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="animate-spin" size={10} />
                    Verificando...
                  </>
                ) : 'Já paguei, atualizar agora'}
              </button>
            </div>

            <div className="mt-6 flex items-center gap-4 text-[10px] text-proc-text-sec">
              <div className="flex items-center gap-1">
                <ShieldCheck size={12} />
                <span>Pagamento Seguro</span>
              </div>
              <div className="flex items-center gap-1">
                <CreditCard size={12} />
                <span>Cartão de Crédito</span>
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="mt-8 text-[10px] font-bold text-proc-text-sec hover:text-white uppercase tracking-widest transition-colors"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
