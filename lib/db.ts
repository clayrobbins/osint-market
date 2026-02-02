import { createClient, type Client } from '@libsql/client';

// Database client singleton
let db: Client | null = null;

export function getDb(): Client {
  if (!db) {
    // Use Turso in production, local file in development
    const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;
    
    db = createClient({
      url,
      authToken,
    });
  }
  return db;
}

// Initialize database schema
export async function initDb() {
  const client = getDb();
  
  // Bounties table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS bounties (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      description TEXT,
      reward_amount REAL NOT NULL,
      reward_token TEXT NOT NULL,
      reward_usd_value REAL,
      poster_wallet TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      difficulty TEXT NOT NULL,
      tags TEXT NOT NULL,
      escrow_tx TEXT,
      created_at TEXT NOT NULL,
      deadline TEXT NOT NULL,
      claimed_by TEXT,
      claimed_at TEXT,
      claim_expires_at TEXT
    )
  `);
  
  // Submissions table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      bounty_id TEXT NOT NULL,
      agent_wallet TEXT NOT NULL,
      answer TEXT NOT NULL,
      evidence TEXT NOT NULL,
      methodology TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (bounty_id) REFERENCES bounties(id)
    )
  `);
  
  // Resolutions table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS resolutions (
      id TEXT PRIMARY KEY,
      bounty_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      status TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      resolver_id TEXT NOT NULL,
      payment_tx TEXT,
      resolved_at TEXT NOT NULL,
      FOREIGN KEY (bounty_id) REFERENCES bounties(id),
      FOREIGN KEY (submission_id) REFERENCES submissions(id)
    )
  `);
  
  // Transactions table (for fee tracking)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      bounty_id TEXT,
      amount REAL NOT NULL,
      token TEXT NOT NULL,
      from_wallet TEXT,
      to_wallet TEXT,
      fee_amount REAL,
      tx_signature TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (bounty_id) REFERENCES bounties(id)
    )
  `);
  
  // Create indexes
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_bounties_poster ON bounties(poster_wallet)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_submissions_bounty ON submissions(bounty_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_transactions_bounty ON transactions(bounty_id)`);
  
  // Reputation tables
  await client.execute(`
    CREATE TABLE IF NOT EXISTS reputation (
      wallet TEXT PRIMARY KEY,
      total_bounties INTEGER DEFAULT 0,
      successful_bounties INTEGER DEFAULT 0,
      failed_bounties INTEGER DEFAULT 0,
      total_earnings REAL DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  
  await client.execute(`
    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      badge_type TEXT NOT NULL,
      earned_at TEXT NOT NULL,
      bounty_id TEXT,
      FOREIGN KEY (wallet) REFERENCES reputation(wallet)
    )
  `);
  
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_badges_wallet ON badges(wallet)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_reputation_earnings ON reputation(total_earnings DESC)`);
  
  console.log('Database initialized');
}

// Helper to generate IDs
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}
