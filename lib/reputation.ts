import { getDb } from './db';

export interface HunterReputation {
  wallet: string;
  totalBounties: number;
  successfulBounties: number;
  failedBounties: number;
  totalEarnings: number;
  successRate: number;
  rank: 'novice' | 'hunter' | 'expert' | 'elite' | 'legend';
  badges: string[];
  createdAt: string;
  updatedAt: string;
}

// Rank thresholds
const RANK_THRESHOLDS = {
  novice: { minBounties: 0, minSuccessRate: 0 },
  hunter: { minBounties: 3, minSuccessRate: 0.5 },
  expert: { minBounties: 10, minSuccessRate: 0.7 },
  elite: { minBounties: 25, minSuccessRate: 0.8 },
  legend: { minBounties: 50, minSuccessRate: 0.9 },
};

// Badge definitions
const BADGES = {
  first_blood: { name: 'First Blood', description: 'Completed first bounty' },
  speed_demon: { name: 'Speed Demon', description: 'Completed bounty in under 1 hour' },
  perfectionist: { name: 'Perfectionist', description: '10 bounties with 90%+ confidence' },
  whale_hunter: { name: 'Whale Hunter', description: 'Completed a bounty worth 10+ SOL' },
  streak_5: { name: 'Hot Streak', description: '5 successful bounties in a row' },
  streak_10: { name: 'Unstoppable', description: '10 successful bounties in a row' },
  early_adopter: { name: 'Early Adopter', description: 'Joined in first week' },
};

// Initialize reputation tables
export async function initReputationTables() {
  const db = getDb();
  
  await db.execute(`
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
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      badge_type TEXT NOT NULL,
      earned_at TEXT NOT NULL,
      bounty_id TEXT,
      FOREIGN KEY (wallet) REFERENCES reputation(wallet)
    )
  `);
  
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_badges_wallet ON badges(wallet)`);
}

// Get or create hunter reputation
export async function getHunterReputation(wallet: string): Promise<HunterReputation | null> {
  const db = getDb();
  
  const result = await db.execute({
    sql: 'SELECT * FROM reputation WHERE wallet = ?',
    args: [wallet],
  });
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  const totalBounties = Number(row.total_bounties);
  const successfulBounties = Number(row.successful_bounties);
  const successRate = totalBounties > 0 ? successfulBounties / totalBounties : 0;
  
  // Get badges
  const badgesResult = await db.execute({
    sql: 'SELECT badge_type FROM badges WHERE wallet = ?',
    args: [wallet],
  });
  const badges = badgesResult.rows.map(r => String(r.badge_type));
  
  return {
    wallet: String(row.wallet),
    totalBounties,
    successfulBounties,
    failedBounties: Number(row.failed_bounties),
    totalEarnings: Number(row.total_earnings),
    successRate,
    rank: calculateRank(totalBounties, successRate),
    badges,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// Create new hunter profile
export async function createHunterProfile(wallet: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  
  await db.execute({
    sql: `INSERT OR IGNORE INTO reputation (wallet, created_at, updated_at) VALUES (?, ?, ?)`,
    args: [wallet, now, now],
  });
}

// Record successful bounty completion
export async function recordSuccess(
  wallet: string, 
  bountyId: string,
  earnings: number,
  completionTimeMs: number
): Promise<string[]> {
  const db = getDb();
  const now = new Date().toISOString();
  
  // Ensure profile exists
  await createHunterProfile(wallet);
  
  // Update stats
  await db.execute({
    sql: `UPDATE reputation SET 
      successful_bounties = successful_bounties + 1,
      total_bounties = total_bounties + 1,
      total_earnings = total_earnings + ?,
      current_streak = current_streak + 1,
      best_streak = MAX(best_streak, current_streak + 1),
      updated_at = ?
    WHERE wallet = ?`,
    args: [earnings, now, wallet],
  });
  
  // Check for new badges
  const newBadges = await checkAndAwardBadges(wallet, bountyId, earnings, completionTimeMs);
  
  return newBadges;
}

// Record failed bounty
export async function recordFailure(wallet: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  
  // Ensure profile exists
  await createHunterProfile(wallet);
  
  await db.execute({
    sql: `UPDATE reputation SET 
      failed_bounties = failed_bounties + 1,
      total_bounties = total_bounties + 1,
      current_streak = 0,
      updated_at = ?
    WHERE wallet = ?`,
    args: [now, wallet],
  });
}

// Check and award badges
async function checkAndAwardBadges(
  wallet: string,
  bountyId: string,
  earnings: number,
  completionTimeMs: number
): Promise<string[]> {
  const db = getDb();
  const now = new Date().toISOString();
  const newBadges: string[] = [];
  
  // Get current stats
  const rep = await getHunterReputation(wallet);
  if (!rep) return [];
  
  // First Blood
  if (rep.successfulBounties === 1 && !rep.badges.includes('first_blood')) {
    await awardBadge(wallet, 'first_blood', bountyId);
    newBadges.push('first_blood');
  }
  
  // Speed Demon (under 1 hour)
  if (completionTimeMs < 3600000 && !rep.badges.includes('speed_demon')) {
    await awardBadge(wallet, 'speed_demon', bountyId);
    newBadges.push('speed_demon');
  }
  
  // Whale Hunter (10+ SOL bounty)
  if (earnings >= 10 && !rep.badges.includes('whale_hunter')) {
    await awardBadge(wallet, 'whale_hunter', bountyId);
    newBadges.push('whale_hunter');
  }
  
  // Streak badges
  const streakResult = await db.execute({
    sql: 'SELECT current_streak FROM reputation WHERE wallet = ?',
    args: [wallet],
  });
  const currentStreak = Number(streakResult.rows[0]?.current_streak || 0);
  
  if (currentStreak >= 5 && !rep.badges.includes('streak_5')) {
    await awardBadge(wallet, 'streak_5', bountyId);
    newBadges.push('streak_5');
  }
  
  if (currentStreak >= 10 && !rep.badges.includes('streak_10')) {
    await awardBadge(wallet, 'streak_10', bountyId);
    newBadges.push('streak_10');
  }
  
  return newBadges;
}

// Award a badge
async function awardBadge(wallet: string, badgeType: string, bountyId: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `badge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  await db.execute({
    sql: `INSERT INTO badges (id, wallet, badge_type, earned_at, bounty_id) VALUES (?, ?, ?, ?, ?)`,
    args: [id, wallet, badgeType, now, bountyId],
  });
}

// Calculate rank based on stats
function calculateRank(totalBounties: number, successRate: number): HunterReputation['rank'] {
  if (totalBounties >= RANK_THRESHOLDS.legend.minBounties && successRate >= RANK_THRESHOLDS.legend.minSuccessRate) {
    return 'legend';
  }
  if (totalBounties >= RANK_THRESHOLDS.elite.minBounties && successRate >= RANK_THRESHOLDS.elite.minSuccessRate) {
    return 'elite';
  }
  if (totalBounties >= RANK_THRESHOLDS.expert.minBounties && successRate >= RANK_THRESHOLDS.expert.minSuccessRate) {
    return 'expert';
  }
  if (totalBounties >= RANK_THRESHOLDS.hunter.minBounties && successRate >= RANK_THRESHOLDS.hunter.minSuccessRate) {
    return 'hunter';
  }
  return 'novice';
}

// Get leaderboard
export async function getReputationLeaderboard(limit: number = 20): Promise<HunterReputation[]> {
  const db = getDb();
  
  const result = await db.execute({
    sql: `SELECT * FROM reputation 
      WHERE total_bounties > 0 
      ORDER BY successful_bounties DESC, total_earnings DESC 
      LIMIT ?`,
    args: [limit],
  });
  
  const leaderboard: HunterReputation[] = [];
  
  for (const row of result.rows) {
    const wallet = String(row.wallet);
    const rep = await getHunterReputation(wallet);
    if (rep) leaderboard.push(rep);
  }
  
  return leaderboard;
}

// Export badge definitions for frontend
export function getBadgeDefinitions() {
  return BADGES;
}
