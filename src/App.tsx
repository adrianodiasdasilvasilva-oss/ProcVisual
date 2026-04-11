import { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import Filters from './components/Filters';
import ActionButtons from './components/ActionButtons';
import HealthGauge from './components/HealthGauge';
import MainChart from './components/MainChart';
import QuickCards from './components/QuickCards';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import NewTransactionModal from './components/NewTransactionModal';
import Settings from './components/Settings';
import AnalysisTab from './components/AnalysisTab';
import ReportsTab from './components/ReportsTab';
import InteractiveBalloon from './components/InteractiveBalloon';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy, getDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { LogIn, Loader2, Edit3, Trash2, CheckCircle2, Square, CheckSquare, Search, X } from 'lucide-react';

import LandingPage from './components/landing/LandingPage';
import LoginScreen from './components/LoginScreen';

export interface Transaction {
  id: string;
  userId: string;
  tipo: 'income' | 'expense';
  valor: number;
  categoria: string;
  data: string;
  descricao: string;
  estabelecimento: string;
  createdAt: any;
  pago?: boolean;
  notificado5dias?: boolean;
  notificadoNoDia?: boolean;
  groupId?: string; // To group installments
  parcela?: number;
  totalParcelas?: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [filterYears, setFilterYears] = useState<string[]>(['2026']);
  const [filterMonths, setFilterMonths] = useState<string[]>(['Abril']);
  const [filterCategory, setFilterCategory] = useState('Todas Categorias');
  const [searchTerm, setSearchTerm] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Only apply light theme if user is logged in
    if (theme === 'light' && user) {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme, user]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleEditTransactions = () => {
    setActiveTab('lancamentos');
  };

  const handleDeleteTransaction = async (id: string) => {
    setTransactionToDelete(id);
  };

  const handleTogglePaid = async (transaction: Transaction) => {
    const path = 'lancamentos';
    try {
      await setDoc(doc(db, path, transaction.id), {
        pago: !transaction.pago
      }, { merge: true });
    } catch (error) {
      console.error('Erro ao atualizar status de pagamento:', error);
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const monthMap: { [key: string]: number } = {
    'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3, 'Maio': 4, 'Junho': 5,
    'Julho': 6, 'Agosto': 7, 'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    // Always include current year and surrounding years as a baseline
    const currentYear = new Date().getFullYear();
    years.add((currentYear - 1).toString());
    years.add(currentYear.toString());
    years.add((currentYear + 1).toString());
    
    // Add years from transactions
    transactions.forEach(t => {
      const year = new Date(t.data + 'T12:00:00').getFullYear().toString();
      years.add(year);
    });
    
    return Array.from(years).sort();
  }, [transactions]);

  const availableCategories = useMemo(() => {
    const predefined = ['Todas Categorias', 'Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação'];
    // Merge with custom categories and remove duplicates
    const all = Array.from(new Set([...predefined, ...customCategories]));
    return all;
  }, [customCategories]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.data + 'T12:00:00');
      const tYear = tDate.getFullYear().toString();
      const tMonth = tDate.getMonth();
      
      const yearMatch = filterYears.length === 0 || filterYears.includes(tYear);
      const monthMatch = filterMonths.length === 0 || filterMonths.some(m => monthMap[m] === tMonth);
      const categoryMatch = filterCategory === 'Todas Categorias' || t.categoria === filterCategory;
      
      return yearMatch && monthMatch && categoryMatch;
    });
  }, [transactions, filterYears, filterMonths, filterCategory]);

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    
    const path = 'lancamentos';
    try {
      await deleteDoc(doc(db, path, transactionToDelete));
      setTransactionToDelete(null);
      setSelectedIds(prev => prev.filter(id => id !== transactionToDelete));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const searchedTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    
    const normalize = (str: string) => 
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    const term = normalize(searchTerm);
    
    return transactions.filter(t => 
      normalize(t.estabelecimento || '').includes(term) || 
      normalize(t.descricao || '').includes(term)
    );
  }, [transactions, searchTerm]);

  const handleSelectAll = () => {
    if (selectedIds.length === transactions.length && transactions.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map(t => t.id));
    }
  };

  const handleBulkDelete = async () => {
    const path = 'lancamentos';
    try {
      await Promise.all(selectedIds.map(id => deleteDoc(doc(db, path, id))));
      setSelectedIds([]);
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Connection Test
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDoc(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Ensure user exists in Firestore without overwriting existing data
        const userRef = doc(db, 'usuarios', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const userData = {
              nome: currentUser.displayName || 'Usuário',
              email: currentUser.email,
              dataCriacao: serverTimestamp(),
              fotoURL: currentUser.photoURL || ''
            };
            await setDoc(userRef, userData);
            setProfile(userData);
            console.log('Novo usuário criado no Firestore');
          } else {
            setProfile(userSnap.data());
            console.log('Usuário já existe no Firestore');
          }
        } catch (error) {
          console.error('Error ensuring user in Firestore:', error);
        }
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time Transactions Listener
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }

    setIsLoading(true);
    const path = 'lancamentos';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('data', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(docs);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Real-time Categories Listener
  useEffect(() => {
    if (!user) {
      setCustomCategories([]);
      return;
    }

    const categoriesRef = collection(db, 'categorias');
    const q = query(categoriesRef, where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => doc.data().nome as string);
      setCustomCategories(cats);
    });

    return () => unsubscribe();
  }, [user]);

  // Claim Pending WhatsApp Transactions
  useEffect(() => {
    if (!user || !profile?.telefone) return;

    const claimPending = async () => {
      const cleanProfilePhone = profile.telefone.replace(/\D/g, "");
      if (!cleanProfilePhone) return;

      console.log('>>> [CLAIM] Buscando lançamentos pendentes para:', cleanProfilePhone);
      
      try {
        const q = query(
          collection(db, 'lancamentos'),
          where('userId', '==', 'whatsapp_pending'),
          where('telefone', '==', cleanProfilePhone)
        );
        
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          console.log(`>>> [CLAIM] Encontrados ${snapshot.size} lançamentos para vincular.`);
          
          const promises = snapshot.docs.map(d => 
            updateDoc(doc(db, 'lancamentos', d.id), {
              userId: user.uid,
              // We keep the phone for reference but it's now linked to the real user
            })
          );
          
          await Promise.all(promises);
          console.log('>>> [CLAIM] Lançamentos vinculados com sucesso!');
        }
      } catch (error) {
        console.error('>>> [CLAIM] Erro ao vincular lançamentos:', error);
      }
    };

    claimPending();
  }, [user, profile]);

  const handleEmailLogin = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const handleEmailSignUp = async (email: string, pass: string, name: string, phone: string) => {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, pass);
    
    // Save additional user info to Firestore
    const userRef = doc(db, 'usuarios', newUser.uid);
    await setDoc(userRef, {
      nome: name,
      email: email,
      telefone: phone,
      dataCriacao: serverTimestamp()
    }, { merge: true });
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-proc-bg flex items-center justify-center">
        <Loader2 className="text-proc-cyan animate-spin" size={40} />
      </div>
    );
  }

  if (!user) {
    if (showLogin) {
      return (
        <LoginScreen 
          onEmailLogin={handleEmailLogin}
          onEmailSignUp={handleEmailSignUp}
          onBack={() => setShowLogin(false)}
        />
      );
    }
    return <LandingPage onLogin={() => setShowLogin(true)} />;
  }

  const totalIncome = filteredTransactions
    .filter(t => t.tipo === 'income')
    .reduce((acc, curr) => acc + curr.valor, 0);
    
  const totalExpense = filteredTransactions
    .filter(t => t.tipo === 'expense')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const balance = totalIncome - totalExpense;

  // Dynamic Health Calculation
  const healthPercentage = totalIncome === 0 
    ? (totalExpense === 0 ? 100 : 0)
    : Math.max(0, Math.min(100, ((totalIncome - totalExpense) / totalIncome) * 100));

  return (
    <div className="min-h-screen bg-proc-bg text-proc-text-main font-sans selection:bg-proc-green/30 flex flex-col md:flex-row">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onInstall={deferredPrompt ? handleInstallClick : undefined} />
      
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto pb-24 md:pb-0">
        <Header balance={balance} />
        
        <main className="w-full max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <Filters 
              theme={theme} 
              onToggleTheme={toggleTheme} 
              years={filterYears}
              months={filterMonths}
              category={filterCategory}
              availableYears={availableYears}
              availableCategories={availableCategories}
              onFilterChange={(f) => {
                if (f.years) setFilterYears(f.years);
                if (f.months) setFilterMonths(f.months);
                if (f.category) setFilterCategory(f.category);
              }}
            />
            <div className="hidden md:block">
              <ActionButtons 
                onNewTransaction={() => setIsModalOpen(true)} 
                onEditTransactions={handleEditTransactions}
              />
            </div>
          </div>
          
          <div className="md:grid md:grid-cols-12 md:gap-8">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' ? (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="md:col-span-12"
                >
                  <div className="md:hidden mb-6">
                    <ActionButtons 
                      onNewTransaction={() => setIsModalOpen(true)} 
                      onEditTransactions={handleEditTransactions}
                    />
                  </div>
                  
                  {isLoading ? (
                    <div className="py-20 flex justify-center">
                      <Loader2 className="text-proc-cyan animate-spin" size={32} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Left Column - Stats & Summary */}
                      <div className="md:col-span-4 space-y-6">
                        <HealthGauge percentage={healthPercentage} />
                        <QuickCards income={totalIncome} expense={totalExpense} />
                      </div>

                      {/* Right Column - Chart & Activity */}
                      <div className="md:col-span-8 space-y-6">
                        <MainChart 
                          transactions={filteredTransactions} 
                          month={filterMonths.length === 1 ? filterMonths[0] : filterMonths.length > 1 ? `${filterMonths[0]}...` : 'Todos'}
                          year={filterYears.length === 1 ? filterYears[0] : filterYears.length > 1 ? `${filterYears[0]}...` : 'Todos'}
                        />
                        
                        {/* Desktop Activity Feed Placeholder or List */}
                        <div className="bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-6">
                          <h3 className="text-proc-text-main font-bold text-lg mb-4">Lançamentos do mês</h3>
                          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {filteredTransactions.map((t) => (
                              <div key={t.id} className="flex items-center justify-between p-4 rounded-2xl bg-proc-secondary/30 hover:bg-proc-secondary/50 transition-all">
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.tipo === 'income' ? 'bg-proc-green/10 text-proc-green' : 'bg-red-500/10 text-red-500'}`}>
                                    <div className="w-2 h-2 rounded-full bg-current" />
                                  </div>
                                  <div>
                                    <p className="text-proc-text-main font-medium text-sm">{t.estabelecimento || t.descricao || 'Sem descrição'}</p>
                                    <p className="text-proc-text-sec text-xs">{t.categoria} • {new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <p className={`font-bold text-sm ${t.tipo === 'income' ? 'text-proc-green' : 'text-red-500'}`}>
                                    {t.tipo === 'income' ? '+' : '-'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {filteredTransactions.length === 0 && (
                              <p className="text-proc-text-sec text-center py-8">Nenhum lançamento encontrado.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : activeTab === 'lancamentos' ? (
                <motion.div
                  key="lancamentos"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="md:col-span-12"
                >
                  <div className="bg-proc-secondary/20 border border-white/10 rounded-[2.5rem] p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <h3 className="text-proc-text-main font-bold text-xl">Gerenciar Lançamentos</h3>
                        <div className="px-3 py-1 rounded-full bg-proc-cyan/10 text-proc-cyan text-[10px] font-bold uppercase tracking-widest">
                          {transactions.length} Total
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {transactions.length > 0 && (
                          <button 
                            onClick={handleSelectAll}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-proc-text-main text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                          >
                            {selectedIds.length === transactions.length ? <CheckSquare size={16} /> : <Square size={16} />}
                            {selectedIds.length === transactions.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
                          </button>
                        )}
                        {selectedIds.length > 0 && (
                          <button 
                            onClick={() => setShowBulkDeleteConfirm(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                          >
                            <Trash2 size={16} />
                            Excluir ({selectedIds.length})
                          </button>
                        )}
                        <button 
                          onClick={() => setActiveTab('dashboard')}
                          className="text-proc-text-sec hover:text-proc-text-main transition-colors text-sm font-medium"
                        >
                          Voltar para Dashboard
                        </button>
                      </div>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="mb-6 relative group">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-proc-text-sec group-focus-within:text-proc-cyan transition-colors" />
                      <input 
                        type="text"
                        placeholder="Buscar por estabelecimento ou descrição..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-proc-bg/50 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-proc-text-main text-sm focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-bg transition-all"
                      />
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-proc-text-sec hover:text-white transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {searchedTransactions.map((t) => (
                        <div 
                          key={t.id} 
                          className={`flex items-center justify-between p-4 rounded-2xl transition-all border ${
                            selectedIds.includes(t.id) 
                              ? 'bg-proc-cyan/5 border-proc-cyan/30' 
                              : 'bg-proc-secondary/30 hover:bg-proc-secondary/50 border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => handleToggleSelect(t.id)}
                              className={`p-2 rounded-lg transition-all ${
                                selectedIds.includes(t.id) ? 'text-proc-cyan' : 'text-proc-text-sec hover:text-proc-text-main'
                              }`}
                            >
                              {selectedIds.includes(t.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${t.tipo === 'income' ? 'bg-proc-green/10 text-proc-green' : 'bg-red-500/10 text-red-500'}`}>
                              <div className="w-2.5 h-2.5 rounded-full bg-current" />
                            </div>
                            <div>
                              <p className="text-proc-text-main font-bold">{t.estabelecimento || t.descricao || 'Sem descrição'}</p>
                              <p className="text-proc-text-sec text-xs">{t.categoria} • {new Date(t.data).toLocaleDateString('pt-BR')}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className={`font-bold ${t.tipo === 'income' ? 'text-proc-green' : 'text-red-500'}`}>
                                {t.tipo === 'income' ? '+' : '-'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                              {t.tipo === 'expense' && (
                                <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${t.pago ? 'text-proc-green' : 'text-amber-500'}`}>
                                  {t.pago ? 'Pago' : 'Pendente'}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {t.tipo === 'expense' && (
                                <button 
                                  onClick={() => handleTogglePaid(t)}
                                  className={`p-3 rounded-xl transition-all ${t.pago ? 'bg-proc-green/10 text-proc-green hover:bg-proc-green/20' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'}`}
                                  title={t.pago ? "Marcar como Pendente" : "Marcar como Pago"}
                                >
                                  <CheckCircle2 size={18} />
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  setEditingTransaction(t);
                                  setIsModalOpen(true);
                                }}
                                className="p-3 rounded-xl bg-proc-cyan/10 text-proc-cyan hover:bg-proc-cyan/20 transition-all"
                                title="Editar"
                              >
                                <Edit3 size={18} />
                              </button>
                              <button 
                                onClick={() => handleDeleteTransaction(t.id)}
                                className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                                title="Excluir"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {transactions.length > 0 && searchedTransactions.length === 0 && (
                        <div className="py-20 text-center">
                          <p className="text-proc-text-sec">Nenhum lançamento encontrado para "{searchTerm}".</p>
                        </div>
                      )}
                      {transactions.length === 0 && (
                        <div className="py-20 text-center">
                          <p className="text-proc-text-sec">Nenhum lançamento encontrado para gerenciar.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : activeTab === 'analise' ? (
                <motion.div
                  key="analise"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="md:col-span-12"
                >
                  <AnalysisTab 
                    transactions={transactions} 
                    filteredTransactions={filteredTransactions}
                    selectedYears={filterYears}
                    selectedMonths={filterMonths}
                  />
                </motion.div>
              ) : activeTab === 'relatorios' ? (
                <motion.div
                  key="relatorios"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="md:col-span-12"
                >
                  <ReportsTab 
                    transactions={filteredTransactions} 
                    userName={profile?.nome || user?.displayName || 'Usuário'} 
                    selectedYears={filterYears}
                    selectedMonths={filterMonths}
                  />
                </motion.div>
              ) : activeTab === 'configuracoes' ? (
                <motion.div
                  key="configuracoes"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="md:col-span-12"
                >
                  <Settings theme={theme} onToggleTheme={toggleTheme} />
                </motion.div>
              ) : (
                <motion.div
                  key="other"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="md:col-span-12 py-20 text-center"
                >
                  <div className="w-24 h-24 rounded-full bg-proc-secondary/50 border border-white/10 flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <div className="w-12 h-12 rounded-full bg-proc-cyan/20 animate-pulse flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-proc-cyan/40" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-proc-text-main mb-2 uppercase tracking-widest">
                    {activeTab}
                  </h2>
                  <p className="text-proc-text-sec text-sm max-w-[200px] mx-auto">
                    Esta seção está sendo processada visualmente. Em breve disponível.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      <div className="md:hidden">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} onInstall={deferredPrompt ? handleInstallClick : undefined} />
      </div>

      {user && (
        <InteractiveBalloon 
          userData={user} 
          transactionsCount={transactions.length} 
        />
      )}

      {/* New Transaction Modal */}
      <NewTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }} 
        transactionToEdit={editingTransaction}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {transactionToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTransactionToDelete(null)}
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
              <h3 className="text-xl font-bold text-proc-text-main text-center mb-2">Excluir Lançamento?</h3>
              <p className="text-proc-text-sec text-center mb-8">
                Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setTransactionToDelete(null)}
                  className="flex-1 py-4 rounded-2xl bg-proc-secondary/50 text-proc-text-main font-bold hover:bg-proc-secondary/80 transition-all border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBulkDeleteConfirm(false)}
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
              <h3 className="text-xl font-bold text-proc-text-main text-center mb-2">Excluir {selectedIds.length} Lançamentos?</h3>
              <p className="text-proc-text-sec text-center mb-8">
                Tem certeza que deseja excluir todos os lançamentos selecionados? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="flex-1 py-4 rounded-2xl bg-proc-secondary/50 text-proc-text-main font-bold hover:bg-proc-secondary/80 transition-all border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Excluir Tudo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
