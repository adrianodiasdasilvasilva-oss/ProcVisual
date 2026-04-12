import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Mail, Lock, ArrowRight, UserPlus, Loader2, User, Phone, ArrowLeft, CheckCircle } from 'lucide-react';
import Logo from './Logo';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

interface LoginScreenProps {
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailSignUp: (email: string, pass: string, name: string, phone: string) => Promise<void>;
  onBack?: () => void;
  initialIsSignUp?: boolean;
}

export default function LoginScreen({ onEmailLogin, onEmailSignUp, onBack, initialIsSignUp = false }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, digite seu e-mail para redefinir a senha.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError(null);
    } catch (err: any) {
      console.error('Reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Usuário não cadastrado');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Domínio não autorizado para redefinição. Entre em contato com o suporte em procvisual.dashboard@gmail.com.');
      } else {
        setError(`Erro ao enviar e-mail: ${err.message || 'Tente novamente.'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isSignUp && (!name || !phone)) return;

    setIsLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await onEmailSignUp(email, password, name, phone);
      } else {
        await onEmailLogin(email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Usuário não cadastrado');
      } else if (err.code === 'auth/wrong-password') {
        setError('Senha incorreta. Tente novamente.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else {
        setError('Ocorreu um erro ao acessar sua conta.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-proc-bg flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(0,209,255,0.05),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(0,230,118,0.05),transparent_50%)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-proc-secondary/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-[0_0_50px_rgba(0,209,255,0.1)] relative"
      >
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-8 left-8 text-proc-text-sec hover:text-white transition-colors flex items-center gap-2 group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-widest">Voltar</span>
          </button>
        )}

        <div className="text-center mb-8 pt-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex justify-center mb-4"
          >
            <Logo size="large" className="h-[70px]" />
          </motion.div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {isSignUp ? 'Criar nova conta' : 'Bem-vindo de volta'}
          </h2>
          <p className="text-proc-text-sec text-sm">
            {isSignUp 
              ? 'Preencha seus dados para começar.' 
              : 'Acesse sua conta para gerenciar suas finanças.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-proc-text-sec uppercase tracking-wider ml-1">
                  Nome Completo
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-proc-text-sec group-focus-within:text-proc-cyan transition-colors">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-proc-bg/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-proc-cyan/50 focus:ring-4 focus:ring-proc-cyan/10 transition-all"
                    required={isSignUp}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-proc-text-sec uppercase tracking-wider ml-1">
                  Telefone
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-proc-text-sec group-focus-within:text-proc-cyan transition-colors">
                    <Phone size={18} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-proc-bg/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-proc-cyan/50 focus:ring-4 focus:ring-proc-cyan/10 transition-all"
                    required={isSignUp}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-proc-text-sec uppercase tracking-wider ml-1">
              E-mail
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-proc-text-sec group-focus-within:text-proc-cyan transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setResetSent(false);
                }}
                placeholder="seu@email.com"
                className="w-full bg-proc-bg/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-proc-cyan/50 focus:ring-4 focus:ring-proc-cyan/10 transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-proc-text-sec uppercase tracking-wider ml-1">
              Senha
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-proc-text-sec group-focus-within:text-proc-cyan transition-colors">
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-proc-bg/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-proc-cyan/50 focus:ring-4 focus:ring-proc-cyan/10 transition-all"
                required={!resetSent}
              />
            </div>
            {!isSignUp && (
              <div className="flex justify-end px-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] font-bold text-proc-text-sec hover:text-proc-cyan uppercase tracking-widest transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-400 text-xs font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20"
              >
                {error}
              </motion.p>
            )}
            {resetSent && (
              <motion.div
                key="success"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-proc-green text-xs font-medium bg-proc-green/10 p-3 rounded-xl border border-proc-green/20 flex items-center gap-2"
              >
                <CheckCircle size={14} className="shrink-0" />
                <div>
                  <p>E-mail de redefinição enviado com sucesso!</p>
                  <p className="text-[10px] opacity-80 mt-0.5">Verifique sua caixa de spam</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full group relative flex items-center justify-center gap-3 py-4 rounded-2xl bg-proc-cyan text-proc-bg font-bold hover:bg-proc-cyan/90 transition-all duration-300 shadow-[0_0_20px_rgba(0,209,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {isSignUp ? 'Criar Conta' : 'Entrar'}
                {isSignUp ? <UserPlus size={18} /> : <ArrowRight size={18} />}
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setResetSent(false);
            }}
            className="text-sm text-proc-text-sec hover:text-proc-cyan transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Crie agora'}
          </button>
        </div>

      </motion.div>
    </div>
  );
}
