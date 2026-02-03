import { getDb, generateId } from '../db';

export type TransactionType = 'escrow_deposit' | 'escrow_release' | 'escrow_refund' | 'fee_collection';

export interface Transaction {
  id: string;
  type: TransactionType;
  bounty_id: string | null;
  amount: number;
  token: string;
  from_wallet: string | null;
  to_wallet: string | null;
  fee_amount: number | null;
  tx_signature: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
}

export async function createTransaction(data: {
  type: TransactionType;
  bounty_id?: string;
  amount: number;
  token: string;
  from_wallet?: string;
  to_wallet?: string;
  fee_amount?: number;
  tx_signature?: string;
  status?: 'pending' | 'confirmed' | 'failed';
}): Promise<Transaction> {
  const db = getDb();
  const id = generateId('tx');
  const now = new Date().toISOString();
  
  await db.execute({
    sql: `INSERT INTO transactions (
      id, type, bounty_id, amount, token, from_wallet, to_wallet, 
      fee_amount, tx_signature, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.type,
      data.bounty_id || null,
      data.amount,
      data.token,
      data.from_wallet || null,
      data.to_wallet || null,
      data.fee_amount || null,
      data.tx_signature || null,
      data.status || 'pending',
      now,
    ],
  });
  
  return {
    id,
    type: data.type,
    bounty_id: data.bounty_id || null,
    amount: data.amount,
    token: data.token,
    from_wallet: data.from_wallet || null,
    to_wallet: data.to_wallet || null,
    fee_amount: data.fee_amount || null,
    tx_signature: data.tx_signature || null,
    status: data.status || 'pending',
    created_at: now,
  };
}

export async function updateTransactionStatus(
  id: string,
  status: 'pending' | 'confirmed' | 'failed',
  tx_signature?: string
): Promise<boolean> {
  const db = getDb();
  
  if (tx_signature) {
    const result = await db.execute({
      sql: 'UPDATE transactions SET status = ?, tx_signature = ? WHERE id = ?',
      args: [status, tx_signature, id],
    });
    return result.rowsAffected > 0;
  }
  
  const result = await db.execute({
    sql: 'UPDATE transactions SET status = ? WHERE id = ?',
    args: [status, id],
  });
  return result.rowsAffected > 0;
}

export async function getTransactionsByBounty(bountyId: string): Promise<Transaction[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM transactions WHERE bounty_id = ? ORDER BY created_at DESC',
    args: [bountyId],
  });
  
  return result.rows as unknown as Transaction[];
}

// Get total fees collected
export async function getTotalFeesCollected(): Promise<{ sol: number; usdc: number }> {
  const db = getDb();
  
  const result = await db.execute({
    sql: `SELECT token, SUM(fee_amount) as total 
          FROM transactions 
          WHERE type = 'fee_collection' AND status = 'confirmed'
          GROUP BY token`,
    args: [],
  });
  
  const fees = { sol: 0, usdc: 0 };
  for (const row of result.rows) {
    const r = row as unknown as { token: string; total: number };
    if (r.token === 'SOL') fees.sol = r.total;
    if (r.token === 'USDC') fees.usdc = r.total;
  }
  
  return fees;
}

// List transactions with filters
export async function listTransactions(options: {
  bounty_id?: string;
  wallet?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ transactions: Transaction[]; total: number }> {
  const db = getDb();
  const { bounty_id, wallet, type, status, limit = 50, offset = 0 } = options;
  
  let whereClauses: string[] = [];
  let args: any[] = [];
  
  if (bounty_id) {
    whereClauses.push('bounty_id = ?');
    args.push(bounty_id);
  }
  if (wallet) {
    whereClauses.push('(from_wallet = ? OR to_wallet = ?)');
    args.push(wallet, wallet);
  }
  if (type) {
    whereClauses.push('type = ?');
    args.push(type);
  }
  if (status) {
    whereClauses.push('status = ?');
    args.push(status);
  }
  
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  // Get total count
  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM transactions ${whereClause}`,
    args,
  });
  const total = Number((countResult.rows[0] as any).count);
  
  // Get paginated results
  const result = await db.execute({
    sql: `SELECT * FROM transactions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });
  
  return { 
    transactions: result.rows as unknown as Transaction[], 
    total 
  };
}
