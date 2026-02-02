import { getDb, generateId } from '../db';
import type { Bounty, BountyStatus, Reward, CreateBountyRequest } from '../types';

export interface BountyRow {
  id: string;
  question: string;
  description: string | null;
  reward_amount: number;
  reward_token: string;
  reward_usd_value: number | null;
  poster_wallet: string;
  status: string;
  difficulty: string;
  tags: string;
  escrow_tx: string | null;
  created_at: string;
  deadline: string;
  claimed_by: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
}

function rowToBounty(row: BountyRow): Bounty {
  return {
    id: row.id,
    question: row.question,
    description: row.description || undefined,
    reward: {
      amount: row.reward_amount,
      token: row.reward_token as Reward['token'],
      usd_value: row.reward_usd_value || undefined,
    },
    poster_wallet: row.poster_wallet,
    status: row.status as BountyStatus,
    difficulty: row.difficulty as Bounty['difficulty'],
    tags: JSON.parse(row.tags),
    created_at: row.created_at,
    deadline: row.deadline,
    claimed_by: row.claimed_by || undefined,
    claimed_at: row.claimed_at || undefined,
  };
}

export async function listBounties(options: {
  status?: BountyStatus | 'all';
  posterWallet?: string;
  limit?: number;
  offset?: number;
}): Promise<{ bounties: Bounty[]; total: number }> {
  const db = getDb();
  const { status = 'open', posterWallet, limit = 20, offset = 0 } = options;
  
  let whereClause = '';
  const params: (string | number)[] = [];
  
  if (status !== 'all') {
    whereClause = 'WHERE status = ?';
    params.push(status);
  }
  
  if (posterWallet) {
    whereClause += whereClause ? ' AND poster_wallet = ?' : 'WHERE poster_wallet = ?';
    params.push(posterWallet);
  }
  
  // Get total count
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM bounties ${whereClause}`,
    args: params,
  });
  const total = Number(countResult.rows[0]?.count || 0);
  
  // Get bounties
  const result = await db.execute({
    sql: `SELECT * FROM bounties ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  });
  
  const bounties = result.rows.map(row => rowToBounty(row as unknown as BountyRow));
  
  return { bounties, total };
}

export async function getBounty(id: string): Promise<Bounty | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM bounties WHERE id = ?',
    args: [id],
  });
  
  if (result.rows.length === 0) return null;
  return rowToBounty(result.rows[0] as unknown as BountyRow);
}

export async function createBounty(
  data: CreateBountyRequest & { poster_wallet: string; escrow_tx?: string }
): Promise<Bounty> {
  const db = getDb();
  const id = generateId('bounty');
  const now = new Date().toISOString();
  
  await db.execute({
    sql: `INSERT INTO bounties (
      id, question, description, reward_amount, reward_token, reward_usd_value,
      poster_wallet, status, difficulty, tags, escrow_tx, created_at, deadline
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.question,
      data.description || null,
      data.reward.amount,
      data.reward.token,
      data.reward.usd_value || null,
      data.poster_wallet,
      'open',
      data.difficulty,
      JSON.stringify(data.tags),
      data.escrow_tx || null,
      now,
      data.deadline,
    ],
  });
  
  return (await getBounty(id))!;
}

export async function claimBounty(
  bountyId: string,
  agentWallet: string,
  expiresAt: string
): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  
  // Only claim if open
  const result = await db.execute({
    sql: `UPDATE bounties 
          SET status = 'claimed', claimed_by = ?, claimed_at = ?, claim_expires_at = ?
          WHERE id = ? AND status = 'open'`,
    args: [agentWallet, now, expiresAt, bountyId],
  });
  
  return result.rowsAffected > 0;
}

export async function updateBountyStatus(
  bountyId: string,
  status: BountyStatus
): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: 'UPDATE bounties SET status = ? WHERE id = ?',
    args: [status, bountyId],
  });
  return result.rowsAffected > 0;
}

export async function getClaimedBountyByAgent(agentWallet: string): Promise<Bounty | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM bounties WHERE claimed_by = ? AND status = 'claimed' LIMIT 1`,
    args: [agentWallet],
  });
  
  if (result.rows.length === 0) return null;
  return rowToBounty(result.rows[0] as unknown as BountyRow);
}

export async function getExpiredClaims(): Promise<Bounty[]> {
  const db = getDb();
  const now = new Date().toISOString();
  
  const result = await db.execute({
    sql: `SELECT * FROM bounties WHERE status = 'claimed' AND claim_expires_at < ?`,
    args: [now],
  });
  
  return result.rows.map(row => rowToBounty(row as unknown as BountyRow));
}

export async function releaseClaim(bountyId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: `UPDATE bounties 
          SET status = 'open', claimed_by = NULL, claimed_at = NULL, claim_expires_at = NULL
          WHERE id = ?`,
    args: [bountyId],
  });
  return result.rowsAffected > 0;
}
