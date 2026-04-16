import { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Users, UserCheck, Calendar, Search, Loader2, BellRing, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface UserProfile {
  id: string;
  nome: string;
  email: string;
  isActive: boolean;
  dataCriacao?: any;
  dataAssinatura?: any;
  telefone?: string;
}

export default function AdminTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNotifying, setIsNotifying] = useState(false);
  const [isTestingWA, setIsTestingWA] = useState(false);
  const [notifyResult, setNotifyResult] = useState<any>(null);
  const [testPhone, setTestPhone] = useState('');

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

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec">Usuário</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec">Data de Assinatura</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-proc-text-sec text-right">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-proc-text-main">{user.nome}</span>
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
                  <td className="px-6 py-4">
                    <span className="text-sm text-proc-text-main font-mono">
                      {user.dataAssinatura?.toDate ? user.dataAssinatura.toDate().toLocaleDateString('pt-BR') : 
                       (user.isActive ? 'Presente' : 'N/A')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xs text-proc-text-sec">
                      {user.dataCriacao?.toDate ? user.dataCriacao.toDate().toLocaleDateString('pt-BR') : 'Sem data'}
                    </span>
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
    </div>
  );
}
