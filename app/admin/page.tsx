'use client';

import { useState, useEffect } from 'react';

interface Stats {
  total: number;
  open: number;
  claimed: number;
  submitted: number;
  resolved: number;
  expired: number;
  disputed: number;
}

interface Bounty {
  id: string;
  question: string;
  status: string;
  reward: { amount: number; token: string };
  created_at: string;
  poster_wallet: string;
}

interface Dispute {
  id: string;
  bounty_id: string;
  agent_wallet: string;
  reason: string;
  status: string;
  created_at: string;
}

interface AdminData {
  stats: Stats;
  disputedBounties: Bounty[];
  pendingDisputes: Dispute[];
  disputeCount: number;
  recentBounties: Bounty[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin', {
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
        },
      });
      
      if (res.status === 401) {
        setAuthenticated(false);
        setError('Unauthorized - check admin secret');
        return;
      }
      
      if (!res.ok) throw new Error('Failed to fetch');
      
      const json = await res.json();
      setData(json);
      setAuthenticated(true);
      setError(null);
    } catch (e) {
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const doAction = async (action: string, params: Record<string, unknown>) => {
    try {
      setActionResult(null);
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...params }),
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        setActionResult(`Error: ${json.error}`);
      } else {
        setActionResult(`Success: ${json.message}`);
        fetchData(); // Refresh
      }
    } catch (e) {
      setActionResult('Action failed');
    }
  };

  useEffect(() => {
    // Check for stored secret
    const stored = localStorage.getItem('adminSecret');
    if (stored) {
      setAdminSecret(stored);
    }
  }, []);

  const handleLogin = () => {
    localStorage.setItem('adminSecret', adminSecret);
    setLoading(true);
    fetchData();
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-6">🔐 Admin Login</h1>
          <input
            type="password"
            placeholder="Admin Secret"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            className="w-full p-3 bg-gray-800 rounded mb-4"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded font-medium"
          >
            Login
          </button>
          {error && <p className="mt-4 text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <p className="text-red-400">{error || 'No data'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">📊 OSINT Market Admin</h1>
          <button
            onClick={fetchData}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
          >
            Refresh
          </button>
        </div>

        {actionResult && (
          <div className={`mb-6 p-4 rounded ${actionResult.startsWith('Error') ? 'bg-red-900' : 'bg-green-900'}`}>
            {actionResult}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {Object.entries(data.stats).map(([key, value]) => (
            <div key={key} className="bg-gray-800 p-4 rounded-lg">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-gray-400 capitalize">{key}</div>
            </div>
          ))}
        </div>

        {/* Pending Disputes */}
        {data.pendingDisputes.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">
              ⚠️ Pending Disputes ({data.disputeCount})
            </h2>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-3 text-left">Bounty ID</th>
                    <th className="p-3 text-left">Hunter</th>
                    <th className="p-3 text-left">Reason</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingDisputes.map((dispute) => (
                    <tr key={dispute.id} className="border-t border-gray-700">
                      <td className="p-3 font-mono text-sm">{dispute.bounty_id}</td>
                      <td className="p-3 font-mono text-sm">
                        {dispute.agent_wallet.slice(0, 8)}...
                      </td>
                      <td className="p-3 text-sm">{dispute.reason.slice(0, 100)}...</td>
                      <td className="p-3">
                        <button
                          onClick={() => doAction('resolve-dispute', { 
                            dispute_id: dispute.id, 
                            decision: 'upheld' 
                          })}
                          className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm mr-2"
                        >
                          Uphold
                        </button>
                        <button
                          onClick={() => doAction('resolve-dispute', { 
                            dispute_id: dispute.id, 
                            decision: 'overturned' 
                          })}
                          className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                        >
                          Overturn
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Bounties */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Recent Bounties</h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-3 text-left">ID</th>
                  <th className="p-3 text-left">Question</th>
                  <th className="p-3 text-left">Reward</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBounties.map((bounty) => (
                  <tr key={bounty.id} className="border-t border-gray-700">
                    <td className="p-3 font-mono text-sm">{bounty.id.slice(-12)}</td>
                    <td className="p-3 text-sm">{bounty.question.slice(0, 50)}...</td>
                    <td className="p-3">
                      {bounty.reward.amount} {bounty.reward.token}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        bounty.status === 'open' ? 'bg-green-700' :
                        bounty.status === 'resolved' ? 'bg-blue-700' :
                        bounty.status === 'disputed' ? 'bg-yellow-700' :
                        'bg-gray-600'
                      }`}>
                        {bounty.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => {
                          if (confirm(`Delete bounty ${bounty.id}?`)) {
                            doAction('delete-bounty', { bounty_id: bounty.id });
                          }
                        }}
                        className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => {
                const ids = data.recentBounties
                  .filter(b => b.question.toLowerCase().includes('test'))
                  .map(b => b.id);
                if (ids.length && confirm(`Delete ${ids.length} test bounties?`)) {
                  doAction('bulk-delete', { bounty_ids: ids });
                }
              }}
              className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded"
            >
              🧹 Clean Test Data
            </button>
            <button
              onClick={() => {
                const bountyId = prompt('Enter bounty ID:');
                if (bountyId) doAction('manual-payout', { bounty_id: bountyId });
              }}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
            >
              💰 Manual Payout
            </button>
            <button
              onClick={() => {
                const bountyId = prompt('Enter bounty ID:');
                if (bountyId) doAction('manual-refund', { bounty_id: bountyId });
              }}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
            >
              ↩️ Manual Refund
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
