import type { ScanHistoryEntry } from './types';

const HISTORY_KEY = 'recykle_history';
const MAX_HISTORY = 50;

export function getHistory(): ScanHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
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
}
