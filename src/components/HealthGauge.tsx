import { motion } from 'motion/react';

interface HealthGaugeProps {
  percentage: number;
}

export default function HealthGauge({ percentage }: HealthGaugeProps) {
  // Simple semicircular gauge using SVG
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative bg-gradient-to-br from-proc-secondary/40 to-proc-bg p-6 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden mb-0">
      {/* Background Glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-proc-green/10 blur-[80px] rounded-full" />
      
      <div className="flex flex-col items-center">
        <h2 className="text-[10px] font-bold text-proc-text-sec uppercase tracking-[0.2em] mb-6">Saúde Financeira</h2>
        
        <div className="relative w-48 h-24 overflow-hidden">
          <svg height="160" width="160" className="absolute left-1/2 -translate-x-1/2 top-0">
            {/* Background track */}
            <circle
              stroke="rgba(255,255,255,0.05)"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset: 0, transform: 'rotate(-180deg)', transformOrigin: '50% 50%' }}
              r={normalizedRadius}
              cx="80"
              cy="80"
            />
            {/* Progress track */}
            <motion.circle
              stroke="url(#gaugeGradient)"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
              style={{ transform: 'rotate(-180deg)', transformOrigin: '50% 50%' }}
              r={normalizedRadius}
              cx="80"
              cy="80"
            />
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00D1FF" />
                <stop offset="100%" stopColor="#00E676" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Pointer */}
          <motion.div 
            className="absolute bottom-0 left-1/2 w-1 h-16 bg-white origin-bottom rounded-full"
            initial={{ rotate: -90 }}
            animate={{ rotate: -90 + (percentage * 1.8) }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ left: 'calc(50% - 2px)' }}
          >
            <div className="w-3 h-3 bg-white rounded-full absolute -top-1 -left-1 shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
          </motion.div>
        </div>

        <div className="mt-2 text-center">
          <motion.span 
            className="text-4xl font-bold text-white block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {percentage}%
          </motion.span>
          <span className="text-[10px] text-proc-cyan font-bold glow-cyan px-3 py-1 bg-proc-cyan/10 rounded-full uppercase tracking-widest">Excelente</span>
        </div>
      </div>
    </div>
  );
}
