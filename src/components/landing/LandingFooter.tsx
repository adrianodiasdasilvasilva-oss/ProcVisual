import React from 'react';
import { Github, Twitter, Instagram, Linkedin, Heart } from 'lucide-react';
import Logo from '../Logo';

export default function LandingFooter() {
  const currentYear = new Date().getFullYear();

  const links = [
    { name: 'Termos', href: '#' },
    { name: 'Privacidade', href: '#' },
    { name: 'Suporte', href: '#' },
    { name: 'Blog', href: '#' },
  ];

  const social = [
    { icon: Twitter, href: '#' },
    { icon: Instagram, href: '#' },
    { icon: Linkedin, href: '#' },
    { icon: Github, href: '#' },
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
              {links.map((link) => (
                <a key={link.name} href={link.href} className="text-proc-text-sec text-sm hover:text-proc-cyan transition-colors">
                  {link.name}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="text-white font-bold text-sm uppercase tracking-widest">Social</h5>
              <div className="flex gap-4">
                {social.map((item, i) => (
                  <a key={i} href={item.href} className="w-10 h-10 rounded-xl bg-proc-secondary/50 border border-white/5 flex items-center justify-center text-proc-text-sec hover:text-white hover:border-white/10 transition-all">
                    <item.icon size={18} />
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
