import Link from 'next/link';

interface HunterEntry {
  wallet: string;
  bounties_completed: number;
  total_earned: number;
  approval_rate: number;
}

async function getLeaderboard() {
  try {
    const res = await fetch('http://localhost:3000/api/leaderboard', {
      cache: 'no-store',
    });
    if (res.ok) return res.json();
  } catch {}
  return { hunters: [], posters: [] };
}

function truncateWallet(wallet: string) {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function getRankEmoji(index: number) {
  switch (index) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return `#${index + 1}`;
  }
}

export default async function LeaderboardPage() {
  const data = await getLeaderboard();

  return (
    <main className="min-h-screen bg-black text-green-400 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-gray-500 hover:text-green-400">← Back</Link>
          <h1 className="text-2xl font-bold">🏆 Leaderboard</h1>
        </div>

        {/* Top Hunters */}
        <div className="border border-green-500 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-cyan-400 mb-4">Top Hunters</h2>
          
          {data.hunters.length === 0 ? (
            <p className="text-gray-500">No hunters yet. Be the first to claim a bounty!</p>
          ) : (
            <div className="space-y-3">
              {data.hunters.map((hunter: HunterEntry, index: number) => (
                <div 
                  key={hunter.wallet}
                  className={`flex items-center justify-between p-3 rounded ${
                    index < 3 ? 'bg-green-900/20 border border-green-500/30' : 'bg-gray-900/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xl w-10">{getRankEmoji(index)}</span>
                    <div>
                      <span className="font-mono text-white">{truncateWallet(hunter.wallet)}</span>
                      <div className="text-xs text-gray-500">
                        {hunter.bounties_completed} bounties • {hunter.approval_rate}% approval
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-cyan-400 font-bold">
                      ${hunter.total_earned.toLocaleString()}
                    </span>
                    <div className="text-xs text-gray-500">earned</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Posters */}
        <div className="border border-purple-500/50 rounded-lg p-6 bg-purple-900/10">
          <h2 className="text-xl font-bold text-purple-400 mb-4">Top Bounty Posters</h2>
          
          {data.posters.length === 0 ? (
            <p className="text-gray-500">No bounties posted yet.</p>
          ) : (
            <div className="grid gap-2">
              {data.posters.map((poster: any, index: number) => (
                <div 
                  key={poster.wallet}
                  className="flex items-center justify-between p-2 bg-gray-900/50 rounded"
                >
                  <span className="font-mono text-sm">{truncateWallet(poster.wallet)}</span>
                  <span className="text-sm text-gray-400">
                    {poster.bounties_posted} bounties • {poster.total_staked} SOL staked
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          Updated: {data.updated_at ? new Date(data.updated_at).toLocaleString() : 'N/A'}
        </div>
      </div>
    </main>
  );
}
