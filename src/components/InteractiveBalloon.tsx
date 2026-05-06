import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, MessageCircle, Info, Cake, Mic } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  icon: React.ReactNode;
  condition?: () => boolean;
}

interface InteractiveBalloonProps {
  userData: any;
  transactions: any[];
}

export default function InteractiveBalloon({ userData, transactions }: InteractiveBalloonProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const hasBirthdays = transactions.some(t => t.tipo === 'birthday');
  const hasWhatsAppUsage = transactions.some(t => t.origem?.includes('whatsapp'));
  
  const currentMonthTransactions = transactions.filter(t => {
    const date = new Date(t.data + 'T12:00:00');
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  const totalExpenses = currentMonthTransactions.filter(t => t.tipo === 'expense').reduce((acc, t) => acc + (t.valor || 0), 0);
  const totalIncome = currentMonthTransactions.filter(t => t.tipo === 'income').reduce((acc, t) => acc + (t.valor || 0), 0);
  const unpaidExpenses = transactions.filter(t => t.tipo === 'expense' && !t.pago);
  const hasHighExpenses = totalExpenses > totalIncome * 0.8 && totalIncome > 0;

  const nextUpcomingBill = [...transactions]
    .filter(t => t.tipo === 'expense' && !t.pago)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())[0];

  const messages: Message[] = [
    {
      id: 'welcome',
      text: transactions.length === 0 ? 'Seja bem-vindo à ProcVisual!' : 'Bem-vindo de volta! Como estão suas finanças hoje?',
      icon: <Sparkles className="text-proc-cyan" size={18} />,
    },
    {
      id: 'unpaid_count',
      text: `Você tem ${unpaidExpenses.length} contas pendentes de pagamento. Não deixe acumular!`,
      icon: <Info className="text-amber-500" size={18} />,
      condition: () => unpaidExpenses.length > 0,
    },
    {
      id: 'next_bill',
      text: nextUpcomingBill ? `Lembrete: Sua próxima conta "${nextUpcomingBill.descricao || nextUpcomingBill.estabelecimento}" vence em breve.` : '',
      icon: <Info className="text-proc-cyan" size={18} />,
      condition: () => nextUpcomingBill !== undefined,
    },
    {
      id: 'whatsapp',
      text: 'Cadastre suas despesas e receba alertas no Whatsapp!',
      icon: <MessageCircle className="text-proc-green" size={18} />,
      condition: () => !hasWhatsAppUsage,
    },
    {
      id: 'birthday_info',
      text: 'Dica: Cadastre aniversários para receber alertas automáticos e nunca esquecer ninguém.',
      icon: <Cake className="text-pink-500" size={18} />,
      condition: () => !hasBirthdays,
    },
    {
      id: 'whatsapp_features',
      text: 'Sabia que você pode lançar despesas por áudio no WhatsApp? Economize tempo!',
      icon: <Mic className="text-proc-green" size={18} />,
      condition: () => !hasWhatsAppUsage,
    },
    {
      id: 'expense_alert',
      text: 'Alerta: Seus gastos este mês já representam 80% da sua receita.',
      icon: <Info className="text-red-500" size={18} />,
      condition: () => hasHighExpenses,
    },
    {
      id: 'savings_tip',
      text: 'Parabéns! Sua receita está superando seus gastos este mês. Ótimo trabalho!',
      icon: <Sparkles className="text-proc-green" size={18} />,
      condition: () => totalIncome > totalExpenses && transactions.length > 5 && !hasHighExpenses,
    }
  ].filter(m => m.text && (!m.condition || m.condition()));

  useEffect(() => {
    // Show the first message after a short delay
    const initialTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(initialTimeout);
  }, []);

  useEffect(() => {
    if (!isVisible || messages.length === 0) return;

    // Change message or hide after 20 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Wait a bit before showing the next one
      setTimeout(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
        setIsVisible(true);
      }, 5000);
    }, 20000);

    return () => clearTimeout(timer);
  }, [isVisible, currentMessageIndex, messages.length]);

  const currentMessage = messages[currentMessageIndex] || messages[0];

  if (!currentMessage) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.8, x: 20 }}
          animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
          exit={{ opacity: 0, y: 20, scale: 0.8, x: 20 }}
          className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-[100] max-w-[280px] md:max-w-xs"
        >
          <div className="relative bg-proc-secondary/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-proc-cyan/20 blur-[40px] rounded-full group-hover:bg-proc-cyan/30 transition-colors" />
            
            <div className="flex gap-4 relative z-10">
              <div className="shrink-0 w-10 h-10 rounded-2xl bg-proc-bg/50 flex items-center justify-center border border-white/10">
                {currentMessage.icon}
              </div>
              
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-bold text-proc-cyan uppercase tracking-widest">ProcVisual Assist</p>
                <p className="text-xs text-proc-text-main leading-relaxed font-medium">
                  {currentMessage.text}
                </p>
              </div>

              <button 
                onClick={() => setIsVisible(false)}
                className="shrink-0 p-1 text-proc-text-sec hover:text-proc-text-main transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Progress Bar */}
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 30, ease: "linear" }}
              className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-proc-cyan to-proc-green opacity-50"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
