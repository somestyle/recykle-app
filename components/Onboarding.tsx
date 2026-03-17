'use client';

import { useState, useCallback } from 'react';
import type { CityInfo } from '@/lib/types';

interface Props {
  city: CityInfo;
  onStart: () => void;
  onBack?: () => void;
}

type PermState = 'idle' | 'requesting' | 'granted' | 'denied';

export default function Onboarding({ city, onStart, onBack }: Props) {
  const [camPerm, setCamPerm] = useState<PermState>('idle');
  const [micPerm, setMicPerm] = useState<PermState>('idle');

  const allGranted = camPerm === 'granted' && micPerm === 'granted';

  const requestPermissions = useCallback(async () => {
    setCamPerm('requesting');
    setMicPerm('requesting');
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCamPerm('granted');
      setMicPerm('granted');
    } catch {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setCamPerm('granted');
      } catch {
        setCamPerm('denied');
      }
      try {
        await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setMicPerm('granted');
      } catch {
        setMicPerm('denied');
      }
    }
  }, []);

  const anyDenied = camPerm === 'denied' || micPerm === 'denied';
  const requesting = camPerm === 'requesting' || micPerm === 'requesting';

  return (
    <div
      className="screen-enter flex h-dvh flex-col"
      style={{ background: '#f8fafc' }}
    >
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90"
          style={{ background: 'rgba(0,0,0,0.06)' }}
          aria-label="Go back"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {/* Logo section */}
      <div className="flex shrink-0 flex-col items-center px-6 pt-10 pb-5">
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px]"
          style={{ background: 'linear-gradient(145deg, #22c55e, #16a34a)', boxShadow: '0 8px 28px rgba(34,197,94,0.3)' }}
        >
          <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9">
            <path d="M10 24H7.2a2.4 2.4 0 0 1-2.06-1.16 2.34 2.34 0 0 1-.005-2.34L9.94 12.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.5 24h10.76a2.4 2.4 0 0 0 2.04-1.17 2.34 2.34 0 0 0 0-2.33l-1.61-2.78" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="m18 20-4 4 4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.39 17.78 9.94 12.5l-5.36 1.44" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="m12.45 7.57 1.44-2.49A2.4 2.4 0 0 1 15.73 4a2.34 2.34 0 0 1 2.03 1.17l5.18 8.97" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="m17.56 12.64 5.38 1.44 1.44-5.38" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#0f172a' }}>Recykle</h1>
        <p className="mt-1 text-sm" style={{ color: '#64748b' }}>
          Recycling rules for {city.city}, {city.province}
        </p>
      </div>

      {/* Scrollable content */}
      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {/* Permission section */}
        <div
          className="shrink-0 rounded-2xl p-4"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
            Access needed
          </p>
          <div className="flex gap-3">
            <PermCard icon="📷" label="Camera" sublabel="To see your items" state={camPerm} />
            <PermCard icon="🎤" label="Microphone" sublabel="To hear your voice" state={micPerm} />
          </div>

          {anyDenied && (
            <p className="mt-3 text-center text-xs" style={{ color: '#ef4444' }}>
              Permission denied. Please enable access in your browser settings and reload.
            </p>
          )}

          {(camPerm === 'idle' || micPerm === 'idle') && !anyDenied && (
            <button
              onClick={requestPermissions}
              disabled={requesting}
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: requesting ? 'rgba(34,197,94,0.1)' : 'linear-gradient(145deg, #22c55e, #16a34a)',
                color: requesting ? '#22c55e' : '#fff',
                boxShadow: requesting ? 'none' : '0 4px 14px rgba(34,197,94,0.3)',
              }}
            >
              {requesting ? 'Requesting access...' : 'Allow Camera and Microphone'}
            </button>
          )}
        </div>

        {/* How it works — single combined tile */}
        <div className="shrink-0">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
            How it works
          </p>
          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <HowItWorksStep
              num="1"
              color="#22c55e"
              title="Point your camera"
              desc="Aim at any item: a bottle, battery, cardboard box, or anything nearby."
              divider
            />
            <HowItWorksStep
              num="2"
              color="#3b82f6"
              title={'Tap "Check This" or just ask'}
              desc="Press the button for a silent scan, or speak naturally. Both work."
              divider
            />
            <HowItWorksStep
              num="3"
              color="#f97316"
              title="Special items saved automatically"
              desc="Depot drop-offs and bulk items are added to your Notes so you don't forget."
              divider={false}
            />
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 px-5 pt-3 pb-8 pb-safe-6">
        <button
          onClick={onStart}
          disabled={!allGranted}
          className="w-full rounded-2xl py-4 text-base font-bold transition-all active:scale-[0.98]"
          style={{
            background: allGranted ? 'linear-gradient(145deg, #22c55e, #16a34a)' : '#e2e8f0',
            color: allGranted ? '#fff' : '#94a3b8',
            boxShadow: allGranted ? '0 8px 28px rgba(34,197,94,0.3)' : 'none',
          }}
        >
          {allGranted ? 'Start Scanning' : 'Allow access to continue'}
        </button>
      </div>
    </div>
  );
}

function PermCard({ icon, label, sublabel, state }: { icon: string; label: string; sublabel: string; state: PermState }) {
  const isGranted = state === 'granted';
  const isDenied = state === 'denied';
  const isRequesting = state === 'requesting';

  return (
    <div
      className="flex flex-1 flex-col items-center gap-1.5 rounded-xl py-3 px-2 text-center"
      style={{
        background: isGranted ? '#f0fdf4' : isDenied ? '#fef2f2' : '#f8fafc',
        border: isGranted ? '1px solid #bbf7d0' : isDenied ? '1px solid #fecaca' : '1px solid #e2e8f0',
        transition: 'all 0.2s ease',
      }}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-[13px] font-semibold" style={{ color: '#0f172a' }}>{label}</p>
        <p className="text-[11px]" style={{ color: '#64748b' }}>{sublabel}</p>
      </div>
      <div className="mt-0.5 text-xs font-medium">
        {isGranted && <span style={{ color: '#16a34a' }}>Granted</span>}
        {isDenied && <span style={{ color: '#dc2626' }}>Denied</span>}
        {isRequesting && <span style={{ color: '#94a3b8' }}>Requesting...</span>}
        {state === 'idle' && <span style={{ color: '#94a3b8' }}>Required</span>}
      </div>
    </div>
  );
}

function HowItWorksStep({
  num, color, title, desc, divider,
}: {
  num: string; color: string; title: string; desc: string; divider: boolean;
}) {
  return (
    <>
      <div className="flex items-start gap-3 px-3.5 py-3.5">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: `${color}18`, color }}
        >
          {num}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug" style={{ color: '#0f172a' }}>{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: '#64748b' }}>{desc}</p>
        </div>
      </div>
      {divider && <div style={{ height: 1, background: '#f1f5f9', marginLeft: 52, marginRight: 16 }} />}
    </>
  );
}
