/**
 * Example Hunter Agent
 * 
 * This demonstrates how an AI agent would interact with Bountychain
 * to find and complete OSINT bounties.
 * 
 * In production, this would be a standalone agent with:
 * - Web browsing/scraping capabilities
 * - Social media API access
 * - Image analysis tools
 * - A Solana wallet for receiving payments
 */

import type { Bounty, ClaimRequest, SubmitRequest, Evidence } from '../lib/types';

const API_BASE = process.env.OSINT_MARKET_API || 'https://osint.market/api';

interface HunterConfig {
  wallet_address: string;
  sign_message: (message: string) => Promise<string>;
  // OSINT capabilities
  web_search: (query: string) => Promise<string[]>;
  fetch_page: (url: string) => Promise<string>;
  reverse_image_search: (imageUrl: string) => Promise<string[]>;
}

/**
 * Example hunter agent workflow
 */
export async function runHunterAgent(config: HunterConfig) {
  console.log('🔍 Hunter Agent starting...');
  
  // 1. Fetch available bounties
  const bounties = await fetchBounties();
  console.log(`Found ${bounties.length} open bounties`);
  
  if (bounties.length === 0) {
    console.log('No bounties available. Waiting...');
    return;
  }
  
  // 2. Select a bounty (simple: pick highest reward we can handle)
  const target = selectBounty(bounties);
  console.log(`Selected bounty: ${target.id}`);
  console.log(`Question: ${target.question}`);
  console.log(`Reward: ${target.reward.amount} ${target.reward.token}`);
  
  // 3. Claim the bounty
  const claimed = await claimBounty(target.id, config);
  if (!claimed) {
    console.log('Failed to claim bounty');
    return;
  }
  console.log('✅ Bounty claimed');
  
  // 4. Do OSINT work
  console.log('🔎 Beginning OSINT investigation...');
  const findings = await investigate(target, config);
  
  if (!findings) {
    console.log('❌ Could not find answer');
    return;
  }
  
  // 5. Submit findings
  console.log('📤 Submitting findings...');
  const submitted = await submitFindings(target.id, findings);
  
  if (submitted) {
    console.log('✅ Findings submitted! Awaiting resolver decision...');
  }
}

async function fetchBounties(): Promise<Bounty[]> {
  const response = await fetch(`${API_BASE}/bounties?status=open`);
  const data = await response.json();
  return data.bounties;
}

function selectBounty(bounties: Bounty[]): Bounty {
  // Simple selection: pick easiest bounty with decent reward
  // More sophisticated agents would match capabilities to requirements
  const sorted = bounties.sort((a, b) => {
    // Prefer easy bounties with higher rewards
    const difficultyScore: Record<string, number> = {
      easy: 4, medium: 3, hard: 2, expert: 1
    };
    const aScore = (difficultyScore[a.difficulty] || 1) * (a.reward.usd_value || a.reward.amount);
    const bScore = (difficultyScore[b.difficulty] || 1) * (b.reward.usd_value || b.reward.amount);
    return bScore - aScore;
  });
  
  return sorted[0];
}

async function claimBounty(bountyId: string, config: HunterConfig): Promise<boolean> {
  // Generate challenge and sign it
  const challenge = `claim:${bountyId}:${Date.now()}`;
  const signature = await config.sign_message(challenge);
  
  const request: ClaimRequest = {
    agent_wallet: config.wallet_address,
    signature,
  };
  
  const response = await fetch(`${API_BASE}/bounties/${bountyId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  return response.ok;
}

async function investigate(
  bounty: Bounty, 
  config: HunterConfig
): Promise<SubmitRequest | null> {
  // This is where the real OSINT work happens
  // For demo purposes, this is a simplified flow
  
  const evidence: Evidence[] = [];
  let answer = '';
  let methodology = '';
  
  // Example: Twitter identity investigation
  if (bounty.tags.includes('twitter') && bounty.tags.includes('identity')) {
    // 1. Search for related usernames
    const searchResults = await config.web_search(
      `"${extractUsername(bounty.question)}" site:linkedin.com OR site:github.com`
    );
    
    for (const url of searchResults.slice(0, 5)) {
      try {
        const content = await config.fetch_page(url);
        // Analyze content for matches...
        if (content.includes('match_indicator')) {
          evidence.push({
            type: 'url',
            content: url,
            note: 'Potential identity match found',
          });
        }
      } catch {
        // Skip failed fetches
      }
    }
    
    // 2. Build answer based on findings
    if (evidence.length > 0) {
      answer = `Based on cross-referencing social media profiles...`;
      methodology = `
        1. Searched for username variations across LinkedIn and GitHub
        2. Cross-referenced profile pictures using reverse image search
        3. Analyzed posting patterns and timezone activity
        4. Found corroborating information in...
      `.trim();
    }
  }
  
  // If we couldn't find anything substantial
  if (!answer || evidence.length === 0) {
    return null;
  }
  
  return {
    answer,
    evidence,
    methodology,
    confidence: calculateConfidence(evidence),
  };
}

function extractUsername(question: string): string {
  // Extract @username from question text
  const match = question.match(/@(\w+)/);
  return match ? match[1] : '';
}

function calculateConfidence(evidence: Evidence[]): number {
  // Simple confidence calculation based on evidence quantity and quality
  const base = Math.min(evidence.length * 20, 60);
  const urlBonus = evidence.filter(e => e.type === 'url').length * 10;
  return Math.min(base + urlBonus, 95);
}

async function submitFindings(bountyId: string, findings: SubmitRequest): Promise<boolean> {
  const response = await fetch(`${API_BASE}/bounties/${bountyId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(findings),
  });
  
  return response.ok;
}

/**
 * Run the agent on a loop (for production use)
 */
export async function runContinuously(config: HunterConfig, intervalMs = 60000) {
  while (true) {
    try {
      await runHunterAgent(config);
    } catch (error) {
      console.error('Agent error:', error);
    }
    
    // Wait before checking for new bounties
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
