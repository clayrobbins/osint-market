import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { listBounties, createBounty } from '@/lib/repositories/bounties';
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
    const body: CreateBountyRequest = await request.json();
    
    // Validate minimum bounty (0.1 SOL)
    if (body.reward.token === 'SOL' && body.reward.amount < 0.1) {
      return NextResponse.json(
        { error: 'Minimum bounty is 0.1 SOL' },
        { status: 400 }
      );
    }
    
    // TODO: Verify wallet signature
    // TODO: Process escrow deposit via mcpay
    // TODO: Deduct 2.5% fee
    
    const poster_wallet = request.headers.get('x-wallet-address') || 'anonymous';
    
    const bounty = await createBounty({
      ...body,
      poster_wallet,
      // escrow_tx will be set after payment confirmation
    });

    return NextResponse.json({ 
      created: true, 
      bounty_id: bounty.id,
      bounty,
      escrow_status: 'pending',
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating bounty:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
