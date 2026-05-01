import React, { useState, useEffect } from 'react';
import { Search, User as UserIcon, LogOut, Sun, Moon } from 'lucide-react';
import { auth, db } from '../firebase';
import Logo from './Logo';
import { doc, onSnapshot } from 'firebase/firestore';

interface HeaderProps {
  balance: number;
}

export default function Header({ balance }: HeaderProps) {
  const user = auth.currentUser;
  const [photoURL, setPhotoURL] = useState<string | null>(user?.photoURL || null);
  const [displayName, setDisplayName] = useState<string | null>(user?.displayName || null);

  useEffect(() => {
    if (!user) return;

    // Listen to user data in Firestore for the profile picture and name
    const userRef = doc(db, 'usuarios', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.fotoURL) {
          setPhotoURL(data.fotoURL);
        }
        if (data.nome) {
          setDisplayName(data.nome);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  const firstName = displayName ? displayName.split(' ')[0] : '';

  return (
    <header className="sticky top-0 z-40 bg-proc-bg/80 backdrop-blur-md px-6 md:px-8 py-4 flex justify-between items-center border-b border-proc-border">
      <div className="flex items-center gap-3 md:hidden">
        <Logo size="small" className="h-7" />
        <div className="flex flex-col">
          <h1 className="text-lg font-bold tracking-tight text-proc-text-main leading-none">
            Proc<span className="text-proc-cyan">Visual</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[8px] text-proc-text-sec uppercase tracking-widest font-semibold">Saldo</span>
            <span className={`text-[10px] font-bold ${balance < 0 ? 'text-red-500' : 'text-proc-cyan'}`}>
              R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        {firstName && (
          <div className="ml-1 pl-3 border-l border-proc-text-sec/20 flex flex-col justify-center">
            <span className="text-[10px] text-proc-text-sec uppercase tracking-widest font-bold leading-none mb-1">Olá,</span>
            <span className="text-xs font-bold text-proc-cyan leading-none">{firstName}</span>
          </div>
        )}
      </div>

      <div className="hidden md:flex items-center gap-6 flex-1">
        <div className="relative max-w-md w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-proc-text-sec group-focus-within:text-proc-cyan transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar lançamentos, categorias..." 
            className="w-full bg-proc-secondary/30 border border-proc-border rounded-2xl py-2.5 pl-12 pr-4 text-sm text-proc-text-main placeholder:text-proc-text-sec focus:outline-none focus:border-proc-cyan/30 focus:bg-proc-secondary/50 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-proc-cyan/5 rounded-2xl border border-proc-cyan/10">
          <span className="text-[10px] text-proc-text-sec uppercase tracking-widest font-bold">Saldo Consolidado</span>
          <span className={`text-sm font-bold ${balance < 0 ? 'text-red-500' : 'text-proc-cyan'}`}>
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-3 pr-4 border-r border-proc-border">
          <div 
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-proc-cyan to-proc-green p-[1px] shadow-[0_0_15px_rgba(0,209,255,0.2)] group relative"
          >
            <div className="w-full h-full rounded-[11px] bg-proc-bg flex items-center justify-center overflow-hidden">
              {photoURL ? (
                <img src={photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={20} className="text-proc-cyan" />
              )}
            </div>
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-bold text-proc-text-main leading-none">{displayName || user?.displayName || 'Usuário'}</p>
            <p className="text-[10px] text-proc-text-sec mt-1">Premium Plan</p>
          </div>
        </div>

        <button 
          onClick={() => auth.signOut()}
          className="md:hidden p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
