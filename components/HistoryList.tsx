'use client';

import { useEffect, useState } from 'react';
import type { DisposalCategory, ScanHistoryEntry } from '@/lib/types';
import { getHistory, clearHistory } from '@/lib/history';

interface Props {
  onBack: () => void;
}

const CATEGORY_EMOJI: Record<DisposalCategory, string> = {
  Recycling: '♻️',
  Garbage: '🗑️',
  Compost: '🌱',
  'Depot Drop-off': '🏭',
  'Bulk Item': '📦',
};

const CATEGORY_COLOR: Record<DisposalCategory, string> = {
  Recycling: 'text-green-400',
  Garbage: 'text-red-400',
  Compost: 'text-lime-400',
  'Depot Drop-off': 'text-orange-400',
  'Bulk Item': 'text-purple-400',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function HistoryList({ onBack }: Props) {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setEntries(getHistory());
  }, []);

  function handleClear() {
    clearHistory();
    setEntries([]);
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 pt-safe-top">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
        >
          ← Back
        </button>
        <h1 className="text-base font-semibold">Scan History</h1>
        {entries.length > 0 ? (
          <button
            onClick={handleClear}
            className="text-xs text-red-400 hover:text-red-300 transition"
          >
            Clear all
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="mb-4 text-5xl opacity-30">📋</div>
            <p className="text-gray-500">No scans yet.</p>
            <p className="mt-1 text-sm text-gray-600">
              Scan items with Recykle and they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5 px-4 py-2">
            {entries.map((entry) => {
              const emoji = CATEGORY_EMOJI[entry.disposal.category] ?? '🗑️';
              const color = CATEGORY_COLOR[entry.disposal.category] ?? 'text-gray-400';
              const isOpen = expanded === entry.id;

              return (
                <li key={entry.id} className="py-3">
                  <button
                    onClick={() => setExpanded(isOpen ? null : entry.id)}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    {/* Thumbnail or emoji */}
                    {entry.thumbnail ? (
                      <img
                        src={entry.thumbnail}
                        alt=""
                        className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-2xl">
                        {emoji}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-medium text-white">{entry.disposal.item}</p>
                        <span className="flex-shrink-0 text-xs text-gray-500">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <p className={`text-sm font-semibold ${color}`}>
                        {emoji} {entry.disposal.category}
                      </p>
                      <p className="text-xs text-gray-500">{entry.city}</p>
                    </div>

                    <span className="text-gray-600 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}>
                      ▾
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="mt-3 ml-15 rounded-xl bg-white/5 p-3" style={{ marginLeft: '60px' }}>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {entry.disposal.explanation}
                      </p>
                      {entry.disposal.tip && (
                        <p className="mt-2 text-sm text-yellow-400/80">
                          💡 {entry.disposal.tip}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-gray-600">
                        {entry.disposal.material} · {entry.city}
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
