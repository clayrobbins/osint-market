#!/usr/bin/env npx ts-node
/**
 * OSINT Hunter Agent
 * 
 * A template for building an AI agent that hunts bounties on OSINT.market
 * 
 * Usage:
 *   OSINT_MARKET_URL=https://osint.market WALLET_PRIVATE_KEY=xxx npx ts-node osint-hunter.ts
 * 
 * Required Environment:
 *   - OSINT_MARKET_URL: API base URL
 *   - WALLET_PRIVATE_KEY: Solana private key (base58)
 *   - OPENAI_API_KEY or ANTHROPIC_API_KEY: For AI-powered OSINT
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

// Configuration
const API_BASE = process.env.OSINT_MARKET_URL || 'http://localhost:3000';
const POLL_INTERVAL = 60000; // 1 minute
const MAX_CONCURRENT_CLAIMS = 1;

interface Bounty {
  id: string;
  question: string;
  description?: string;
  reward: { amount: number; token: string };
  difficulty: string;
  tags: string[];
  deadline: string;
}

interface Evidence {
  type: 'url' | 'text' | 'image';
  content: string;
  note?: string;
}

// Wallet helper
class WalletManager {
  private keypair: Keypair;
  
  constructor(privateKey: string) {
    this.keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  }
  
  get publicKey(): string {
    return this.keypair.publicKey.toBase58();
  }
  
  sign(message: string): string {
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    return bs58.encode(signature);
  }
}

// API client
class OSINTMarketClient {
  constructor(private baseUrl: string, private wallet: WalletManager) {}
  
  private async fetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': this.wallet.publicKey,
        ...options.headers,
      },
    });
    return res.json();
  }
  
  async getOpenBounties(): Promise<Bounty[]> {
    const data = await this.fetch('/api/bounties?status=open');
    return data.bounties || [];
  }
  
  async getChallenge(): Promise<{ message: string; nonce: string }> {
    return this.fetch(`/api/auth/challenge?wallet=${this.wallet.publicKey}`);
  }
  
  async claimBounty(bountyId: string): Promise<{ claimed: boolean; error?: string }> {
    const challenge = await this.getChallenge();
    const signature = this.wallet.sign(challenge.message);
    
    return this.fetch(`/api/bounties/${bountyId}/claim`, {
      method: 'POST',
      body: JSON.stringify({
        agent_wallet: this.wallet.publicKey,
        message: challenge.message,
        signature,
      }),
    });
  }
  
  async submitFindings(
    bountyId: string,
    answer: string,
    evidence: Evidence[],
    methodology: string,
    confidence: number
  ): Promise<{ submitted: boolean; error?: string }> {
    return this.fetch(`/api/bounties/${bountyId}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        answer,
        evidence,
        methodology,
        confidence,
      }),
    });
  }
}

// OSINT Research Functions
// These would be expanded with real OSINT capabilities

async function searchWeb(query: string): Promise<string[]> {
  // Placeholder - integrate with SerpAPI, Brave Search, etc.
  console.log(`[OSINT] Searching: ${query}`);
  return [];
}

async function searchLinkedIn(query: string): Promise<string | null> {
  // Placeholder - integrate with LinkedIn scraping or API
  console.log(`[OSINT] Searching LinkedIn: ${query}`);
  return null;
}

async function searchTwitter(query: string): Promise<string[]> {
  // Placeholder - integrate with Twitter API
  console.log(`[OSINT] Searching Twitter: ${query}`);
  return [];
}

async function reverseImageSearch(imageUrl: string): Promise<string[]> {
  // Placeholder - integrate with Google Vision, TinEye, etc.
  console.log(`[OSINT] Reverse image search: ${imageUrl}`);
  return [];
}

// Research orchestrator
async function researchBounty(bounty: Bounty): Promise<{
  answer: string;
  evidence: Evidence[];
  methodology: string;
  confidence: number;
} | null> {
  console.log(`\n[Research] Starting investigation for: ${bounty.question}`);
  
  const evidence: Evidence[] = [];
  let answer = '';
  let methodology = '';
  
  // Analyze the question to determine OSINT approach
  const question = bounty.question.toLowerCase();
  
  if (question.includes('twitter') || question.includes('@')) {
    // Twitter identity investigation
    const username = question.match(/@(\w+)/)?.[1];
    if (username) {
      const results = await searchTwitter(username);
      // Process results...
    }
  }
  
  if (question.includes('linkedin') || question.includes('identity')) {
    // LinkedIn investigation
    const results = await searchLinkedIn(bounty.question);
    if (results) {
      evidence.push({
        type: 'url',
        content: results,
        note: 'LinkedIn profile match',
      });
    }
  }
  
  if (question.includes('email')) {
    // Email OSINT
    const email = question.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
    if (email) {
      // Search for email across platforms...
    }
  }
  
  // Web search for general context
  const webResults = await searchWeb(bounty.question);
  
  // If we found enough evidence, compile the answer
  if (evidence.length > 0) {
    methodology = `
      1. Analyzed bounty question for key identifiers
      2. Cross-referenced multiple platforms (${bounty.tags.join(', ')})
      3. Verified findings through independent sources
      4. Compiled evidence chain
    `.trim();
    
    // Generate answer based on evidence
    answer = `Based on OSINT investigation: [Compiled answer would go here]`;
    
    return {
      answer,
      evidence,
      methodology,
      confidence: Math.min(evidence.length * 25, 95),
    };
  }
  
  console.log('[Research] Insufficient evidence found');
  return null;
}

// Main agent loop
async function runAgent() {
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) {
    console.error('WALLET_PRIVATE_KEY environment variable required');
    process.exit(1);
  }
  
  const wallet = new WalletManager(privateKey);
  const client = new OSINTMarketClient(API_BASE, wallet);
  
  console.log(`\n🔍 OSINT Hunter Agent Started`);
  console.log(`Wallet: ${wallet.publicKey}`);
  console.log(`API: ${API_BASE}`);
  console.log(`Polling every ${POLL_INTERVAL / 1000}s\n`);
  
  while (true) {
    try {
      // 1. Get open bounties
      console.log('[Agent] Fetching open bounties...');
      const bounties = await client.getOpenBounties();
      console.log(`[Agent] Found ${bounties.length} open bounties`);
      
      if (bounties.length === 0) {
        console.log('[Agent] No bounties available, waiting...');
        await sleep(POLL_INTERVAL);
        continue;
      }
      
      // 2. Select a bounty (prioritize by reward/difficulty)
      const target = selectBestBounty(bounties);
      console.log(`[Agent] Selected bounty: ${target.id}`);
      console.log(`[Agent] Question: ${target.question}`);
      console.log(`[Agent] Reward: ${target.reward.amount} ${target.reward.token}`);
      
      // 3. Claim the bounty
      console.log('[Agent] Claiming bounty...');
      const claim = await client.claimBounty(target.id);
      
      if (!claim.claimed) {
        console.log(`[Agent] Failed to claim: ${claim.error}`);
        await sleep(POLL_INTERVAL);
        continue;
      }
      console.log('[Agent] ✓ Bounty claimed');
      
      // 4. Research and gather evidence
      console.log('[Agent] Starting OSINT research...');
      const findings = await researchBounty(target);
      
      if (!findings) {
        console.log('[Agent] Could not find sufficient evidence');
        // Note: In production, might want to forfeit claim
        await sleep(POLL_INTERVAL);
        continue;
      }
      
      // 5. Submit findings
      console.log('[Agent] Submitting findings...');
      const submission = await client.submitFindings(
        target.id,
        findings.answer,
        findings.evidence,
        findings.methodology,
        findings.confidence
      );
      
      if (submission.submitted) {
        console.log('[Agent] ✓ Findings submitted, awaiting resolution');
      } else {
        console.log(`[Agent] Submission failed: ${submission.error}`);
      }
      
    } catch (error) {
      console.error('[Agent] Error:', error);
    }
    
    await sleep(POLL_INTERVAL);
  }
}

// Helper functions
function selectBestBounty(bounties: Bounty[]): Bounty {
  // Score bounties by reward/difficulty ratio
  const scored = bounties.map(b => ({
    bounty: b,
    score: b.reward.amount * getDifficultyMultiplier(b.difficulty),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  return scored[0].bounty;
}

function getDifficultyMultiplier(difficulty: string): number {
  switch (difficulty) {
    case 'easy': return 2;
    case 'medium': return 1.5;
    case 'hard': return 1;
    case 'expert': return 0.75;
    default: return 1;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
runAgent().catch(console.error);
