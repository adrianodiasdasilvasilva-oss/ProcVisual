import { useState, useEffect } from 'react';
import Header from './components/Header';
import Filters from './components/Filters';
import ActionButtons from './components/ActionButtons';
import HealthGauge from './components/HealthGauge';
import SummaryCard from './components/SummaryCard';
import MainChart from './components/MainChart';
import QuickCards from './components/QuickCards';
import BottomNav from './components/BottomNav';
import NewTransactionModal from './components/NewTransactionModal';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { LogIn, Loader2 } from 'lucide-react';

export interface Transaction {
  id: string;
  userId: string;
  tipo: 'income' | 'expense';
  valor: number;
  categoria: string;
  data: string;
  descricao: string;
  estabelecimento: string;
  formaPagamento: string;
  createdAt: any;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    return (
      <div className="min-h-screen bg-proc-bg flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-proc-cyan/10 flex items-center justify-center text-proc-cyan mb-8 shadow-[0_0_30px_rgba(0,209,255,0.2)]">
          <LogIn size={40} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Proc<span className="text-proc-cyan">Visual</span></h1>
        <p className="text-proc-text-sec mb-8 max-w-xs">Acesse sua conta para gerenciar suas finanças com inteligência visual.</p>
        <button 
          onClick={handleLogin}
          className="w-full max-w-xs py-4 rounded-2xl bg-white text-proc-bg font-bold flex items-center justify-center gap-3 hover:bg-proc-cyan transition-all shadow-xl"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Entrar com Google
        </button>
      </div>
    );
  }

  const totalIncome = transactions
    .filter(t => t.tipo === 'income')
    .reduce((acc, curr) => acc + curr.valor, 0);
    
  const totalExpense = transactions
    .filter(t => t.tipo === 'expense')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const balance = totalIncome - totalExpense;

  return (
    <div className="min-h-screen bg-proc-bg text-white font-sans selection:bg-proc-green/30 pb-24">
      <Header balance={balance} />
      
      <main className="max-w-md mx-auto pt-2">
        <Filters />
        
        <div className="px-6 pt-4">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <ActionButtons onNewTransaction={() => setIsModalOpen(true)} />
                
                {isLoading ? (
                  <div className="py-20 flex justify-center">
                    <Loader2 className="text-proc-cyan animate-spin" size={32} />
                  </div>
                ) : (
                  <>
                    <HealthGauge percentage={balance > 0 ? 82 : 45} />
                    <SummaryCard income={totalIncome} expense={totalExpense} />
                    <MainChart transactions={transactions} />
                    <QuickCards income={totalIncome} expense={totalExpense} />
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="other"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="py-20 text-center"
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

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* New Transaction Modal */}
      <NewTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
