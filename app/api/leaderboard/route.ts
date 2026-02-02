import { NextResponse } from 'next/server';
import { initDb, getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

interface LeaderboardEntry {
  wallet: string;
  bounties_completed: number;
  total_earned: number;
  approval_rate: number;
}

export async function GET() {
  await ensureDb();
  const db = getDb();
  
  // Get top hunters by completed bounties
  const huntersResult = await db.execute({
    sql: `
      SELECT 
        s.agent_wallet as wallet,
        COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN r.status = 'rejected' THEN 1 END) as rejected,
        COUNT(*) as total_submissions
      FROM submissions s
      LEFT JOIN resolutions r ON r.submission_id = s.id
      GROUP BY s.agent_wallet
      ORDER BY approved DESC
      LIMIT 20
    `,
    args: [],
  });
  
  // Get earnings per hunter
  const earningsResult = await db.execute({
    sql: `
      SELECT 
        s.agent_wallet as wallet,
        SUM(b.reward_amount) as total_earned,
        b.reward_token as token
      FROM submissions s
      JOIN resolutions r ON r.submission_id = s.id
      JOIN bounties b ON b.id = s.bounty_id
      WHERE r.status = 'approved'
      GROUP BY s.agent_wallet, b.reward_token
    `,
    args: [],
  });
  
  // Combine data
  const earningsMap = new Map<string, number>();
  for (const row of earningsResult.rows) {
    const r = row as unknown as { wallet: string; total_earned: number; token: string };
    // Convert to USD estimate (rough)
    const usdValue = r.token === 'SOL' ? r.total_earned * 150 : r.total_earned;
    earningsMap.set(r.wallet, (earningsMap.get(r.wallet) || 0) + usdValue);
  }
  
  const leaderboard: LeaderboardEntry[] = huntersResult.rows.map(row => {
    const r = row as unknown as { 
      wallet: string; 
      approved: number; 
      rejected: number; 
      total_submissions: number 
    };
    return {
      wallet: r.wallet,
      bounties_completed: Number(r.approved),
      total_earned: earningsMap.get(r.wallet) || 0,
      approval_rate: r.total_submissions > 0 
        ? Math.round((Number(r.approved) / r.total_submissions) * 100) 
        : 0,
    };
  }).filter(e => e.bounties_completed > 0);
  
  // Get top posters
  const postersResult = await db.execute({
    sql: `
      SELECT 
        poster_wallet as wallet,
        COUNT(*) as bounties_posted,
        SUM(reward_amount) as total_staked
      FROM bounties
      GROUP BY poster_wallet
      ORDER BY bounties_posted DESC
      LIMIT 10
    `,
    args: [],
  });
  
  return NextResponse.json({
    hunters: leaderboard,
    posters: postersResult.rows.map(r => r as unknown as {
      wallet: string;
      bounties_posted: number;
      total_staked: number;
    }),
    updated_at: new Date().toISOString(),
  });
}
