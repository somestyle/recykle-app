'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { CityInfo, DisposalResult } from '@/lib/types';
import { GeminiLiveClient, type GeminiLiveStatus } from '@/lib/gemini-live-client';
import { addHistoryEntry } from '@/lib/history';
import ResultCard from './ResultCard';

// ─── Waveform bars ────────────────────────────────────────────────────────────
function WaveBars({ active, color }: { active: boolean; color: string }) {
  const heights = [35, 65, 90, 55, 75, 45, 80];
  const delays  = [0, 0.15, 0.3, 0.45, 0.2, 0.35, 0.1];
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 22 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          className={active ? 'wave-bar' : ''}
          style={{
            width: 3,
            height: active ? `${h}%` : '20%',
            borderRadius: 2,
            background: color,
            animationDelay: `${delays[i]}s`,
            transition: 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M7.5 18V12.5h5V18" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5V10l2.5 2.5" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 10a7 7 0 0014 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  );
}

// ─── Emoji map ────────────────────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  'Recycling':      '♻️',
  'Garbage':        '🗑️',
  'Compost':        '🌱',
  'Depot Drop-off': '🔋',
  'Bulk Item':      '🛋️',
};

// ─── Caption helpers ──────────────────────────────────────────────────────────
type CaptionMsg = { id: number; role: 'user' | 'assistant'; text: string };

function cleanForDisplay(text: string): string {
  return text
    .replace(/<disposal_data>[\s\S]*?<\/disposal_data>/g, '')
    .replace(/\*\*[^*]*\*\*/g, '')
    .replace(/##[^\n]*/g, '')
    .trim();
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface LiveScannerProps {
  city: CityInfo;
  onOpenHistory: () => void;
  onGoHome: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function LiveScanner({ city, onOpenHistory, onGoHome }: LiveScannerProps) {
  // Session state
  const [sessionState, setSessionState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [geminiStatus, setGeminiStatus] = useState<GeminiLiveStatus>('disconnected');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Disposal state
  const [disposal, setDisposal] = useState<DisposalResult | null>(null);
  const [thumbnail, setThumbnail] = useState<string | undefined>();

  // Emoji flash
  const [emojiFlash, setEmojiFlash] = useState<string | null>(null);
  const emojiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Captions
  const [captions, setCaptions] = useState<CaptionMsg[]>([]);
  const assistantBufRef = useRef('');
  const userBufRef = useRef('');
  const captionIdRef = useRef(0);
  const captionScrollRef = useRef<HTMLDivElement>(null);

  // Camera / media
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Gemini client
  const clientRef = useRef<GeminiLiveClient | null>(null);

  // Derived
  const isLive = sessionState === 'live';
  const isSpeaking = geminiStatus === 'speaking';
  const isListening = isLive && geminiStatus === 'ready';
  const isActive = isListening || isSpeaking;

  // ── Camera setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        setErrorMsg('Camera access denied. Please allow camera permission.');
      }
    }
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Auto-scroll captions ────────────────────────────────────────────────────
  useEffect(() => {
    if (captionScrollRef.current) {
      captionScrollRef.current.scrollTop = captionScrollRef.current.scrollHeight;
    }
  }, [captions]);

  // ── Caption helpers ─────────────────────────────────────────────────────────
  const upsertCaption = useCallback((role: 'user' | 'assistant', text: string) => {
    setCaptions(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, text };
        return updated;
      }
      const newEntry: CaptionMsg = { id: captionIdRef.current++, role, text };
      const next = [...prev, newEntry];
      return next.length > 4 ? next.slice(-4) : next;
    });
  }, []);

  // ── Emoji flash ──────────────────────────────────────────────────────────────
  const triggerEmoji = useCallback((emoji: string) => {
    if (emojiTimerRef.current) clearTimeout(emojiTimerRef.current);
    setEmojiFlash(emoji);
    emojiTimerRef.current = setTimeout(() => setEmojiFlash(null), 1900);
  }, []);

  // ── Start / Stop session ────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if ((sessionState !== 'idle' && sessionState !== 'error') || !videoRef.current || !cameraReady) return;
    setSessionState('starting');
    setErrorMsg(null);
    setCaptions([]);
    assistantBufRef.current = '';
    userBufRef.current = '';

    const client = new GeminiLiveClient({
      onStatusChange: (status) => {
        setGeminiStatus(status);
        if (status === 'ready') setSessionState('live');
        if (status === 'error') setSessionState('error');
      },
      onDisposalResult: (result, thumb) => {
        setDisposal(result);
        setThumbnail(thumb);
        assistantBufRef.current = '';
        triggerEmoji(CATEGORY_EMOJI[result.category] ?? '♻️');
        addHistoryEntry({ timestamp: Date.now(), city: city.displayName, disposal: result, thumbnail: thumb });
      },
      onTranscriptUpdate: (text) => {
        assistantBufRef.current = text;
        upsertCaption('assistant', text);
      },
      onUserTranscript: (text, finished) => {
        if (text) userBufRef.current += text;
        upsertCaption('user', userBufRef.current);
        if (finished) userBufRef.current = '';
      },
      onError: (msg) => {
        setErrorMsg(msg);
        setSessionState('error');
      },
    });

    clientRef.current = client;
    try {
      await client.start(city, videoRef.current);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setSessionState('error');
    }
  }, [sessionState, city, cameraReady, upsertCaption, triggerEmoji]);

  const stopSession = useCallback(() => {
    clientRef.current?.stop();
    clientRef.current = null;
    setSessionState('idle');
    setGeminiStatus('disconnected');
    setDisposal(null);
    setCaptions([]);
  }, []);

  useEffect(() => () => { clientRef.current?.stop(); }, []);

  // ── Mic button appearance ───────────────────────────────────────────────────
  let btnBg = 'linear-gradient(145deg, #22c55e, #16a34a)';
  let btnShadow = '0 8px 28px rgba(34,197,94,0.45)';
  let statusLabel = 'Tap to start';

  if (sessionState === 'starting') {
    btnBg = 'rgba(255,255,255,0.08)';
    btnShadow = 'none';
    statusLabel = 'Connecting…';
  } else if (isLive) {
    if (isSpeaking) {
      btnBg = 'rgba(96,165,250,0.15)';
      btnShadow = '0 0 0 1.5px rgba(96,165,250,0.5)';
      statusLabel = 'Speaking…';
    } else {
      btnBg = 'rgba(34,197,94,0.15)';
      btnShadow = '0 0 0 1.5px rgba(34,197,94,0.5)';
      statusLabel = 'Listening…';
    }
  } else if (sessionState === 'error') {
    btnBg = 'rgba(239,68,68,0.15)';
    btnShadow = '0 0 0 1.5px rgba(239,68,68,0.4)';
    statusLabel = 'Tap to retry';
  }

  // ── Viewfinder color ────────────────────────────────────────────────────────
  const frameColor = isSpeaking
    ? 'rgba(96,165,250,0.75)'
    : isListening
    ? 'rgba(74,222,128,0.75)'
    : 'rgba(255,255,255,0.3)';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-black">

      {/* ── Camera card ── */}
      <div className="relative mx-3 mt-3 min-h-0 flex-1 overflow-hidden rounded-[20px] bg-black">
        {/* Camera feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Top gradient */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />

        {/* Bottom gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Branding overlay — Recykle + city */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-4 pt-5">
          <span className="text-base font-bold tracking-tight text-white">Recykle</span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}
          >
            {city.city}, {city.province}
          </span>
        </div>

        {/* Viewfinder corners */}
        {(isActive || sessionState === 'starting') && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-56 w-56" style={{ transition: 'all 0.4s ease' }}>
              {/* TL */}
              <div className="absolute left-0 top-0 h-7 w-7" style={{ borderTop: `2px solid ${frameColor}`, borderLeft: `2px solid ${frameColor}`, borderRadius: '4px 0 0 0' }} />
              {/* TR */}
              <div className="absolute right-0 top-0 h-7 w-7" style={{ borderTop: `2px solid ${frameColor}`, borderRight: `2px solid ${frameColor}`, borderRadius: '0 4px 0 0' }} />
              {/* BL */}
              <div className="absolute bottom-0 left-0 h-7 w-7" style={{ borderBottom: `2px solid ${frameColor}`, borderLeft: `2px solid ${frameColor}`, borderRadius: '0 0 0 4px' }} />
              {/* BR */}
              <div className="absolute bottom-0 right-0 h-7 w-7" style={{ borderBottom: `2px solid ${frameColor}`, borderRight: `2px solid ${frameColor}`, borderRadius: '0 0 4px 0' }} />
              {/* Scan line */}
              <div className="scan-line absolute inset-x-2" style={{ height: 1, background: `linear-gradient(90deg, transparent, ${frameColor}, transparent)` }} />
            </div>
          </div>
        )}

        {/* Listening ripples */}
        {isListening && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="ripple-1 absolute h-12 w-12 rounded-full bg-green-400/15" />
            <div className="ripple-2 absolute h-12 w-12 rounded-full bg-green-400/15" />
          </div>
        )}

        {/* Emoji flash */}
        {emojiFlash && (
          <div className="emoji-flash pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <span style={{ fontSize: 88, lineHeight: 1, filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.35))' }}>
              {emojiFlash}
            </span>
          </div>
        )}

        {/* Error message inside camera area */}
        {errorMsg && (
          <div className="absolute inset-x-4 bottom-4 z-20">
            <div
              className="rounded-xl px-4 py-2.5 text-center text-sm text-red-300"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              {errorMsg}
            </div>
          </div>
        )}

        {/* Connecting overlay */}
        {sessionState === 'starting' && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ border: '2px solid rgba(34,197,94,0.3)' }}
            >
              <svg className="spinner h-7 w-7 text-green-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-white">Starting Recykle…</p>
              <p className="mt-0.5 text-xs text-white/50">Connecting to Gemini Live</p>
            </div>
          </div>
        )}

        {/* Result card */}
        {disposal && (
          <ResultCard
            result={disposal}
            thumbnail={thumbnail}
            city={city.displayName}
            onDismiss={() => { setDisposal(null); setThumbnail(undefined); }}
          />
        )}
      </div>

      {/* ── Caption strip ── */}
      <div
        className="overflow-hidden bg-black px-4"
        style={{
          maxHeight: captions.length > 0 ? 'min(120px, 18dvh)' : '0px',
          transition: 'max-height 0.3s ease',
          borderTop: captions.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <div
          ref={captionScrollRef}
          className="overflow-y-auto py-3"
          style={{ maxHeight: 'inherit', scrollbarWidth: 'none' } as React.CSSProperties}
        >
          {captions.map((msg, i) => {
            const clean = cleanForDisplay(msg.text);
            if (!clean) return null;
            return (
              <p
                key={msg.id}
                className="text-sm leading-snug"
                style={{
                  opacity: i < captions.length - 1 ? 0.45 : 1,
                  marginBottom: i < captions.length - 1 ? 4 : 0,
                  color: 'rgba(255,255,255,0.82)',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.07em',
                    marginRight: 6,
                    color: msg.role === 'user' ? '#4ade80' : '#60a5fa',
                  }}
                >
                  {msg.role === 'user' ? 'You' : 'Recykle'}
                </span>
                {clean}
              </p>
            );
          })}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div
        className="flex items-center justify-around bg-black px-6 pb-safe pt-3"
        style={{ minHeight: 76 }}
      >
        {/* Home */}
        <button
          onClick={onGoHome}
          aria-label="Change location"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition-colors active:text-white/70"
        >
          <HomeIcon />
        </button>

        {/* Center mic/stop */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={isLive ? stopSession : startSession}
            disabled={sessionState === 'starting'}
            className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full transition-transform active:scale-95"
            style={{ background: btnBg, boxShadow: btnShadow, opacity: sessionState === 'starting' ? 0.7 : 1 }}
            aria-label={isLive ? 'Stop session' : 'Start session'}
          >
            {sessionState === 'starting' ? (
              <svg className="spinner h-6 w-6 text-white/60" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" />
              </svg>
            ) : isSpeaking ? (
              <WaveBars active={true} color="#93c5fd" />
            ) : isListening ? (
              <WaveBars active={true} color="#4ade80" />
            ) : (
              <MicIcon />
            )}
          </button>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {statusLabel}
          </span>
        </div>

        {/* History */}
        <button
          onClick={onOpenHistory}
          aria-label="View history"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition-colors active:text-white/70"
        >
          <HistoryIcon />
        </button>
      </div>
    </div>
  );
}
