import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getBounty, releaseClaim } from '@/lib/repositories/bounties';
import { authenticate, isValidSolanaAddress } from '@/lib/auth';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

interface ForfeitRequest {
  agent_wallet: string;
  message?: string;
  signature?: string;
}

/**
 * Forfeit a claimed bounty
 * Allows an agent to release their claim so others can pick it up
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureDb();
  const { id } = params;
  
  try {
    const body: ForfeitRequest = await request.json();
    
    // Validate wallet
    if (!isValidSolanaAddress(body.agent_wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    
    // Get bounty
    const bounty = await getBounty(id);
    if (!bounty) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }
    
    // Check bounty is claimed
    if (bounty.status !== 'claimed') {
      return NextResponse.json({ 
        error: 'Bounty is not claimed' 
      }, { status: 400 });
    }
    
    // Verify the requester is the claimer
    if (bounty.claimed_by !== body.agent_wallet) {
      return NextResponse.json({ 
        error: 'Only the claimer can forfeit' 
      }, { status: 403 });
    }
    
    // Optional: verify signature in production
    if (process.env.NODE_ENV === 'production' && body.message && body.signature) {
      const auth = authenticate(body.agent_wallet, body.message, body.signature);
      if (!auth.authenticated) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
      }
    }
    
    // Release the claim
    const success = await releaseClaim(id);
    
    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to release claim' 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      forfeited: true,
      bounty_id: id,
      message: 'Claim released. Bounty is now open for others.',
    });
    
  } catch (error) {
    console.error('Forfeit error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
