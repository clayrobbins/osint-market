import { NextRequest, NextResponse } from 'next/server';
import { initDb, getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

interface ActivityItem {
  type: 'bounty_created' | 'bounty_claimed' | 'submission' | 'resolution';
  bounty_id: string;
  question: string;
  wallet: string;
  amount?: number;
  token?: string;
  status?: string;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  await ensureDb();
  const db = getDb();
  
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
  
  // Get recent activity from multiple sources
  const activities: ActivityItem[] = [];
  
  // Recent bounties
  const bounties = await db.execute({
    sql: `SELECT id, question, poster_wallet, reward_amount, reward_token, status, created_at 
          FROM bounties 
          ORDER BY created_at DESC 
          LIMIT ?`,
    args: [limit],
  });
  
  for (const row of bounties.rows) {
    const b = row as unknown as {
      id: string;
      question: string;
      poster_wallet: string;
      reward_amount: number;
      reward_token: string;
      status: string;
      created_at: string;
    };
    activities.push({
      type: 'bounty_created',
      bounty_id: b.id,
      question: b.question.length > 80 ? b.question.slice(0, 80) + '...' : b.question,
      wallet: b.poster_wallet,
      amount: b.reward_amount,
      token: b.reward_token,
      timestamp: b.created_at,
    });
  }
  
  // Recent submissions
  const submissions = await db.execute({
    sql: `SELECT s.bounty_id, s.agent_wallet, s.submitted_at, b.question
          FROM submissions s
          JOIN bounties b ON b.id = s.bounty_id
          ORDER BY s.submitted_at DESC
          LIMIT ?`,
    args: [limit],
  });
  
  for (const row of submissions.rows) {
    const s = row as unknown as {
      bounty_id: string;
      agent_wallet: string;
      submitted_at: string;
      question: string;
    };
    activities.push({
      type: 'submission',
      bounty_id: s.bounty_id,
      question: s.question.length > 80 ? s.question.slice(0, 80) + '...' : s.question,
      wallet: s.agent_wallet,
      timestamp: s.submitted_at,
    });
  }
  
  // Recent resolutions
  const resolutions = await db.execute({
    sql: `SELECT r.bounty_id, r.status, r.resolved_at, b.question, b.reward_amount, b.reward_token, s.agent_wallet
          FROM resolutions r
          JOIN bounties b ON b.id = r.bounty_id
          JOIN submissions s ON s.id = r.submission_id
          ORDER BY r.resolved_at DESC
          LIMIT ?`,
    args: [limit],
  });
  
  for (const row of resolutions.rows) {
    const r = row as unknown as {
      bounty_id: string;
      status: string;
      resolved_at: string;
      question: string;
      reward_amount: number;
      reward_token: string;
      agent_wallet: string;
    };
    activities.push({
      type: 'resolution',
      bounty_id: r.bounty_id,
      question: r.question.length > 80 ? r.question.slice(0, 80) + '...' : r.question,
      wallet: r.agent_wallet,
      status: r.status,
      amount: r.status === 'approved' ? r.reward_amount : undefined,
      token: r.status === 'approved' ? r.reward_token : undefined,
      timestamp: r.resolved_at,
    });
  }
  
  // Sort by timestamp
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return NextResponse.json({
    activities: activities.slice(0, limit),
    count: activities.length,
  });
}
