'use client';

import { useState, useRef, useEffect } from 'react';
import type { CityInfo } from '@/lib/types';
import { resolveCityFromPostal } from '@/lib/types';

interface Props {
  onCitySelected: (city: CityInfo) => void;
  onViewNotes?: () => void;
}

const DEMO_CITIES = [
  { label: 'Markham',       region: 'ON · Canada', postal: 'L3R 2A1', country: 'CA' },
  { label: 'Toronto',       region: 'ON · Canada', postal: 'M5V 3A9', country: 'CA' },
  { label: 'San Francisco', region: 'CA · USA',    postal: '94102',   country: 'US' },
];

export default function LocationSetup({ onCitySelected, onViewNotes }: Props) {
  const [postal, setPostal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!postal.trim()) return;
    const city = resolveCityFromPostal(postal);
    if (!city) {
      setError('Not recognized. Try L3R 2A1, M5V 3A9, or 94102.');
      return;
    }
    setLoading(true);
    setError('');
    setTimeout(() => onCitySelected(city), 220);
  }

  function handleDemoCity(postal: string) {
    const city = resolveCityFromPostal(postal);
    if (city) {
      setLoading(true);
      setTimeout(() => onCitySelected(city), 180);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase();
    setPostal(val);
    setError('');
    if (val.length >= 5) {
      const city = resolveCityFromPostal(val);
      if (city) {
        setLoading(true);
        setTimeout(() => onCitySelected(city), 180);
      }
    }
  }

  return (
    <div className="screen-enter relative flex h-dvh flex-col items-center justify-center overflow-hidden px-6" style={{ background: 'var(--bg)' }}>

      {/* Ambient radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(34,197,94,0.18) 0%, transparent 70%)',
        }}
      />

      {/* Logo */}
      <div className="relative mb-10 flex flex-col items-center">
        {/* Animated ambient rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="logo-pulse absolute h-24 w-24 rounded-full bg-green-400/15" />
          <div className="logo-pulse-delay absolute h-24 w-24 rounded-full bg-green-400/15" />
        </div>

        {/* Icon circle */}
        <div
          className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: 'linear-gradient(145deg, #22c55e, #16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.35), inset 0 1px 1px rgba(255,255,255,0.2)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
            <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
            <path d="m14 16-3 3 3 3" />
            <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
            <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
            <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
          </svg>
        </div>

        {/* Brand name */}
        <h1 className="mt-5 text-[2.4rem] font-bold tracking-tight" style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Recykle
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          AI-powered recycling assistant
        </p>
      </div>

      {/* Form card */}
      <div className="w-full max-w-[340px]">
        <form onSubmit={handleSubmit}>
          {/* Input */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 stroke-slate-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              value={postal}
              onChange={handleChange}
              placeholder="Postal code or ZIP"
              maxLength={10}
              autoCapitalize="characters"
              autoComplete="postal-code"
              className="w-full rounded-2xl py-4 pl-10 pr-4 text-base font-medium tracking-wider outline-none transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
              style={{
                background: 'var(--surface)',
                border: error ? '1.5px solid rgba(239,68,68,0.6)' : '1.5px solid var(--border)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(34,197,94,0.6)')}
              onBlur={e => (e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.6)' : 'var(--border)')}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {error}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!postal.trim() || loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold text-white transition-all active:scale-[0.98] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-35"
            style={{
              background: postal.trim() && !loading ? 'linear-gradient(145deg, #22c55e, #16a34a)' : 'var(--surface-2)',
              boxShadow: postal.trim() && !loading ? '0 4px 20px rgba(34,197,94,0.3)' : 'none',
              border: postal.trim() && !loading ? 'none' : '1.5px solid var(--border)',
              color: postal.trim() && !loading ? '#fff' : 'var(--text-tertiary)',
            }}
          >
            {loading ? (
              <>
                <span className="spinner inline-block h-4 w-4 rounded-full border-2 border-current/30 border-t-current" />
                <span>Loading…</span>
              </>
            ) : (
              <>
                <span>Confirm location</span>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>or pick a city</span>
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>

        {/* City chips — 3-column horizontal grid */}
        <div className="grid grid-cols-3 gap-2">
          {DEMO_CITIES.map((c) => (
            <button
              key={c.postal}
              onClick={() => handleDemoCity(c.postal)}
              className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center transition-all active:scale-95"
              style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wider"
                style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-tertiary)' }}
              >
                {c.country}
              </span>
              <span className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{c.label}</span>
              <span className="text-[10px] leading-none" style={{ color: 'var(--text-tertiary)' }}>{c.region}</span>
            </button>
          ))}
        </div>

        {/* Notes shortcut */}
        {onViewNotes && (
          <button
            onClick={onViewNotes}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-all active:scale-[0.98]"
            style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 2.5h10a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z" />
              <path d="M7 7h6M7 10h6M7 13h4" />
            </svg>
            View your Notes
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 flex flex-col items-center gap-1">
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Gemini Live API · Google Cloud
        </p>
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Built for a better world ❤️
        </p>
      </div>
    </div>
  );
}
