'use client';

import type { DisposalCategory, DisposalResult } from '@/lib/types';

interface Props {
  result: DisposalResult;
  city: string;
  thumbnail?: string;
  onDismiss: () => void;
}

const CATEGORY_CONFIG: Record<
  DisposalCategory,
  { emoji: string; label: string; colorClass: string; bgClass: string }
> = {
  Recycling: {
    emoji: '♻️',
    label: 'Recycling',
    colorClass: 'text-green-400',
    bgClass: 'bg-green-500/20 border-green-500/30',
  },
  Garbage: {
    emoji: '🗑️',
    label: 'Garbage',
    colorClass: 'text-red-400',
    bgClass: 'bg-red-500/20 border-red-500/30',
  },
  Compost: {
    emoji: '🌱',
    label: 'Compost',
    colorClass: 'text-lime-400',
    bgClass: 'bg-lime-500/20 border-lime-500/30',
  },
  'Depot Drop-off': {
    emoji: '🏭',
    label: 'Depot Drop-off',
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-500/20 border-orange-500/30',
  },
  'Bulk Item': {
    emoji: '📦',
    label: 'Bulk Item',
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/20 border-purple-500/30',
  },
};

export default function ResultCard({ result, city, thumbnail, onDismiss }: Props) {
  const config = CATEGORY_CONFIG[result.category] ?? CATEGORY_CONFIG['Garbage'];

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 slide-up">
      {/* Tap-outside backdrop */}
      <div
        className="absolute inset-0 -top-screen"
        onClick={onDismiss}
        style={{ top: '-100vh' }}
      />

      <div className="relative mx-auto max-w-lg rounded-t-3xl bg-gray-950 px-5 pb-safe-bottom pb-8 pt-5 shadow-2xl">
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <div className="flex gap-4">
          {/* Thumbnail */}
          {thumbnail && (
            <img
              src={thumbnail}
              alt="Scanned item"
              className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
            />
          )}

          <div className="min-w-0 flex-1">
            {/* Category badge */}
            <div
              className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${config.bgClass} ${config.colorClass}`}
            >
              <span>{config.emoji}</span>
              <span>{config.label}</span>
            </div>

            {/* Item name */}
            <h2 className="text-lg font-bold leading-tight text-white">{result.item}</h2>
            <p className="text-sm text-gray-400">{result.material}</p>
          </div>
        </div>

        {/* City */}
        <p className="mt-3 text-xs text-gray-500">Rules for {city}</p>

        {/* Explanation */}
        <p className="mt-2 text-sm text-gray-300 leading-relaxed">{result.explanation}</p>

        {/* Tip */}
        {result.tip && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2.5">
            <span className="mt-0.5 text-yellow-400">💡</span>
            <p className="text-sm text-gray-300">{result.tip}</p>
          </div>
        )}

        {/* Continue button */}
        <button
          onClick={onDismiss}
          className="mt-4 w-full rounded-xl bg-white/10 py-3 text-sm font-medium text-white transition hover:bg-white/20 active:scale-95"
        >
          Continue scanning
        </button>
      </div>
    </div>
  );
}
