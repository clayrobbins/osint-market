import { NextRequest, NextResponse } from 'next/server';
import { generateAuthMessage } from '@/lib/auth';
import { randomBytes } from 'crypto';

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
      expires_in: 300, // 5 minutes
      instructions: 'Sign this message with your wallet and include the signature in your API call',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
