import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, MessageCircle, Info } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  icon: React.ReactNode;
  condition?: (data: any) => boolean;
}

interface InteractiveBalloonProps {
  userData: any;
  transactionsCount: number;
}

export default function InteractiveBalloon({ userData, transactionsCount }: InteractiveBalloonProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const messages: Message[] = [
    {
      id: 'welcome',
      text: transactionsCount === 0 ? 'Seja bem-vindo à ProcVisual!' : 'Bem-vindo de volta!',
      icon: <Sparkles className="text-proc-cyan" size={18} />,
    },
    {
      id: 'whatsapp',
      text: 'Cadastre suas despesas e receba alertas no Whatsapp!',
      icon: <MessageCircle className="text-proc-green" size={18} />,
    },
    {
      id: 'tip',
      text: 'Dica: Use categorias personalizadas para melhor organização.',
      icon: <Info className="text-proc-cyan" size={18} />,
    }
  ];

  useEffect(() => {
    // Show the first message after a short delay
    const initialTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(initialTimeout);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    // Change message or hide after 30 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Wait a bit before showing the next one
      setTimeout(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
        setIsVisible(true);
      }, 5000);
    }, 30000);

    return () => clearTimeout(timer);
  }, [isVisible, currentMessageIndex, messages.length]);

  const currentMessage = messages[currentMessageIndex];

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
