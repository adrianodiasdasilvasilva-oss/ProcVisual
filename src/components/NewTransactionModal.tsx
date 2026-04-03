import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Edit3, 
  Camera, 
  Image as ImageIcon, 
  Upload, 
  Save, 
  ArrowLeft,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'selection' | 'manual' | 'receipt' | 'processing' | 'success';

export default function NewTransactionModal({ isOpen, onClose }: NewTransactionModalProps) {
  const [view, setView] = useState<ModalView>('selection');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formData, setFormData] = useState({
    type: 'expense',
    value: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const resetModal = () => {
    setView('selection');
    setImagePreview(null);
    setFormData({
      type: 'expense',
      value: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
      description: ''
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

  const processReceipt = () => {
    setView('processing');
    // Simulate OCR processing
    setTimeout(() => {
      setFormData({
        type: 'expense',
        value: '154.90',
        category: 'Alimentação',
        date: '2026-04-03',
        description: 'Restaurante ProcVisual'
      });
      setView('manual');
    }, 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setView('success');
    setTimeout(() => {
      handleClose();
    }, 1500);
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
                {view !== 'selection' && view !== 'success' && (
                  <button 
                    onClick={() => setView('selection')}
                    className="p-2 rounded-xl bg-white/5 text-proc-text-sec hover:text-white transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h3 className="text-lg font-bold text-white">
                  {view === 'selection' && 'Novo Lançamento'}
                  {view === 'manual' && 'Lançamento Manual'}
                  {view === 'receipt' && 'Enviar Comprovante'}
                  {view === 'processing' && 'Processando...'}
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

            <div className="p-6">
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
                      <p className="font-bold text-white">Lançamento Manual</p>
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
                      <p className="font-bold text-white">Enviar Comprovante</p>
                      <p className="text-xs text-proc-text-sec">Tire uma foto ou envie da galeria</p>
                    </div>
                  </button>
                </div>
              )}

              {/* VIEW: MANUAL FORM */}
              {view === 'manual' && (
                <form onSubmit={handleSave} className="space-y-4">
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
                    <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1">Valor</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-proc-text-sec font-bold">R$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={formData.value}
                        onChange={(e) => setFormData({...formData, value: e.target.value})}
                        placeholder="0,00"
                        className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white font-bold focus:outline-none focus:border-proc-cyan/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1">Categoria</label>
                      <select 
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors appearance-none"
                      >
                        <option value="">Selecionar</option>
                        <option value="Alimentação">Alimentação</option>
                        <option value="Moradia">Moradia</option>
                        <option value="Transporte">Transporte</option>
                        <option value="Lazer">Lazer</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1">Data</label>
                      <input 
                        type="date" 
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1">Descrição</label>
                    <input 
                      type="text" 
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Ex: Almoço de negócios"
                      className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors"
                    />
                  </div>

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
                      className="flex-1 py-3.5 rounded-xl font-bold text-proc-bg bg-proc-green shadow-[0_0_20px_rgba(0,230,118,0.3)] flex items-center justify-center gap-2"
                    >
                      <Save size={18} />
                      Salvar
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
                          onClick={() => fileInputRef.current?.click()}
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
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
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
                        <Loader2 size={18} className="animate-spin hidden" />
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
                    <div className="w-24 h-24 rounded-full border-4 border-proc-cyan/20 border-t-proc-cyan animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Camera size={32} className="text-proc-cyan animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white">Lendo Comprovante</p>
                    <p className="text-sm text-proc-text-sec mt-1">Nossa IA está extraindo os dados...</p>
                  </div>
                </div>
              )}

              {/* VIEW: SUCCESS */}
              {view === 'success' && (
                <div className="py-12 flex flex-col items-center justify-center gap-6">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 rounded-full bg-proc-green/20 flex items-center justify-center text-proc-green"
                  >
                    <CheckCircle2 size={48} />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white">Lançamento Salvo!</p>
                    <p className="text-sm text-proc-text-sec mt-1">Seu saldo foi atualizado com sucesso.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
