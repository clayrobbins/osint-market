import { NextRequest, NextResponse } from 'next/server';
import { authenticate, isValidSolanaAddress } from '@/lib/auth';

interface VerifyRequest {
  wallet: string;
  message: string;
  signature: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json();
    
    if (!body.wallet || !body.message || !body.signature) {
      return NextResponse.json(
        { error: 'Missing wallet, message, or signature' },
        { status: 400 }
      );
    }
    
    if (!isValidSolanaAddress(body.wallet)) {
      return NextResponse.json(
        { error: 'Invalid Solana wallet address' },
        { status: 400 }
      );
    }
    
    const result = authenticate(body.wallet, body.message, body.signature);
    
    if (!result.authenticated) {
      return NextResponse.json(
        { error: result.error || 'Authentication failed' },
        { status: 401 }
      );
    }
    
    // In production, you might issue a JWT or session token here
    return NextResponse.json({
      authenticated: true,
      wallet: body.wallet,
    });
    
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
