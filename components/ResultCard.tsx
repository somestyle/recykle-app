'use client';

import type { DisposalCategory, DisposalResult } from '@/lib/types';

interface Props {
  result: DisposalResult;
  city: string;
  thumbnail?: string;
  onDismiss: () => void;
}

interface CategoryStyle {
  label: string;
  color: string;
  bg: string;
  gradient: string;
  actionLabel: string;
}

// ── SVG category icons ─────────────────────────────────────────────────────
function CategoryIcon({ category, className }: { category: DisposalCategory; className?: string }) {
  const shared = { viewBox: '0 0 24 24', fill: 'none', className, stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (category) {
    case 'Recycling':
      return (
        <svg {...shared}>
          <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/>
          <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/>
          <path d="m14 16-3 3 3 3"/>
          <path d="M8.293 13.596 7.196 9.5 3.1 10.598"/>
          <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/>
          <path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>
        </svg>
      );
    case 'Garbage':
      return (
        <svg {...shared}>
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      );
    case 'Compost':
      return (
        <svg {...shared}>
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
        </svg>
      );
    case 'Depot Drop-off':
      return (
        <svg {...shared}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      );
    case 'Bulk Item':
      return (
        <svg {...shared}>
          <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      );
  }
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="18" x2="15" y2="18"/>
      <line x1="10" y1="22" x2="14" y2="22"/>
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
    </svg>
  );
}

const CATEGORY: Record<DisposalCategory, CategoryStyle> = {
  Recycling: {
    label: 'Recycling',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.12)',
    gradient: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.05) 100%)',
    actionLabel: 'Blue box · Curbside',
  },
  Garbage: {
    label: 'Garbage',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.05) 100%)',
    actionLabel: 'Black bin · Landfill',
  },
  Compost: {
    label: 'Compost',
    color: '#84cc16',
    bg: 'rgba(132, 204, 22, 0.12)',
    gradient: 'linear-gradient(135deg, rgba(132,204,22,0.2) 0%, rgba(132,204,22,0.05) 100%)',
    actionLabel: 'Green bin · Organics',
  },
  'Depot Drop-off': {
    label: 'Depot Drop-off',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.12)',
    gradient: 'linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(249,115,22,0.05) 100%)',
    actionLabel: 'Hazardous waste depot',
  },
  'Bulk Item': {
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
        style={{ background: 'var(--surface)', boxShadow: '0 -4px 32px rgba(0,0,0,0.12), 0 -1px 6px rgba(0,0,0,0.06)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-9 rounded-full" style={{ background: 'rgba(0,0,0,0.1)' }} />
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
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: cat.bg, color: cat.color }}
            >
              <CategoryIcon category={result.category} className="h-7 w-7" />
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
              className="text-xl font-bold leading-snug"
              style={{ letterSpacing: '-0.01em', color: 'var(--text-primary)' }}
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
            <LightbulbIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" />
            <p className="text-sm leading-snug" style={{ color: 'rgba(251,191,36,0.85)' }}>
              {result.tip}
            </p>
          </div>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <div className="mt-4 px-4">
          <button
            onClick={onDismiss}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98] hover:brightness-110"
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
