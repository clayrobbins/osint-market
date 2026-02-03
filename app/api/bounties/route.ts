import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDb } from '@/lib/db';
import { listBounties, createBounty } from '@/lib/repositories/bounties';
import { processDeposit, FEE_STRUCTURE, ESCROW_WALLET } from '@/lib/escrow';
import type { BountyStatus, CreateBountyRequest, BountyListResponse } from '@/lib/types';

// Supported tokens
const SUPPORTED_TOKENS = ['SOL', 'USDC'];

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
  const difficulty = searchParams.get('difficulty') as 'easy' | 'medium' | 'hard' | 'expert' | null;
  const tags = searchParams.get('tags')?.split(',').map(t => t.trim()).filter(Boolean) || null;
  const page = parseInt(searchParams.get('page') || '1');
  const per_page = parseInt(searchParams.get('per_page') || '20');
  
  const { bounties, total } = await listBounties({
    status,
    difficulty: difficulty || undefined,
    tags: tags || undefined,
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
    const body: CreateBountyRequest & { escrow_tx?: string; poster_wallet?: string } = await request.json();
    
    // Validate required fields
    if (!body.question || body.question.trim().length < 10) {
      return NextResponse.json(
        { error: 'Question is required and must be at least 10 characters' },
        { status: 400 }
      );
    }
    
    if (!body.reward || !body.reward.amount || !body.reward.token) {
      return NextResponse.json(
        { error: 'Reward is required with amount and token (e.g., {"amount": 0.5, "token": "SOL"})' },
        { status: 400 }
      );
    }
    
    // Validate token type
    if (!SUPPORTED_TOKENS.includes(body.reward.token)) {
      return NextResponse.json(
        { error: `Unsupported token: ${body.reward.token}. Supported tokens: ${SUPPORTED_TOKENS.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate minimum bounty (0.1 SOL)
    if (body.reward.token === 'SOL' && body.reward.amount < FEE_STRUCTURE.minimumSol) {
      return NextResponse.json(
        { error: `Minimum bounty is ${FEE_STRUCTURE.minimumSol} SOL` },
        { status: 400 }
      );
    }
    
    // Get poster wallet from header or body
    const poster_wallet = request.headers.get('x-wallet-address') || body.poster_wallet;
    
    if (!poster_wallet) {
      return NextResponse.json(
        { error: 'Missing x-wallet-address header or poster_wallet in body' },
        { status: 400 }
      );
    }
    
    // Apply defaults for optional fields
    const deadline = body.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Default: 7 days
    const difficulty = body.difficulty || 'medium';
    const tags = body.tags || [];
    
    // Create bounty first (to get ID)
    const bounty = await createBounty({
      ...body,
      deadline,
      difficulty,
      tags,
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
            recipient: ESCROW_WALLET.toBase58(),
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
        recipient: ESCROW_WALLET.toBase58(),
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
