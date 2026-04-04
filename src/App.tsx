import { useState, useEffect } from 'react';
import Header from './components/Header';
import Filters from './components/Filters';
import ActionButtons from './components/ActionButtons';
import HealthGauge from './components/HealthGauge';
import SummaryCard from './components/SummaryCard';
import MainChart from './components/MainChart';
import QuickCards from './components/QuickCards';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import NewTransactionModal from './components/NewTransactionModal';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { LogIn, Loader2 } from 'lucide-react';

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
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Save/Update user in Firestore
        const userRef = doc(db, 'usuarios', currentUser.uid);
        try {
          await setDoc(userRef, {
            nome: currentUser.displayName || 'Usuário',
            email: currentUser.email,
            dataCriacao: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          console.error('Error saving user:', error);
        }
      } else {
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

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
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
      return <LoginScreen onLogin={handleLogin} />;
    }
    return <LandingPage onLogin={() => setShowLogin(true)} />;
  }

  const totalIncome = transactions
    .filter(t => t.tipo === 'income')
    .reduce((acc, curr) => acc + curr.valor, 0);
    
  const totalExpense = transactions
    .filter(t => t.tipo === 'expense')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const balance = totalIncome - totalExpense;

  return (
    <div className="min-h-screen bg-proc-bg text-white font-sans selection:bg-proc-green/30 flex flex-col md:flex-row">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto pb-24 md:pb-0">
        <Header balance={balance} />
        
        <main className="w-full max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <Filters />
            <div className="hidden md:block">
              <ActionButtons onNewTransaction={() => setIsModalOpen(true)} />
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
                    <ActionButtons onNewTransaction={() => setIsModalOpen(true)} />
                  </div>
                  
                  {isLoading ? (
                    <div className="py-20 flex justify-center">
                      <Loader2 className="text-proc-cyan animate-spin" size={32} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Left Column - Stats & Summary */}
                      <div className="md:col-span-4 space-y-6">
                        <HealthGauge percentage={balance > 0 ? 82 : 45} />
                        <SummaryCard income={totalIncome} expense={totalExpense} />
                        <QuickCards income={totalIncome} expense={totalExpense} />
                      </div>

                      {/* Right Column - Chart & Activity */}
                      <div className="md:col-span-8 space-y-6">
                        <MainChart transactions={transactions} />
                        
                        {/* Desktop Activity Feed Placeholder or List */}
                        <div className="bg-proc-secondary/20 border border-white/5 rounded-[2.5rem] p-6">
                          <h3 className="text-white font-bold text-lg mb-4">Atividade Recente</h3>
                          <div className="space-y-4">
                            {transactions.slice(0, 5).map((t) => (
                              <div key={t.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all">
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.tipo === 'income' ? 'bg-proc-green/10 text-proc-green' : 'bg-red-500/10 text-red-500'}`}>
                                    <div className="w-2 h-2 rounded-full bg-current" />
                                  </div>
                                  <div>
                                    <p className="text-white font-medium text-sm">{t.descricao || t.estabelecimento || 'Sem descrição'}</p>
                                    <p className="text-proc-text-sec text-xs">{t.categoria} • {new Date(t.data).toLocaleDateString('pt-BR')}</p>
                                  </div>
                                </div>
                                <p className={`font-bold text-sm ${t.tipo === 'income' ? 'text-proc-green' : 'text-red-500'}`}>
                                  {t.tipo === 'income' ? '+' : '-'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            ))}
                            {transactions.length === 0 && (
                              <p className="text-proc-text-sec text-center py-8">Nenhum lançamento encontrado.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
                  <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-widest">
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
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* New Transaction Modal */}
      <NewTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
