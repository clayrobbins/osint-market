import { NextRequest, NextResponse } from 'next/server';
import { generateAuthMessage } from '@/lib/auth';

/**
 * Generate a challenge message for wallet authentication.
 * Agents call this endpoint, sign the returned message, then use the signature
 * to authenticate API calls.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  
  if (!wallet) {
    return NextResponse.json(
      { error: 'wallet parameter is required' },
      { status: 400 }
    );
  }
  
  // Generate a random nonce
  const nonce = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
  
  const message = generateAuthMessage(nonce);
  
  return NextResponse.json({
    message,
    nonce,
    wallet,
    instructions: 'Sign this message with your Solana wallet and include the signature in API calls via x-signature header',
  });
}
