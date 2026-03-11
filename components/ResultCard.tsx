'use client';

import type { DisposalCategory, DisposalResult } from '@/lib/types';

interface Props {
  result: DisposalResult;
  city: string;
  thumbnail?: string;
  onDismiss: () => void;
}

interface CategoryStyle {
  emoji: string;
  label: string;
  color: string;
  bg: string;
  gradient: string;
  actionLabel: string;
}

const CATEGORY: Record<DisposalCategory, CategoryStyle> = {
  Recycling: {
    emoji: '♻️',
    label: 'Recycling',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.12)',
    gradient: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.05) 100%)',
    actionLabel: 'Blue box · Curbside',
  },
  Garbage: {
    emoji: '🗑️',
    label: 'Garbage',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.05) 100%)',
    actionLabel: 'Black bin · Landfill',
  },
  Compost: {
    emoji: '🌱',
    label: 'Compost',
    color: '#84cc16',
    bg: 'rgba(132, 204, 22, 0.12)',
    gradient: 'linear-gradient(135deg, rgba(132,204,22,0.2) 0%, rgba(132,204,22,0.05) 100%)',
    actionLabel: 'Green bin · Organics',
  },
  'Depot Drop-off': {
    emoji: '🏭',
    label: 'Depot Drop-off',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.12)',
    gradient: 'linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(249,115,22,0.05) 100%)',
    actionLabel: 'Hazardous waste depot',
  },
  'Bulk Item': {
    emoji: '📦',
    label: 'Bulk Item',
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.12)',
    gradient: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(139,92,246,0.05) 100%)',
    actionLabel: 'Special municipal pickup',
  },
};

export default function ResultCard({ result, city, thumbnail, onDismiss }: Props) {
  const cat = CATEGORY[result.category] ?? CATEGORY['Garbage'];

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 slide-up">
      {/* Tap-behind backdrop */}
      <div
        className="absolute"
        style={{ top: '-100vh', right: 0, bottom: 0, left: 0 }}
        onClick={onDismiss}
      />

      <div
        className="relative mx-auto max-w-lg rounded-t-[28px] pb-safe-8"
        style={{ background: '#111114', boxShadow: '0 -8px 40px rgba(0,0,0,0.7)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-9 rounded-full bg-white/15" />
        </div>

        {/* ── Category hero banner ─────────────────────────────────── */}
        <div
          className="mx-4 mt-2 rounded-2xl px-4 py-4"
          style={{ background: cat.gradient, border: `1px solid ${cat.color}28` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: `${cat.color}99` }}>
                DISPOSAL CATEGORY
              </p>
              <p className="mt-0.5 text-3xl font-bold tracking-tight" style={{ color: cat.color }}>
                {cat.label}
              </p>
              <p className="mt-1 text-sm" style={{ color: `${cat.color}80` }}>
                {cat.actionLabel}
              </p>
            </div>
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
              style={{ background: cat.bg }}
            >
              {cat.emoji}
            </div>
          </div>
        </div>

        {/* ── Item details ─────────────────────────────────────────── */}
        <div className="mt-4 flex gap-3 px-4">
          {thumbnail && (
            <img
              src={thumbnail}
              alt="Scanned item"
              className="h-[68px] w-[68px] shrink-0 rounded-xl object-cover"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            />
          )}
          <div className="min-w-0">
            <h2
              className="text-xl font-bold leading-snug text-white"
              style={{ letterSpacing: '-0.01em' }}
            >
              {result.item}
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {result.material}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              Rules for {city}
            </p>
          </div>
        </div>

        {/* ── Explanation ──────────────────────────────────────────── */}
        <p className="mt-4 px-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {result.explanation}
        </p>

        {/* ── Preparation tip ──────────────────────────────────────── */}
        {result.tip && (
          <div
            className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl px-3.5 py-3"
            style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)' }}
          >
            <span className="mt-0.5 shrink-0 text-base">💡</span>
            <p className="text-sm leading-snug" style={{ color: 'rgba(251,191,36,0.85)' }}>
              {result.tip}
            </p>
          </div>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <div className="mt-4 px-4">
          <button
            onClick={onDismiss}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{
              background: cat.bg,
              border: `1px solid ${cat.color}30`,
              color: cat.color,
            }}
          >
            Continue scanning
          </button>
        </div>
      </div>
    </div>
  );
}
