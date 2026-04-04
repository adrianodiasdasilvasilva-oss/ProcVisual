import React from 'react';
import LandingHeader from './LandingHeader';
import LandingHero from './LandingHero';
import LandingFeatures from './LandingFeatures';
import LandingHowItWorks from './LandingHowItWorks';
import LandingPreview from './LandingPreview';
import LandingCTA from './LandingCTA';
import LandingFooter from './LandingFooter';

interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-proc-bg text-white font-sans selection:bg-proc-green/30 overflow-x-hidden">
      <LandingHeader onLogin={onLogin} />
      
      <main>
        <LandingHero onStart={onLogin} />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingPreview />
        <LandingCTA onStart={onLogin} />
      </main>

      <LandingFooter />
    </div>
  );
}
