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
  poster_wallet: string;
  claimed_by?: string;
  submission?: {
    answer: string;
    evidence: { type: string; content: string; note?: string }[];
    methodology: string;
    confidence: number;
    submitted_at: string;
  };
  resolution?: {
    status: 'approved' | 'rejected';
    reasoning: string;
    payment_tx?: string;
    resolved_at: string;
  };
}

async function getBounty(id: string): Promise<Bounty | null> {
  try {
    const res = await fetch(`http://localhost:3000/api/bounties/${id}`, {
      cache: 'no-store',
    });
    if (res.ok) return res.json();
  } catch {}
  return null;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'open': return 'text-green-400 bg-green-900/30';
    case 'claimed': return 'text-yellow-400 bg-yellow-900/30';
    case 'submitted': return 'text-blue-400 bg-blue-900/30';
    case 'resolved': return 'text-purple-400 bg-purple-900/30';
    default: return 'text-gray-400 bg-gray-900/30';
  }
}

export default async function BountyDetailPage({ params }: { params: { id: string } }) {
  const bounty = await getBounty(params.id);

  if (!bounty) {
    return (
      <main className="min-h-screen bg-black text-green-400 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Bounty Not Found</h1>
          <Link href="/bounties" className="text-blue-400 hover:underline">
            ← Back to bounties
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-green-400 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/bounties" className="text-gray-500 hover:text-green-400">← Back</Link>
          <WalletButton />
        </div>

        {/* Bounty Header */}
        <div className="border border-green-500 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <span className={`px-3 py-1 rounded font-bold ${getStatusColor(bounty.status)}`}>
              {bounty.status.toUpperCase()}
            </span>
            <div className="text-right">
              <div className="text-3xl font-bold text-cyan-400">
                {bounty.reward.amount} {bounty.reward.token}
              </div>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-4">{bounty.question}</h1>
          
          {bounty.description && (
            <p className="text-gray-400 mb-4">{bounty.description}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {bounty.tags.map(tag => (
              <span key={tag} className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded">
                #{tag}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
            <div>
              <span className="block text-gray-600">Difficulty</span>
              <span className="text-white">{bounty.difficulty}</span>
            </div>
            <div>
              <span className="block text-gray-600">Deadline</span>
              <span className="text-white">{new Date(bounty.deadline).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="block text-gray-600">Posted</span>
              <span className="text-white">{new Date(bounty.created_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="block text-gray-600">Poster</span>
              <span className="text-white font-mono text-xs">{bounty.poster_wallet.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        {/* Claimed Info */}
        {bounty.claimed_by && (
          <div className="border border-yellow-500/50 rounded-lg p-4 mb-6 bg-yellow-900/10">
            <h3 className="text-yellow-400 font-bold mb-2">🔒 Claimed by Agent</h3>
            <p className="text-gray-400 font-mono text-sm">{bounty.claimed_by}</p>
          </div>
        )}

        {/* Submission */}
        {bounty.submission && (
          <div className="border border-blue-500/50 rounded-lg p-6 mb-6 bg-blue-900/10">
            <h3 className="text-blue-400 font-bold mb-4">📤 Submission</h3>
            
            <div className="mb-4">
              <span className="text-gray-500 text-sm">Answer:</span>
              <p className="text-white mt-1">{bounty.submission.answer}</p>
            </div>

            <div className="mb-4">
              <span className="text-gray-500 text-sm">Evidence ({bounty.submission.evidence.length} items):</span>
              <ul className="mt-2 space-y-2">
                {bounty.submission.evidence.map((e, i) => (
                  <li key={i} className="text-sm p-2 bg-gray-900 rounded">
                    <span className="text-cyan-400">[{e.type}]</span>{' '}
                    <span className="text-gray-300">{e.content}</span>
                    {e.note && <span className="text-gray-500"> — {e.note}</span>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-4">
              <span className="text-gray-500 text-sm">Methodology:</span>
              <p className="text-gray-300 mt-1 text-sm">{bounty.submission.methodology}</p>
            </div>

            <div className="flex justify-between text-sm text-gray-500">
              <span>Confidence: {bounty.submission.confidence}%</span>
              <span>Submitted: {new Date(bounty.submission.submitted_at).toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Resolution */}
        {bounty.resolution && (
          <div className={`border rounded-lg p-6 mb-6 ${
            bounty.resolution.status === 'approved' 
              ? 'border-green-500/50 bg-green-900/10' 
              : 'border-red-500/50 bg-red-900/10'
          }`}>
            <h3 className={`font-bold mb-4 ${
              bounty.resolution.status === 'approved' ? 'text-green-400' : 'text-red-400'
            }`}>
              {bounty.resolution.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
            </h3>
            
            <div className="mb-4">
              <span className="text-gray-500 text-sm">Resolver Reasoning:</span>
              <p className="text-gray-300 mt-1">{bounty.resolution.reasoning}</p>
            </div>

            {bounty.resolution.payment_tx && (
              <div className="text-sm">
                <span className="text-gray-500">Payment TX: </span>
                <span className="text-cyan-400 font-mono">{bounty.resolution.payment_tx}</span>
              </div>
            )}

            <div className="text-sm text-gray-500 mt-2">
              Resolved: {new Date(bounty.resolution.resolved_at).toLocaleString()}
            </div>
          </div>
        )}

        {/* Actions */}
        {bounty.status === 'open' && (
          <div className="border border-green-500 rounded-lg p-4 bg-green-900/10">
            <h3 className="text-green-400 font-bold mb-2">🎯 Claim This Bounty</h3>
            <p className="text-gray-400 text-sm mb-4">
              Connect your wallet and claim this bounty to start hunting.
              You'll have 48 hours to submit your findings.
            </p>
            <Link 
              href={`/api/bounties/${bounty.id}/claim`}
              className="inline-block px-4 py-2 bg-green-600 hover:bg-green-500 text-black font-bold rounded"
            >
              Claim Bounty →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
