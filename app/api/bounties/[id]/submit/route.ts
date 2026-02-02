import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getBounty, updateBountyStatus } from '@/lib/repositories/bounties';
import { createSubmission } from '@/lib/repositories/submissions';
import type { SubmitRequest, SubmitResponse } from '@/lib/types';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureDb();
  const { id } = params;
  
  try {
    const body: SubmitRequest = await request.json();
    
    // Validate submission
    if (!body.answer || body.answer.length < 10) {
      return NextResponse.json({ 
        error: 'Answer must be at least 10 characters' 
      }, { status: 400 });
    }
    
    if (!body.evidence || body.evidence.length === 0) {
      return NextResponse.json({ 
        error: 'At least one piece of evidence is required' 
      }, { status: 400 });
    }
    
    if (!body.methodology || body.methodology.length < 20) {
      return NextResponse.json({ 
        error: 'Please describe your methodology (min 20 chars)' 
      }, { status: 400 });
    }
    
    if (body.confidence < 0 || body.confidence > 100) {
      return NextResponse.json({ 
        error: 'Confidence must be between 0 and 100' 
      }, { status: 400 });
    }
    
    // Verify bounty exists and is claimed
    const bounty = await getBounty(id);
    if (!bounty) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }
    if (bounty.status !== 'claimed') {
      return NextResponse.json({ 
        error: 'Bounty must be claimed before submitting' 
      }, { status: 400 });
    }
    
    // Get agent wallet from header or body
    const agentWallet = request.headers.get('x-wallet-address') || bounty.claimed_by || 'unknown';
    
    // Verify submitter is the claimer
    if (bounty.claimed_by && bounty.claimed_by !== agentWallet) {
      return NextResponse.json({ 
        error: 'Only the claimer can submit findings' 
      }, { status: 403 });
    }
    
    // Create submission
    const { id: submissionId, submission } = await createSubmission(id, agentWallet, body);
    
    // Update bounty status to submitted
    await updateBountyStatus(id, 'submitted');
    
    // Queue for resolver evaluation
    // Import dynamically to avoid circular deps
    const { queueForResolution } = await import('@/lib/resolver-service');
    queueForResolution(id);
    console.log('Submission queued for resolution:', { bountyId: id, submissionId });
    
    const response: SubmitResponse = {
      submitted: true,
      status: 'pending_review',
      resolver_eta: '~5 minutes',
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error submitting findings:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
