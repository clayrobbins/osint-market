import { getDb, generateId } from '../db';

export interface Dispute {
  id: string;
  bounty_id: string;
  agent_wallet: string;  // The hunter who filed the dispute
  reason: string;
  evidence: string[];    // JSON array of evidence items
  status: 'pending' | 'reviewing' | 'upheld' | 'overturned';
  admin_notes?: string;
  created_at: string;
  resolved_at?: string;
}

interface DisputeRow {
  id: string;
  bounty_id: string;
  agent_wallet: string;
  reason: string;
  evidence: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

function rowToDispute(row: DisputeRow): Dispute {
  return {
    id: row.id,
    bounty_id: row.bounty_id,
    agent_wallet: row.agent_wallet,
    reason: row.reason,
    evidence: JSON.parse(row.evidence || '[]'),
    status: row.status as Dispute['status'],
    admin_notes: row.admin_notes || undefined,
    created_at: row.created_at,
    resolved_at: row.resolved_at || undefined,
  };
}

export async function createDispute(data: {
  bounty_id: string;
  agent_wallet: string;
  reason: string;
  evidence?: string[];
}): Promise<Dispute> {
  const db = getDb();
  const id = generateId('dispute');
  const now = new Date().toISOString();
  
  await db.execute({
    sql: `INSERT INTO disputes (
      id, bounty_id, agent_wallet, reason, evidence, status, created_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    args: [id, data.bounty_id, data.agent_wallet, data.reason, JSON.stringify(data.evidence || []), now],
  });
  
  return (await getDispute(id))!;
}

export async function getDispute(id: string): Promise<Dispute | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM disputes WHERE id = ?',
    args: [id],
  });
  
  if (result.rows.length === 0) return null;
  return rowToDispute(result.rows[0] as unknown as DisputeRow);
}

export async function getDisputeByBounty(bountyId: string): Promise<Dispute | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM disputes WHERE bounty_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [bountyId],
  });
  
  if (result.rows.length === 0) return null;
  return rowToDispute(result.rows[0] as unknown as DisputeRow);
}

export async function listDisputes(options: {
  status?: Dispute['status'];
  limit?: number;
  offset?: number;
}): Promise<{ disputes: Dispute[]; total: number }> {
  const db = getDb();
  const { status, limit = 20, offset = 0 } = options;
  
  let whereClause = '';
  const params: (string | number)[] = [];
  
  if (status) {
    whereClause = 'WHERE status = ?';
    params.push(status);
  }
  
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM disputes ${whereClause}`,
    args: params,
  });
  const total = Number(countResult.rows[0]?.count || 0);
  
  const result = await db.execute({
    sql: `SELECT * FROM disputes ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  });
  
  const disputes = result.rows.map(row => rowToDispute(row as unknown as DisputeRow));
  return { disputes, total };
}

export async function updateDisputeStatus(
  id: string,
  status: Dispute['status'],
  adminNotes?: string,
  resolvedBy?: string
): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  
  const result = await db.execute({
    sql: `UPDATE disputes 
          SET status = ?, admin_notes = ?, resolved_at = ?, resolved_by = ?
          WHERE id = ?`,
    args: [status, adminNotes || null, now, resolvedBy || null, id],
  });
  
  return result.rowsAffected > 0;
}
