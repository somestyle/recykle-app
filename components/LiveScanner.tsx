'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CityInfo, DisposalResult } from '@/lib/types';
import { GeminiLiveClient, type GeminiLiveStatus } from '@/lib/gemini-live-client';
import { addHistoryEntry } from '@/lib/history';
import ResultCard from './ResultCard';

interface Props {
  city: CityInfo;
  onOpenHistory: () => void;
}

// Camera-facing mode: prefer back camera on mobile
const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
};

export default function LiveScanner({ city, onOpenHistory }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<GeminiLiveClient | null>(null);

  const [sessionState, setSessionState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [geminiStatus, setGeminiStatus] = useState<GeminiLiveStatus>('disconnected');
  const [transcript, setTranscript] = useState('');
  const [disposal, setDisposal] = useState<DisposalResult | null>(null);
  const [thumbnail, setThumbnail] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  // ─── Camera preview (always on) ───────────────────────────────────────────

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
      } catch (err) {
        console.error('Camera error:', err);
        setErrorMsg('Camera access denied. Please allow camera permission and refresh.');
        setSessionState('error');
      }
    }

    initCamera();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ─── Gemini Live session management ───────────────────────────────────────

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
        // Save to history
        addHistoryEntry({
          timestamp: Date.now(),
          city: city.displayName,
          disposal: result,
          thumbnail: thumb,
        });
      },
      onTranscriptUpdate: (text) => {
        setTranscript(text);
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
  }, [city, cameraReady]);

  const stopSession = useCallback(() => {
    clientRef.current?.stop();
    clientRef.current = null;
    setSessionState('idle');
    setGeminiStatus('disconnected');
    setTranscript('');
    setDisposal(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.stop();
    };
  }, []);

  // ─── Derived UI state ─────────────────────────────────────────────────────

  const statusLabel = (() => {
    if (sessionState === 'idle') return 'Tap to start';
    if (sessionState === 'starting') return 'Connecting…';
    if (sessionState === 'error') return 'Error';
    switch (geminiStatus) {
      case 'connected': return 'Setting up…';
      case 'ready': return 'Listening…';
      case 'speaking': return 'Recykle is speaking…';
      default: return 'Live';
    }
  })();

  const isLive = sessionState === 'live';
  const isSpeaking = geminiStatus === 'speaking';
  const isListening = isLive && geminiStatus === 'ready';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">

      {/* ── Camera preview ── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* ── Dark gradient overlays for UI readability ── */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* ── Top bar ── */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-safe-top py-4 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white">♻️ Recykle</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">
            {city.displayName}
          </span>
        </div>
        <button
          onClick={onOpenHistory}
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur-sm hover:bg-white/20 transition"
        >
          History
        </button>
      </div>

      {/* ── Listening pulse indicator ── */}
      {isListening && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="relative h-4 w-4">
            <div className="pulse-ring absolute inset-0 rounded-full bg-green-400 opacity-75" />
            <div className="relative h-4 w-4 rounded-full bg-green-500" />
          </div>
        </div>
      )}

      {/* ── Transcript bubble ── */}
      {transcript && !disposal && (
        <div className="absolute inset-x-4 top-24 z-20 flex justify-center pointer-events-none">
          <div className="max-w-sm rounded-2xl bg-black/70 px-4 py-3 backdrop-blur-md">
            <p className="text-sm text-white/80 leading-relaxed">
              {/* Hide the <disposal_data> block from the transcript */}
              {transcript.replace(/<disposal_data>[\s\S]*?<\/disposal_data>/g, '').trim()}
            </p>
          </div>
        </div>
      )}

      {/* ── Result card overlay ── */}
      {disposal && (
        <ResultCard
          result={disposal}
          thumbnail={thumbnail}
          city={city.displayName}
          onDismiss={() => {
            setDisposal(null);
            setThumbnail(undefined);
          }}
        />
      )}

      {/* ── Bottom controls ── */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-4 pb-safe-bottom pb-8 px-6">

        {/* Status label */}
        <div className="flex items-center gap-2">
          {isLive && (
            <span
              className={`h-2 w-2 rounded-full ${
                isSpeaking ? 'bg-blue-400' : isListening ? 'bg-green-400' : 'bg-yellow-400'
              }`}
              style={isListening ? { boxShadow: '0 0 6px #4ade80' } : undefined}
            />
          )}
          <span className="text-sm text-white/70">{statusLabel}</span>
        </div>

        {/* Error message */}
        {errorMsg && (
          <p className="text-center text-sm text-red-400 max-w-xs">{errorMsg}</p>
        )}

        {/* Main action button */}
        {sessionState === 'idle' || sessionState === 'error' ? (
          <button
            onClick={startSession}
            disabled={!cameraReady}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-3xl shadow-xl shadow-green-500/40 transition-all hover:bg-green-400 active:scale-95 disabled:opacity-40"
          >
            🎙️
          </button>
        ) : (
          <button
            onClick={stopSession}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/80 text-3xl shadow-xl transition-all hover:bg-red-500 active:scale-95 backdrop-blur-sm"
          >
            ⏹
          </button>
        )}

        {/* Hint text */}
        {sessionState === 'idle' && cameraReady && (
          <p className="text-center text-xs text-white/40 max-w-xs">
            Point your camera at any item and ask &ldquo;What do I do with this?&rdquo;
          </p>
        )}

        {isLive && !isSpeaking && !disposal && (
          <p className="text-center text-xs text-white/40 max-w-xs">
            Speak naturally — Recykle can hear you
          </p>
        )}
      </div>

      {/* ── Starting overlay ── */}
      {sessionState === 'starting' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mb-4 animate-spin text-4xl">♻️</div>
          <p className="text-white">Connecting to Recykle…</p>
          <p className="mt-1 text-sm text-gray-400">Starting Gemini Live session</p>
        </div>
      )}
    </div>
  );
}
