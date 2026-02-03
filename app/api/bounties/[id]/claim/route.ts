import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getBounty, claimBounty, getClaimedBountyByAgent } from '@/lib/repositories/bounties';
import { authenticate, isValidSolanaAddress } from '@/lib/auth';
import type { ClaimRequest, ClaimResponse } from '@/lib/types';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

// Always require auth (can be disabled with SKIP_AUTH=true for testing)
const REQUIRE_AUTH = process.env.SKIP_AUTH !== 'true';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureDb();
  const { id } = params;
  
  try {
    const body: ClaimRequest & { message?: string } = await request.json();
    
    // Validate wallet address
    if (!isValidSolanaAddress(body.agent_wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    
    // Verify wallet signature (required in production)
    if (REQUIRE_AUTH) {
      if (!body.message || !body.signature) {
        return NextResponse.json({ 
          error: 'Authentication required. Include message and signature.' 
        }, { status: 401 });
      }
      
      const authResult = authenticate(body.agent_wallet, body.message, body.signature);
      if (!authResult.authenticated) {
        return NextResponse.json({ 
          error: authResult.error || 'Authentication failed' 
        }, { status: 401 });
      }
    }
    
    // Verify bounty exists and is open
    const bounty = await getBounty(id);
    if (!bounty) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }
    if (bounty.status !== 'open') {
      return NextResponse.json({ error: 'Bounty is not available for claiming' }, { status: 400 });
    }
    
    // Check if agent already has a claimed bounty
    const existingClaim = await getClaimedBountyByAgent(body.agent_wallet);
    if (existingClaim) {
      return NextResponse.json({ 
        error: 'You already have a claimed bounty. Complete or forfeit it first.',
        claimed_bounty_id: existingClaim.id,
      }, { status: 400 });
    }
    
    // Set claim expiry (48 hours)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    
    const success = await claimBounty(id, body.agent_wallet, expiresAt);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to claim bounty' }, { status: 500 });
    }
    
    const response: ClaimResponse = {
      claimed: true,
      bounty_id: id,
      expires_at: expiresAt,
      message: 'Bounty claimed successfully. You have 48 hours to submit your findings.',
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error claiming bounty:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
