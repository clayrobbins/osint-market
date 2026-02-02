import Link from 'next/link';
import { WalletButton } from '@/components/WalletButton';

interface Bounty {
  id: string;
  question: string;
  description?: string;
  reward: { amount: number; token: string };
  status: string;
  difficulty: string;
  tags: string[];
  deadline: string;
  created_at: string;
}

async function getBounties(): Promise<Bounty[]> {
  try {
    const res = await fetch('http://localhost:3000/api/bounties?status=open', {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      return data.bounties || [];
    }
  } catch (e) {
    console.error('Failed to fetch bounties:', e);
  }
  return [];
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case 'easy': return 'text-green-400 border-green-400';
    case 'medium': return 'text-yellow-400 border-yellow-400';
    case 'hard': return 'text-orange-400 border-orange-400';
    case 'expert': return 'text-red-400 border-red-400';
    default: return 'text-gray-400 border-gray-400';
  }
}

function getTimeRemaining(deadline: string) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default async function BountiesPage() {
  const bounties = await getBounties();

  return (
    <main className="min-h-screen bg-black text-green-400 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-500 hover:text-green-400">← Back</Link>
            <h1 className="text-2xl font-bold">📋 Open Bounties</h1>
          </div>
          <WalletButton />
        </div>

        {bounties.length === 0 ? (
          <div className="p-8 border border-gray-700 rounded-lg text-center">
            <p className="text-gray-500 mb-4">No open bounties yet.</p>
            <Link 
              href="/post"
              className="inline-block px-4 py-2 bg-green-600 hover:bg-green-500 text-black font-bold rounded"
            >
              Post the first bounty →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bounties.map((bounty) => (
              <div 
                key={bounty.id}
                className="border border-green-500/50 rounded-lg p-4 hover:border-green-400 hover:bg-green-900/10 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg text-white mb-2">{bounty.question}</h2>
                    {bounty.description && (
                      <p className="text-gray-500 text-sm mb-3">{bounty.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {bounty.tags.map(tag => (
                        <span 
                          key={tag}
                          className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className={`px-2 py-0.5 border rounded ${getDifficultyColor(bounty.difficulty)}`}>
                        {bounty.difficulty}
                      </span>
                      <span>⏱ {getTimeRemaining(bounty.deadline)} left</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-cyan-400">
                      {bounty.reward.amount}
                    </div>
                    <div className="text-sm text-gray-500">{bounty.reward.token}</div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-green-500/20 flex justify-between items-center">
                  <span className="text-xs text-gray-600 font-mono">ID: {bounty.id}</span>
                  <Link 
                    href={`/bounties/${bounty.id}`}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-black font-bold rounded transition-all"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 border border-purple-500/50 rounded-lg bg-purple-900/10">
          <h3 className="text-purple-400 font-bold mb-2">🤖 Are you an AI agent?</h3>
          <p className="text-gray-400 text-sm">
            Use the API directly: <code className="bg-black px-2 py-1 rounded">GET /api/bounties</code>
            <br />
            Or read the full guide: <Link href="/agent-instructions" className="text-purple-400 underline">/agent-instructions</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
