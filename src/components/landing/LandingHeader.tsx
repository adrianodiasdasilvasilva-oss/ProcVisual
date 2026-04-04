import React from 'react';
import { motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import Logo from '../Logo';

interface LandingHeaderProps {
  onLogin: () => void;
}

export default function LandingHeader({ onLogin }: LandingHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const navLinks = [
    { name: 'Recursos', href: '#recursos' },
    { name: 'Como Funciona', href: '#como-funciona' },
    { name: 'Preços', href: '#precos' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-proc-bg/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size="medium" />
          <span className="text-xl font-bold text-white tracking-tighter">
            Proc<span className="text-proc-cyan">Visual</span>
          </span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-proc-text-sec hover:text-proc-cyan transition-colors"
            >
              {link.name}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <button 
            onClick={onLogin}
            className="px-6 py-2.5 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
          >
            Login
          </button>
          <button 
            onClick={onLogin}
            className="px-6 py-2.5 rounded-xl bg-proc-green text-proc-bg font-bold shadow-[0_0_20px_rgba(0,230,118,0.3)] hover:shadow-[0_0_30px_rgba(0,230,118,0.5)] transition-all"
          >
            Começar Grátis
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden p-2 text-white"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-proc-bg border-b border-white/5 p-6 flex flex-col gap-6"
        >
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className="text-lg font-medium text-proc-text-sec"
            >
              {link.name}
            </a>
          ))}
          <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
            <button 
              onClick={() => { onLogin(); setIsMenuOpen(false); }}
              className="w-full py-4 rounded-xl border border-white/10 text-white font-bold"
            >
              Login
            </button>
            <button 
              onClick={() => { onLogin(); setIsMenuOpen(false); }}
              className="w-full py-4 rounded-xl bg-proc-green text-proc-bg font-bold"
            >
              Começar Grátis
            </button>
          </div>
        </motion.div>
      )}
    </header>
  );
}
