import { motion } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface LandingCTAProps {
  onStart: () => void;
}

export default function LandingCTA({ onStart }: LandingCTAProps) {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative z-10 bg-gradient-to-br from-proc-green/20 to-proc-cyan/20 border border-white/10 rounded-[3rem] p-12 md:p-20 text-center overflow-hidden shadow-2xl"
        >
          {/* Background Glow */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-proc-green/20 blur-[100px] rounded-full" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-proc-cyan/20 blur-[100px] rounded-full" />

          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-widest mb-8">
              <Sparkles size={14} className="text-proc-green" />
              Experimente agora
            </div>
            
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 leading-tight tracking-tight">
              Comece agora <br /> <span className="text-proc-green">gratuitamente</span>
            </h2>
            
            <p className="text-lg md:text-xl text-proc-text-sec mb-12 leading-relaxed">
              Junte-se a milhares de pessoas que já transformaram sua gestão financeira com a ProcVisual. Sem cartões, sem compromisso.
            </p>

            <button 
              onClick={onStart}
              className="px-12 py-5 rounded-2xl bg-white text-proc-bg font-bold text-lg flex items-center justify-center gap-3 mx-auto shadow-2xl hover:bg-proc-green hover:scale-105 transition-all group"
            >
              Criar minha conta
              <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
