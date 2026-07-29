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
import { Users, UserCheck, Calendar, Search, Loader2, Bell, RefreshCw, FileDown, Trash2, X, AlertTriangle, Power, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { checkUserAccess, getTrialEndDate } from '../lib/trial';

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
  const [selectedUserForMessage, setSelectedUserForMessage] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [lastCronStatus, setLastCronStatus] = useState<any>(null);

  useEffect(() => {
    if (!db) return;
    
    // Solo permitir el listener si el usuario es Admin (esto se verifica en las reglas, 
    // pero aquí evitamos el error en consola si no lo es)
    const unsubscribe = onSnapshot(doc(db, 'config', 'lastCronRun'), 
      (snapshot) => {
        if (snapshot.exists()) {
          setLastCronStatus(snapshot.data());
        }
      },
      (error) => {
        console.warn('>>> [ADMIN] Falha ao monitorar cron (pode ser falta de permissão):', error.message);
      }
    );
    return () => unsubscribe();
  }, []);

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
      const count = data.results?.notified || 0;
      alert(`✅ Processamento global concluído: ${count} notificações enviadas.`);
    } catch (err) {
      console.error('Erro ao disparar notificações:', err);
      alert('❌ Erro de conexão ao disparar notificações globais');
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
      if (count === 0) {
        alert('ℹ️ Nenhuma despesa ou aniversário vencendo hoje/amanhã para este usuário.');
      } else {
        alert(`✅ Processamento concluído: ${count} notificação(ões) enviada(s).`);
      }
    } catch (err) {
      console.error('Erro ao disparar notificação individual:', err);
      alert('❌ Erro ao enviar notificação');
    } finally {
      setNotifyingUserId(null);
    }
  };

  const handleSendCustomMessage = async () => {
    if (!selectedUserForMessage) {
      alert('Selecione um usuário');
      return;
    }
    if (!customMessage.trim()) {
      alert('Digite uma mensagem');
      return;
    }

    setIsSendingMessage(true);
    try {
      const res = await fetch('/api/admin/send-custom-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: selectedUserForMessage, 
          message: customMessage 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Mensagem enviada com sucesso!');
        setCustomMessage('');
      } else {
        alert('❌ Erro: ' + (data.error || 'Falha ao enviar'));
      }
    } catch (err) {
      alert('❌ Erro de conexão');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getTrialInfo = (user: UserProfile) => {
    const access = checkUserAccess(user);
    if (user.isActive) {
      return {
        status: 'paid',
        label: 'Assinante (Pago)',
        badgeClass: 'bg-proc-green/10 text-proc-green border border-proc-green/20 font-medium',
        timeText: 'Acesso Ativo'
      };
    }

    if (access.reason === 'trial_active') {
      const trialEnd = getTrialEndDate(user);
      if (!trialEnd) {
        return {
          status: 'trial_active',
          label: 'Em Teste',
          badgeClass: 'bg-proc-cyan/15 text-proc-cyan border border-proc-cyan/30 font-bold',
          timeText: '7 Dias Grátis'
        };
      }
      const diffMs = trialEnd.getTime() - Date.now();
      if (diffMs > 0) {
        const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        const mins = Math.floor((diffMs / (1000 * 60)) % 60);

        let timeText = '';
        if (days > 0) {
          timeText = `${days}d ${hours}h restantes`;
        } else if (hours > 0) {
          timeText = `${hours}h ${mins}m restantes`;
        } else {
          timeText = `${mins}m restantes`;
        }

        return {
          status: 'trial_active',
          label: 'Teste Grátis',
          badgeClass: 'bg-proc-cyan/20 text-proc-cyan border border-proc-cyan/40 font-bold',
          timeText
        };
      }
    }

    if (access.reason === 'trial_expired') {
      return {
        status: 'trial_expired',
        label: 'Teste Expirado',
        badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium',
        timeText: 'Finalizado (0d)'
      };
    }

    if (access.reason === 'phone_blocked') {
      return {
        status: 'phone_blocked',
        label: 'Tel. Duplicado',
        badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20 font-medium',
        timeText: 'Bloqueado'
      };
    }

    return {
      status: 'inactive',
      label: 'Sem Teste',
      badgeClass: 'bg-white/5 text-proc-text-sec border border-white/10 font-medium',
      timeText: 'Inativo'
    };
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = filteredUsers.map(u => {
        const trialInfo = getTrialInfo(u);
        return {
          Nome: u.nome || 'Sem Nome',
          Email: u.email,
          Telefone: u.telefone || 'N/A',
          'Teste Gratis': trialInfo.label,
          'Tempo Restante Teste': trialInfo.timeText,
          Status: u.isActive ? 'Ativo' : 'Inativo',
          'Data Criacao': formatDate(u.dataCriacao) || 'N/A',
          'Data Assinatura': formatDate(u.dataAssinatura) || formatDate(u.lastPayment) || (u.isActive ? 'Em processamento' : 'N/A')
        };
      });

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

  const trialActiveCount = useMemo(() => {
    return users.filter(u => !u.isActive && checkUserAccess(u).reason === 'trial_active').length;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-proc-secondary/20 border border-white/10 p-5 rounded-[2.5rem] flex items-center gap-3.5 shadow-xl">
          <div className="w-11 h-11 rounded-2xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan shrink-0">
            <Users size={22} />
          </div>
          <div>
            <p className="text-proc-text-sec text-[10px] font-bold uppercase tracking-widest">Total Usuários</p>
            <p className="text-xl font-bold text-proc-text-main">{users.length}</p>
          </div>
        </div>

        <div className="bg-proc-secondary/20 border border-white/10 p-5 rounded-[2.5rem] flex items-center gap-3.5 shadow-xl">
          <div className="w-11 h-11 rounded-2xl bg-proc-green/10 flex items-center justify-center text-proc-green shrink-0">
            <UserCheck size={22} />
          </div>
          <div>
            <p className="text-proc-text-sec text-[10px] font-bold uppercase tracking-widest">Usuários Ativos</p>
            <p className="text-xl font-bold text-proc-text-main">{activeCount}</p>
          </div>
        </div>

        <div className="bg-proc-secondary/20 border border-proc-cyan/20 p-5 rounded-[2.5rem] flex items-center gap-3.5 shadow-xl bg-gradient-to-br from-proc-cyan/10 to-transparent">
          <div className="w-11 h-11 rounded-2xl bg-proc-cyan/20 flex items-center justify-center text-proc-cyan shrink-0 animate-pulse">
            <Timer size={22} />
          </div>
          <div>
            <p className="text-proc-cyan text-[10px] font-bold uppercase tracking-widest">Em Teste Grátis</p>
            <p className="text-xl font-bold text-proc-cyan">{trialActiveCount}</p>
          </div>
        </div>

        <div className="bg-proc-secondary/20 border border-white/10 p-5 rounded-[2.5rem] flex items-center gap-3.5 shadow-xl">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
            <Calendar size={22} />
          </div>
          <div>
            <p className="text-proc-text-sec text-[10px] font-bold uppercase tracking-widest">Conversão</p>
            <p className="text-xl font-bold text-proc-text-main">
              {users.length > 0 ? ((activeCount / users.length) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        <button 
          onClick={handleRunNotifications}
          disabled={isNotifying}
          className="bg-proc-cyan/10 border border-proc-cyan/20 p-5 rounded-[2.5rem] flex flex-col justify-center gap-1.5 hover:bg-proc-cyan/20 transition-all text-left shadow-xl group disabled:opacity-50"
        >
          <div className="flex items-center justify-between w-full">
            <div className={`w-9 h-9 rounded-xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan ${isNotifying ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`}>
              {isNotifying ? <RefreshCw size={18} /> : <Bell size={20} />}
            </div>
            {notifyResult && (
              <span className="text-[10px] font-bold bg-proc-green/20 text-proc-green px-2 py-0.5 rounded">
                Envios: {notifyResult.notified ?? 0}
              </span>
            )}
          </div>
          <div>
            <p className="text-proc-cyan text-[10px] font-bold uppercase tracking-widest">Disparar Notificações</p>
            <p className="text-proc-text-sec text-[9px]">Rotina de vencimentos</p>
          </div>
        </button>
      </div>

      {/* Custom Message Section */}
      <div className="bg-proc-secondary/20 border border-white/10 p-6 rounded-[2.5rem] shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-proc-cyan/10 flex items-center justify-center text-proc-cyan">
            <Bell size={20} />
          </div>
          <h3 className="text-lg font-bold text-proc-text-main">Disparar Mensagem Avulsa</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-proc-text-sec ml-2">Selecionar Usuário</label>
            <select 
              value={selectedUserForMessage}
              onChange={(e) => setSelectedUserForMessage(e.target.value)}
              className="w-full bg-proc-bg/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-proc-text-main focus:outline-none focus:border-proc-cyan/30 appearance-none"
            >
              <option value="">Escolha um usuário...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nome || u.email} {u.telefone ? `(${u.telefone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-6 space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-proc-text-sec ml-2">Mensagem do Administrador</label>
            <input 
              type="text"
              placeholder="Digite o texto da mensagem para enviar pelo WhatsApp..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full bg-proc-bg/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-proc-text-main focus:outline-none focus:border-proc-cyan/30"
              onKeyDown={(e) => e.key === 'Enter' && handleSendCustomMessage()}
            />
          </div>

          <div className="md:col-span-2">
            <button 
              onClick={handleSendCustomMessage}
              disabled={isSendingMessage || !selectedUserForMessage || !customMessage}
              className="w-full bg-proc-cyan text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-proc-cyan/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isSendingMessage ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-proc-text-main">Gestão de Usuários</h3>
              {lastCronStatus && (
                <div className={`text-[10px] flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${lastCronStatus.status === 'success' ? 'bg-proc-green/10 border-proc-green/30 text-proc-green' : 'bg-proc-cyan/10 border-proc-cyan/30 text-proc-cyan'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${lastCronStatus.status === 'success' ? 'bg-proc-green animate-pulse' : 'bg-proc-cyan animate-pulse'}`} />
                  Último Envio: {
                    lastCronStatus.timestamp?.toDate 
                      ? lastCronStatus.timestamp.toDate().toLocaleString('pt-BR') 
                      : lastCronStatus.timestamp 
                        ? new Date(lastCronStatus.timestamp).toLocaleString('pt-BR')
                        : 'Aguardando'
                  } | Notificados: {lastCronStatus.results?.notified || 0}
                </div>
              )}
            </div>
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
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-cyan">Teste Grátis / Tempo</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec text-center">Data de Assinatura</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec text-center">Criado em</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => {
                const trialInfo = getTrialInfo(user);
                return (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-proc-text-main">{user.nome || 'Sem Nome'}</span>
                        <span className="text-xs text-proc-text-sec">{user.email}</span>
                        {user.telefone && <span className="text-[10px] text-proc-cyan/70 mt-0.5">{user.telefone}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${trialInfo.badgeClass}`}>
                          {trialInfo.status === 'trial_active' && <span className="w-1.5 h-1.5 rounded-full bg-proc-cyan animate-pulse" />}
                          {trialInfo.label}
                        </span>
                        <span className={`text-xs font-mono font-medium ${trialInfo.status === 'trial_active' ? 'text-proc-cyan font-bold' : 'text-proc-text-sec'}`}>
                          {trialInfo.timeText}
                        </span>
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
                        {notifyingUserId === user.id ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
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
              );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-proc-text-sec">
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
