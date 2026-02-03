import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDb } from '@/lib/db';
import { listBounties, createBounty } from '@/lib/repositories/bounties';
import { processDeposit, FEE_STRUCTURE } from '@/lib/escrow';
import type { BountyStatus, CreateBountyRequest, BountyListResponse } from '@/lib/types';

// Ensure DB is initialized
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  await ensureDb();
  
  const searchParams = request.nextUrl.searchParams;
  const status = (searchParams.get('status') || 'open') as BountyStatus | 'all';
  const page = parseInt(searchParams.get('page') || '1');
  const per_page = parseInt(searchParams.get('per_page') || '20');
  
  const { bounties, total } = await listBounties({
    status,
    limit: per_page,
    offset: (page - 1) * per_page,
  });

  const response: BountyListResponse = {
    bounties,
    total,
    page,
    per_page,
  };

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  await ensureDb();
  
  try {
    const body: CreateBountyRequest & { escrow_tx?: string } = await request.json();
    
    // Validate minimum bounty (0.1 SOL)
    if (body.reward.token === 'SOL' && body.reward.amount < FEE_STRUCTURE.minimumSol) {
      return NextResponse.json(
        { error: `Minimum bounty is ${FEE_STRUCTURE.minimumSol} SOL` },
        { status: 400 }
      );
    }
    
    const poster_wallet = request.headers.get('x-wallet-address');
    
    if (!poster_wallet) {
      return NextResponse.json(
        { error: 'Missing x-wallet-address header' },
        { status: 400 }
      );
    }
    
    // Create bounty first (to get ID)
    const bounty = await createBounty({
      ...body,
      poster_wallet,
    });
    
    // If escrow_tx provided, verify the deposit
    if (body.escrow_tx) {
      const depositResult = await processDeposit(
        bounty.id,
        body.reward,
        poster_wallet,
        body.escrow_tx
      );
      
      if (!depositResult.success) {
        // TODO: Delete the bounty or mark as failed
        return NextResponse.json({ 
          created: true, 
          bounty_id: bounty.id,
          bounty,
          escrow_status: 'failed',
          escrow_error: depositResult.error,
          deposit_instructions: {
            recipient: FEE_STRUCTURE.treasury,
            amount: body.reward.amount,
            token: body.reward.token,
            fee: `${FEE_STRUCTURE.creation}% creation fee`,
          },
        }, { status: 201 });
      }
      
      return NextResponse.json({ 
        created: true, 
        bounty_id: bounty.id,
        bounty,
        escrow_status: 'confirmed',
        escrow_tx: body.escrow_tx,
        net_amount: depositResult.netAmount,
        fee_amount: depositResult.feeAmount,
      }, { status: 201 });
    }
    
    // No escrow_tx - return deposit instructions
    return NextResponse.json({ 
      created: true, 
      bounty_id: bounty.id,
      bounty,
      escrow_status: 'pending',
      deposit_instructions: {
        recipient: FEE_STRUCTURE.treasury,
        amount: body.reward.amount,
        token: body.reward.token,
        fee: `${FEE_STRUCTURE.creation}% creation fee (${body.reward.amount * FEE_STRUCTURE.creation / 100} ${body.reward.token})`,
        note: 'Send deposit to recipient address, then call PUT /api/bounties/{id}/confirm with the transaction signature',
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating bounty:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
