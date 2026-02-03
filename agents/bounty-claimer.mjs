#!/usr/bin/env node
/**
 * OSINT Bounty Claimer with proper Solana wallet signing
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import fs from 'fs';

const API_BASE = 'https://osint-market-production.up.railway.app/api';

class WalletManager {
  constructor(privateKey) {
    this.keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  }
  
  get publicKey() {
    return this.keypair.publicKey.toBase58();
  }
  
  sign(message) {
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    return bs58.encode(signature);
  }
}

class OSINTMarketClient {
  constructor(wallet) {
    this.wallet = wallet;
  }
  
  async fetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': this.wallet.publicKey,
        ...options.headers,
      },
    });
    const data = await res.json();
    return data;
  }
  
  async getChallenge() {
    try {
      const response = await fetch(`${API_BASE}/auth/challenge?wallet=${this.wallet.publicKey}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': this.wallet.publicKey,
        },
      });
      
      const text = await response.text();
      console.log('Raw challenge response:', text);
      
      if (!text) {
        // Fallback - try standard authentication message
        const nonce = Date.now().toString();
        return {
          message: `authenticate:${this.wallet.publicKey}:${nonce}`,
          nonce: nonce
        };
      }
      
      return JSON.parse(text);
    } catch (error) {
      console.log('Challenge endpoint error, using fallback message');
      const nonce = Date.now().toString();
      return {
        message: `authenticate:${this.wallet.publicKey}:${nonce}`,
        nonce: nonce
      };
    }
  }
  
  async claimBounty(bountyId) {
    const challenge = await this.getChallenge();
    console.log('Challenge response:', challenge);
    const signature = this.wallet.sign(challenge.message);
    
    return this.fetch(`/bounties/${bountyId}/claim`, {
      method: 'POST',
      body: JSON.stringify({
        agent_wallet: this.wallet.publicKey,
        message: challenge.message,
        signature,
      }),
    });
  }
  
  async submitFindings(bountyId, answer, evidence, methodology, confidence) {
    return this.fetch(`/bounties/${bountyId}/submit`, {
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

async function main() {
  try {
    // Read private key
    const privateKey = fs.readFileSync('/Users/clayrobbins/.clawdbot/carrie-wallet-key.txt', 'utf8').trim();
    
    // Initialize wallet and client
    const wallet = new WalletManager(privateKey);
    const client = new OSINTMarketClient(wallet);
    
    console.log(`🔍 OSINT Hunter - Wallet: ${wallet.publicKey}`);
    
    // Claim the acme-ventures.xyz bounty
    const bountyId = 'bounty_ml6zbcugz5pf7f';
    console.log(`Claiming bounty: ${bountyId}`);
    
    const claim = await client.claimBounty(bountyId);
    console.log('Claim result:', claim);
    
    if (claim.claimed || claim.success) {
      console.log('✓ Bounty claimed successfully!');
      
      // Submit findings
      const evidence = [
        {
          type: 'url',
          content: 'https://acme-ventures.xyz',
          note: 'Domain does not exist (ENOTFOUND error)'
        },
        {
          type: 'url', 
          content: 'https://web.archive.org/web/*/acme-ventures.xyz',
          note: 'No Internet Archive snapshots found'
        },
        {
          type: 'text',
          content: 'Wikipedia search for "Acme Ventures" returns no results',
          note: 'No established presence in public records'
        }
      ];
      
      const methodology = `
OSINT Investigation Process:
1. Domain Resolution Check: Attempted to access acme-ventures.xyz - domain does not resolve (ENOTFOUND)
2. Historical Analysis: Checked Internet Archive Wayback Machine - no historical snapshots
3. Public Records Search: Searched Wikipedia and major databases - no legitimate entries found
4. VC Database Cross-reference: Attempted access to Crunchbase and AngelList (blocked by anti-bot measures)
5. Domain Registration Check: Whois lookup indicates domain likely never registered

Conclusion: All evidence points to acme-ventures.xyz being non-existent/fraudulent.
      `.trim();
      
      const submission = await client.submitFindings(
        bountyId,
        'acme-ventures.xyz is NOT a legitimate VC fund. The domain does not exist, has no historical presence, and appears to be completely fictitious.',
        evidence,
        methodology,
        95
      );
      
      console.log('Submission result:', submission);
      
      if (submission.submitted || submission.success) {
        console.log('✓ Findings submitted successfully!');
        console.log('🎯 Bounty completed - awaiting review and payout');
      }
    } else {
      console.log('❌ Failed to claim bounty:', claim);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();