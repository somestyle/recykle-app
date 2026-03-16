import type { ScanHistoryEntry } from './types';

const HISTORY_KEY = 'recykle_history';
const SEEDED_KEY = 'recykle_seeded';
const MAX_HISTORY = 50;

// Example notes pre-seeded for demo purposes
const EXAMPLE_NOTES: ScanHistoryEntry[] = [
  {
    id: 'example-1',
    timestamp: Date.now() - 86400000, // yesterday
    city: 'Toronto, Ontario',
    disposal: {
      item: 'AA Battery',
      material: 'Alkaline battery',
      category: 'Depot Drop-off',
      explanation: 'Batteries are hazardous and cannot go in any regular bin in Toronto.',
      tip: 'Drop off at Canadian Tire – 839 Yonge St, Toronto. Battery recycling at customer service.',
      address: {
        name: 'Canadian Tire – Toronto',
        address: '839 Yonge St, Toronto, ON',
        note: 'Battery recycling available at customer service desk',
      },
    },
    thumbnail: undefined,
  },
  {
    id: 'example-2',
    timestamp: Date.now() - 259200000, // 3 days ago
    city: 'Toronto, Ontario',
    disposal: {
      item: 'Old Laptop',
      material: 'Electronics, mixed metals and plastics',
      category: 'Depot Drop-off',
      explanation: 'Electronics contain hazardous materials and must be recycled at a certified depot.',
      tip: 'Drop off at Best Buy – 2452 Yonge St, Toronto. Free electronics recycling drop-off.',
      address: {
        name: 'Best Buy – Toronto',
        address: '2452 Yonge St, Toronto, ON',
        note: 'Free electronics recycling, no purchase required',
      },
    },
    thumbnail: undefined,
  },
];

export function getHistory(): ScanHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const seeded = localStorage.getItem(SEEDED_KEY);
    if (!raw && !seeded) {
      // First launch — seed example notes
      localStorage.setItem(HISTORY_KEY, JSON.stringify(EXAMPLE_NOTES));
      localStorage.setItem(SEEDED_KEY, '1');
      return EXAMPLE_NOTES;
    }
    if (!raw) return [];
    return JSON.parse(raw) as ScanHistoryEntry[];
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry: Omit<ScanHistoryEntry, 'id'>): ScanHistoryEntry {
  const newEntry: ScanHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
  };

  const history = getHistory();
  const updated = [newEntry, ...history].slice(0, MAX_HISTORY);

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Storage full — trim and retry
    const trimmed = [newEntry, ...history].slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  }

  return newEntry;
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(SEEDED_KEY);
}
