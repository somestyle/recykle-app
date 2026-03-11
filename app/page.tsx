'use client';

import { useState } from 'react';
import LocationSetup from '@/components/LocationSetup';
import LiveScanner from '@/components/LiveScanner';
import HistoryList from '@/components/HistoryList';
import type { CityInfo } from '@/lib/types';

type AppScreen = 'setup' | 'scanner' | 'history';

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>('setup');
  // Use a key so each new screen re-mounts with its enter animation
  const [screenKey, setScreenKey] = useState(0);
  const [city, setCity] = useState<CityInfo | null>(null);

  function go(next: AppScreen) {
    setScreen(next);
    setScreenKey(k => k + 1);
  }

  function handleCitySelected(selected: CityInfo) {
    setCity(selected);
    go('scanner');
  }

  return (
    // `overflow-hidden` ONLY on the scanner — applied per-screen inside LiveScanner.
    // Here we allow scroll so HistoryList can scroll on iOS.
    <main className="h-screen w-full bg-black">
      {screen === 'setup' && (
        <LocationSetup key={screenKey} onCitySelected={handleCitySelected} />
      )}

      {screen === 'scanner' && city && (
        <LiveScanner
          key={screenKey}
          city={city}
          onOpenHistory={() => go('history')}
        />
      )}

      {screen === 'history' && (
        <HistoryList key={screenKey} onBack={() => go('scanner')} />
      )}
    </main>
  );
}
