'use client';

import { useEffect, useState } from 'react';
import type { DisposalCategory, ScanHistoryEntry } from '@/lib/types';
import { getHistory, clearHistory } from '@/lib/history';

interface Props {
  onBack: () => void;
}

type FilterTab = 'All' | DisposalCategory;

const CATEGORIES: DisposalCategory[] = ['Recycling', 'Garbage', 'Compost', 'Depot Drop-off', 'Bulk Item'];

const CAT_STYLE: Record<DisposalCategory, { emoji: string; color: string; bg: string }> = {
  Recycling:       { emoji: '♻️',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  Garbage:         { emoji: '🗑️', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  Compost:         { emoji: '🌱',  color: '#84cc16', bg: 'rgba(132,204,22,0.1)' },
  'Depot Drop-off':{ emoji: '🏭',  color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  'Bulk Item':     { emoji: '📦',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
};

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
          {/* Back */}
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90"
            style={{ background: 'var(--surface)' }}
            aria-label="Go back"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
          </button>

          <h1 className="text-base font-semibold text-white">Scan History</h1>

          {/* Clear */}
          {all.length > 0 ? (
            <button
              onClick={handleClear}
              className="h-9 rounded-full px-3 text-xs font-medium text-red-400 transition-all active:scale-95"
              style={{ background: 'rgba(239,68,68,0.08)' }}
            >
              Clear
            </button>
          ) : (
            <div className="w-9" />
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
                  className="shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95"
                  style={{
                    background: active ? s.bg : 'var(--surface)',
                    color: active ? s.color : 'var(--text-secondary)',
                    border: active ? `1px solid ${s.color}40` : '1px solid var(--border)',
                  }}
                >
                  <span>{s.emoji}</span>
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
            <div className="flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: 'var(--surface)' }}>
              {filter === 'All' ? '📋' : CAT_STYLE[filter as DisposalCategory]?.emoji ?? '📋'}
            </div>
            <p className="font-medium text-white">
              {filter === 'All' ? 'No scans yet' : `No ${filter} items`}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {filter === 'All'
                ? 'Scan items with Recykle and they\'ll appear here'
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
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-xl"
                          style={{ background: s.bg }}
                        >
                          {s.emoji}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">{entry.disposal.item}</p>
                        <span className="shrink-0 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      {/* Category chip inline */}
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {s.emoji} {entry.disposal.category}
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
                          <span className="shrink-0">💡</span>
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
