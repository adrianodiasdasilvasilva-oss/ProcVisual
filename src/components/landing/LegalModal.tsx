import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Lock, ShieldCheck, Info } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

export default function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  const content = {
    terms: {
      title: 'Termos de Uso',
      icon: FileText,
      emoji: '📄',
      sections: [
        {
          text: 'A ProcVisual é uma plataforma de gestão financeira pessoal desenvolvida para ajudar usuários a organizar suas finanças de forma simples e eficiente. Ao utilizar a plataforma, o usuário concorda com os seguintes termos:'
        },
        {
          items: [
            'O usuário é responsável pelas informações inseridas no sistema.',
            'A ProcVisual não se responsabiliza por decisões financeiras tomadas com base nos dados informados.',
            'O acesso à conta é pessoal e intransferível.',
            'O usuário compromete-se a não utilizar a plataforma para fins ilegais.',
            'A ProcVisual pode atualizar funcionalidades e estes termos a qualquer momento visando melhorias no serviço.',
            'Em caso de violação destes termos, o acesso poderá ser suspenso ou cancelado.'
          ]
        },
        {
          text: 'Ao continuar utilizando a ProcVisual, o usuário declara estar de acordo com estes termos.'
        }
      ]
    },
    privacy: {
      title: 'Privacidade',
      icon: Lock,
      emoji: '🔐',
      sections: [
        {
          text: 'A sua privacidade é prioridade na ProcVisual. Todos os dados inseridos são tratados com segurança e confidencialidade.'
        },
        {
          items: [
            'Os dados financeiros são armazenados de forma segura.',
            'A ProcVisual não vende, compartilha ou comercializa informações dos usuários.',
            'As informações são utilizadas apenas para funcionamento da plataforma.',
            'O usuário pode solicitar a exclusão da sua conta e dados a qualquer momento.',
            'Integrações externas (como serviços de pagamento ou envio de notificações) são utilizadas apenas quando necessário e de forma segura.',
            'Apenas o próprio usuário e pessoas autorizadas por ele (como membros da família) podem acessar os dados.'
          ]
        },
        {
          text: 'Nosso compromisso é garantir transparência, segurança e controle total das suas informações.'
        }
      ]
    }
  };

  const activeContent = content[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-proc-bg/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl max-h-[80vh] bg-proc-secondary border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-proc-secondary/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
                  <activeContent.icon size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    <span className="text-xl">{activeContent.emoji}</span> {activeContent.title}
                  </h3>
                  <p className="text-xs text-proc-text-sec uppercase tracking-widest font-bold">ProcVisual Legal</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 rounded-xl bg-white/5 text-proc-text-sec hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
              {activeContent.sections.map((section, idx) => (
                <div key={idx} className="space-y-4">
                  {section.text && (
                    <p className="text-proc-text-sec leading-relaxed">
                      {section.text}
                    </p>
                  )}
                  {section.items && (
                    <ul className="space-y-4">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-4 group">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-proc-cyan shrink-0 group-hover:shadow-[0_0_8px_#00D1FF] transition-shadow" />
                          <span className="text-proc-text-sec text-sm leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              <div className="pt-8 border-t border-white/5">
                <div className="p-4 rounded-2xl bg-proc-cyan/5 border border-proc-cyan/10 flex items-start gap-3">
                  <ShieldCheck size={18} className="text-proc-cyan shrink-0 mt-0.5" />
                  <p className="text-xs text-proc-text-sec leading-relaxed">
                    Sua segurança é nossa prioridade. Caso tenha dúvidas sobre nossos termos ou como tratamos seus dados, entre em contato através do nosso e-mail de suporte.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-proc-secondary/30 flex justify-end">
              <button 
                onClick={onClose}
                className="px-8 py-3 rounded-xl bg-proc-cyan text-proc-bg font-bold hover:shadow-[0_0_20px_rgba(0,209,255,0.3)] transition-all"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
