'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CityInfo, DisposalResult } from '@/lib/types';
import { GeminiLiveClient, type GeminiLiveStatus } from '@/lib/gemini-live-client';
import { addHistoryEntry } from '@/lib/history';
import ResultCard from './ResultCard';

interface Props {
  city: CityInfo;
  onOpenHistory: () => void;
  onGoHome: () => void;
}

const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
};

// Heights for each waveform bar (7 bars, different starting heights)
const WAVE_HEIGHTS = [35, 65, 50, 90, 55, 80, 40];
const WAVE_DELAYS   = ['0s', '0.1s', '0.2s', '0s', '0.15s', '0.08s', '0.22s'];

function Waveform({ active, speaking }: { active: boolean; speaking: boolean }) {
  const color = speaking ? '#60a5fa' : '#4ade80'; // blue-400 | green-400
  return (
    <div
      className="flex items-end gap-[3px] transition-opacity duration-300"
      style={{ height: 28, opacity: active ? 1 : 0 }}
    >
      {WAVE_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className={active ? 'wave-bar' : ''}
          style={{
            width: 3,
            height: `${h}%`,
            borderRadius: 99,
            backgroundColor: color,
            animationDelay: WAVE_DELAYS[i],
            animationDuration: `${0.6 + i * 0.07}s`,
          }}
        />
      ))}
    </div>
  );
}

// Corner bracket for viewfinder
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const top    = pos === 'tl' || pos === 'tr';
  const left   = pos === 'tl' || pos === 'bl';
  return (
    <div
      className="absolute h-7 w-7"
      style={{
        top:    top  ? 0 : 'auto',
        bottom: !top ? 0 : 'auto',
        left:   left ? 0 : 'auto',
        right:  !left? 0 : 'auto',
        borderTop:    top  ? '2px solid currentColor' : 'none',
        borderBottom: !top ? '2px solid currentColor' : 'none',
        borderLeft:   left ? '2px solid currentColor' : 'none',
        borderRight:  !left? '2px solid currentColor' : 'none',
        borderRadius: pos === 'tl' ? '4px 0 0 0' : pos === 'tr' ? '0 4px 0 0' : pos === 'bl' ? '0 0 0 4px' : '0 0 4px 0',
      }}
    />
  );
}

export default function LiveScanner({ city, onOpenHistory, onGoHome }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<GeminiLiveClient | null>(null);

  const [sessionState, setSessionState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [geminiStatus, setGeminiStatus] = useState<GeminiLiveStatus>('disconnected');
  const [transcript, setTranscript] = useState('');
  const [disposal, setDisposal] = useState<DisposalResult | null>(null);
  const [thumbnail, setThumbnail] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  // ─── Camera preview ───────────────────────────────────────────────────────

  useEffect(() => {
    let stream: MediaStream;
    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        setErrorMsg('Camera access denied. Allow camera permission and refresh.');
        setSessionState('error');
      }
    }
    initCamera();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  // ─── Session management ───────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    if (!videoRef.current || !cameraReady) return;
    setSessionState('starting');
    setErrorMsg('');
    setDisposal(null);
    setTranscript('');

    const client = new GeminiLiveClient({
      onStatusChange: (status) => {
        setGeminiStatus(status);
        if (status === 'ready') setSessionState('live');
        if (status === 'error') setSessionState('error');
      },
      onDisposalResult: (result, thumb) => {
        setDisposal(result);
        setThumbnail(thumb);
        setTranscript('');
        addHistoryEntry({ timestamp: Date.now(), city: city.displayName, disposal: result, thumbnail: thumb });
      },
      onTranscriptUpdate: (text) => setTranscript(text),
      onError: (msg) => { setErrorMsg(msg); setSessionState('error'); },
    });

    clientRef.current = client;
    try {
      await client.start(city, videoRef.current);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setSessionState('error');
    }
  }, [city, cameraReady]);

  const stopSession = useCallback(() => {
    clientRef.current?.stop();
    clientRef.current = null;
    setSessionState('idle');
    setGeminiStatus('disconnected');
    setTranscript('');
    setDisposal(null);
  }, []);

  useEffect(() => () => { clientRef.current?.stop(); }, []);

  // ─── Derived state ────────────────────────────────────────────────────────

  const isLive      = sessionState === 'live';
  const isSpeaking  = geminiStatus === 'speaking';
  const isListening = isLive && geminiStatus === 'ready';
  const isActive    = isListening || isSpeaking;

  // Viewfinder bracket color shifts with state
  const bracketColor = isSpeaking
    ? 'rgba(96,165,250,0.75)'   // blue when AI speaks
    : isListening
      ? 'rgba(74,222,128,0.75)' // green when listening
      : 'rgba(255,255,255,0.35)'; // dim white at idle/starting

  const statusDot = isSpeaking ? '#60a5fa' : isListening ? '#4ade80' : '#fbbf24';

  const statusLabel = (() => {
    if (sessionState === 'idle') return null;
    if (sessionState === 'starting') return 'Connecting…';
    if (sessionState === 'error') return null;
    if (isSpeaking)  return 'Recykle is speaking';
    if (isListening) return 'Listening…';
    return 'Setting up…';
  })();

  const cleanTranscript = transcript
    .replace(/<disposal_data>[\s\S]*?<\/disposal_data>/g, '')
    .trim();

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">

      {/* ── Camera ── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* ── Gradient overlays ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 to-transparent" />

      {/* ── Top bar ── */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-safe-5">
        <div className="flex items-center gap-2">
          {/* Back to home / change location */}
          <button
            onClick={onGoHome}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90 hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
            aria-label="Change location"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
          </button>
          <span className="text-lg font-bold text-white">Recykle</span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
          >
            {city.displayName}
          </span>
        </div>

        {/* History button */}
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-sm font-medium text-white transition-all active:scale-95 hover:bg-white/20"
          style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5V8l2.5 1.5" />
          </svg>
          History
        </button>
      </div>

      {/* ── Viewfinder ── */}
      {(isActive || sessionState === 'starting') && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-64 w-64" style={{ color: bracketColor, transition: 'color 0.4s ease' }}>
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />

            {/* Scan line */}
            {isActive && (
              <div
                className="scan-line absolute left-2 right-2"
                style={{ height: 1, background: `linear-gradient(to right, transparent, ${bracketColor}, transparent)` }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Listening ripple (replaces the tiny center dot) ── */}
      {isListening && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {/* Rings expand from center — behind the viewfinder */}
          <div className="ripple-1 absolute h-12 w-12 rounded-full bg-green-400/20" />
          <div className="ripple-2 absolute h-12 w-12 rounded-full bg-green-400/20" />
        </div>
      )}

      {/* ── Transcript bubble — floats above FAB, not above top bar ── */}
      {cleanTranscript && !disposal && (
        <div
          className="absolute inset-x-6 z-20 pointer-events-none"
          style={{ bottom: 200 }}
        >
          <div
            className="mx-auto max-w-xs rounded-2xl px-4 py-3"
            style={{
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <p className="text-sm leading-relaxed text-white/85">{cleanTranscript}</p>
          </div>
        </div>
      )}

      {/* ── Result card ── */}
      {disposal && (
        <ResultCard
          result={disposal}
          thumbnail={thumbnail}
          city={city.displayName}
          onDismiss={() => { setDisposal(null); setThumbnail(undefined); }}
        />
      )}

      {/* ── Bottom controls ── */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center pb-safe-8 px-6">

        {/* Status pill */}
        {statusLabel && (
          <div
            className="mb-5 flex items-center gap-2 rounded-full px-3.5 py-1.5"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: statusDot, boxShadow: `0 0 6px ${statusDot}` }}
            />
            <span className="text-xs font-medium text-white/80">{statusLabel}</span>
            <Waveform active={isActive} speaking={isSpeaking} />
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div
            className="mb-4 max-w-xs rounded-xl px-4 py-2.5 text-center text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            {errorMsg}
          </div>
        )}

        {/* FAB */}
        <div className="relative">
          {/* Outer glow ring when live */}
          {isLive && (
            <div
              className="absolute inset-0 rounded-full opacity-40"
              style={{ transform: 'scale(1.35)', background: isSpeaking ? 'rgba(96,165,250,0.3)' : 'rgba(34,197,94,0.3)', filter: 'blur(10px)' }}
            />
          )}

          {sessionState === 'idle' || sessionState === 'error' ? (
            <button
              onClick={startSession}
              disabled={!cameraReady}
              className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full transition-all active:scale-95 hover:brightness-110 disabled:opacity-30"
              style={{
                background: 'linear-gradient(145deg, #22c55e, #16a34a)',
                boxShadow: '0 8px 28px rgba(34,197,94,0.45)',
              }}
              aria-label="Start session"
            >
              {/* Mic icon */}
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full transition-all active:scale-95 hover:brightness-125"
              style={{
                background: 'rgba(239,68,68,0.15)',
                backdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(239,68,68,0.4)',
                boxShadow: '0 4px 20px rgba(239,68,68,0.2)',
              }}
              aria-label="Stop session"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-red-400" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          )}
        </div>

        {/* Hint */}
        <p
          className="mt-4 text-center text-xs transition-opacity"
          style={{ color: 'rgba(255,255,255,0.35)', minHeight: 16 }}
        >
          {sessionState === 'idle' && cameraReady && 'Point camera at an item and ask'}
          {isListening && 'Speak naturally — Recykle can hear you'}
          {isSpeaking && 'Playing response…'}
        </p>
      </div>

      {/* ── Connecting overlay ── */}
      {sessionState === 'starting' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.3)' }}
          >
            <svg
              viewBox="0 0 24 24" fill="none" className="spinner h-7 w-7 text-green-400"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <p className="text-base font-medium text-white">Starting Recykle…</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Connecting to Gemini Live</p>
        </div>
      )}
    </div>
  );
}
