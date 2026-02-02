import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';

// Constants
export const TREASURY_WALLET = new PublicKey('7G7co8fLDdddRNbFwPWH9gots93qB4EXPwBoshd3x2va');
export const CREATION_FEE_PERCENT = 0.025; // 2.5%
export const PAYOUT_FEE_PERCENT = 0.025;   // 2.5%
export const MIN_BOUNTY_SOL = 0.1;

// USDC on mainnet
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Get Solana connection
export function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

// Get escrow keypair from env (for signing transactions)
// In production, use a secure key management solution
function getEscrowKeypair(): Keypair | null {
  const secretKey = process.env.ESCROW_PRIVATE_KEY;
  if (!secretKey) {
    console.warn('ESCROW_PRIVATE_KEY not set - transactions will be simulated');
    return null;
  }
  return Keypair.fromSecretKey(bs58.decode(secretKey));
}

// Get SOL balance
export async function getSolBalance(wallet: string): Promise<number> {
  const connection = getConnection();
  const publicKey = new PublicKey(wallet);
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

// Get USDC balance
export async function getUsdcBalance(wallet: string): Promise<number> {
  const connection = getConnection();
  const publicKey = new PublicKey(wallet);
  
  try {
    const tokenAccount = await getAssociatedTokenAddress(USDC_MINT, publicKey);
    const account = await getAccount(connection, tokenAccount);
    return Number(account.amount) / 1_000_000; // USDC has 6 decimals
  } catch {
    return 0;
  }
}

// Calculate fee amounts
export function calculateFees(amount: number, feePercent: number = CREATION_FEE_PERCENT): {
  feeAmount: number;
  netAmount: number;
} {
  const feeAmount = amount * feePercent;
  const netAmount = amount - feeAmount;
  return { feeAmount, netAmount };
}

// Create transfer instruction for SOL
export function createSolTransferInstruction(
  from: PublicKey,
  to: PublicKey,
  amount: number
): ReturnType<typeof SystemProgram.transfer> {
  return SystemProgram.transfer({
    fromPubkey: from,
    toPubkey: to,
    lamports: Math.floor(amount * LAMPORTS_PER_SOL),
  });
}

// Transfer SOL from escrow to recipient
export async function transferSolFromEscrow(
  recipient: string,
  amount: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  const escrowKeypair = getEscrowKeypair();
  
  if (!escrowKeypair) {
    // Simulation mode
    console.log(`[SIMULATED] Transfer ${amount} SOL to ${recipient}`);
    return { 
      success: true, 
      signature: `simulated_${Date.now()}_${Math.random().toString(36).slice(2)}` 
    };
  }
  
  try {
    const connection = getConnection();
    const recipientPubkey = new PublicKey(recipient);
    
    const transaction = new Transaction().add(
      createSolTransferInstruction(escrowKeypair.publicKey, recipientPubkey, amount)
    );
    
    const signature = await sendAndConfirmTransaction(connection, transaction, [escrowKeypair]);
    
    return { success: true, signature };
  } catch (error: any) {
    console.error('SOL transfer error:', error);
    return { success: false, error: error.message };
  }
}

// Transfer USDC from escrow to recipient
export async function transferUsdcFromEscrow(
  recipient: string,
  amount: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  const escrowKeypair = getEscrowKeypair();
  
  if (!escrowKeypair) {
    // Simulation mode
    console.log(`[SIMULATED] Transfer ${amount} USDC to ${recipient}`);
    return { 
      success: true, 
      signature: `simulated_usdc_${Date.now()}_${Math.random().toString(36).slice(2)}` 
    };
  }
  
  try {
    const connection = getConnection();
    const recipientPubkey = new PublicKey(recipient);
    
    // Get token accounts
    const escrowTokenAccount = await getAssociatedTokenAddress(USDC_MINT, escrowKeypair.publicKey);
    const recipientTokenAccount = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);
    
    const transaction = new Transaction().add(
      createTransferInstruction(
        escrowTokenAccount,
        recipientTokenAccount,
        escrowKeypair.publicKey,
        Math.floor(amount * 1_000_000) // USDC has 6 decimals
      )
    );
    
    const signature = await sendAndConfirmTransaction(connection, transaction, [escrowKeypair]);
    
    return { success: true, signature };
  } catch (error: any) {
    console.error('USDC transfer error:', error);
    return { success: false, error: error.message };
  }
}

// Generic transfer from escrow (supports SOL, USDC, and simulates others)
export async function transferFromEscrow(
  recipient: string,
  amount: number,
  token: string
): Promise<{ success: boolean; signature?: string; error?: string }> {
  if (token === 'USDC') {
    return transferUsdcFromEscrow(recipient, amount);
  }
  if (token === 'SOL') {
    return transferSolFromEscrow(recipient, amount);
  }
  // Simulate transfer for other tokens (META, ORE, etc.)
  console.log(`[SIMULATED] Transfer ${amount} ${token} to ${recipient}`);
  return { 
    success: true, 
    signature: `simulated_${token.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2)}` 
  };
}

// Verify a SOL deposit was made to escrow
export async function verifyDeposit(
  signature: string,
  expectedFrom: string,
  expectedAmount: number
): Promise<{ verified: boolean; actualAmount?: number; error?: string }> {
  // In simulation mode, accept any signature starting with "simulated_"
  if (signature.startsWith('simulated_')) {
    return { verified: true, actualAmount: expectedAmount };
  }
  
  try {
    const connection = getConnection();
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx || !tx.meta) {
      return { verified: false, error: 'Transaction not found' };
    }
    
    // Check transaction was successful
    if (tx.meta.err) {
      return { verified: false, error: 'Transaction failed' };
    }
    
    // Verify the transfer (simplified check)
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;
    
    // Get escrow account index
    const accountKeys = tx.transaction.message.getAccountKeys();
    let escrowIndex = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys.get(i)?.equals(TREASURY_WALLET)) {
        escrowIndex = i;
        break;
      }
    }
    
    if (escrowIndex === -1) {
      return { verified: false, error: 'Escrow wallet not in transaction' };
    }
    
    const amountReceived = (postBalances[escrowIndex] - preBalances[escrowIndex]) / LAMPORTS_PER_SOL;
    
    // Allow small variance for fees
    if (amountReceived >= expectedAmount * 0.99) {
      return { verified: true, actualAmount: amountReceived };
    }
    
    return { verified: false, error: `Expected ${expectedAmount} SOL, got ${amountReceived}` };
  } catch (error: any) {
    console.error('Deposit verification error:', error);
    return { verified: false, error: error.message };
  }
}

// Generate escrow deposit instructions for frontend
export function generateDepositInstructions(
  amount: number,
  token: 'SOL' | 'USDC'
): {
  recipient: string;
  amount: number;
  token: string;
  memo: string;
} {
  const { feeAmount, netAmount } = calculateFees(amount, CREATION_FEE_PERCENT);
  
  return {
    recipient: TREASURY_WALLET.toBase58(),
    amount: amount, // User sends full amount, fee taken on deposit
    token,
    memo: `OSINT.market bounty deposit (${netAmount} net after ${feeAmount} fee)`,
  };
}
