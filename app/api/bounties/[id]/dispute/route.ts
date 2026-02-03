import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getBounty, updateBountyStatus } from '@/lib/repositories/bounties';
import { getSubmissionByBounty } from '@/lib/repositories/submissions';
import { createDispute } from '@/lib/repositories/disputes';
import { authenticate, isValidSolanaAddress } from '@/lib/auth';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

interface DisputeRequest {
  agent_wallet: string;
  reason: string;
  evidence?: string[];
  message?: string;
  signature?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureDb();
  const { id } = params;
  
  try {
    const body: DisputeRequest = await request.json();
    
    // Validate wallet
    if (!isValidSolanaAddress(body.agent_wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
    
    // Validate reason
    if (!body.reason || body.reason.length < 20) {
      return NextResponse.json({ 
        error: 'Dispute reason must be at least 20 characters' 
      }, { status: 400 });
    }
    
    // Get bounty
    const bounty = await getBounty(id);
    if (!bounty) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }
    
    // Only resolved bounties can be disputed
    if (bounty.status !== 'resolved') {
      return NextResponse.json({ 
        error: 'Only resolved bounties can be disputed' 
      }, { status: 400 });
    }
    
    // Only the submitter can dispute
    const submission = await getSubmissionByBounty(id);
    if (!submission || submission.agent_wallet !== body.agent_wallet) {
      return NextResponse.json({ 
        error: 'Only the original submitter can file a dispute' 
      }, { status: 403 });
    }
    
    // Verify signature if provided
    if (body.message && body.signature) {
      const authResult = authenticate(body.agent_wallet, body.message, body.signature);
      if (!authResult.authenticated) {
        return NextResponse.json({ error: authResult.error }, { status: 401 });
      }
    }
    
    // Create dispute record
    const dispute = await createDispute({
      bounty_id: id,
      agent_wallet: body.agent_wallet,
      reason: body.reason,
      evidence: body.evidence || [],
    });
    
    // Update bounty status to disputed
    await updateBountyStatus(id, 'disputed');
    
    return NextResponse.json({
      disputed: true,
      dispute_id: dispute.id,
      bounty_id: id,
      message: 'Dispute filed successfully. An admin will review within 48 hours.',
    });
    
  } catch (error) {
    console.error('Error filing dispute:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
