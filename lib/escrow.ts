import { 
  ESCROW_WALLET,
  TREASURY_WALLET,
  CREATION_FEE_PERCENT,
  PAYOUT_FEE_PERCENT,
  MIN_BOUNTY_SOL,
  calculateFees,
  transferFromEscrow,
  verifyDeposit,
  generateDepositInstructions,
} from './solana';

export { ESCROW_WALLET, TREASURY_WALLET };
import { createTransaction, updateTransactionStatus } from './repositories/transactions';
import type { Bounty, Reward } from './types';

export interface DepositResult {
  success: boolean;
  bountyId?: string;
  escrowTx?: string;
  netAmount?: number;
  feeAmount?: number;
  error?: string;
}

export interface PayoutResult {
  success: boolean;
  payoutTx?: string;
  feeTx?: string;
  netAmount?: number;
  feeAmount?: number;
  error?: string;
}

/**
 * Process bounty creation - verify deposit and record fee
 */
export async function processDeposit(
  bountyId: string,
  reward: Reward,
  posterWallet: string,
  depositTxSignature: string
): Promise<DepositResult> {
  // Validate minimum
  if (reward.token === 'SOL' && reward.amount < MIN_BOUNTY_SOL) {
    return { success: false, error: `Minimum bounty is ${MIN_BOUNTY_SOL} SOL` };
  }
  
  // Calculate fees
  const { feeAmount, netAmount } = calculateFees(reward.amount, CREATION_FEE_PERCENT);
  
  // Verify the deposit transaction
  const verification = await verifyDeposit(depositTxSignature, posterWallet, reward.amount);
  
  if (!verification.verified) {
    return { success: false, error: verification.error || 'Deposit verification failed' };
  }
  
  // Record the escrow deposit
  const depositRecord = await createTransaction({
    type: 'escrow_deposit',
    bounty_id: bountyId,
    amount: netAmount,
    token: reward.token,
    from_wallet: posterWallet,
    to_wallet: TREASURY_WALLET.toBase58(),
    tx_signature: depositTxSignature,
    status: 'confirmed',
  });
  
  // Record the fee collection
  await createTransaction({
    type: 'fee_collection',
    bounty_id: bountyId,
    amount: feeAmount,
    token: reward.token,
    from_wallet: posterWallet,
    to_wallet: TREASURY_WALLET.toBase58(),
    fee_amount: feeAmount,
    tx_signature: depositTxSignature,
    status: 'confirmed',
  });
  
  return {
    success: true,
    bountyId,
    escrowTx: depositTxSignature,
    netAmount,
    feeAmount,
  };
}

/**
 * Process bounty payout - transfer to hunter and collect fee
 */
export async function processPayout(
  bounty: Bounty,
  hunterWallet: string
): Promise<PayoutResult> {
  // Calculate payout fee
  const { feeAmount, netAmount } = calculateFees(bounty.reward.amount, PAYOUT_FEE_PERCENT);
  
  // Note: The escrow already deducted creation fee, so we're working with the original amount
  // Total fees = creation fee + payout fee = 5%
  const escrowedAmount = bounty.reward.amount * (1 - CREATION_FEE_PERCENT);
  const actualPayout = escrowedAmount - feeAmount;
  
  // Transfer to hunter (supports both SOL and USDC)
  const transfer = await transferFromEscrow(hunterWallet, actualPayout, bounty.reward.token);
  
  if (!transfer.success) {
    return { success: false, error: transfer.error };
  }
  
  // Record payout transaction
  await createTransaction({
    type: 'escrow_release',
    bounty_id: bounty.id,
    amount: actualPayout,
    token: bounty.reward.token,
    from_wallet: TREASURY_WALLET.toBase58(),
    to_wallet: hunterWallet,
    tx_signature: transfer.signature,
    status: 'confirmed',
  });
  
  // Record payout fee
  await createTransaction({
    type: 'fee_collection',
    bounty_id: bounty.id,
    amount: feeAmount,
    token: bounty.reward.token,
    to_wallet: TREASURY_WALLET.toBase58(),
    fee_amount: feeAmount,
    status: 'confirmed',
  });
  
  return {
    success: true,
    payoutTx: transfer.signature,
    netAmount: actualPayout,
    feeAmount,
  };
}

/**
 * Process refund - return escrowed funds to poster
 */
export async function processRefund(
  bounty: Bounty
): Promise<PayoutResult> {
  // Refund the escrowed amount (original minus creation fee, which is non-refundable)
  const escrowedAmount = bounty.reward.amount * (1 - CREATION_FEE_PERCENT);
  
  const transfer = await transferFromEscrow(bounty.poster_wallet, escrowedAmount, bounty.reward.token);
  
  if (!transfer.success) {
    return { success: false, error: transfer.error };
  }
  
  await createTransaction({
    type: 'escrow_refund',
    bounty_id: bounty.id,
    amount: escrowedAmount,
    token: bounty.reward.token,
    from_wallet: TREASURY_WALLET.toBase58(),
    to_wallet: bounty.poster_wallet,
    tx_signature: transfer.signature,
    status: 'confirmed',
  });
  
  return {
    success: true,
    payoutTx: transfer.signature,
    netAmount: escrowedAmount,
  };
}

/**
 * Get deposit instructions for frontend
 */
export function getDepositInstructions(amount: number, token: 'SOL' | 'USDC' = 'SOL') {
  return generateDepositInstructions(amount, token);
}

/**
 * Summary of fee structure
 */
export const FEE_STRUCTURE = {
  creation: CREATION_FEE_PERCENT * 100, // 2.5%
  payout: PAYOUT_FEE_PERCENT * 100,     // 2.5%
  total: (CREATION_FEE_PERCENT + PAYOUT_FEE_PERCENT) * 100, // 5%
  minimumSol: MIN_BOUNTY_SOL,
  treasury: TREASURY_WALLET.toBase58(),
};
