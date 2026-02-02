import { getDb, generateId } from '../db';
import type { Resolution } from '../types';

export interface ResolutionRow {
  id: string;
  bounty_id: string;
  submission_id: string;
  status: string;
  reasoning: string;
  resolver_id: string;
  payment_tx: string | null;
  resolved_at: string;
}

function rowToResolution(row: ResolutionRow): Resolution {
  return {
    status: row.status as Resolution['status'],
    reasoning: row.reasoning,
    resolved_at: row.resolved_at,
    resolver_id: row.resolver_id,
    payment_tx: row.payment_tx || undefined,
  };
}

export async function createResolution(
  bountyId: string,
  submissionId: string,
  data: {
    status: 'approved' | 'rejected';
    reasoning: string;
    resolver_id: string;
    payment_tx?: string;
  }
): Promise<Resolution> {
  const db = getDb();
  const id = generateId('res');
  const now = new Date().toISOString();
  
  await db.execute({
    sql: `INSERT INTO resolutions (
      id, bounty_id, submission_id, status, reasoning, resolver_id, payment_tx, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      bountyId,
      submissionId,
      data.status,
      data.reasoning,
      data.resolver_id,
      data.payment_tx || null,
      now,
    ],
  });
  
  return {
    status: data.status,
    reasoning: data.reasoning,
    resolved_at: now,
    resolver_id: data.resolver_id,
    payment_tx: data.payment_tx,
  };
}

export async function getResolutionByBounty(bountyId: string): Promise<Resolution | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM resolutions WHERE bounty_id = ? LIMIT 1',
    args: [bountyId],
  });
  
  if (result.rows.length === 0) return null;
  return rowToResolution(result.rows[0] as unknown as ResolutionRow);
}
