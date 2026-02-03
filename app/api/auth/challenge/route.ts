import { NextRequest, NextResponse } from 'next/server';
import { generateAuthMessage } from '@/lib/auth';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// GET /api/auth/challenge?wallet=xxx - for agents
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  
  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
  }
  
  // Generate a random nonce
  const nonce = randomBytes(16).toString('hex');
  
  // Generate the message to sign
  const message = generateAuthMessage(nonce);
  
  return NextResponse.json({
    message,
    nonce,
    wallet,
    expires_in: 300, // 5 minutes
    instructions: 'Sign this message with your wallet and include the signature in your API call',
  });
}

// POST /api/auth/challenge - for frontend
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const wallet = body.wallet;
    
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }
    
    // Generate a random nonce
    const nonce = randomBytes(16).toString('hex');
    
    // Generate the message to sign
    const message = generateAuthMessage(nonce);
    
    return NextResponse.json({
      message,
      nonce,
      wallet,
      expires_in: 300, // 5 minutes
      instructions: 'Sign this message with your wallet and include the signature in your API call',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
