import { NextRequest, NextResponse } from 'next/server';
import { getHunterReputation, createHunterProfile, getBadgeDefinitions } from '@/lib/reputation';
import { initDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    await ensureDb();
    const { wallet } = await params;
    
    // Validate wallet address
    if (!wallet || wallet.length < 32) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    
    let reputation = await getHunterReputation(wallet);
    
    // If no profile exists, create one and return defaults
    if (!reputation) {
      await createHunterProfile(wallet);
      reputation = await getHunterReputation(wallet);
    }
    
    return NextResponse.json({
      reputation,
      badgeDefinitions: getBadgeDefinitions(),
    });
  } catch (error: any) {
    console.error('Reputation fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reputation' },
      { status: 500 }
    );
  }
}
