import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getBounty } from '@/lib/repositories/bounties';
import { processDeposit } from '@/lib/escrow';
import { getDb } from '@/lib/db';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

interface DepositRequest {
  tx_signature: string;
  poster_wallet: string;
}

/**
 * Verify and process a bounty deposit
 * Called after user sends funds to escrow wallet
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureDb();
  const { id } = params;
  
  try {
    const body: DepositRequest = await request.json();
    
    if (!body.tx_signature || !body.poster_wallet) {
      return NextResponse.json(
        { error: 'tx_signature and poster_wallet are required' },
        { status: 400 }
      );
    }
    
    // Get bounty
    const bounty = await getBounty(id);
    if (!bounty) {
      return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
    }
    
    // Verify poster matches
    if (bounty.poster_wallet !== body.poster_wallet) {
      return NextResponse.json(
        { error: 'Wallet does not match bounty poster' },
        { status: 403 }
      );
    }
    
    // Process the deposit
    const result = await processDeposit(
      id,
      bounty.reward,
      body.poster_wallet,
      body.tx_signature
    );
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Deposit processing failed' },
        { status: 400 }
      );
    }
    
    // Update bounty with escrow tx
    const db = getDb();
    await db.execute({
      sql: 'UPDATE bounties SET escrow_tx = ? WHERE id = ?',
      args: [body.tx_signature, id],
    });
    
    return NextResponse.json({
      success: true,
      bounty_id: id,
      escrow_tx: result.escrowTx,
      net_amount: result.netAmount,
      fee_amount: result.feeAmount,
      message: 'Deposit verified and bounty is now active',
    });
    
  } catch (error) {
    console.error('Deposit error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
