import { NextRequest, NextResponse } from 'next/server';
import { getReputationLeaderboard, getBadgeDefinitions } from '@/lib/reputation';
import { initDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    
    const leaderboard = await getReputationLeaderboard(limit);
    
    return NextResponse.json({
      leaderboard,
      badgeDefinitions: getBadgeDefinitions(),
    });
  } catch (error: any) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
