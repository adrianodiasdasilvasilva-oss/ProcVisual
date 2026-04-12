import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  FileSpreadsheet, 
  Share2, 
  Filter, 
  Calendar, 
  ChevronDown, 
  Download, 
  MessageSquare,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Transaction } from '../App';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useEffect } from 'react';

interface ReportsTabProps {
  transactions: Transaction[];
  userName: string;
  selectedYears: string[];
  selectedMonths: string[];
}

type ReportType = 'complete' | 'income' | 'expense';
type SummaryType = 'short' | 'detailed' | 'numbers' | 'suggestions';

export default function ReportsTab({ transactions, userName, selectedYears, selectedMonths }: ReportsTabProps) {
  const [reportType, setReportType] = useState<ReportType>('complete');
  const [summaryType, setSummaryType] = useState<SummaryType>('detailed');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [includeSummaryInWA, setIncludeSummaryInWA] = useState(true);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    const getBase64ImageFromURL = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.setAttribute('crossOrigin', 'anonymous');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
        };
        img.onerror = error => reject(error);
        img.src = url;
      });
    };

    const loadLogo = async () => {
      try {
        const base64 = await getBase64ImageFromURL('https://i.imgur.com/mPPZOMY.png');
        setLogoBase64(base64);
      } catch (error) {
        console.error('Error loading logo for PDF:', error);
      }
    };
    loadLogo();
  }, []);

  // Filter transactions based on report type (income/expense/complete)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.tipo === 'birthday') return false;
      const inType = reportType === 'complete' || t.tipo === reportType;
      return inType;
    });
  }, [transactions, reportType]);

  // Calculate Summary Data
  const summaryData = useMemo(() => {
    const totalIncome = filteredTransactions.filter(t => t.tipo === 'income').reduce((acc, t) => acc + t.valor, 0);
    const totalExpense = filteredTransactions.filter(t => t.tipo === 'expense').reduce((acc, t) => acc + t.valor, 0);
    const balance = totalIncome - totalExpense;

    const categoryStats = filteredTransactions
      .filter(t => t.tipo === 'expense')
      .reduce((acc: any, t) => {
        acc[t.categoria] = (acc[t.categoria] || 0) + t.valor;
        return acc;
      }, {});

    const topCategory = Object.entries(categoryStats).sort((a: any, b: any) => b[1] - a[1])[0] || ['Nenhuma', 0];

    const dayStats = filteredTransactions
      .filter(t => t.tipo === 'expense')
      .reduce((acc: any, t) => {
        acc[t.data] = (acc[t.data] || 0) + t.valor;
        return acc;
      }, {});

    const topDay = Object.entries(dayStats).sort((a: any, b: any) => b[1] - a[1])[0] || ['', 0];

    return {
      totalIncome,
      totalExpense,
      balance,
      topCategory: topCategory[0],
      topCategoryValue: topCategory[1],
      topDay: topDay[0],
      topDayValue: topDay[1]
    };
  }, [filteredTransactions]);

  const getFormattedPeriod = () => {
    const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const monthMap: { [key: string]: number } = {
      'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3, 'Maio': 4, 'Junho': 5,
      'Julho': 6, 'Agosto': 7, 'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11
    };

    if (selectedMonths.length === 0 || selectedMonths.length === 12) {
      if (selectedYears.length === 1) return `ANO_${selectedYears[0]}`;
      return `VARIOS_ANOS`;
    }

    const sortedMonths = [...selectedMonths].sort((a, b) => monthMap[a] - monthMap[b]);
    const monthLabels = sortedMonths.map(m => monthNames[monthMap[m]]);
    
    let periodStr = monthLabels.join('_');
    if (selectedYears.length === 1) {
      periodStr += `_${selectedYears[0].slice(-2)}`;
    } else if (selectedYears.length > 1) {
      periodStr += `_MULT_ANOS`;
    }
    
    return periodStr;
  };

  const generateSummaryText = () => {
    const { totalIncome, totalExpense, balance, topCategory, topDay } = summaryData;
    
    let text = `*Resumo financeiro - ProcVisual*\n\n`;
    text += `Período: ${getFormattedPeriod()}\n\n`;
    text += `Receitas: R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    text += `Despesas: R$ ${totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    text += `Saldo: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;

    if (summaryType !== 'numbers') {
      text += `Maior gasto: ${topCategory}\n`;
      if (topDay) {
        text += `Dia mais caro: ${new Date(topDay + 'T12:00:00').toLocaleDateString('pt-BR')}\n\n`;
      }

      if (summaryType === 'suggestions') {
        if (topCategory !== 'Nenhuma') {
          text += `Sugestão: Analise seus gastos em "${topCategory}" para identificar possíveis economias.`;
        } else {
          text += `Sugestão: Continue mantendo o controle rigoroso dos seus lançamentos.`;
        }
      }
    }

    return text;
  };

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    setGenerationStep('Gerando relatório PDF...');
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(0, 209, 255); // Proc Cyan
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      if (logoBase64) {
        // Add Logo
        doc.addImage(logoBase64, 'PNG', 20, 10, 20, 20);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.text('ProcVisual', 45, 25);
      } else {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.text('ProcVisual', 20, 25);
      }
      
      doc.setFontSize(10);
      doc.text('Relatório Financeiro Pessoal', logoBase64 ? 45 : 20, 32);
      
      // User Info
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(12);
      doc.text(`Usuário: ${userName}`, 20, 55);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, 62);
      doc.text(`Período: ${getFormattedPeriod()}`, 20, 69);
      
      // Summary Box
      doc.setDrawColor(230, 230, 230);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(20, 80, pageWidth - 40, 45, 3, 3, 'FD');
      
      doc.setFontSize(14);
      doc.setTextColor(0, 209, 255);
      doc.text('Resumo do Período', 30, 92);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Receitas: R$ ${summaryData.totalIncome.toLocaleString('pt-BR')}`, 30, 102);
      doc.text(`Despesas: R$ ${summaryData.totalExpense.toLocaleString('pt-BR')}`, 30, 108);
      doc.text(`Saldo Final: R$ ${summaryData.balance.toLocaleString('pt-BR')}`, 30, 114);
      
      // Table
      const tableData = filteredTransactions.map(t => [
        new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        t.descricao || t.estabelecimento || 'Sem descrição',
        t.categoria,
        t.tipo === 'income' ? 'Receita' : 'Despesa',
        `R$ ${t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: 135,
        head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
        body: tableData,
        headStyles: { fillColor: [0, 209, 255], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Gerado pela ProcVisual - Inteligência Financeira', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }

      doc.save(`Relatorio_Financeiro_da_ProcVisual_${getFormattedPeriod()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleGenerateExcel = () => {
    setIsGenerating(true);
    setGenerationStep('Gerando planilha Excel...');
    
    try {
      const wb = XLSX.utils.book_new();
      
      // Prepare data in a structure similar to the PDF
      const reportData = [
        ['PROC-VISUAL - RELATÓRIO FINANCEIRO PESSOAL'],
        [''],
        ['INFORMAÇÕES DO RELATÓRIO'],
        ['Usuário:', userName],
        ['Data de Emissão:', new Date().toLocaleDateString('pt-BR')],
        ['Período:', getFormattedPeriod()],
        [''],
        ['RESUMO DO PERÍODO'],
        ['Receitas:', summaryData.totalIncome],
        ['Despesas:', summaryData.totalExpense],
        ['Saldo Final:', summaryData.balance],
        [''],
        ['DETALHAMENTO DE LANÇAMENTOS'],
        ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status'],
        ...filteredTransactions.map(t => [
          new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
          t.descricao || t.estabelecimento || 'Sem descrição',
          t.categoria,
          t.tipo === 'income' ? 'Receita' : 'Despesa',
          t.valor,
          t.pago ? 'Pago' : 'Pendente'
        ]),
        [''],
        ['Gerado pela ProcVisual - Inteligência Financeira']
      ];

      const ws = XLSX.utils.aoa_to_sheet(reportData);
      
      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 15 }, // Data / Labels
        { wch: 45 }, // Descrição / Values
        { wch: 20 }, // Categoria
        { wch: 12 }, // Tipo
        { wch: 15 }, // Valor
        { wch: 12 }  // Status
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Relatório Financeiro');

      XLSX.writeFile(wb, `Relatorio_da_ProcVisual_${getFormattedPeriod()}.xlsx`);
    } catch (error) {
      console.error('Error generating Excel:', error);
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleShareWhatsApp = () => {
    const summary = generateSummaryText();
    const message = encodeURIComponent(
      `Segue meu resumo financeiro:\n\n${summary}\n\nGerado pela ProcVisual`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-proc-text-main tracking-tight">Relatórios</h2>
        <p className="text-proc-text-sec text-sm mt-1">Exporte seus dados e compartilhe seus resultados.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Card 1: Filters */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-8 bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
              <Filter size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-proc-text-main">Filtros do Relatório</h3>
              <p className="text-xs text-proc-text-sec">Defina o que será incluído no documento</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest mb-3 block">Tipo de Lançamento</label>
                <div className="flex bg-proc-bg/50 p-1 rounded-2xl border border-white/5">
                  {(['complete', 'income', 'expense'] as ReportType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setReportType(t)}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${
                        reportType === t 
                          ? 'bg-proc-cyan text-proc-bg shadow-lg shadow-proc-cyan/20' 
                          : 'text-proc-text-sec hover:text-proc-text-main'
                      }`}
                    >
                      {t === 'complete' ? 'Completo' : t === 'income' ? 'Receitas' : 'Despesas'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-proc-text-sec mt-3 italic">
                O relatório será gerado com base nos filtros principais (Ano e Mês) selecionados no topo da página.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Card 2: Summary Options */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-4 bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-proc-green/10 flex items-center justify-center text-proc-green">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-proc-text-main">Resumo IA</h3>
              <p className="text-xs text-proc-text-sec">Personalize o texto automático</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-2">
              {(['short', 'detailed', 'numbers', 'suggestions'] as SummaryType[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSummaryType(s)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-xs font-bold transition-all border text-left ${
                    summaryType === s 
                      ? 'bg-proc-green/10 border-proc-green text-proc-green' 
                      : 'bg-proc-bg/50 border-white/5 text-proc-text-sec hover:border-white/20'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${summaryType === s ? 'bg-proc-green animate-pulse' : 'bg-proc-text-sec/30'}`} />
                  {s === 'short' ? 'Resumo Curto' : s === 'detailed' ? 'Resumo Detalhado' : s === 'numbers' ? 'Apenas Números' : 'Com Sugestões'}
                </button>
              ))}
            </div>

            <div className="pt-4 border-t border-white/5">
              <button 
                onClick={() => setIncludeSummaryInWA(!includeSummaryInWA)}
                className="flex items-center justify-between w-full group"
              >
                <span className="text-xs font-bold text-proc-text-sec group-hover:text-proc-text-main transition-colors">Incluir no WhatsApp</span>
                <div className={`w-10 h-5 rounded-full transition-all relative ${includeSummaryInWA ? 'bg-proc-green' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${includeSummaryInWA ? 'left-6' : 'left-1'}`} />
                </div>
              </button>
            </div>
          </div>
        </motion.section>

        {/* Card 3: Summary Preview */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-12 bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-proc-text-main">Prévia do Resumo</h3>
                <p className="text-xs text-proc-text-sec">Veja como ficará sua mensagem</p>
              </div>
            </div>
          </div>

          <div className="bg-proc-bg/50 border border-white/5 rounded-[2rem] p-8 relative group">
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Sparkles className="text-proc-cyan animate-pulse" size={20} />
            </div>
            <pre className="text-sm text-proc-text-main font-mono whitespace-pre-wrap leading-relaxed">
              {generateSummaryText()}
            </pre>
          </div>
        </motion.section>

        {/* Card 4: Actions */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-12"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleGeneratePDF}
              disabled={isGenerating}
              className="flex items-center justify-center gap-3 py-6 rounded-[2rem] bg-proc-cyan text-proc-bg font-bold uppercase tracking-widest hover:shadow-[0_0_30px_rgba(0,209,255,0.3)] transition-all disabled:opacity-50"
            >
              <FileText size={20} />
              Gerar PDF
            </button>
            <button
              onClick={handleGenerateExcel}
              disabled={isGenerating}
              className="flex items-center justify-center gap-3 py-6 rounded-[2rem] bg-proc-green text-proc-bg font-bold uppercase tracking-widest hover:shadow-[0_0_30px_rgba(0,230,118,0.3)] transition-all disabled:opacity-50"
            >
              <FileSpreadsheet size={20} />
              Gerar Excel
            </button>
            <button
              onClick={handleShareWhatsApp}
              disabled={isGenerating}
              className="flex items-center justify-center gap-3 py-6 rounded-[2rem] bg-[#25D366] text-white font-bold uppercase tracking-widest hover:shadow-[0_0_30px_rgba(37,211,102,0.3)] transition-all disabled:opacity-50"
            >
              <MessageSquare size={20} />
              Enviar WhatsApp
            </button>
          </div>
        </motion.section>
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-proc-bg/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <div className="w-24 h-24 rounded-full border-4 border-proc-cyan/20 border-t-proc-cyan animate-spin mx-auto mb-6" />
              <h3 className="text-xl font-bold text-proc-text-main mb-2 tracking-widest uppercase">{generationStep}</h3>
              <p className="text-proc-text-sec text-sm">Aguarde um momento enquanto processamos seus dados.</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
