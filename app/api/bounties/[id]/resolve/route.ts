import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getBounty, updateBountyStatus } from '@/lib/repositories/bounties';
import { getSubmissionByBounty } from '@/lib/repositories/submissions';
import { createResolution, getResolutionByBounty } from '@/lib/repositories/resolutions';
import { createTransaction } from '@/lib/repositories/transactions';
import { processPayout, processRefund } from '@/lib/escrow';
import type { Resolution, ResolutionResponse } from '@/lib/types';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

// This endpoint is called by the resolver service
const RESOLVER_SECRET = process.env.RESOLVER_SECRET || 'dev-resolver-secret';

interface ResolveRequest {
  status: 'approved' | 'rejected';
  reasoning: string;
  resolver_secret: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureDb();
  const { id } = params;
  
  try {
    const body: ResolveRequest = await request.json();
    
    // Authenticate resolver
    if (body.resolver_secret !== RESOLVER_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get bounty
    const bounty = await getBounty(id);
    if (!bounty) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }
    
    // Check bounty is in submitted status
    if (bounty.status !== 'submitted') {
      return NextResponse.json({ 
        error: 'Bounty must be in submitted status to resolve' 
      }, { status: 400 });
    }
    
    // Check if already resolved
    const existingResolution = await getResolutionByBounty(id);
    if (existingResolution) {
      return NextResponse.json({ 
        error: 'Bounty already resolved',
        resolution: existingResolution,
      }, { status: 400 });
    }
    
    // Get submission
    const submission = await getSubmissionByBounty(id);
    if (!submission) {
      return NextResponse.json({ error: 'No submission found' }, { status: 400 });
    }
    
    let paymentTx: string | undefined;
    
    if (body.status === 'approved') {
      // Execute actual on-chain payout
      const payoutResult = await processPayout(bounty, submission.agent_wallet);
      
      if (!payoutResult.success) {
        console.error('Payout failed:', payoutResult.error);
        return NextResponse.json({ 
          error: 'Payment execution failed',
          details: payoutResult.error,
        }, { status: 500 });
      }
      
      paymentTx = payoutResult.payoutTx;
      console.log(`Payment confirmed: ${payoutResult.netAmount} ${bounty.reward.token} to ${submission.agent_wallet}`);
      console.log(`Fee: ${payoutResult.feeAmount} ${bounty.reward.token} | Tx: ${paymentTx}`);
    } else {
      // Rejected - refund escrow to poster
      const refundResult = await processRefund(bounty);
      
      if (!refundResult.success) {
        console.error('Refund failed:', refundResult.error);
        // Still resolve the bounty, but note the refund issue
        paymentTx = `refund_failed_${Date.now()}`;
      } else {
        paymentTx = refundResult.payoutTx;
        console.log(`Refund sent: ${refundResult.netAmount} ${bounty.reward.token} to ${bounty.poster_wallet}`);
      }
    }
    
    // Create resolution record
    const resolution = await createResolution(id, submission.id, {
      status: body.status,
      reasoning: body.reasoning,
      resolver_id: 'resolver-opus-v1',
      payment_tx: paymentTx,
    });
    
    // Update bounty status
    await updateBountyStatus(id, 'resolved');
    
    const response: ResolutionResponse = {
      bounty_id: id,
      status: resolution.status,
      reasoning: resolution.reasoning,
      payment_tx: resolution.payment_tx,
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error resolving bounty:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
