'use client';

import { useState, useRef } from 'react';
import LocationSetup from '@/components/LocationSetup';
import Onboarding from '@/components/Onboarding';
import LiveScanner from '@/components/LiveScanner';
import HistoryList from '@/components/HistoryList';
import type { CityInfo } from '@/lib/types';

type AppScreen = 'setup' | 'onboarding' | 'scanner' | 'history';

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>('setup');
  // Use a key so each new screen re-mounts with its enter animation
  const [screenKey, setScreenKey] = useState(0);
  const [city, setCity] = useState<CityInfo | null>(null);
  const prevScreenRef = useRef<AppScreen>('setup');

  function go(next: AppScreen) {
    prevScreenRef.current = screen;
    setScreen(next);
    setScreenKey(k => k + 1);
  }

  function handleCitySelected(selected: CityInfo) {
    setCity(selected);
    go('onboarding');
  }

  return (
    <main className="h-dvh w-full overflow-hidden bg-black">
      {screen === 'setup' && (
        <LocationSetup key={screenKey} onCitySelected={handleCitySelected} onViewNotes={() => go('history')} />
      )}

      {screen === 'onboarding' && city && (
        <Onboarding
          key={screenKey}
          city={city}
          onStart={() => go('scanner')}
          onBack={() => go('setup')}
        />
      )}

      {screen === 'scanner' && city && (
        <LiveScanner
          key={screenKey}
          city={city}
          onOpenHistory={() => go('history')}
          onGoHome={() => go('setup')}
        />
      )}

      {screen === 'history' && (
        <HistoryList key={screenKey} onBack={() => go((prevScreenRef.current === 'setup' ? 'setup' : 'scanner') as AppScreen)} />
      )}
    </main>
  );
}
