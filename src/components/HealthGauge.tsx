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

  const isCritical = percentage <= 0;

  return (
    <div className="relative bg-gradient-to-br from-proc-secondary/40 to-proc-bg p-6 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden mb-0">
      {/* Background Glow */}
      <div className={`absolute -top-20 -right-20 w-40 h-40 blur-[80px] rounded-full transition-colors duration-1000 ${
        percentage >= 80 ? 'bg-proc-green/10' :
        percentage >= 30 ? 'bg-proc-cyan/10' :
        'bg-red-500/10'
      }`} />
      
      <div className="flex flex-col items-center">
        <h2 className="text-[10px] font-bold text-proc-text-sec uppercase tracking-[0.2em] mb-6">Saúde Financeira</h2>
        
        <div className="relative w-48 h-24 overflow-hidden">
          <svg height="160" width="160" className="absolute left-1/2 -translate-x-1/2 top-0">
            {/* Background track */}
            <circle
              stroke="var(--proc-text-sec)"
              strokeOpacity="0.1"
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
              stroke={isCritical ? "transparent" : "url(#gaugeGradient)"}
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
                <stop offset="0%" stopColor={percentage >= 80 ? "#00E676" : "#00D1FF"} />
                <stop offset="100%" stopColor={percentage >= 80 ? "#00E676" : "#00D1FF"} />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Pointer */}
          <motion.div 
            className={`absolute bottom-0 left-1/2 w-1 h-16 origin-bottom rounded-full transition-colors duration-1000 ${isCritical ? 'bg-red-500' : 'bg-proc-text-main'}`}
            initial={{ rotate: -90 }}
            animate={{ rotate: -90 + (percentage * 1.8) }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ left: 'calc(50% - 2px)' }}
          >
            <div className={`w-3 h-3 rounded-full absolute -top-1 -left-1 transition-all duration-1000 ${
              isCritical ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-proc-text-main shadow-[0_0_10px_rgba(255,255,255,0.5)]'
            }`} />
          </motion.div>
        </div>

        <div className="mt-2 text-center">
          <motion.span 
            className="text-4xl font-bold text-proc-text-main block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {Math.round(percentage)}%
          </motion.span>
          <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
            percentage >= 80 ? 'text-proc-green bg-proc-green/10 glow-green' :
            percentage >= 50 ? 'text-proc-cyan bg-proc-cyan/10 glow-cyan' :
            percentage >= 30 ? 'text-yellow-400 bg-yellow-400/10 shadow-[0_0_10px_rgba(250,204,21,0.2)]' :
            'text-red-500 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
          }`}>
            {percentage >= 80 ? 'Excelente' :
             percentage >= 50 ? 'Boa' :
             percentage >= 30 ? 'Regular' :
             'Crítica'}
          </span>
        </div>
      </div>
    </div>
  );
}
