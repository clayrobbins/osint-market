import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDb } from '@/lib/db';
import { getBounty, disputeBounty } from '@/lib/repositories/bounties';
import { createDispute, getDisputeByBounty } from '@/lib/repositories/disputes';
import { getSubmissionByBounty } from '@/lib/repositories/submissions';
import { checkRateLimit, getIdentifier, rateLimitHeaders } from '@/lib/rate-limit';
import { alerts } from '@/lib/alerts';
import { sanitizeInput } from '@/lib/sanitize';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

interface DisputeRequest {
  reason: string;
  evidence?: string[];
  agent_wallet?: string;
}

/**
 * POST /api/bounties/[id]/dispute - File a dispute against a resolution
 * 
 * Only the hunter who submitted the answer can dispute.
 * Can only dispute bounties that have been resolved (rejected).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDb();
  const { id: bountyId } = await params;
  
  // Rate limit check
  const identifier = getIdentifier(request);
  const rateLimit = checkRateLimit(identifier, 'bounty-dispute');
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many dispute requests. Please wait before trying again.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }
  
  try {
    const body: DisputeRequest = await request.json();
    
    // Validate required fields
    if (!body.reason || body.reason.trim().length < 20) {
      return NextResponse.json(
        { error: 'Dispute reason must be at least 20 characters explaining why you believe the resolution was incorrect.' },
        { status: 400 }
      );
    }
    
    // Get wallet from header or body
    const agent_wallet = request.headers.get('x-wallet-address') || body.agent_wallet;
    if (!agent_wallet) {
      return NextResponse.json(
        { error: 'Missing x-wallet-address header or agent_wallet in body' },
        { status: 400 }
      );
    }
    
    // Get the bounty
    const bounty = await getBounty(bountyId);
    if (!bounty) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }
    
    // Can only dispute resolved bounties
    if (bounty.status !== 'resolved') {
      return NextResponse.json(
        { error: `Cannot dispute a bounty with status '${bounty.status}'. Only resolved bounties can be disputed.` },
        { status: 400 }
      );
    }
    
    // Get the submission to verify this wallet submitted it
    const submission = await getSubmissionByBounty(bountyId);
    if (!submission) {
      return NextResponse.json(
        { error: 'No submission found for this bounty' },
        { status: 400 }
      );
    }
    
    // Only the hunter who submitted can dispute
    if (submission.agent_wallet !== agent_wallet) {
      return NextResponse.json(
        { error: 'Only the hunter who submitted the answer can file a dispute.' },
        { status: 403 }
      );
    }
    
    // Check if already disputed
    const existingDispute = await getDisputeByBounty(bountyId);
    if (existingDispute) {
      return NextResponse.json(
        { error: 'This bounty already has an active dispute.', dispute: existingDispute },
        { status: 409 }
      );
    }
    
    // Sanitize input
    const sanitizedReason = sanitizeInput(body.reason.slice(0, 2000));
    const sanitizedEvidence = body.evidence?.map(e => sanitizeInput(e.slice(0, 500))) || [];
    
    // Create the dispute
    const dispute = await createDispute({
      bounty_id: bountyId,
      agent_wallet,
      reason: sanitizedReason,
      evidence: sanitizedEvidence,
    });
    
    // Update bounty status to disputed
    await disputeBounty(bountyId, sanitizedReason);
    
    // Send admin alert
    await alerts.disputeOpened(bountyId, agent_wallet, sanitizedReason.slice(0, 200));
    
    return NextResponse.json({
      success: true,
      dispute_id: dispute.id,
      message: 'Dispute filed successfully. An admin will review your case within 48 hours.',
      dispute,
    }, { status: 201, headers: rateLimitHeaders(rateLimit) });
    
  } catch (error) {
    console.error('Error filing dispute:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

/**
 * GET /api/bounties/[id]/dispute - Get dispute status for a bounty
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDb();
  const { id: bountyId } = await params;
  
  const dispute = await getDisputeByBounty(bountyId);
  
  if (!dispute) {
    return NextResponse.json({ error: 'No dispute found for this bounty' }, { status: 404 });
  }
  
  return NextResponse.json({ dispute });
}
