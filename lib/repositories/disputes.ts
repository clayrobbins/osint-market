import { getDb, generateId } from '../db';

export interface Dispute {
  id: string;
  bounty_id: string;
  agent_wallet: string;
  reason: string;
  evidence: string[];
  status: 'pending' | 'resolved_for_hunter' | 'resolved_for_poster' | 'dismissed';
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export async function createDispute(data: {
  bounty_id: string;
  agent_wallet: string;
  reason: string;
  evidence: string[];
}): Promise<Dispute> {
  const db = getDb();
  const id = generateId('dispute');
  const now = new Date().toISOString();
  
  await db.execute({
    sql: `INSERT INTO disputes (
      id, bounty_id, agent_wallet, reason, evidence, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.bounty_id,
      data.agent_wallet,
      data.reason,
      JSON.stringify(data.evidence),
      'pending',
      now,
    ],
  });
  
  return {
    id,
    bounty_id: data.bounty_id,
    agent_wallet: data.agent_wallet,
    reason: data.reason,
    evidence: data.evidence,
    status: 'pending',
    admin_notes: null,
    created_at: now,
    resolved_at: null,
  };
}

export async function getDispute(id: string): Promise<Dispute | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM disputes WHERE id = ?',
    args: [id],
  });
  
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as any;
  return {
    ...row,
    evidence: JSON.parse(row.evidence || '[]'),
  };
}

export async function getDisputeByBounty(bountyId: string): Promise<Dispute | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM disputes WHERE bounty_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [bountyId],
  });
  
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as any;
  return {
    ...row,
    evidence: JSON.parse(row.evidence || '[]'),
  };
}

export async function resolveDispute(
  id: string,
  status: 'resolved_for_hunter' | 'resolved_for_poster' | 'dismissed',
  admin_notes: string
): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  
  const result = await db.execute({
    sql: 'UPDATE disputes SET status = ?, admin_notes = ?, resolved_at = ? WHERE id = ?',
    args: [status, admin_notes, now, id],
  });
  
  return result.rowsAffected > 0;
}

export async function listDisputes(options: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ disputes: Dispute[]; total: number }> {
  const db = getDb();
  const { status, limit = 50, offset = 0 } = options;
  
  let whereClause = '';
  let args: any[] = [];
  
  if (status) {
    whereClause = 'WHERE status = ?';
    args.push(status);
  }
  
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM disputes ${whereClause}`,
    args,
  });
  const total = Number((countResult.rows[0] as any).count);
  
  const result = await db.execute({
    sql: `SELECT * FROM disputes ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });
  
  const disputes = result.rows.map((row: any) => ({
    ...row,
    evidence: JSON.parse(row.evidence || '[]'),
  }));
  
  return { disputes, total };
}
