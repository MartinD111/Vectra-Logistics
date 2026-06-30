'use client';

import { useState, useEffect } from 'react';
import CmrOnboarding from '@/components/cmr/CmrOnboarding';
import CmrWorkspace from '@/components/cmr/CmrWorkspace';

export default function CmrHelperPage() {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    const hideOnboarding = localStorage.getItem('hide_cmr_onboarding');
    if (hideOnboarding === 'true') {
      setShowOnboarding(false);
    } else {
      setShowOnboarding(true);
    }
  }, []);

  if (showOnboarding === null) {
    return <div className="min-h-[calc(100vh-80px)] bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
       <div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
    </div>;
  }

  if (showOnboarding) {
    return <CmrOnboarding onContinue={() => setShowOnboarding(false)} />;
  }

  return <CmrWorkspace />;
}
