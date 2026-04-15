import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, setDoc, collection, query, where, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { 
  User, 
  Phone, 
  Camera, 
  Trash2, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  Plus,
  Moon,
  Sun,
  Mail,
  CreditCard,
  Calendar,
  RefreshCw
} from 'lucide-react';
import CropImageModal from './CropImageModal';

interface SettingsProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function Settings({ theme, onToggleTheme }: SettingsProps) {
  const [userData, setUserData] = useState<any>(null);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState('');
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, 'usuarios', auth.currentUser.uid);
    const unsubscribeUser = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserData(data);
        setPhone(data.telefone || '');
        setName(data.nome || '');
        setEmail(data.email || '');
        setPhoto(data.fotoURL || '');
      }
      setIsLoading(false);
    });

    const categoriesRef = collection(db, 'categorias');
    const q = query(categoriesRef, where('userId', '==', auth.currentUser.uid));
    const unsubscribeCategories = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomCategories(cats);
    });

    return () => {
      unsubscribeUser();
      unsubscribeCategories();
    };
  }, []);

  const [isCheckingSub, setIsCheckingSub] = useState(false);

  const fetchSubDetails = async () => {
    if (!auth.currentUser || isCheckingSub) return;
    setIsCheckingSub(true);
    try {
      const res = await fetch(`/api/subscription-details?userId=${auth.currentUser?.uid}`);
      const data = await res.json();
      if (data.nextPaymentDate) {
        // The profile listener will pick up the change after the API updates Firestore
      }
    } catch (e) {
      console.error("Error fetching sub details:", e);
    } finally {
      setIsCheckingSub(false);
    }
  };

  useEffect(() => {
    if (!userData?.nextPaymentDate && auth.currentUser && !isCheckingSub) {
      fetchSubDetails();
    }
  }, [userData?.nextPaymentDate, auth.currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setIsSaving(true);
    setMessage(null);
    const path = 'usuarios';
    try {
      const userRef = doc(db, path, auth.currentUser.uid);
      await setDoc(userRef, {
        nome: name,
        email: email,
        telefone: phone,
        fotoURL: photo,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      setMessage({ type: 'error', text: 'Erro ao atualizar perfil.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
        setIsCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleCropComplete = async (croppedImage: string) => {
    setIsCropping(true);
    setMessage(null);
    
    // Auto-save photo
    if (!auth.currentUser) {
      setIsCropping(false);
      return;
    }
    
    const path = 'usuarios';
    try {
      const userRef = doc(db, path, auth.currentUser.uid);
      
      // Use setDoc with merge: true to ensure document exists and fields are updated correctly
      await setDoc(userRef, {
        fotoURL: croppedImage,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setPhoto(croppedImage);
      setMessage({ type: 'success', text: 'Foto de perfil salva com sucesso!' });
      setIsCropModalOpen(false);
      setImageToCrop(null);
    } catch (error: any) {
      console.error("Error updating photo:", error);
      const errorMsg = 'Erro ao salvar foto no banco de dados. Verifique sua conexão.';
      setMessage({ type: 'error', text: errorMsg });
      
      // Call handleFirestoreError last as it throws
      try {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } catch (e) {
        // Re-throw the error from handleFirestoreError to the modal
        throw e;
      }
    } finally {
      setIsCropping(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const path = 'categorias';
    try {
      await deleteDoc(doc(db, path, categoryToDelete));
      setMessage({ type: 'success', text: 'Categoria excluída!' });
      setCategoryToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      setMessage({ type: 'error', text: 'Erro ao excluir categoria.' });
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="text-proc-cyan animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-proc-text-main tracking-tight">Configurações</h2>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-2xl flex items-center gap-3 ${
              message.type === 'success' ? 'bg-proc-green/10 text-proc-green border border-proc-green/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <p className="text-sm font-bold uppercase tracking-widest">{message.text}</p>
            <button onClick={() => setMessage(null)} className="ml-auto text-xs opacity-50 hover:opacity-100">Fechar</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Section */}
        <section className="bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
              <User size={20} />
            </div>
            <h3 className="text-xl font-bold text-proc-text-main">Perfil do Usuário</h3>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full border-4 border-proc-cyan/20 overflow-hidden bg-proc-bg/50 flex items-center justify-center">
                  {photo ? (
                    <img src={photo} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="text-proc-text-sec" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-3 bg-proc-cyan text-proc-bg rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <Camera size={20} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handlePhotoUpload}
                />
              </div>
              <p className="text-xs text-proc-text-sec">Clique na câmera para alterar sua foto</p>
            </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1">Nome</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-proc-text-main text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1">E-mail</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Seu e-mail principal"
                    className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-proc-text-main text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors"
                  />
                  <p className="text-[9px] text-proc-text-sec mt-1 ml-1">
                    * Use o e-mail vinculado à sua assinatura para sincronizar os dados.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1 flex items-center gap-1">
                    <Phone size={10} /> Celular
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="flex-1 bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-proc-text-main text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors"
                    />
                  </div>
                  
                  <p className="text-[9px] text-proc-text-sec mt-1 ml-1">
                    * Use o formato com DDD (ex: 11999999999). O sistema enviará notificações de despesas para este número.
                  </p>
                </div>
              </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 rounded-2xl bg-proc-cyan text-proc-bg font-bold flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(0,209,255,0.3)] transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </section>

        {/* Theme & Display Section */}
        <section className="bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <h3 className="text-xl font-bold text-proc-text-main">Aparência</h3>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-proc-text-sec">
              Escolha entre o modo escuro (padrão) e o modo claro para uma melhor experiência visual.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => theme === 'light' && onToggleTheme()}
                className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-3 ${
                  theme === 'dark' 
                    ? 'bg-proc-cyan/10 border-proc-cyan text-proc-cyan shadow-[0_0_20px_rgba(0,209,255,0.1)]' 
                    : 'bg-proc-bg/50 border-white/5 text-proc-text-sec hover:bg-white/5'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-proc-bg border border-white/10 flex items-center justify-center shadow-inner">
                  <Moon size={24} />
                </div>
                <span className="font-bold text-xs uppercase tracking-widest">Modo Escuro</span>
              </button>

              <button
                onClick={() => theme === 'dark' && onToggleTheme()}
                className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-3 ${
                  theme === 'light' 
                    ? 'bg-proc-cyan/10 border-proc-cyan text-proc-cyan shadow-[0_0_20px_rgba(0,209,255,0.1)]' 
                    : 'bg-proc-bg/50 border-white/5 text-proc-text-sec hover:bg-white/5'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-white border border-black/5 flex items-center justify-center shadow-inner">
                  <Sun size={24} className="text-amber-500" />
                </div>
                <span className="font-bold text-xs uppercase tracking-widest">Modo Claro</span>
              </button>
            </div>
          </div>
        </section>
        
        {/* Subscription Section */}
        <section className="bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
              <CreditCard size={20} />
            </div>
            <h3 className="text-xl font-bold text-proc-text-main">Assinatura</h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-proc-bg/50 border border-white/5">
              <div>
                <p className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${userData?.isActive ? 'bg-proc-green animate-pulse' : 'bg-red-500'}`} />
                  <p className={`text-sm font-bold ${userData?.isActive ? 'text-proc-green' : 'text-red-500'}`}>
                    {userData?.isActive ? 'Premium Ativo' : 'Inativo'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest">Plano</p>
                <p className="text-sm font-bold text-proc-text-main mt-1">
                  {userData?.plan === 'premium' ? 'Mensal Premium' : 'Nenhum'}
                </p>
              </div>
            </div>

            {userData?.isActive && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-proc-cyan/5 border border-proc-cyan/10 group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-proc-cyan uppercase tracking-widest">Próxima Renovação</p>
                    <p className="text-sm font-bold text-proc-text-main mt-0.5">
                      {userData?.nextPaymentDate ? (
                        new Date(userData.nextPaymentDate).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })
                      ) : isCheckingSub ? (
                        "Consultando data..."
                      ) : (
                        "Data não localizada"
                      )}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    fetchSubDetails();
                  }}
                  disabled={isCheckingSub}
                  className={`p-2 rounded-xl transition-all ${isCheckingSub ? 'animate-spin text-proc-cyan' : 'text-proc-cyan/40 hover:text-proc-cyan hover:bg-proc-cyan/10 opacity-0 group-hover:opacity-100'}`}
                  title="Atualizar dados da assinatura"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            )}

            {!userData?.isActive && (
              <p className="text-xs text-proc-text-sec italic text-center">
                Sua assinatura não está ativa. Regularize seu pagamento para acessar todas as funcionalidades.
              </p>
            )}
          </div>
        </section>

        {/* Categories Section */}
        <section className="bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-proc-green/10 flex items-center justify-center text-proc-green">
              <Tag size={20} />
            </div>
            <h3 className="text-xl font-bold text-proc-text-main">Categorias Personalizadas</h3>
          </div>

          <p className="text-sm text-proc-text-sec">
            Aqui você pode gerenciar as categorias que criou manualmente ao inserir lançamentos.
          </p>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {customCategories.length > 0 ? (
              customCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-4 rounded-2xl bg-proc-secondary/30 border border-white/10 hover:bg-proc-secondary/50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-proc-cyan" />
                    <span className="text-proc-text-main font-medium">{cat.nome}</span>
                  </div>
                  <button
                    onClick={() => setCategoryToDelete(cat.id)}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                    title="Excluir categoria"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl">
                <p className="text-proc-text-sec text-xs italic">Nenhuma categoria personalizada encontrada.</p>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-proc-cyan/5 border border-proc-cyan/10">
            <p className="text-[10px] text-proc-cyan font-bold uppercase tracking-widest flex items-center gap-2">
              <Plus size={10} /> Dica
            </p>
            <p className="text-xs text-proc-text-sec mt-1">
              Novas categorias são criadas automaticamente quando você escolhe "Personalizada" ao adicionar um lançamento.
            </p>
          </div>
        </section>
        
        {/* Suporte Section */}
        <section className="p-8 rounded-[2.5rem] bg-proc-secondary border border-white/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
              <Mail size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-proc-text-main">Suporte</h2>
              <p className="text-sm text-proc-text-sec">Precisa de ajuda ou tem alguma dúvida?</p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-proc-bg/50 border border-white/5 flex flex-col items-center text-center">
            <p className="text-sm text-proc-text-sec leading-relaxed">
              Nossa equipe está pronta para te ajudar. Para entrar em contato com a ProcVisual, basta enviar um e-mail para o endereço abaixo:
            </p>
            <div className="mt-4 flex items-center justify-center gap-3 p-4 rounded-xl bg-proc-cyan/5 border border-proc-cyan/10 w-full">
              <Mail size={18} className="text-proc-cyan" />
              <a 
                href="mailto:procvisual.dashboard@gmail.com" 
                className="text-proc-text-main font-bold hover:text-proc-cyan transition-colors"
              >
                procvisual.dashboard@gmail.com
              </a>
            </div>
          </div>
        </section>
      </div>

      <CropImageModal 
        isOpen={isCropModalOpen}
        onClose={() => {
          if (!isCropping) {
            setIsCropModalOpen(false);
            setImageToCrop(null);
          }
        }}
        image={imageToCrop}
        onCropComplete={handleCropComplete}
        isSaving={isCropping}
      />

      {/* Category Delete Confirmation Modal */}
      <AnimatePresence>
        {categoryToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCategoryToDelete(null)}
              className="absolute inset-0 bg-proc-bg/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-proc-secondary border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-proc-text-main text-center mb-2">Excluir Categoria?</h3>
              <p className="text-proc-text-sec text-center mb-8">
                Tem certeza que deseja excluir esta categoria personalizada?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCategoryToDelete(null)}
                  className="flex-1 py-4 rounded-2xl bg-proc-secondary/50 text-proc-text-main font-bold hover:bg-proc-secondary/80 transition-all border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteCategory}
                  className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
