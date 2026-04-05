import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, deleteDoc, getDocs } from 'firebase/firestore';
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
  Plus
} from 'lucide-react';

export default function Settings() {
  const [userData, setUserData] = useState<any>(null);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, 'usuarios', auth.currentUser.uid);
    const unsubscribeUser = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserData(data);
        setPhone(data.telefone || '');
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setIsSaving(true);
    setMessage(null);
    const path = 'usuarios';
    try {
      const userRef = doc(db, path, auth.currentUser.uid);
      await updateDoc(userRef, {
        telefone: phone,
        fotoURL: photo,
        updatedAt: new Date()
      });
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
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const path = 'categorias';
    try {
      await deleteDoc(doc(db, path, id));
      setMessage({ type: 'success', text: 'Categoria excluída!' });
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
        <h2 className="text-3xl font-bold text-white tracking-tight">Configurações</h2>
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
        <section className="bg-proc-secondary/20 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
              <User size={20} />
            </div>
            <h3 className="text-xl font-bold text-white">Perfil do Usuário</h3>
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
                  value={userData?.nome || ''} 
                  disabled
                  className="w-full bg-proc-bg/30 border border-white/5 rounded-xl py-3 px-4 text-proc-text-sec text-sm cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1">E-mail</label>
                <input 
                  type="email" 
                  value={userData?.email || ''} 
                  disabled
                  className="w-full bg-proc-bg/30 border border-white/5 rounded-xl py-3 px-4 text-proc-text-sec text-sm cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-proc-text-sec uppercase tracking-widest ml-1 flex items-center gap-1">
                  <Phone size={10} /> Celular
                </label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-proc-cyan/50 transition-colors"
                />
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

        {/* Categories Section */}
        <section className="bg-proc-secondary/20 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-proc-green/10 flex items-center justify-center text-proc-green">
              <Tag size={20} />
            </div>
            <h3 className="text-xl font-bold text-white">Categorias Personalizadas</h3>
          </div>

          <p className="text-sm text-proc-text-sec">
            Aqui você pode gerenciar as categorias que criou manualmente ao inserir lançamentos.
          </p>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {customCategories.length > 0 ? (
              customCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-proc-cyan" />
                    <span className="text-white font-medium">{cat.nome}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-2 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20"
                    title="Excluir categoria"
                  >
                    <Trash2 size={16} />
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
      </div>
    </div>
  );
}
