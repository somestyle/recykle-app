'use client';

import { useState, useRef, useEffect, CSSProperties } from 'react';
import LocationSetup from '@/components/LocationSetup';
import Onboarding from '@/components/Onboarding';
import LiveScanner from '@/components/LiveScanner';
import HistoryList from '@/components/HistoryList';
import type { CityInfo } from '@/lib/types';

type AppScreen = 'setup' | 'onboarding' | 'scanner' | 'history';

const SCREEN_ORDER: AppScreen[] = ['setup', 'onboarding', 'scanner', 'history'];

// Wraps each screen and animates it in using rAF so the browser always
// catches the initial paint before starting the transition.
function ScreenWrapper({
  id, direction, children,
}: {
  id: number;
  direction: 'forward' | 'back';
  children: React.ReactNode;
}) {
  const dx = direction === 'forward' ? 55 : -55;
  const [style, setStyle] = useState<CSSProperties>({
    opacity: 0,
    transform: `translateX(${dx}px)`,
    transition: 'none',
    height: '100%',
    width: '100%',
  });

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setStyle({
        opacity: 1,
        transform: 'translateX(0)',
        transition: 'opacity 0.22s ease, transform 0.28s cubic-bezier(0.25, 1, 0.4, 1)',
        height: '100%',
        width: '100%',
      });
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return <div style={style}>{children}</div>;
}

export default function Home() {
  const [screen, setScreen]     = useState<AppScreen>('setup');
  const [screenKey, setScreenKey] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [city, setCity]           = useState<CityInfo | null>(null);
  const prevScreenRef             = useRef<AppScreen>('setup');
  // Capture direction synchronously before state batch flushes
  const directionRef              = useRef<'forward' | 'back'>('forward');

  function go(next: AppScreen) {
    const fromIdx = SCREEN_ORDER.indexOf(screen);
    const toIdx   = SCREEN_ORDER.indexOf(next);
    const dir: 'forward' | 'back' = toIdx >= fromIdx ? 'forward' : 'back';
    directionRef.current = dir;
    setDirection(dir);
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
      <ScreenWrapper key={screenKey} id={screenKey} direction={directionRef.current}>
        {screen === 'setup' && (
          <LocationSetup onCitySelected={handleCitySelected} onViewNotes={() => go('history')} />
        )}
        {screen === 'onboarding' && city && (
          <Onboarding
            city={city}
            onStart={() => go('scanner')}
            onBack={() => go('setup')}
          />
        )}
        {screen === 'scanner' && city && (
          <LiveScanner
            city={city}
            onOpenHistory={() => go('history')}
            onGoHome={() => go('setup')}
          />
        )}
        {screen === 'history' && (
          <HistoryList onBack={() => go(prevScreenRef.current === 'setup' ? 'setup' : 'scanner')} />
        )}
      </ScreenWrapper>
    </main>
  );
}
