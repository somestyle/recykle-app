'use client';

import { useState } from 'react';
import type { DisposalCategory, DisposalResult } from '@/lib/types';

interface Props {
  result: DisposalResult;
  city: string;
  thumbnail?: string;
  onDismiss: () => void;
  onSaveToNotes?: () => void;
  alreadySaved?: boolean;
}

interface CategoryStyle {
  label: string;
  color: string;
  bg: string;
  chipBg: string;   // bin-type chip background
  chipLabel: string; // bin type label
}

// SVG icons
function CategoryIcon({ category, className }: { category: DisposalCategory; className?: string }) {
  const shared = { viewBox: '0 0 24 24', fill: 'none', className, stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (category) {
    case 'Recycling':
      return <svg {...shared}><path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/><path d="m14 16-3 3 3 3"/><path d="M8.293 13.596 7.196 9.5 3.1 10.598"/><path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/><path d="m13.378 9.633 4.096 1.098 1.097-4.096"/></svg>;
    case 'Garbage':
      return <svg {...shared}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
    case 'Compost':
      return <svg {...shared}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>;
    case 'Depot Drop-off':
      return <svg {...shared}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case 'Bulk Item':
      return <svg {...shared}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
  }
}

function GpsPinIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 0 1 8 1.5z" />
      <circle cx="8" cy="6" r="1.5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="9" height="9" rx="1.5" />
      <path d="M10.5 5.5V3.5a1.5 1.5 0 0 0-1.5-1.5h-6a1.5 1.5 0 0 0-1.5 1.5v6a1.5 1.5 0 0 0 1.5 1.5h2" />
    </svg>
  );
}

const CATEGORY: Record<DisposalCategory, CategoryStyle> = {
  Recycling: {
    label: 'Recycling',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.1)',
    chipBg: '#1d4ed8',
    chipLabel: 'Blue box',
  },
  Garbage: {
    label: 'Garbage',
    color: '#4b5563',
    bg: 'rgba(75,85,99,0.08)',
    chipBg: '#374151',
    chipLabel: 'Black bin',
  },
  Compost: {
    label: 'Compost',
    color: '#15803d',
    bg: 'rgba(21,128,61,0.1)',
    chipBg: '#15803d',
    chipLabel: 'Green bin',
  },
  'Depot Drop-off': {
    label: 'Depot Drop-off',
    color: '#ea580c',
    bg: 'rgba(234,88,12,0.1)',
    chipBg: '#c2410c',
    chipLabel: 'Drop-off required',
  },
  'Bulk Item': {
    label: 'Bulk Item',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.1)',
    chipBg: '#6d28d9',
    chipLabel: 'Bulk pickup',
  },
};

export default function ResultCard({ result, city, thumbnail, onDismiss, onSaveToNotes, alreadySaved }: Props) {
  const cat = CATEGORY[result.category] ?? CATEGORY['Garbage'];
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (result.address) {
      navigator.clipboard.writeText(`${result.address.name}, ${result.address.address}`).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  }

  return (
    /* Full-screen overlay */
    <div className="absolute inset-0 z-40 flex items-center justify-center px-4">
      {/* Tap-behind to dismiss */}
      <div className="absolute inset-0" onClick={onDismiss} />

      {/* Card */}
      <div
        className="card-in relative w-full max-w-sm overflow-hidden rounded-[24px]"
        style={{
          background: 'var(--surface)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.12)',
          maxHeight: '88dvh',
          overflowY: 'auto',
        }}
      >
        {/* Category header */}
        <div className="px-5 pt-5 pb-4" style={{ background: cat.bg }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: `${cat.color}99` }}>
                Disposal category
              </p>
              <p className="text-2xl font-bold tracking-tight" style={{ color: cat.color }}>
                {cat.label}
              </p>
              {/* Bin-type chip */}
              <span
                className="mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold text-white"
                style={{ background: cat.chipBg }}
              >
                {cat.chipLabel}
              </span>
            </div>
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.6)', color: cat.color }}
            >
              <CategoryIcon category={result.category} className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Item details */}
        <div className="flex items-start gap-3 px-5 pt-4">
          {thumbnail && (
            <img
              src={thumbnail}
              alt="Scanned item"
              className="h-16 w-16 shrink-0 rounded-xl object-cover"
              style={{ border: '1px solid rgba(0,0,0,0.06)' }}
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {result.item}
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {result.material}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              Rules for {city}
            </p>
          </div>
        </div>

        {/* Explanation */}
        <p className="mt-3 px-5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {result.explanation}
        </p>

        {/* Drop-off address — grey, no border, GPS icon + copy button */}
        {result.address && (
          <div
            className="mx-5 mt-3 rounded-xl p-3.5"
            style={{ background: 'rgba(0,0,0,0.04)' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                <GpsPinIcon />
                <span className="text-[10px] font-semibold uppercase tracking-widest">Nearest drop-off</span>
              </div>
              <button
                onClick={copyAddress}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors active:scale-95"
                style={{ color: copied ? '#16a34a' : 'var(--text-tertiary)', background: 'rgba(0,0,0,0.04)' }}
                aria-label="Copy address"
              >
                <CopyIcon />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {result.address.name}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {result.address.address}
            </p>
            {result.address.note && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {result.address.note}
              </p>
            )}
          </div>
        )}

        {/* Tip — plain text, no tile */}
        {result.tip && (
          <p className="mt-3 px-5 text-sm leading-snug" style={{ color: 'rgba(180,130,0,0.9)' }}>
            💡 {result.tip}
          </p>
        )}

        {/* CTA */}
        <div className="mt-4 px-5 pb-5 flex flex-col gap-2">
          <button
            onClick={onDismiss}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              background: cat.bg,
              color: cat.color,
            }}
          >
            Continue scanning
          </button>

          {alreadySaved ? (
            <div className="flex items-center justify-center gap-1.5 py-1">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 8l4 4 7-7" />
              </svg>
              <span className="text-xs font-medium" style={{ color: '#22c55e' }}>Saved to Notes</span>
            </div>
          ) : onSaveToNotes ? (
            <button
              onClick={onSaveToNotes}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-medium transition-all active:scale-[0.98]"
              style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)' }}
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2h10a1 1 0 0 1 1 1v11l-5-2.5L4 14V3a1 1 0 0 1 1-1z" />
              </svg>
              Save to Notes
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
