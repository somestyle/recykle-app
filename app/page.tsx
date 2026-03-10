'use client';

import { useState } from 'react';
import LocationSetup from '@/components/LocationSetup';
import LiveScanner from '@/components/LiveScanner';
import HistoryList from '@/components/HistoryList';
import type { CityInfo } from '@/lib/types';

type AppScreen = 'setup' | 'scanner' | 'history';

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>('setup');
  const [city, setCity] = useState<CityInfo | null>(null);

  function handleCitySelected(selected: CityInfo) {
    setCity(selected);
    setScreen('scanner');
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-black">
      {screen === 'setup' && (
        <LocationSetup onCitySelected={handleCitySelected} />
      )}

      {screen === 'scanner' && city && (
        <LiveScanner
          city={city}
          onOpenHistory={() => setScreen('history')}
        />
      )}

      {screen === 'history' && (
        <HistoryList onBack={() => setScreen('scanner')} />
      )}
    </main>
  );
}
