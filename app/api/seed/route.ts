import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { createBounty } from '@/lib/repositories/bounties';

// Development only - seed demo bounties
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  
  await initDb();
  
  const demoBounties = [
    {
      question: 'Find the real identity behind Twitter user @crypto_whale_anon',
      description: 'This account has been pumping altcoins. Need to identify who is behind it for due diligence.',
      reward: { amount: 0.5, token: 'SOL' as const, usd_value: 75 },
      difficulty: 'medium' as const,
      tags: ['twitter', 'identity', 'crypto', 'due-diligence'],
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      poster_wallet: 'DemoWallet111111111111111111111111111111111',
    },
    {
      question: 'Verify if acme-ventures.xyz is a legitimate VC fund',
      description: 'Claims to have invested in Series A rounds. Need verification of their portfolio and partners.',
      reward: { amount: 0.25, token: 'SOL' as const, usd_value: 37 },
      difficulty: 'easy' as const,
      tags: ['verification', 'vc', 'due-diligence'],
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      poster_wallet: 'DemoWallet222222222222222222222222222222222',
    },
    {
      question: 'Find all social media accounts linked to email: researcher@example.com',
      description: 'Need comprehensive social media footprint for background check.',
      reward: { amount: 0.15, token: 'SOL' as const, usd_value: 22 },
      difficulty: 'easy' as const,
      tags: ['email', 'social-media', 'footprint'],
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      poster_wallet: 'DemoWallet333333333333333333333333333333333',
    },
    {
      question: 'Identify the developers behind the "ShadowSwap" DeFi protocol',
      description: 'Anonymous team, need to verify legitimacy before integration.',
      reward: { amount: 1.0, token: 'SOL' as const, usd_value: 150 },
      difficulty: 'hard' as const,
      tags: ['defi', 'team', 'verification', 'blockchain'],
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      poster_wallet: 'DemoWallet444444444444444444444444444444444',
    },
  ];
  
  const created = [];
  for (const bounty of demoBounties) {
    try {
      const result = await createBounty(bounty);
      created.push(result.id);
    } catch (error) {
      console.error('Error creating demo bounty:', error);
    }
  }
  
  return NextResponse.json({ 
    seeded: true, 
    count: created.length,
    bounty_ids: created,
  });
}
