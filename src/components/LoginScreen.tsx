import React from 'react';
import { motion } from 'motion/react';
import { LogIn } from 'lucide-react';
import Logo from './Logo';

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <div className="min-h-screen bg-proc-bg flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(0,209,255,0.05),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(0,230,118,0.05),transparent_50%)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-proc-secondary/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-[0_0_50px_rgba(0,209,255,0.1)] text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <Logo size="large" className="h-[90px]" />
        </motion.div>

        <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo ao ProcVisual</h2>
        <p className="text-proc-text-sec text-sm mb-8">
          Acesse sua conta para gerenciar suas finanças com inteligência artificial.
        </p>

        <button 
          onClick={onLogin}
          className="w-full group relative flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-proc-bg font-bold hover:bg-proc-cyan hover:text-proc-bg transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(0,209,255,0.3)]"
        >
          <div className="w-8 h-8 rounded-lg bg-proc-bg/5 flex items-center justify-center group-hover:bg-proc-bg/10 transition-colors">
            <LogIn size={18} />
          </div>
          Entrar com Google
        </button>

        <div className="mt-8 pt-8 border-t border-white/5">
          <p className="text-[10px] text-proc-text-sec uppercase tracking-widest font-bold">
            Segurança de nível bancário
          </p>
          <div className="flex justify-center gap-4 mt-4 opacity-30 grayscale">
            <div className="w-8 h-8 rounded bg-white/10" />
            <div className="w-8 h-8 rounded bg-white/10" />
            <div className="w-8 h-8 rounded bg-white/10" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
