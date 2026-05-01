import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  updateDoc as firestoreUpdateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Users, UserCheck, Calendar, Search, Loader2, BellRing, RefreshCw, FileDown, Trash2, X, AlertTriangle, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface UserProfile {
  id: string;
  nome: string;
  email: string;
  isActive: boolean;
  manuallyBlocked?: boolean;
  dataCriacao?: any;
  dataAssinatura?: any;
  lastPayment?: any;
  telefone?: string;
  valorAssinatura?: number;
}

export default function AdminTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNotifying, setIsNotifying] = useState(false);
  const [isTestingWA, setIsTestingWA] = useState(false);
  const [notifyResult, setNotifyResult] = useState<any>(null);
  const [testPhone, setTestPhone] = useState('');
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notifyingUserId, setNotifyingUserId] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);

  useEffect(() => {
    const path = 'usuarios';
    const q = query(collection(db, path), orderBy('dataCriacao', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleTestWhatsApp = async () => {
    if (!testPhone) {
      alert('Digite um número para testar');
      return;
    }
    setIsTestingWA(true);
    try {
      const res = await fetch('/api/admin/test-whatsapp', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testPhone })
      });
      const data = await res.json();
      alert(data.success ? '✅ Teste enviado!' : '❌ Falha: ' + data.error);
    } catch (err) {
      alert('❌ Erro de conexão');
    } finally {
      setIsTestingWA(false);
    }
  };

  const handleRunNotifications = async () => {
    setIsNotifying(true);
    setNotifyResult(null);
    try {
      const res = await fetch('/api/admin/run-notifications', { method: 'POST' });
      const data = await res.json();
      setNotifyResult(data.results || data);
    } catch (err) {
      console.error('Erro ao disparar notificações:', err);
      setNotifyResult({ error: 'Erro de conexão' });
    } finally {
      setIsNotifying(false);
    }
  };

  const handleNotifyIndividual = async (userId: string) => {
    setNotifyingUserId(userId);
    try {
      const res = await fetch('/api/admin/run-notifications', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      const count = data.results?.notified || 0;
      alert(`✅ Processamento concluído: ${count} notificação(ões) enviada(s).`);
    } catch (err) {
      console.error('Erro ao disparar notificação individual:', err);
      alert('❌ Erro ao enviar notificação');
    } finally {
      setNotifyingUserId(null);
    }
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = filteredUsers.map(u => ({
        Nome: u.nome || 'Sem Nome',
        Email: u.email,
        Telefone: u.telefone || 'N/A',
        Status: u.isActive ? 'Ativo' : 'Inativo',
        ValorAssinatura: u.valorAssinatura ? `R$ ${u.valorAssinatura.toFixed(2)}` : 'N/A',
        'Data Criacao': formatDate(u.dataCriacao) || 'N/A',
        'Data Assinatura': formatDate(u.dataAssinatura) || formatDate(u.lastPayment) || (u.isActive ? 'Em processamento' : 'N/A')
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
      XLSX.writeFile(wb, `relatorio_usuarios_procvisual_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      alert('Erro ao gerar relatório');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'usuarios', userToDelete.id));
      setUserToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `usuarios/${userToDelete.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (user: UserProfile) => {
    setTogglingUserId(user.id);
    const newActiveState = !user.isActive;
    try {
      await firestoreUpdateDoc(doc(db, 'usuarios', user.id), {
        isActive: newActiveState,
        manuallyBlocked: !newActiveState, // Se o admin desativou, bloqueia manualmente
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `usuarios/${user.id}`);
      alert('Erro ao alterar status');
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleSyncStripe = async (userId: string) => {
    setSyncingUserId(userId);
    try {
      const res = await fetch(`/api/subscription-details?userId=${userId}`);
      if (!res.ok) throw new Error('Erro ao buscar dados no Stripe');
      const data = await res.json();
      console.log('>>> [ADMIN] Sincronização Stripe concluída:', data);
      
      if (data.status === 'active' || data.isActive) {
        alert('✅ Dados sincronizados! Assinatura ativa encontrada e data atualizada.');
      } else {
        alert('ℹ️ Sincronizado, mas nenhuma assinatura ativa foi encontrada para este usuário no Stripe.');
      }
    } catch (err) {
      console.error('Erro ao sincronizar Stripe:', err);
      alert('❌ Erro ao sincronizar dados com o Stripe');
    } finally {
      setSyncingUserId(null);
    }
  };

  const formatDate = (val: any) => {
    if (!val) return null;
    try {
      if (val.toDate) return val.toDate().toLocaleDateString('pt-BR');
      if (val instanceof Date) return val.toLocaleDateString('pt-BR');
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    } catch (e) {
      console.warn('Erro ao formatar data:', e);
    }
    return null;
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const activeCount = useMemo(() => {
    return users.filter(u => u.isActive).length;
  }, [users]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="text-proc-cyan animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-proc-secondary/20 border border-white/10 p-6 rounded-[2.5rem] flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
            <Users size={24} />
          </div>
          <div>
            <p className="text-proc-text-sec text-[10px] font-bold uppercase tracking-widest">Total Usuários</p>
            <p className="text-2xl font-bold text-proc-text-main">{users.length}</p>
          </div>
        </div>

        <div className="bg-proc-secondary/20 border border-white/10 p-6 rounded-[2.5rem] flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-proc-green/10 flex items-center justify-center text-proc-green">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-proc-text-sec text-[10px] font-bold uppercase tracking-widest">Usuários Ativos</p>
            <p className="text-2xl font-bold text-proc-text-main">{activeCount}</p>
          </div>
        </div>

        <div className="bg-proc-secondary/20 border border-white/10 p-6 rounded-[2.5rem] flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-proc-text-sec text-[10px] font-bold uppercase tracking-widest">Conversão</p>
            <p className="text-2xl font-bold text-proc-text-main">
              {users.length > 0 ? ((activeCount / users.length) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        <button 
          onClick={handleRunNotifications}
          disabled={isNotifying}
          className="bg-proc-cyan/10 border border-proc-cyan/20 p-6 rounded-[2.5rem] flex flex-col justify-center gap-2 hover:bg-proc-cyan/20 transition-all text-left shadow-xl group disabled:opacity-50"
        >
          <div className="flex items-center justify-between w-full">
            <div className={`w-10 h-10 rounded-xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan ${isNotifying ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`}>
              {isNotifying ? <RefreshCw size={20} /> : <BellRing size={24} />}
            </div>
            {notifyResult && (
              <span className="text-[10px] font-bold bg-proc-green/20 text-proc-green px-2 py-1 rounded">
                Sucesso: {notifyResult.notified ?? 0}
              </span>
            )}
          </div>
          <div>
            <p className="text-proc-cyan text-[10px] font-bold uppercase tracking-widest">Disparar Notificações</p>
            <p className="text-proc-text-sec text-[10px]">Executar rotina de vencimentos</p>
          </div>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-bold text-proc-text-main">Gestão de Usuários</h3>
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="text"
                placeholder="DDD + Número (ex: 19991234567)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, ""))}
                className="bg-proc-bg/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-proc-text-main w-48 focus:outline-none focus:border-proc-cyan/30"
              />
              <button 
                onClick={handleTestWhatsApp}
                disabled={isTestingWA || !testPhone}
                className="bg-proc-cyan/20 hover:bg-proc-cyan/30 text-proc-cyan px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isTestingWA ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Testar WhatsApp
              </button>
            </div>
          </div>
          
          <div className="relative w-full md:w-auto flex items-center gap-3">
            <button 
              onClick={handleExportExcel}
              className="bg-proc-green/20 hover:bg-proc-green/30 text-proc-green px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-proc-green/30"
            >
              <FileDown size={16} />
              Exportar Excel
            </button>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-proc-text-sec" size={16} />
              <input 
                type="text"
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-proc-bg/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-proc-text-main focus:outline-none focus:border-proc-cyan/30 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec">Usuário</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec text-center">Assinatura</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec text-center">Data de Assinatura</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec text-center">Criado em</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-proc-text-main">{user.nome || 'Sem Nome'}</span>
                      <span className="text-xs text-proc-text-sec">{user.email}</span>
                      {user.telefone && <span className="text-[10px] text-proc-cyan/70 mt-0.5">{user.telefone}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      user.isActive 
                        ? 'bg-proc-green/10 text-proc-green border border-proc-green/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${user.isActive ? 'bg-proc-green' : 'bg-red-400'}`} />
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-bold text-proc-green font-mono">
                      {user.valorAssinatura ? `R$ ${user.valorAssinatura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm text-proc-text-main font-mono">
                      {formatDate(user.dataAssinatura) || formatDate(user.lastPayment) || 
                       (user.isActive ? <span className="text-proc-cyan animate-pulse">Sincronizar...</span> : 'N/A')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs text-proc-text-sec">
                      {user.dataCriacao?.toDate ? user.dataCriacao.toDate().toLocaleDateString('pt-BR') : 'Sem data'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleSyncStripe(user.id)}
                        disabled={syncingUserId === user.id}
                        className="p-2 text-proc-cyan/60 hover:text-proc-cyan hover:bg-proc-cyan/10 rounded-lg transition-all"
                        title="Sincronizar com Stripe (Puxar data histórica)"
                      >
                        {syncingUserId === user.id ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                      </button>
                      <button 
                        onClick={() => handleToggleActive(user)}
                        disabled={togglingUserId === user.id}
                        className={`p-2 rounded-lg transition-all ${
                          user.isActive 
                            ? 'text-proc-green/60 hover:text-proc-green hover:bg-proc-green/10' 
                            : 'text-proc-text-sec/60 hover:text-proc-text-main hover:bg-white/10'
                        }`}
                        title={user.isActive ? "Desativar Usuário" : "Ativar Usuário"}
                      >
                        {togglingUserId === user.id ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
                      </button>
                      <button 
                        onClick={() => handleNotifyIndividual(user.id)}
                        disabled={notifyingUserId === user.id}
                        className="p-2 text-proc-cyan/60 hover:text-proc-cyan hover:bg-proc-cyan/10 rounded-lg transition-all"
                        title="Disparar Notificações para este usuário"
                      >
                        {notifyingUserId === user.id ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={18} />}
                      </button>
                      <button 
                        onClick={() => setUserToDelete(user)}
                        className="p-2 text-proc-text-sec/60 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="Excluir Usuário"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-proc-text-sec">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserToDelete(null)}
              className="absolute inset-0 bg-proc-bg/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-proc-secondary border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500/30" />
              
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                  <AlertTriangle size={32} />
                </div>
                
                <h3 className="text-xl font-bold text-proc-text-main">Excluir Usuário?</h3>
                <p className="text-proc-text-sec text-sm leading-relaxed">
                  Você está prestes a excluir permanentemente <span className="text-proc-text-main font-bold">{userToDelete.email}</span>.
                  Esta ação não pode ser desfeita e removerá o perfil do banco de dados.
                </p>

                <div className="grid grid-cols-2 gap-4 w-full mt-6">
                  <button 
                    onClick={() => setUserToDelete(null)}
                    className="py-3 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-proc-text-main font-bold transition-all border border-white/5"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleDeleteUser}
                    disabled={isDeleting}
                    className="py-3 px-6 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
