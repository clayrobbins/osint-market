import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getBounty } from '@/lib/repositories/bounties';
import { getDepositInstructions, FEE_STRUCTURE } from '@/lib/escrow';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

/**
 * Get deposit instructions for a bounty
 */
export async function GET(request: NextRequest) {
  await ensureDb();
  
  const bountyId = request.nextUrl.searchParams.get('bounty_id');
  const amount = parseFloat(request.nextUrl.searchParams.get('amount') || '0');
  const token = (request.nextUrl.searchParams.get('token') || 'SOL') as 'SOL' | 'USDC';
  
  // If bounty_id provided, get amount from bounty
  if (bountyId) {
    const bounty = await getBounty(bountyId);
    if (!bounty) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }
    
    const instructions = getDepositInstructions(bounty.reward.amount, bounty.reward.token as 'SOL' | 'USDC');
    
    return NextResponse.json({
      bounty_id: bountyId,
      ...instructions,
      fee_percent: FEE_STRUCTURE.creation,
      after_deposit: 'POST /api/bounties/{bounty_id}/deposit with tx_signature to verify',
    });
  }
  
  // Otherwise use provided amount
  if (!amount || amount < FEE_STRUCTURE.minimumSol) {
    return NextResponse.json(
      { error: `Amount must be at least ${FEE_STRUCTURE.minimumSol} SOL` },
      { status: 400 }
    );
  }
  
  const instructions = getDepositInstructions(amount, token);
  
  return NextResponse.json({
    ...instructions,
    fee_percent: FEE_STRUCTURE.creation,
    note: 'Create bounty first via POST /api/bounties, then use bounty_id for deposit',
  });
}
