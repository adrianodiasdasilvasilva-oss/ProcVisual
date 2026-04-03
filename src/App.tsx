import { useState } from 'react';
import Header from './components/Header';
import Filters from './components/Filters';
import ActionButtons from './components/ActionButtons';
import HealthGauge from './components/HealthGauge';
import SummaryCard from './components/SummaryCard';
import MainChart from './components/MainChart';
import QuickCards from './components/QuickCards';
import BottomNav from './components/BottomNav';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-proc-bg text-white font-sans selection:bg-proc-green/30 pb-24">
      <Header balance={24850.42} />
      
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
                <ActionButtons />
                <HealthGauge percentage={82} />
                <SummaryCard />
                <MainChart />
                <QuickCards />
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
    </div>
  );
}
