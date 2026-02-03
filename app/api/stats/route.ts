import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDb } from '@/lib/db';
import { getBountiesByStatus } from '@/lib/repositories/bounties';
import { getTotalFeesCollected } from '@/lib/repositories/transactions';
import { getSolBalance } from '@/lib/solana';
import { ESCROW_WALLET, FEE_STRUCTURE } from '@/lib/escrow';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  await ensureDb();
  
  try {
    const [bountyStats, fees, escrowBalance] = await Promise.all([
      getBountiesByStatus(),
      getTotalFeesCollected(),
      getSolBalance(ESCROW_WALLET.toBase58()).catch(() => null),
    ]);
    
    return NextResponse.json({
      bounties: bountyStats,
      escrow: {
        wallet: ESCROW_WALLET.toBase58(),
        balance_sol: escrowBalance,
      },
      fees_collected: fees,
      fee_structure: {
        creation: `${FEE_STRUCTURE.creation}%`,
        payout: `${FEE_STRUCTURE.payout}%`,
        total: `${FEE_STRUCTURE.total}%`,
        minimum_bounty_sol: FEE_STRUCTURE.minimumSol,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
