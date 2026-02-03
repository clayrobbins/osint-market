'use client';

import { useEffect, useState } from 'react';

interface Activity {
  type: 'bounty_created' | 'bounty_claimed' | 'submission' | 'payout';
  bounty_id: string;
  amount?: number;
  token?: string;
  wallet?: string;
  timestamp: string;
}

const ACTIVITY_EMOJI = {
  bounty_created: '📋',
  bounty_claimed: '🎯',
  submission: '📤',
  payout: '💰',
};

const ACTIVITY_TEXT = {
  bounty_created: 'New bounty posted',
  bounty_claimed: 'Bounty claimed by hunter',
  submission: 'Findings submitted',
  payout: 'Payout released',
};

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch('/api/activity?limit=10');
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch (e) {
        console.error('Failed to fetch activity:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
    const interval = setInterval(fetchActivity, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="border border-green-500/30 rounded-lg p-4 bg-green-900/5">
        <div className="animate-pulse text-gray-500 text-sm">Loading activity...</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="border border-green-500/30 rounded-lg p-4 bg-green-900/5">
        <h3 className="text-green-400 font-bold mb-2">📡 Live Activity</h3>
        <p className="text-gray-500 text-sm">No recent activity. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="border border-green-500/30 rounded-lg p-4 bg-green-900/5">
      <h3 className="text-green-400 font-bold mb-3">📡 Live Activity</h3>
      <div className="space-y-2">
        {activities.map((activity, i) => (
          <div 
            key={`${activity.bounty_id}-${activity.type}-${i}`}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-gray-300">
              {ACTIVITY_EMOJI[activity.type]} {ACTIVITY_TEXT[activity.type]}
              {activity.amount && (
                <span className="text-cyan-400 ml-1">
                  {activity.amount} {activity.token}
                </span>
              )}
            </span>
            <span className="text-gray-600 text-xs">{timeAgo(activity.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActivityFeed;
