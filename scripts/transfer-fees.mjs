import { Connection, PublicKey, Transaction, SystemProgram, Keypair, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import os from 'os';

const escrowKey = fs.readFileSync(os.homedir() + '/.clawdbot/osint-escrow-key.txt', 'utf8').trim();
const escrowKeypair = Keypair.fromSecretKey(bs58.decode(escrowKey));

const treasury = new PublicKey('7G7co8fLDdddRNbFwPWH9gots93qB4EXPwBoshd3x2va');
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// Fee from Carrie's completed bounty: 0.0125 SOL (5% of 0.25)
const feeAmount = 0.0125;

console.log(`Transferring ${feeAmount} SOL to treasury...`);
console.log(`From: ${escrowKeypair.publicKey.toBase58()}`);
console.log(`To: ${treasury.toBase58()}`);

const tx = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: escrowKeypair.publicKey,
    toPubkey: treasury,
    lamports: Math.floor(feeAmount * LAMPORTS_PER_SOL),
  })
);

const sig = await sendAndConfirmTransaction(connection, tx, [escrowKeypair]);
console.log(`✅ Success! Signature: ${sig}`);
