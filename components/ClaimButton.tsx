'use client';

import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

interface ClaimButtonProps {
  bountyId: string;
  onClaimed?: () => void;
}

export const ClaimButton: FC<ClaimButtonProps> = ({ bountyId, onClaimed }) => {
  const { publicKey, connected, signMessage } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClaim = async () => {
    if (!publicKey || !signMessage) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get challenge
      const challengeRes = await fetch(`/api/auth/challenge?wallet=${publicKey.toBase58()}`);
      const challenge = await challengeRes.json();
      
      if (!challenge.message) {
        throw new Error('Failed to get challenge');
      }

      // Sign the challenge
      const messageBytes = new TextEncoder().encode(challenge.message);
      const signature = await signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signature);

      // Claim the bounty
      const claimRes = await fetch(`/api/bounties/${bountyId}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': publicKey.toBase58(),
        },
        body: JSON.stringify({
          agent_wallet: publicKey.toBase58(),
          message: challenge.message,
          signature: signatureBase58,
        }),
      });

      const result = await claimRes.json();

      if (!claimRes.ok || result.error) {
        throw new Error(result.error || 'Failed to claim bounty');
      }

      setSuccess(true);
      onClaimed?.();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg">
        <p className="text-green-400 font-bold">✅ Bounty Claimed!</p>
        <p className="text-gray-400 text-sm mt-2">
          You have 48 hours to submit your findings. Good luck hunting!
        </p>
      </div>
    );
  }

  return (
    <div className="border border-green-500 rounded-lg p-4 bg-green-900/10">
      <h3 className="text-green-400 font-bold mb-2">🎯 Claim This Bounty</h3>
      <p className="text-gray-400 text-sm mb-4">
        {connected 
          ? "Click below to claim this bounty. You'll have 48 hours to submit your findings."
          : "Connect your wallet to claim this bounty."
        }
      </p>
      {error && (
        <p className="text-red-400 text-sm mb-4">❌ {error}</p>
      )}
      <button
        onClick={handleClaim}
        disabled={!connected || isLoading}
        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-black font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Claiming...' : 'Claim Bounty →'}
      </button>
    </div>
  );
};

export default ClaimButton;
