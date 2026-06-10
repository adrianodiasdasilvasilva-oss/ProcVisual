import { DollarSign, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { Transaction } from '../App';

interface PendingBalanceCardProps {
  transactions: Transaction[];
}

export default function PendingBalanceCard({ transactions }: PendingBalanceCardProps) {
  // Filter for expense transactions (bills)
  const expenses = transactions.filter(t => t.tipo === 'expense');
  
  const totalExpenses = expenses.reduce((sum, t) => sum + t.valor, 0);
  const paidExpenses = expenses.filter(t => t.pago === true).reduce((sum, t) => sum + t.valor, 0);
  const pendingExpenses = expenses.filter(t => t.pago !== true).reduce((sum, t) => sum + t.valor, 0);
  
  const totalCount = expenses.length;
  const paidCount = expenses.filter(t => t.pago === true).length;
  const pendingCount = expenses.filter(t => t.pago !== true).length;
  
  const percentPaid = totalExpenses > 0 ? Math.round((paidExpenses / totalExpenses) * 100) : 0;

  // Let's format helper
  const formatCurrency = (val: number) => {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (totalCount === 0) {
    return null; // Return nothing if there are no expenses in the filtered period
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      id="pending-balance-summary-card"
      className="mb-8 p-6 bg-proc-bg/60 border border-proc-border rounded-3xl shadow-xl transition-all hover:border-proc-cyan/30"
    >
      <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
        
        {/* Left Side: Pending Alert and Amount */}
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className={`p-4 rounded-2xl bg-amber-500/10 text-amber-500 shrink-0 ${pendingExpenses > 0 ? 'animate-pulse' : ''}`} id="pending-icon-container">
            {pendingExpenses > 0 ? <Clock size={28} /> : <CheckCircle2 size={28} className="text-proc-green" />}
          </div>
          <div>
            <span className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest block mb-0.5" id="label-pending">
              Contas a Pagar (Falta Pagar)
            </span>
            <h4 className={`text-2xl md:text-3xl font-extrabold tracking-tight ${pendingExpenses > 0 ? 'text-amber-500' : 'text-proc-green'}`} id="value-pending">
              {formatCurrency(pendingExpenses)}
            </h4>
            <p className="text-xs text-proc-text-sec font-medium mt-1" id="count-pending">
              {pendingCount} de {totalCount} {totalCount === 1 ? 'conta pendente' : 'contas pendentes'}
            </p>
          </div>
        </div>

        {/* Center: Dynamic Interactive Progress Bar */}
        <div className="w-full lg:flex-1 max-w-md" id="progress-bar-container">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-proc-text-sec" id="progress-label">Progresso de Quitação</span>
            <span className="text-xs font-bold text-proc-cyan" id="progress-percentage">{percentPaid}% Pago</span>
          </div>
          
          <div className="w-full h-3.5 bg-proc-secondary/50 rounded-full overflow-hidden border border-proc-border p-[2px]" id="outer-progress">
            <motion.div 
              className="h-full bg-linear-to-r from-proc-cyan via-proc-green to-proc-green rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${percentPaid}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              id="inner-progress"
            />
          </div>
          
          <p className="text-[10px] text-proc-text-sec mt-1.5 text-right font-medium" id="progress-helper">
            {formatCurrency(paidExpenses)} pagos de {formatCurrency(totalExpenses)} total
          </p>
        </div>

        {/* Right Side: Total vs Paid Quick Metrics */}
        <div className="grid grid-cols-2 gap-4 w-full lg:w-auto shrink-0 border-t lg:border-t-0 lg:border-l border-proc-border pt-4 lg:pt-0 lg:pl-6" id="quick-metrics">
          <div className="px-4 py-3 bg-proc-secondary/30 rounded-2xl border border-proc-border" id="metric-total">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-proc-text-sec uppercase tracking-widest mb-1">
              <Wallet size={12} className="text-proc-cyan" />
              Total Despesas
            </div>
            <p className="text-sm font-bold text-proc-text-main">{formatCurrency(totalExpenses)}</p>
            <p className="text-[9px] text-proc-text-sec mt-0.5">{totalCount} {totalCount === 1 ? 'lançamento' : 'lançamentos'}</p>
          </div>
          
          <div className="px-4 py-3 bg-proc-secondary/30 rounded-2xl border border-proc-border" id="metric-paid">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-proc-text-sec uppercase tracking-widest mb-1">
              <CheckCircle2 size={12} className="text-proc-green" />
              Total Quitado
            </div>
            <p className="text-sm font-bold text-proc-green">{formatCurrency(paidExpenses)}</p>
            <p className="text-[9px] text-proc-text-sec mt-0.5">{paidCount} pagos</p>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
