export type DisposalCategory =
  | 'Recycling'
  | 'Garbage'
  | 'Compost'
  | 'Depot Drop-off'
  | 'Bulk Item';

export interface DisposalResult {
  item: string;
  material: string;
  category: DisposalCategory;
  explanation: string;
  tip: string | null;
  address?: { name: string; address: string; note: string };
}

export interface ScanHistoryEntry {
  id: string;
  timestamp: number;
  city: string;
  disposal: DisposalResult;
  thumbnail?: string; // base64 JPEG
}

export type CityKey = 'markham' | 'toronto' | 'san-francisco';

export interface CityInfo {
  key: CityKey;
  city: string;
  province: string;
  country: string;
  displayName: string;
}

export const CITY_MAP: Record<string, CityInfo> = {
  // Markham postal codes start with L3R, L3S, L3T, L6B, L6C, L6E, L6G
  'L3R': { key: 'markham', city: 'Markham', province: 'Ontario', country: 'Canada', displayName: 'Markham, ON' },
  'L3S': { key: 'markham', city: 'Markham', province: 'Ontario', country: 'Canada', displayName: 'Markham, ON' },
  'L3T': { key: 'markham', city: 'Markham', province: 'Ontario', country: 'Canada', displayName: 'Markham, ON' },
  'L6B': { key: 'markham', city: 'Markham', province: 'Ontario', country: 'Canada', displayName: 'Markham, ON' },
  'L6C': { key: 'markham', city: 'Markham', province: 'Ontario', country: 'Canada', displayName: 'Markham, ON' },
  'L6E': { key: 'markham', city: 'Markham', province: 'Ontario', country: 'Canada', displayName: 'Markham, ON' },
  // Toronto postal codes start with M
  'M4': { key: 'toronto', city: 'Toronto', province: 'Ontario', country: 'Canada', displayName: 'Toronto, ON' },
  'M5': { key: 'toronto', city: 'Toronto', province: 'Ontario', country: 'Canada', displayName: 'Toronto, ON' },
  'M6': { key: 'toronto', city: 'Toronto', province: 'Ontario', country: 'Canada', displayName: 'Toronto, ON' },
  // San Francisco zip codes
  '941': { key: 'san-francisco', city: 'San Francisco', province: 'California', country: 'United States', displayName: 'San Francisco, CA' },
};

export function resolveCityFromPostal(postal: string): CityInfo | null {
  const normalized = postal.trim().toUpperCase().replace(/\s+/g, '');

  // Canadian postal codes: first 3 characters are the FSA
  if (/^[A-Z]\d[A-Z]/.test(normalized)) {
    const fsa = normalized.substring(0, 3);
    if (CITY_MAP[fsa]) return CITY_MAP[fsa];
    // Try 2-char prefix for Toronto (M4, M5, M6, etc.)
    const prefix2 = normalized.substring(0, 2);
    if (CITY_MAP[prefix2]) return CITY_MAP[prefix2];
    // Default: any M postal code → Toronto
    if (normalized.startsWith('M')) {
      return { key: 'toronto', city: 'Toronto', province: 'Ontario', country: 'Canada', displayName: 'Toronto, ON' };
    }
    // Default: any L postal code → Markham (demo)
    if (normalized.startsWith('L')) {
      return { key: 'markham', city: 'Markham', province: 'Ontario', country: 'Canada', displayName: 'Markham, ON' };
    }
  }

  // US zip codes
  if (/^\d{5}/.test(normalized)) {
    const prefix3 = normalized.substring(0, 3);
    if (CITY_MAP[prefix3]) return CITY_MAP[prefix3];
    // Any 94xxx → San Francisco area
    if (normalized.startsWith('94')) {
      return { key: 'san-francisco', city: 'San Francisco', province: 'California', country: 'United States', displayName: 'San Francisco, CA' };
    }
  }

  return null;
}

// WebSocket message types sent from browser → server
export type ClientMessage =
  | { type: 'setup'; city: string; province: string; country: string; cityKey: CityKey }
  | { type: 'audio'; data: string } // base64 PCM16 at 16000 Hz
  | { type: 'video'; data: string } // base64 JPEG
  | { type: 'audioEnd' };

// WebSocket message types received from server → browser
export type ServerMessage =
  | { type: 'connected' }
  | { type: 'ready' } // Gemini session established
  | { type: 'audio'; data: string; mimeType: string } // base64 PCM16 response
  | { type: 'text'; text: string; isResponse?: boolean }
  | { type: 'disposal'; item: string; material: string; category: DisposalCategory; explanation: string; tip: string | null }
  | { type: 'turnComplete' }
  | { type: 'interrupted' }
  | { type: 'userTranscript'; text: string; finished: boolean }
  | { type: 'error'; message: string };
