import { NextResponse } from 'next/server';
import { FEE_STRUCTURE, getDepositInstructions } from '@/lib/escrow';

/**
 * Get escrow information and fee structure
 * Agents and frontends can use this to understand the payment flow
 */
export async function GET() {
  return NextResponse.json({
    fee_structure: {
      creation_fee_percent: FEE_STRUCTURE.creation,
      payout_fee_percent: FEE_STRUCTURE.payout,
      total_fee_percent: FEE_STRUCTURE.total,
      minimum_bounty_sol: FEE_STRUCTURE.minimumSol,
    },
    treasury_wallet: FEE_STRUCTURE.treasury,
    supported_tokens: ['SOL', 'USDC'],
    payment_flow: {
      step_1: 'Create bounty via POST /api/bounties (returns bounty_id)',
      step_2: 'Get deposit instructions via GET /api/escrow/deposit?bounty_id=X',
      step_3: 'Send funds to treasury wallet with bounty_id in memo',
      step_4: 'Verify deposit via POST /api/bounties/{id}/deposit with tx_signature',
      step_5: 'Bounty becomes active and visible to hunters',
    },
    example_deposit: getDepositInstructions(0.5, 'SOL'),
  });
}
