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
    <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M7.5 18V12.5h5V18" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2.5h10a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z" />
      <path d="M7 7h6M7 10h6M7 13h4" />
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

function CameraSnapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
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
type CaptionMsg = { id: number; role: 'user' | 'assistant'; text: string; thinking?: DisposalResult; thinkingText?: string };

function cleanForDisplay(text: string): string {
  return text
    .replace(/<disposal_data>[\s\S]*?<\/disposal_data>/g, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
    .replace(/<[a-zA-Z][^>]*>/g, '')   // strip <noise>, <sigh>, <laugh> etc from transcripts
    .replace(/\*\*[^*]*\*\*/g, '')
    .replace(/##[^\n]*/g, '')
    .trim();
}

function extractThinkingText(text: string): string | null {
  const match = text.match(/<thinking>([\s\S]*?)<\/thinking>/);
  return match ? match[1].trim() : null;
}

// Split the last spoken-response sentence out of raw Gemini thinking transcript.
// The model appends the actual spoken reply at the very end, after all the **heading**
// / analysis paragraphs. We extract it so it shows as "Recykle: ..." in the caption.
function splitThinkingAndResponse(thinkingText: string): { thinking: string; response: string | null } {
  const paragraphs = thinkingText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length < 2) return { thinking: thinkingText, response: null };

  const last = paragraphs[paragraphs.length - 1];

  const isHeading    = last.startsWith('**');
  const isToolMention = last.includes('record_disposal') || last.includes('record\\_disposal');
  const isAnalysis   = /^(I'(ve|m|d)|I (have|am|need|will|was|can)|The |This |Based |After |Having |Therefore|Thus|So the|In conclusion)/i.test(last);

  if (!isHeading && !isToolMention && !isAnalysis && last.length > 5) {
    return {
      thinking: paragraphs.slice(0, -1).join('\n\n'),
      response: last,
    };
  }
  return { thinking: thinkingText, response: null };
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
  const [noteSaved, setNoteSaved] = useState(false);

  // Emoji flash
  const [emojiFlash, setEmojiFlash] = useState<string | null>(null);
  const emojiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Captions
  const [captions, setCaptions] = useState<CaptionMsg[]>([]);
  const assistantBufRef = useRef('');
  const userBufRef = useRef('');
  const captionIdRef = useRef(0);
  const captionScrollRef = useRef<HTMLDivElement>(null);

  // Thinking expand state
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());

  // Caption strip expand state
  const [captionExpanded, setCaptionExpanded] = useState(false);

  // Camera / media
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Gemini client
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const autoStartedRef = useRef(false);

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

  // ── Auto-start session when camera is ready ─────────────────────────────────
  useEffect(() => {
    if (cameraReady && !autoStartedRef.current) {
      autoStartedRef.current = true;
      const t = setTimeout(() => startSession(), 400);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady]);

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

  // ── Thinking expand toggle ───────────────────────────────────────────────────
  const toggleThinking = useCallback((id: number) => {
    setExpandedThinking(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
      onDisposalResult: (result, thumb, thinkingText) => {
        setDisposal(result);
        setThumbnail(thumb);
        triggerEmoji(CATEGORY_EMOJI[result.category] ?? '♻️');
        clientRef.current?.pause(); // pause mic/camera while card is shown

        // Auto-save only special disposal items that need a follow-up trip
        const autoSave = result.category === 'Depot Drop-off' || result.category === 'Bulk Item';
        if (autoSave) {
          addHistoryEntry({ timestamp: Date.now(), city: city.displayName, disposal: result, thumbnail: thumb });
        }
        setNoteSaved(autoSave);

        // Create a new assistant caption entry with thinking data attached
        // Response text will fill in via onTranscriptUpdate after disposal fires
        const newId = captionIdRef.current++;
        setCaptions(prev => {
          const entry: CaptionMsg = {
            id: newId,
            role: 'assistant',
            text: '',
            thinking: result,
            ...(thinkingText?.trim() ? { thinkingText: thinkingText.trim() } : {}),
          };
          const next = [...prev, entry];
          return next.length > 4 ? next.slice(-4) : next;
        });
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

  const handleCheckThis = useCallback(() => {
    if (clientRef.current && isLive && !isSpeaking) {
      clientRef.current.sendCheckThis();
    }
  }, [isLive, isSpeaking]);

  useEffect(() => () => { clientRef.current?.stop(); }, []);

  // ── Viewfinder color ────────────────────────────────────────────────────────
  const frameColor = isSpeaking
    ? 'rgba(96,165,250,0.75)'
    : isListening
    ? 'rgba(74,222,128,0.75)'
    : 'rgba(255,255,255,0.3)';

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-black">

      {/* ── Emoji flash — outside camera card to avoid overflow-hidden clip ── */}
      {emojiFlash && (
        <div className="emoji-flash pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <span style={{ fontSize: 110, lineHeight: 1, filter: 'drop-shadow(0 4px 32px rgba(0,0,0,0.4))' }}>
            {emojiFlash}
          </span>
        </div>
      )}

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

        {/* Dim overlay when card is shown */}
        {disposal && (
          <div
            className="pointer-events-none absolute inset-0 z-[39]"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', transition: 'opacity 0.25s ease' }}
          />
        )}
      </div>

      {/* Result card — rendered at root level for full-screen centering */}
      {disposal && (
        <ResultCard
          result={disposal}
          thumbnail={thumbnail}
          city={city.displayName}
          alreadySaved={noteSaved}
          onSaveToNotes={() => {
            addHistoryEntry({ timestamp: Date.now(), city: city.displayName, disposal, thumbnail });
            setNoteSaved(true);
          }}
          onDismiss={() => {
            setDisposal(null);
            setThumbnail(undefined);
            setNoteSaved(false);
            clientRef.current?.resume();
          }}
        />
      )}

      {/* ── Caption strip ── */}
      <div
        className="relative overflow-hidden bg-black"
        style={{
          maxHeight: captions.length > 0
            ? captionExpanded ? 'min(55dvh, 55vh)' : 'min(120px, 18dvh)'
            : '0px',
          transition: 'max-height 0.35s cubic-bezier(0.16,1,0.3,1)',
          borderTop: captions.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          paddingLeft: 16, paddingRight: 16,
        }}
      >
        {/* Expand/collapse icon — diagonal arrows */}
        {captions.length > 0 && (
          <button
            onClick={() => setCaptionExpanded(e => !e)}
            className="absolute right-3 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}
            aria-label={captionExpanded ? 'Collapse captions' : 'Expand captions'}
          >
            {captionExpanded ? (
              /* Collapse: two diagonal arrows pointing inward */
              <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 1l-4 4M5 1h4v4" />
                <path d="M5 13l4-4M9 13H5V9" />
              </svg>
            ) : (
              /* Expand: two diagonal arrows pointing outward */
              <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 5l4-4M1 1h4v4" />
                <path d="M13 9l-4 4M13 13H9V9" />
              </svg>
            )}
          </button>
        )}
        <div
          ref={captionScrollRef}
          className="overflow-y-auto py-3"
          style={{ maxHeight: 'inherit', scrollbarWidth: 'none' } as React.CSSProperties}
        >
          {captions.map((msg, i) => {
            const clean = cleanForDisplay(msg.text);
            const isOld = i < captions.length - 1;
            const isExpanded = expandedThinking.has(msg.id);
            if (!clean && !msg.thinking) return null;
            return (
              <div
                key={msg.id}
                style={{
                  opacity: isOld ? 0.45 : 1,
                  marginBottom: isOld ? 6 : 0,
                }}
              >
                {/* Thinking pill — only for assistant messages with disposal data */}
                {msg.role === 'assistant' && msg.thinking && (() => {
                  const split = msg.thinkingText
                    ? splitThinkingAndResponse(msg.thinkingText)
                    : { thinking: '', response: null };
                  const thinkingBody = split.thinking;
                  const extractedResponse = split.response;

                  return (
                    <div style={{ marginBottom: extractedResponse || clean ? 3 : 0 }}>
                      <button
                        onClick={() => toggleThinking(msg.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.3)',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 4,
                          padding: '2px 6px',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <span>Thinking</span>
                        {/* Up/down chevron for thinking expand */}
                        <svg viewBox="0 0 10 10" fill="none" style={{ width: 10, height: 10, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3.5l3 3 3-3" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div
                          style={{
                            marginTop: 4,
                            paddingLeft: 8,
                            borderLeft: '1.5px solid rgba(255,255,255,0.12)',
                            fontSize: 11,
                            color: 'rgba(255,255,255,0.4)',
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {msg.thinkingText
                            ? thinkingBody || msg.thinkingText
                            : <>
                                <div>Recognized: {msg.thinking.item}</div>
                                <div>Material: {msg.thinking.material}</div>
                                <div>Category in {city.city}: {msg.thinking.category}</div>
                                <div>{msg.thinking.explanation}</div>
                                {msg.thinking.tip && <div>Tip: {msg.thinking.tip}</div>}
                              </>
                          }
                        </div>
                      )}
                      {/* Extracted spoken response from end of thinking transcript */}
                      {extractedResponse && (
                        <p className="mt-1.5 text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.82)', margin: '6px 0 0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 6, color: '#60a5fa' }}>
                            Recykle
                          </span>
                          {extractedResponse}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Spoken response (from onTranscriptUpdate — post-disposal) */}
                {clean && (
                  <p
                    className="text-sm leading-snug"
                    style={{ color: 'rgba(255,255,255,0.82)', margin: 0 }}
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
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div
        className="flex items-center gap-2 bg-black px-4 pb-safe pt-2.5"
        style={{ minHeight: 72 }}
      >
        {/* Home */}
        <button
          onClick={onGoHome}
          aria-label="Change location"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white/35 transition-all active:text-white/70 active:bg-white/5"
        >
          <HomeIcon />
        </button>

        {/* Wide action chip */}
        <div className="flex flex-1 flex-col items-center gap-1">
          <div
            className="flex w-full items-center overflow-hidden rounded-full"
            style={{
              height: 52,
              border: isLive
                ? isListening
                  ? '1.5px solid rgba(74,222,128,0.3)'
                  : '1.5px solid rgba(96,165,250,0.3)'
                : '1.5px solid rgba(255,255,255,0.1)',
              background: isLive ? 'rgba(255,255,255,0.04)' : 'transparent',
              transition: 'border-color 0.3s ease, background 0.3s ease',
            }}
          >
            {/* Left zone — status / start action */}
            <button
              onClick={!isLive && sessionState !== 'starting' ? startSession : undefined}
              disabled={sessionState === 'starting'}
              className="flex flex-1 items-center gap-2.5 px-4 h-full"
              style={{ cursor: isLive ? 'default' : 'pointer' }}
              aria-label={isLive ? 'Session active' : 'Start session'}
            >
              {sessionState === 'starting' ? (
                <>
                  <svg className="spinner h-4 w-4 shrink-0 text-white/40" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" />
                  </svg>
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Connecting...</span>
                </>
              ) : isLive && isSpeaking ? (
                <>
                  <WaveBars active={true} color="#93c5fd" />
                  <span className="text-xs font-medium" style={{ color: 'rgba(147,197,253,0.8)' }}>Speaking</span>
                </>
              ) : isLive ? (
                <>
                  <WaveBars active={true} color="#4ade80" />
                  <span className="text-xs font-medium" style={{ color: 'rgba(74,222,128,0.8)' }}>Listening</span>
                </>
              ) : sessionState === 'error' ? (
                <>
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" stroke="rgba(239,68,68,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v5M8 11.5v.5" />
                    <circle cx="8" cy="8" r="6.5" />
                  </svg>
                  <span className="text-xs font-medium" style={{ color: 'rgba(239,68,68,0.7)' }}>Tap to retry</span>
                </>
              ) : (
                <>
                  <MicIcon />
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Tap to start</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

            {/* Right zone — Check This camera button */}
            <div className="flex items-center justify-center px-2.5">
              <button
                onClick={handleCheckThis}
                disabled={!isLive || isSpeaking}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90"
                style={{
                  background: isLive && !isSpeaking
                    ? 'linear-gradient(145deg, #3b82f6, #2563eb)'
                    : 'rgba(255,255,255,0.06)',
                  boxShadow: isLive && !isSpeaking ? '0 2px 10px rgba(59,130,246,0.4)' : 'none',
                  opacity: isSpeaking ? 0.4 : 1,
                  transition: 'all 0.25s ease',
                }}
                aria-label="Check this item"
              >
                <CameraSnapIcon />
              </button>
            </div>
          </div>

          {/* Stop link */}
          {isLive && (
            <button
              onClick={stopSession}
              className="text-[10px] transition-opacity active:opacity-80"
              style={{ color: 'rgba(255,255,255,0.18)' }}
            >
              Stop session
            </button>
          )}
        </div>

        {/* Notes */}
        <button
          onClick={onOpenHistory}
          aria-label="View notes"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white/35 transition-all active:text-white/70 active:bg-white/5"
        >
          <NotesIcon />
        </button>
      </div>
    </div>
  );
}
