import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Transaction } from '../App';

interface MainChartProps {
  transactions: Transaction[];
  month: string;
  year: string;
}

export default function MainChart({ transactions, month, year }: MainChartProps) {
  // Group expenses by category
  const expensesByCategory = transactions
    .filter(t => t.tipo === 'expense')
    .reduce((acc, curr) => {
      acc[curr.categoria] = (acc[curr.categoria] || 0) + curr.valor;
      return acc;
    }, {} as Record<string, number>);

  const totalExpense = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);

  const data = Object.entries(expensesByCategory)
    .map(([name, value]) => ({
      name,
      value,
      percent: totalExpense > 0 ? Math.round((value / totalExpense) * 100) : 0
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6); // Top 6 categories

  if (data.length === 0) {
    return (
      <div className="bg-proc-secondary/20 p-8 rounded-[2rem] border border-proc-border mb-6 text-center">
        <p className="text-proc-text-sec text-sm">Nenhuma despesa registrada para exibir no gráfico.</p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-[2rem] border border-proc-border mb-6 bg-proc-secondary/10">
      <div className="flex justify-between items-end mb-6">
        <h3 className="text-sm font-bold text-proc-text-sec uppercase tracking-widest">Despesas por Categoria</h3>
        <span className="text-xs font-bold text-proc-cyan">{month} {year}</span>
      </div>
      
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            layout="vertical"
            margin={{ top: 5, right: 45, left: 10, bottom: 5 }}
          >
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00D1FF" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#00E676" stopOpacity={1} />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <XAxis type="number" hide domain={[0, 'dataMax + 200']} />
            <YAxis 
              dataKey="name" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--proc-text-main)', fontSize: 12, fontWeight: 700 }} 
              width={110}
              interval={0}
            />
            <Tooltip 
              cursor={{ fill: 'var(--proc-text-sec)', opacity: 0.05 }}
              contentStyle={{ 
                backgroundColor: 'var(--proc-secondary)', 
                border: '1px solid var(--proc-border)',
                borderRadius: '16px',
                fontSize: '12px',
                color: 'var(--proc-text-main)',
                fontWeight: 'bold'
              }}
              itemStyle={{ color: 'var(--proc-text-main)' }}
              formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
            />
            <Bar 
              dataKey="value" 
              radius={[0, 6, 6, 0]}
              filter="url(#glow)"
              barSize={16}
            >
              <LabelList 
                dataKey="percent" 
                position="right" 
                formatter={(val: number) => `${val}%`}
                style={{ fill: 'var(--proc-cyan)', fontSize: 11, fontWeight: 'bold' }}
                offset={12}
              />
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="url(#barGradient)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
