import React from 'react';
import { Instagram, Heart } from 'lucide-react';
import Logo from '../Logo';

interface LandingFooterProps {
  onOpenLegal: (type: 'terms' | 'privacy') => void;
}

export default function LandingFooter({ onOpenLegal }: LandingFooterProps) {
  const currentYear = new Date().getFullYear();

  const social = [
    { icon: Instagram, href: 'https://www.instagram.com/procvisual', label: '@procvisual' },
  ];

  return (
    <footer className="py-20 border-t border-white/5 bg-proc-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-12 mb-16">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Logo size="small" className="h-8" />
              <span className="text-xl font-bold text-white tracking-tighter">
                Proc<span className="text-proc-cyan">Visual</span>
              </span>
            </div>
            <p className="text-proc-text-sec text-sm max-w-xs leading-relaxed">
              Inteligência financeira para transformar sua relação com o dinheiro. Simples, visual e automático.
            </p>
          </div>

          <div className="flex flex-wrap gap-8 md:gap-16">
            <div className="flex flex-col gap-4">
              <h5 className="text-white font-bold text-sm uppercase tracking-widest">Produto</h5>
              <button 
                onClick={() => onOpenLegal('terms')}
                className="text-left text-proc-text-sec text-sm hover:text-proc-cyan transition-colors"
              >
                Termos
              </button>
              <button 
                onClick={() => onOpenLegal('privacy')}
                className="text-left text-proc-text-sec text-sm hover:text-proc-cyan transition-colors"
              >
                Privacidade
              </button>
              <a href="mailto:procvisual.dashboard@gmail.com" className="text-proc-text-sec text-sm hover:text-proc-cyan transition-colors">Suporte</a>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="text-white font-bold text-sm uppercase tracking-widest">Suporte</h5>
              <div className="text-proc-text-sec text-sm max-w-[240px] flex flex-col gap-3">
                <p className="leading-relaxed">
                  Para entrar em contato com a ProcVisual:
                </p>
                <div>
                  <span className="text-white font-medium block text-xs uppercase tracking-wider mb-1">E-mail</span>
                  <a href="mailto:procvisual.dashboard@gmail.com" className="text-proc-cyan font-medium hover:underline block break-all">
                    procvisual.dashboard@gmail.com
                  </a>
                </div>
                <div>
                  <span className="text-white font-medium block text-xs uppercase tracking-wider mb-1">WhatsApp</span>
                  <a href="https://wa.me/5519991312218" target="_blank" rel="noopener noreferrer" className="text-proc-cyan font-medium hover:underline block">
                    (19) 99131-2218
                  </a>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="text-white font-bold text-sm uppercase tracking-widest">Social</h5>
              <div className="flex gap-4">
                {social.map((item, i) => (
                  <a 
                    key={i} 
                    href={item.href} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2 rounded-xl bg-proc-secondary/50 border border-white/5 text-proc-text-sec hover:text-white hover:border-white/10 transition-all group"
                  >
                    <item.icon size={18} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-proc-text-sec text-xs">
            © {currentYear} ProcVisual. Todos os direitos reservados.
          </p>
          <p className="text-proc-text-sec text-xs flex items-center gap-1.5">
            Feito com <Heart size={12} className="text-red-500 fill-current" /> para sua liberdade financeira.
          </p>
        </div>
      </div>
    </footer>
  );
}
