'use client';

import { useEffect, useState } from 'react';
import type { DisposalCategory, ScanHistoryEntry } from '@/lib/types';
import { getHistory, clearHistory } from '@/lib/history';

interface Props {
  onBack: () => void;
}

type FilterTab = 'All' | DisposalCategory;

const CATEGORIES: DisposalCategory[] = ['Recycling', 'Garbage', 'Compost', 'Depot Drop-off', 'Bulk Item'];

const CAT_STYLE: Record<DisposalCategory, { color: string; bg: string }> = {
  Recycling:        { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  Garbage:          { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  Compost:          { color: '#84cc16', bg: 'rgba(132,204,22,0.1)' },
  'Depot Drop-off': { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  'Bulk Item':      { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
};

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

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  );
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

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function HistoryList({ onBack }: Props) {
  const [all, setAll] = useState<ScanHistoryEntry[]>([]);
  const [filter, setFilter] = useState<FilterTab>('All');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { setAll(getHistory()); }, []);

  function handleClear() {
    clearHistory();
    setAll([]);
    setExpanded(null);
  }

  const shown = filter === 'All' ? all : all.filter(e => e.disposal.category === filter);

  // Count by category for tab badges
  const counts = Object.fromEntries(
    CATEGORIES.map(c => [c, all.filter(e => e.disposal.category === c).length])
  ) as Record<DisposalCategory, number>;

  return (
    <div className="screen-enter flex h-screen flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div
        className="shrink-0 pt-safe-5 px-4 pb-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}
      >
        <div className="flex items-center justify-between">
          {/* Back — 44px touch target */}
          <button
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90 hover:bg-white/[0.07]"
            style={{ background: 'var(--surface)' }}
            aria-label="Go back"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
          </button>

          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Scan History</h1>

          {/* Clear */}
          {all.length > 0 ? (
            <button
              onClick={handleClear}
              className="h-9 rounded-full px-3 text-xs font-medium text-red-600 transition-all active:scale-95 hover:bg-red-500/10"
              style={{ background: 'rgba(239,68,68,0.07)' }}
            >
              Clear
            </button>
          ) : (
            <div className="w-11" />
          )}
        </div>

        {/* ── Filter tabs ── */}
        {all.length > 0 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {/* All tab */}
            <button
              onClick={() => setFilter('All')}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95"
              style={{
                background: filter === 'All' ? 'var(--green)' : 'var(--surface)',
                color: filter === 'All' ? '#000' : 'var(--text-secondary)',
                border: filter === 'All' ? 'none' : '1px solid var(--border)',
              }}
            >
              All {all.length > 0 && <span className="ml-1 opacity-70">{all.length}</span>}
            </button>

            {/* Category tabs — only show if there are entries in that category */}
            {CATEGORIES.filter(c => counts[c] > 0).map(c => {
              const s = CAT_STYLE[c];
              const active = filter === c;
              return (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95"
                  style={{
                    background: active ? s.bg : 'var(--surface)',
                    color: active ? s.color : 'var(--text-secondary)',
                    border: active ? `1px solid ${s.color}40` : '1px solid var(--border)',
                  }}
                >
                  <CategoryIcon category={c} className="h-3.5 w-3.5" />
                  <span>{c}</span>
                  {counts[c] > 1 && <span className="opacity-60">{counts[c]}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
            >
              {filter === 'All'
                ? <ClipboardIcon className="h-8 w-8" />
                : <CategoryIcon category={filter as DisposalCategory} className="h-8 w-8" />
              }
            </div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {filter === 'All' ? 'No scans yet' : `No ${filter} items`}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {filter === 'All'
                ? "Scan items with Recykle and they'll appear here"
                : `You haven't scanned any ${filter.toLowerCase()} items yet`}
            </p>
          </div>
        ) : (
          <ul className="px-4 py-2">
            {shown.map((entry) => {
              const s = CAT_STYLE[entry.disposal.category];
              const isOpen = expanded === entry.id;

              return (
                <li
                  key={entry.id}
                  className="mb-2 overflow-hidden rounded-2xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : entry.id)}
                    className="flex w-full items-center gap-3 p-3 text-left transition-all active:bg-white/[0.03]"
                  >
                    {/* Thumbnail or category icon */}
                    <div className="shrink-0">
                      {entry.thumbnail ? (
                        <img
                          src={entry.thumbnail}
                          alt=""
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl"
                          style={{ background: s.bg, color: s.color }}
                        >
                          <CategoryIcon category={entry.disposal.category} className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{entry.disposal.item}</p>
                        <span className="shrink-0 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      {/* Category chip inline */}
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: s.bg, color: s.color }}
                        >
                          <CategoryIcon category={entry.disposal.category} className="h-3 w-3" />
                          {entry.disposal.category}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                          {entry.city}
                        </span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
                      style={{ color: 'var(--text-tertiary)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 4l4 4 4-4" />
                    </svg>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div
                      className="border-t px-4 py-3"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {entry.disposal.explanation}
                      </p>
                      {entry.disposal.tip && (
                        <p className="mt-2.5 flex items-start gap-1.5 text-sm" style={{ color: 'rgba(251,191,36,0.75)' }}>
                          <LightbulbIcon className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{entry.disposal.tip}</span>
                        </p>
                      )}
                      <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {entry.disposal.material}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
