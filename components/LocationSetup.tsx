'use client';

import { useState } from 'react';
import type { CityInfo } from '@/lib/types';
import { resolveCityFromPostal } from '@/lib/types';

interface Props {
  onCitySelected: (city: CityInfo) => void;
}

const DEMO_CITIES: Array<{ label: string; postal: string }> = [
  { label: 'Markham, ON', postal: 'L3R 2A1' },
  { label: 'Toronto, ON', postal: 'M5V 3A9' },
  { label: 'San Francisco, CA', postal: '94102' },
];

export default function LocationSetup({ onCitySelected }: Props) {
  const [postal, setPostal] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const city = resolveCityFromPostal(postal);
    if (!city) {
      setError('Postal code not recognized. Try L3R 2A1 (Markham), M5V 3A9 (Toronto), or 94102 (SF).');
      return;
    }
    setError('');
    onCitySelected(city);
  }

  function handleDemoCity(p: string) {
    setPostal(p);
    setError('');
    const city = resolveCityFromPostal(p);
    if (city) onCitySelected(city);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-4xl shadow-lg shadow-green-500/30">
          ♻️
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Recykle</h1>
        <p className="mt-2 text-gray-400">Your AI recycling assistant</p>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm">
        <p className="mb-4 text-center text-sm text-gray-400">
          Enter your postal code so Recykle knows your local recycling rules.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={postal}
            onChange={(e) => {
              setPostal(e.target.value);
              setError('');
            }}
            placeholder="e.g. L3R 2A1 or 94102"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-widest text-white placeholder-gray-500 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            autoCapitalize="characters"
            autoComplete="postal-code"
          />

          {error && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={!postal.trim()}
            className="w-full rounded-xl bg-green-500 py-3 text-lg font-semibold text-white transition-all hover:bg-green-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Get Started →
          </button>
        </form>

        {/* Demo shortcuts */}
        <div className="mt-6">
          <p className="mb-3 text-center text-xs text-gray-500 uppercase tracking-wider">
            Demo cities
          </p>
          <div className="flex flex-col gap-2">
            {DEMO_CITIES.map((c) => (
              <button
                key={c.postal}
                onClick={() => handleDemoCity(c.postal)}
                className="rounded-lg border border-white/10 py-2 text-sm text-gray-300 transition hover:border-green-500/50 hover:bg-white/5 hover:text-white"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-gray-600">
        Powered by Gemini Live API · Google Cloud
      </p>
    </div>
  );
}
