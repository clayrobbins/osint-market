import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getBounty, updateBountyStatus } from '@/lib/repositories/bounties';
import { getSubmissionByBounty } from '@/lib/repositories/submissions';
import { createResolution, getResolutionByBounty } from '@/lib/repositories/resolutions';
import { createTransaction } from '@/lib/repositories/transactions';
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
const TREASURY_WALLET = '7G7co8fLDdddRNbFwPWH9gots93qB4EXPwBoshd3x2va';
const PAYOUT_FEE_PERCENT = 0.025; // 2.5%

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
      // Calculate payout and fee
      const grossAmount = bounty.reward.amount;
      const feeAmount = grossAmount * PAYOUT_FEE_PERCENT;
      const netAmount = grossAmount - feeAmount;
      
      // TODO: Actually execute payment via mcpay/Solana
      // For now, record the transaction
      const payoutTx = await createTransaction({
        type: 'escrow_release',
        bounty_id: id,
        amount: netAmount,
        token: bounty.reward.token,
        to_wallet: submission.agent_wallet,
        status: 'pending', // Will be confirmed after on-chain tx
      });
      
      // Record fee collection
      await createTransaction({
        type: 'fee_collection',
        bounty_id: id,
        amount: feeAmount,
        token: bounty.reward.token,
        to_wallet: TREASURY_WALLET,
        fee_amount: feeAmount,
        status: 'pending',
      });
      
      paymentTx = `pending_${payoutTx.id}`;
      console.log(`Payment pending: ${netAmount} ${bounty.reward.token} to ${submission.agent_wallet}`);
      console.log(`Fee: ${feeAmount} ${bounty.reward.token} to treasury`);
    } else {
      // Rejected - refund escrow to poster (minus creation fee already taken)
      await createTransaction({
        type: 'escrow_refund',
        bounty_id: id,
        amount: bounty.reward.amount,
        token: bounty.reward.token,
        to_wallet: bounty.poster_wallet,
        status: 'pending',
      });
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
