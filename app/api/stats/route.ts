import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDb, getDb } from '@/lib/db';
import { getTotalFeesCollected } from '@/lib/repositories/transactions';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function GET() {
  await ensureDb();
  const db = getDb();
  
  // Get bounty counts by status
  const bountyStats = await db.execute({
    sql: `SELECT status, COUNT(*) as count FROM bounties GROUP BY status`,
    args: [],
  });
  
  const statusCounts: Record<string, number> = {};
  let totalBounties = 0;
  for (const row of bountyStats.rows) {
    const r = row as unknown as { status: string; count: number };
    statusCounts[r.status] = Number(r.count);
    totalBounties += Number(r.count);
  }
  
  // Get total value locked/paid
  const valueStats = await db.execute({
    sql: `SELECT 
            SUM(CASE WHEN status IN ('open', 'claimed', 'submitted') THEN reward_amount ELSE 0 END) as locked,
            SUM(CASE WHEN status = 'resolved' THEN reward_amount ELSE 0 END) as paid
          FROM bounties WHERE reward_token = 'SOL'`,
    args: [],
  });
  
  const valueRow = valueStats.rows[0] as unknown as { locked: number; paid: number } | undefined;
  
  // Get fees collected
  const fees = await getTotalFeesCollected();
  
  // Get unique agents
  const agentStats = await db.execute({
    sql: `SELECT COUNT(DISTINCT claimed_by) as hunters, COUNT(DISTINCT poster_wallet) as posters FROM bounties`,
    args: [],
  });
  const agentRow = agentStats.rows[0] as unknown as { hunters: number; posters: number } | undefined;
  
  return NextResponse.json({
    total_bounties: totalBounties,
    bounties_by_status: statusCounts,
    total_value_locked_sol: valueRow?.locked || 0,
    total_paid_sol: valueRow?.paid || 0,
    fees_collected: fees,
    unique_hunters: Number(agentRow?.hunters || 0),
    unique_posters: Number(agentRow?.posters || 0),
    status: totalBounties > 0 ? 'active' : 'launching_soon',
  });
}
