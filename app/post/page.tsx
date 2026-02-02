'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/WalletButton';
import Link from 'next/link';

export default function PostBounty() {
  const { publicKey, connected } = useWallet();
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('0.1');
  const [token, setToken] = useState<'SOL' | 'USDC'>('SOL');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('medium');
  const [tags, setTags] = useState('');
  const [deadline, setDeadline] = useState('7');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; bounty_id?: string; error?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey) {
      setResult({ error: 'Please connect your wallet first' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const deadlineDate = new Date(Date.now() + parseInt(deadline) * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await fetch('/api/bounties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': publicKey.toBase58(),
        },
        body: JSON.stringify({
          question,
          description: description || undefined,
          reward: {
            amount: parseFloat(amount),
            token,
          },
          difficulty,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          deadline: deadlineDate,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, bounty_id: data.bounty_id });
      } else {
        setResult({ error: data.error || 'Failed to create bounty' });
      }
    } catch (error: any) {
      setResult({ error: error.message || 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-green-400 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="text-gray-500 hover:text-green-400">← Back</Link>
          <WalletButton />
        </div>

        <h1 className="text-2xl font-bold mb-8">📝 Post a Bounty</h1>

        {!connected ? (
          <div className="p-6 border border-yellow-500/50 rounded-lg bg-yellow-900/10">
            <p className="text-yellow-400 mb-4">Connect your wallet to post a bounty</p>
            <WalletButton />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Question *</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., Find the real identity behind @mystery_user"
                className="w-full p-3 bg-gray-900 border border-green-500/50 rounded text-white focus:border-green-400 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional context or requirements..."
                rows={3}
                className="w-full p-3 bg-gray-900 border border-green-500/50 rounded text-white focus:border-green-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Reward Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-3 bg-gray-900 border border-green-500/50 rounded text-white focus:border-green-400 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Token</label>
                <select
                  value={token}
                  onChange={(e) => setToken(e.target.value as 'SOL' | 'USDC')}
                  className="w-full p-3 bg-gray-900 border border-green-500/50 rounded text-white focus:border-green-400 focus:outline-none"
                >
                  <option value="SOL">SOL</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                  className="w-full p-3 bg-gray-900 border border-green-500/50 rounded text-white focus:border-green-400 focus:outline-none"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Deadline (days)</label>
                <select
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full p-3 bg-gray-900 border border-green-500/50 rounded text-white focus:border-green-400 focus:outline-none"
                >
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Tags (comma-separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., twitter, identity, crypto"
                className="w-full p-3 bg-gray-900 border border-green-500/50 rounded text-white focus:border-green-400 focus:outline-none"
              />
            </div>

            <div className="p-4 bg-gray-900/50 rounded border border-gray-700">
              <p className="text-sm text-gray-400">
                <strong className="text-yellow-400">Fee:</strong> 2.5% on creation + 2.5% on payout = 5% total
                <br />
                <strong className="text-cyan-400">You will pay:</strong> {amount} {token} → Hunter receives {(parseFloat(amount || '0') * 0.95).toFixed(4)} {token}
              </p>
            </div>

            {result && (
              <div className={`p-4 rounded ${result.success ? 'bg-green-900/30 border border-green-500' : 'bg-red-900/30 border border-red-500'}`}>
                {result.success ? (
                  <div>
                    <p className="text-green-400">✅ Bounty created!</p>
                    <p className="text-sm text-gray-400 mt-2">
                      ID: <code>{result.bounty_id}</code>
                    </p>
                    <p className="text-sm text-yellow-400 mt-2">
                      Next: Send {amount} {token} to treasury wallet to activate the bounty.
                    </p>
                  </div>
                ) : (
                  <p className="text-red-400">❌ {result.error}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full p-4 bg-green-600 hover:bg-green-500 text-black font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Bounty'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
