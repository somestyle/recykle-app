import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import type { CityKey } from '@/lib/types';

const VALID_CITY_KEYS: CityKey[] = ['markham', 'toronto', 'san-francisco'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityKey = searchParams.get('city') as CityKey | null;

  if (!cityKey || !VALID_CITY_KEYS.includes(cityKey)) {
    return NextResponse.json(
      { error: 'Invalid or missing city key. Valid values: markham, toronto, san-francisco' },
      { status: 400 }
    );
  }

  const filePath = path.join(process.cwd(), 'lib', 'recycling-rules', `${cityKey}.json`);

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const rules = JSON.parse(raw);
    return NextResponse.json(rules);
  } catch {
    return NextResponse.json({ error: 'Rules not found' }, { status: 404 });
  }
}
