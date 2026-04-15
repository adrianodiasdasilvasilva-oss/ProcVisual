import React from 'react';
import LandingHeader from './LandingHeader';
import LandingHero from './LandingHero';
import LandingPreview from './LandingPreview';
import LandingFeatures from './LandingFeatures';
import LandingHowItWorks from './LandingHowItWorks';
import LandingPricing from './LandingPricing';
import LandingFooter from './LandingFooter';
import LegalModal from './LegalModal';

interface LandingPageProps {
  onLogin: () => void;
  onSignUp: () => void;
}

export default function LandingPage({ onLogin, onSignUp }: LandingPageProps) {
  const [legalModal, setLegalModal] = React.useState<{ isOpen: boolean; type: 'terms' | 'privacy' }>({
    isOpen: false,
    type: 'terms'
  });

  const openLegal = (type: 'terms' | 'privacy') => {
    setLegalModal({ isOpen: true, type });
  };

  return (
    <div className="min-h-screen bg-proc-bg text-white font-sans selection:bg-proc-green/30 overflow-x-hidden">
      <LandingHeader onLogin={onLogin} onSignUp={onSignUp} />
      
      <main>
        <LandingHero onStart={onSignUp} onLogin={onLogin} />
        <LandingPreview />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingPricing onSignUp={onSignUp} />
      </main>

      <LandingFooter onOpenLegal={openLegal} />

      <LegalModal 
        isOpen={legalModal.isOpen} 
        onClose={() => setLegalModal(prev => ({ ...prev, isOpen: false }))} 
        type={legalModal.type} 
      />
    </div>
  );
}
