import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createWorker } from 'tesseract.js';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Transaction } from '../App';
import { 
  X, 
  Edit3, 
  Camera, 
  Image as ImageIcon, 
  Upload, 
  Save, 
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Scan,
  Store,
  Calendar,
  DollarSign,
  Tag
} from 'lucide-react';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionToEdit?: Transaction | null;
}

type ModalView = 'selection' | 'manual' | 'receipt' | 'processing' | 'success';

export default function NewTransactionModal({ isOpen, onClose, transactionToEdit }: NewTransactionModalProps) {
  const [view, setView] = useState<ModalView>('selection');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [notificationStatus, setNotificationStatus] = useState<{success: boolean, message?: string} | null>(null);

  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [userCustomCategories, setUserCustomCategories] = useState<string[]>([]);

  const predefinedCategories = [
    'Outros',
    'Alimentação',
    'Moradia',
    'Transporte',
    'Lazer',
    'Saúde',
    'Educação'
  ];

  // Form states
  const [formData, setFormData] = useState({
    type: 'expense',
    value: '',
    category: 'Outros',
    date: new Date().toISOString().split('T')[0],
    description: '',
    establishment: ''
  });

  const [userPhone, setUserPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser || !isOpen) return;

    const userRef = doc(db, 'usuarios', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserPhone(doc.data().telefone || null);
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (!auth.currentUser || !isOpen) return;

    const categoriesRef = collection(db, 'categorias');
    const q = query(categoriesRef, where('userId', '==', auth.currentUser.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => doc.data().nome as string);
      setUserCustomCategories(cats);
    });

    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && transactionToEdit) {
      setView('manual');
      const isPredefined = predefinedCategories.includes(transactionToEdit.categoria);
      setIsCustomCategory(!isPredefined);
      setCustomCategory(!isPredefined ? transactionToEdit.categoria : '');
      setFormData({
        type: (transactionToEdit.tipo as string) === 'despesa' ? 'expense' : ((transactionToEdit.tipo as string) === 'receita' ? 'income' : transactionToEdit.tipo),
        value: transactionToEdit.valor.toString(),
        category: isPredefined ? transactionToEdit.categoria : 'Personalizada',
        date: transactionToEdit.data,
        description: transactionToEdit.descricao,
        establishment: transactionToEdit.estabelecimento
      });
    } else if (isOpen && !transactionToEdit) {
      resetModal();
    }
  }, [isOpen, transactionToEdit]);

  const resetModal = () => {
    setView('selection');
    setImagePreview(null);
    setOcrProgress(0);
    setIsOcrRunning(false);
    setIsSaving(false);
    setErrorMessage(null);
    setNotificationStatus(null);
    setIsCustomCategory(false);
    setCustomCategory('');
    setFormData({
      type: 'expense',
      value: '',
      category: 'Outros',
      date: new Date().toISOString().split('T')[0],
      description: '',
      establishment: ''
    });
  };

  const handleClose = () => {
    onClose();
    setTimeout(resetModal, 300);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processReceipt = async () => {
    if (!imagePreview) {
      console.warn('Processamento cancelado: nenhuma imagem selecionada');
      return;
    }
    
    setView('processing');
    setIsOcrRunning(true);
    setOcrProgress(10);
    setErrorMessage(null);

    try {
      console.log('Iniciando OCR Local com Tesseract.js...');
      setOcrProgress(20);
      
      // Criar o worker do Tesseract
      const worker = await createWorker('por'); // 'por' para Português
      setOcrProgress(40);
      
      // Realizar o reconhecimento
      const { data: { text } } = await worker.recognize(imagePreview);
      setOcrProgress(70);
      
      console.log('Texto extraído pelo OCR Local:', text);
      
      // Lógica inteligente para extrair dados do texto bruto
      const extractedData = parseReceiptText(text);
      
      await worker.terminate();
      setOcrProgress(90);

      setIsCustomCategory(false);
      setCustomCategory('');

      setFormData({
        ...formData,
        type: extractedData.tipo === 'receita' ? 'income' : 'expense',
        value: extractedData.valor?.toString() || '',
        date: extractedData.data || new Date().toISOString().split('T')[0],
        establishment: extractedData.estabelecimento || '',
        category: extractedData.categoria || 'Outros',
        description: extractedData.descricao || extractedData.estabelecimento || ''
      });

      setOcrProgress(100);
      
      setTimeout(() => {
        setView('manual');
        setIsOcrRunning(false);
      }, 500);

    } catch (error: any) {
      console.error('Erro no OCR Local:', error);
      setErrorMessage('Não foi possível ler o comprovante automaticamente. Por favor, insira os dados manualmente.');
      setIsOcrRunning(false);
      setView('manual');
    }
  };

  // Função auxiliar para processar o texto do comprovante sem IA externa
  const parseReceiptText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let valor: number | null = null;
    let data = '';
    let estabelecimento = '';
    
    console.log('Linhas detectadas para análise:', lines);

    const textoLimpo = text.toUpperCase();

    // 1. Tentar encontrar o ESTABELECIMENTO
    // Detecção específica para Lojas Cem
    if (textoLimpo.includes('LOJAS CEM') || 
        textoLimpo.includes('VOCÊ REALIZANDO SONHOS') || 
        textoLimpo.includes('VOCE REALIZANDO SONHOS') ||
        textoLimpo.includes('S A AÇO') ||
        textoLimpo.includes('RESOO TESS') ||
        (textoLimpo.includes('CEM') && (textoLimpo.includes('PRESTAÇÃO') || textoLimpo.includes('CONTRATO')))) {
      estabelecimento = 'Lojas Cem';
    } else if (textoLimpo.includes('CAVICCHIOLLI') || 
               textoLimpo.includes('CAVICCHIOLI') ||
               textoLimpo.includes('SUPERMERCADO') ||
               textoLimpo.includes('MERCADO') ||
               textoLimpo.includes('HORTIFRUTI') ||
               textoLimpo.includes('ATACADO')) {
      // Tenta pegar o nome completo se encontrar a palavra supermercado ou similar
      const linhaSuper = lines.find(l => {
        const u = l.toUpperCase();
        return u.includes('SUPERMERCADO') || u.includes('MERCADO') || u.includes('CAVICCHIOLLI') || u.includes('CAVICCHIOLI') || u.includes('ATACADO');
      });
      if (linhaSuper) {
        // Remove CNPJ, IE, IM e outras sujeiras da linha
        const cleaned = linhaSuper
          .replace(/CNPJ[:\s]*[\d./-]{14,}/gi, '')
          .replace(/IE[:\s]*[\d./-]{9,}/gi, '')
          .replace(/^[^\w]+|[^\w]+$/g, '')
          .trim();
        if (cleaned.length > 3) {
          estabelecimento = cleaned;
        }
      }
      if (!estabelecimento || estabelecimento.length < 3) {
        estabelecimento = 'Supermercado';
      }
    }

    // 2. Tentar encontrar o VALOR
    // Regex mais flexível para capturar valores monetários
    const padraoValor = /(?:^|\s|R\$)\s?(\d{1,3}(?:[.,\s]?\d{3})*[.,\s]\d{2})(?:\s|$)/;
    
    // Padrões específicos com rótulos (mais confiáveis)
    const labelsValor = [
      'VALOR\\s+PAGO',
      'VALOR\\s+TOTAL',
      'TOTAL\\s+A\\s+PAGAR',
      'VALOR\\s+DE\\s+CADA\\s+PRESTA[ÇC][ÃA]O',
      'VALOR\\s+DA\\s+PRESTA[ÇC][ÃA]O',
      'VALOR\\s+DA\\s+PREST',
      'VALOR\\s+PREST',
      'PRESTA[ÇC][ÃA]O',
      'TOTAL',
      'VALOR',
      'PAGO',
      'R\\$',
      'VALOR:',
      'TOTAL:',
      'PAGO:'
    ].join('|');
    
    // Tenta encontrar o valor acompanhado de um label
    // O regex agora permite que o valor esteja na mesma linha ou na próxima
    const regexLabel = new RegExp(`(?:${labelsValor})[\\s:]*?${padraoValor.source.replace('(?:^|\\s|R\\$)\\s?', '')}`, 'i');
    const valorComLabel = text.match(regexLabel);
    
    if (valorComLabel) {
      console.log('Valor com label encontrado:', valorComLabel[1]);
      const valorStr = valorComLabel[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
      valor = parseFloat(valorStr);
    }

    // Se não encontrou com label, tenta buscar todos os valores e filtrar
    if (valor === null || isNaN(valor)) {
      const matchesValores = text.match(new RegExp(padraoValor.source, 'g'));
      if (matchesValores) {
        console.log('Valores genéricos encontrados:', matchesValores);
        
        const valoresPlausiveis = matchesValores
          .map(v => v.trim().replace(/^R\$\s?/, ''))
          .map(v => v.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
          .map(v => parseFloat(v))
          .filter(v => v > 0 && v < 5000); 
        
        if (valoresPlausiveis.length > 0) {
          // Em cupons de supermercado, o valor total costuma ser um dos últimos
          // Mas vamos tentar evitar valores muito pequenos que podem ser quantidades
          const valoresSignificativos = valoresPlausiveis.filter(v => v > 1.0);
          if (valoresSignificativos.length > 0) {
            valor = valoresSignificativos[valoresSignificativos.length - 1];
          } else {
            valor = valoresPlausiveis[valoresPlausiveis.length - 1];
          }
        }
      }
    }

    // Formata o valor para string com ponto decimal para o input type="number"
    const valorFormatado = (valor !== null && !isNaN(valor)) ? valor.toFixed(2) : '';

    // 3. Tentar encontrar a DATA
    const meses: { [key: string]: string } = {
      'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
      'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
    };

    // Padrão Lojas Cem: DD-mes-YYYY (ex: 28-fev-2026)
    const dataLojasCemMatch = text.match(/(\d{2})-(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)-(\d{4})/i);
    
    if (dataLojasCemMatch) {
      console.log('Data Lojas Cem encontrada:', dataLojasCemMatch[0]);
      const dia = dataLojasCemMatch[1];
      const mes = meses[dataLojasCemMatch[2].toLowerCase()];
      const ano = dataLojasCemMatch[3];
      data = `${ano}-${mes}-${dia}`;
    } else {
      // Padrão: DD/MM/YYYY ou DD/MM/YY
      const dataMatch = text.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
      if (dataMatch) {
        const dia = dataMatch[1];
        const mes = dataMatch[2];
        let year = dataMatch[3];
        if (year.length === 2) {
          // Se o ano for "26", assume 2026. Se for "76", pode ser erro de OCR de "26"
          // Vamos assumir que anos > 50 em formato de 2 dígitos são provavelmente erros de OCR para 20xx
          // ou datas muito antigas. Para finanças pessoais, 20xx é mais provável.
          const numYear = parseInt(year);
          if (numYear > 50 && numYear < 100) {
            // Se for algo como 76, e estamos em 2026, é quase certeza que o OCR errou o 2 pelo 7
            year = `20${year.replace(/^[7]/, '2')}`; 
          } else {
            year = `20${year}`;
          }
        } else if (year.length === 4) {
          // Se o ano for 2076, é quase certeza que o OCR errou o 2 pelo 7
          if (year === '2076') year = '2026';
        }
        data = `${year}-${mes}-${dia}`;
      }
    }

    // 4. Tentar encontrar o ESTABELECIMENTO (se ainda não tiver)
    if (!estabelecimento) {
      const linhasFiltradas = lines.filter(l => {
        const upper = l.toUpperCase();
        return l.length > 5 && // Aumentado para evitar ruídos curtos
               !upper.includes('COMPROVANTE') && 
               !upper.includes('PAGAMENTO') &&
               !upper.includes('CNPJ') &&
               !upper.includes('CPF') &&
               !upper.includes('DATA') &&
               !upper.includes('VALOR') &&
               !upper.includes('TOTAL') &&
               !upper.includes('PAGO') &&
               !upper.includes('R$') &&
               !upper.includes('RS ') &&
               !/\d{10,}/.test(l); // Evita linhas com números longos (códigos de barras/contratos)
      });

      if (linhasFiltradas.length > 0) {
        estabelecimento = linhasFiltradas[0]
          .replace(/CNPJ[:\s]*[\d./-]{14,}/gi, '')
          .trim();
      }
    }

    const finalEstabelecimento = estabelecimento || 'Estabelecimento';

    // 5. Tentar determinar a CATEGORIA
    let categoria = 'Outros';
    const estabUpper = finalEstabelecimento.toUpperCase();
    if (textoLimpo.includes('SUPERMERCADO') || 
        textoLimpo.includes('ALIMENTOS') || 
        textoLimpo.includes('MERCEARIA') ||
        textoLimpo.includes('CAVICCHIOLLI') ||
        textoLimpo.includes('CAVICCHIOLI') ||
        estabUpper.includes('SUPERMERCADO') ||
        estabUpper.includes('CAVICCHIOLLI') ||
        estabUpper.includes('CAVICCHIOLI')) {
      categoria = 'Alimentação';
    } else if (textoLimpo.includes('POSTO') || textoLimpo.includes('COMBUSTIVEL')) {
      categoria = 'Transporte';
    } else if (textoLimpo.includes('LOJAS CEM') || textoLimpo.includes('ELETRO')) {
      categoria = 'Casa';
    }

    return {
      valor: valorFormatado || '',
      data: data || new Date().toISOString().split('T')[0],
      estabelecimento: finalEstabelecimento.substring(0, 30),
      categoria: categoria,
      tipo: text.toLowerCase().includes('recebido') ? 'receita' : 'despesa',
      descricao: `Leitura automática: ${finalEstabelecimento}`
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Tentando salvar lançamento...', formData);
    
    if (!auth.currentUser) {
      console.error('Usuário não autenticado');
      return;
    }

    if (!formData.value || isNaN(parseFloat(formData.value))) {
      setErrorMessage('Por favor, insira um valor válido.');
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    const path = 'lancamentos';
    try {
      const cleanValue = formData.value.replace(',', '.');
      const finalCategory = isCustomCategory ? customCategory : formData.category;
      
      // If it's a custom category, save it to the 'categorias' collection if it doesn't exist
      if (isCustomCategory && customCategory) {
        const categoriesRef = collection(db, 'categorias');
        const q = query(categoriesRef, where('userId', '==', auth.currentUser.uid), where('nome', '==', customCategory));
        const existing = await getDocs(q);
        
        if (existing.empty) {
          await addDoc(categoriesRef, {
            userId: auth.currentUser.uid,
            nome: customCategory,
            createdAt: serverTimestamp()
          });
        }
      }

      const payload: any = {
        userId: auth.currentUser.uid,
        tipo: formData.type, // 'income' or 'expense'
        valor: parseFloat(cleanValue),
        categoria: finalCategory || 'Outros',
        data: formData.date,
        descricao: formData.description || formData.establishment || 'Sem descrição',
        estabelecimento: formData.establishment || '',
        telefone: userPhone, // Store phone for scheduled notifications
        updatedAt: serverTimestamp(),
        pago: transactionToEdit ? (transactionToEdit.pago ?? false) : false,
        notificado5dias: transactionToEdit ? (transactionToEdit.notificado5dias ?? false) : false,
        notificadoNoDia: transactionToEdit ? (transactionToEdit.notificadoNoDia ?? false) : false
      };
      
      let transactionId = transactionToEdit?.id;
      if (transactionToEdit) {
        console.log('Atualizando lançamento no Firestore:', transactionToEdit.id, payload);
        await updateDoc(doc(db, path, transactionToEdit.id), payload);
      } else {
        payload.createdAt = serverTimestamp();
        console.log('Payload para Firestore:', payload);
        const docRef = await addDoc(collection(db, path), payload);
        transactionId = docRef.id;
      }

      // WhatsApp notification trigger removed as per user request (only scheduled notifications)
      setView('success');
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('Erro ao salvar no Firestore:', error);
      setIsSaving(false);
      setErrorMessage('Erro ao salvar no banco de dados. Por favor, tente novamente.');
      // We still call handleFirestoreError for logging/system purposes
      try {
        handleFirestoreError(error, OperationType.WRITE, path);
      } catch (e) {
        // Ignore the re-thrown error here as we handle it in the UI
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-proc-bg/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-proc-secondary border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,209,255,0.15)] overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                {view !== 'selection' && view !== 'success' && view !== 'processing' && (
                  <button 
                    onClick={() => setView('selection')}
                    className="p-2 rounded-xl bg-white/5 text-proc-text-sec hover:text-white transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h3 className="text-lg font-bold text-proc-text-main">
                  {view === 'selection' && 'Novo Lançamento'}
                  {view === 'manual' && (transactionToEdit ? 'Editar Lançamento' : 'Inserir Lançamento')}
                  {view === 'receipt' && 'Enviar Comprovante'}
                  {view === 'processing' && 'Lendo Comprovante...'}
                  {view === 'success' && 'Sucesso!'}
                </h3>
              </div>
              <button 
                onClick={handleClose}
                className="p-2 rounded-xl bg-white/5 text-proc-text-sec hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* VIEW: SELECTION */}
              {view === 'selection' && (
                <div className="space-y-4">
                  <button 
                    onClick={() => setView('manual')}
                    className="w-full group p-5 bg-proc-bg/50 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-proc-green/50 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-proc-green/10 flex items-center justify-center text-proc-green group-hover:scale-110 transition-transform">
                      <Edit3 size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-proc-text-main">Lançamento Manual</p>
                      <p className="text-xs text-proc-text-sec">Digite os dados manualmente</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setView('receipt')}
                    className="w-full group p-5 bg-proc-bg/50 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-proc-cyan/50 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan group-hover:scale-110 transition-transform">
                      <Camera size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-proc-text-main">Enviar Comprovante</p>
                      <p className="text-xs text-proc-text-sec">Tire uma foto ou envie da galeria</p>
                    </div>
                  </button>
                </div>
              )}

              {/* VIEW: MANUAL FORM */}
              {view === 'manual' && (
                <form onSubmit={handleSave} className="space-y-4">
                  {/* Error Message */}
                  {errorMessage && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 mb-4">
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{errorMessage}</p>
                    </div>
                  )}

                  {/* Detected Data Badge */}
                  {imagePreview && !errorMessage && (
                    <div className="bg-proc-green/10 border border-proc-green/20 rounded-xl p-3 flex flex-col gap-1 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-proc-green/20 flex items-center justify-center text-proc-green">
                          <Scan size={16} />
                        </div>
                        <p className="text-[10px] font-bold text-proc-green uppercase tracking-widest">Dados extraídos com sucesso!</p>
                      </div>
                      <p className="text-[10px] text-proc-text-sec ml-11">Confira as informações abaixo e clique em Confirmar.</p>
                    </div>
                  )}

                  <div className="flex bg-proc-bg/50 p-1 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'income'})}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.type === 'income' ? 'bg-proc-green text-proc-bg' : 'text-proc-text-sec'}`}
                    >
                      Receita
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'expense'})}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.type === 'expense' ? 'bg-red-500 text-white' : 'text-proc-text-sec'}`}
                    >
                      Despesa
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1 flex items-center gap-1">
                      <DollarSign size={10} /> Valor
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-proc-cyan font-bold">R$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={formData.value}
                        onChange={(e) => setFormData({...formData, value: e.target.value})}
                        placeholder="0,00"
                        className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-proc-text-main font-bold focus:outline-none focus:border-proc-cyan/50 transition-colors text-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1 flex items-center gap-1">
                      <Store size={10} /> Estabelecimento
                    </label>
                    <input 
                      type="text" 
                      value={formData.establishment}
                      onChange={(e) => setFormData({...formData, establishment: e.target.value})}
                      placeholder="Nome da loja ou local"
                      className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-proc-text-main text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1 flex items-center gap-1">
                        <Tag size={10} /> Categoria
                      </label>
                      <select 
                        value={isCustomCategory ? 'Personalizada' : formData.category}
                        onChange={(e) => {
                          if (e.target.value === 'Personalizada') {
                            setIsCustomCategory(true);
                          } else {
                            setIsCustomCategory(false);
                            setFormData({...formData, category: e.target.value});
                          }
                        }}
                        className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-proc-text-main text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors appearance-none"
                      >
                        {predefinedCategories.map(cat => (
                          <option key={cat} value={cat} className="bg-proc-bg text-proc-text-main">{cat}</option>
                        ))}
                        {userCustomCategories.map(cat => (
                          <option key={cat} value={cat} className="bg-proc-bg text-proc-text-main">{cat}</option>
                        ))}
                        <option value="Personalizada" className="bg-proc-bg text-proc-text-main">Personalizada...</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1 flex items-center gap-1">
                        <Calendar size={10} /> Data
                      </label>
                      <input 
                        type="date" 
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-proc-text-main text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors"
                      />
                    </div>
                  </div>

                  {isCustomCategory && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1"
                    >
                      <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1">
                        Nome da Categoria Personalizada
                      </label>
                      <input 
                        type="text" 
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Ex: Presentes, Viagem..."
                        className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-proc-text-main text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors"
                        required
                      />
                    </motion.div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={handleClose}
                      className="flex-1 py-3.5 rounded-xl font-bold text-proc-text-sec bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={isSaving}
                      className={`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        isSaving 
                          ? 'bg-proc-green/50 text-proc-bg cursor-not-allowed' 
                          : 'bg-proc-green text-proc-bg shadow-[0_0_20px_rgba(0,230,118,0.3)] hover:shadow-[0_0_30px_rgba(0,230,118,0.5)]'
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Save size={18} />
                      )}
                      {isSaving ? 'Salvando...' : 'Confirmar'}
                    </button>
                  </div>
                </form>
              )}

              {/* VIEW: RECEIPT UPLOAD */}
              {view === 'receipt' && (
                <div className="space-y-6">
                  {!imagePreview ? (
                    <div className="space-y-4">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full aspect-video border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 bg-proc-bg/30 hover:bg-proc-bg/50 hover:border-proc-cyan/30 transition-all cursor-pointer group"
                      >
                        <div className="w-12 h-12 rounded-full bg-proc-cyan/10 flex items-center justify-center text-proc-cyan group-hover:scale-110 transition-transform">
                          <Upload size={24} />
                        </div>
                        <p className="text-sm font-medium text-proc-text-sec">Arraste ou clique para enviar</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-proc-secondary border border-white/10 text-white font-bold text-sm"
                        >
                          <Camera size={18} className="text-proc-cyan" />
                          Tirar Foto
                        </button>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-proc-secondary border border-white/10 text-white font-bold text-sm"
                        >
                          <ImageIcon size={18} className="text-proc-cyan" />
                          Galeria
                        </button>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                      <input 
                        type="file" 
                        ref={cameraInputRef}
                        className="hidden" 
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageUpload}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <button 
                          onClick={() => setImagePreview(null)}
                          className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-md rounded-lg text-white hover:bg-black/70 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <button 
                        onClick={processReceipt}
                        className="w-full py-4 rounded-xl bg-proc-cyan text-proc-bg font-bold shadow-[0_0_20px_rgba(0,209,255,0.3)] flex items-center justify-center gap-2"
                      >
                        <Scan size={18} />
                        Processar Comprovante
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW: PROCESSING */}
              {view === 'processing' && (
                <div className="py-12 flex flex-col items-center justify-center gap-6">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border-4 border-proc-cyan/10 border-t-proc-cyan animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        animate={{ 
                          y: [-20, 20, -20],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-24 h-1 bg-proc-cyan shadow-[0_0_15px_#00D1FF] rounded-full"
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Scan size={40} className="text-proc-cyan/50" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-xl font-bold text-white">Lendo Comprovante</p>
                    <p className="text-sm text-proc-text-sec">Extraindo dados financeiros...</p>
                    <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden mx-auto mt-4">
                      <motion.div 
                        className="h-full bg-proc-cyan"
                        initial={{ width: 0 }}
                        animate={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: SUCCESS */}
              {view === 'success' && (
                <div className="py-12 flex flex-col items-center justify-center gap-6">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 rounded-full bg-proc-green/20 flex items-center justify-center text-proc-green shadow-[0_0_30px_rgba(0,230,118,0.2)]"
                  >
                    <CheckCircle2 size={48} />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white">Lançamento Salvo!</p>
                    <p className="text-sm text-proc-text-sec mt-1">Seu saldo foi atualizado com sucesso.</p>
                  </div>

                  {/* Notification Status Box */}
                  <div className={`w-full p-4 rounded-2xl border ${
                    notificationStatus?.success 
                      ? 'bg-proc-green/10 border-proc-green/20 text-proc-green' 
                      : notificationStatus === null 
                        ? 'bg-proc-cyan/10 border-proc-cyan/20 text-proc-cyan'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                  }`}>
                    <div className="flex items-center gap-3">
                      {notificationStatus === null ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : notificationStatus.success ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <X size={18} />
                      )}
                      <p className="text-[10px] font-bold uppercase tracking-widest">
                        {notificationStatus === null && 'Enviando Notificação...'}
                        {notificationStatus?.success && 'WhatsApp Enviado!'}
                        {notificationStatus?.success === false && 'Erro na Notificação'}
                      </p>
                    </div>
                    {notificationStatus?.success === false && (
                      <p className="text-[10px] mt-2 opacity-80 leading-relaxed">
                        {notificationStatus.message}
                      </p>
                    )}
                  </div>

                  {!notificationStatus?.success && notificationStatus !== null && (
                    <button 
                      onClick={handleClose}
                      className="mt-2 w-full py-4 rounded-2xl bg-proc-secondary text-proc-text-main font-bold border border-white/10 hover:bg-proc-secondary/80 transition-all"
                    >
                      Fechar
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
