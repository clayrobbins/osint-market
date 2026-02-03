/**
 * OSINT.market Twitter Bot
 * 
 * Automatically tweets about:
 * - New bounty creations
 * - Bounty completions (with payout amount)
 * 
 * Run via cron or as a background service.
 * 
 * Setup:
 * 1. Create Twitter app at developer.twitter.com
 * 2. Get API keys (need Elevated access for tweeting)
 * 3. Set environment variables (see below)
 * 4. Run: npx ts-node scripts/twitter-bot.ts
 */

import { TwitterApi } from 'twitter-api-v2';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const OSINT_API_URL = process.env.OSINT_API_URL || 'https://osint-market-production.up.railway.app';
const STATE_FILE = path.join(__dirname, '.twitter-bot-state.json');
const POLL_INTERVAL_MS = 60 * 1000; // 1 minute

// Twitter credentials (set via env vars)
const twitter = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

interface BotState {
  lastSeenActivityId: string | null;
  lastSeenBountyId: string | null;
  tweetsToday: number;
  lastResetDate: string;
}

interface Activity {
  id: string;
  type: 'bounty_created' | 'bounty_claimed' | 'bounty_submitted' | 'bounty_resolved';
  bounty_id: string;
  bounty_question: string;
  reward_amount: number;
  reward_token: string;
  wallet?: string;
  created_at: string;
}

// Load/save state to persist across restarts
function loadState(): BotState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return {
    lastSeenActivityId: null,
    lastSeenBountyId: null,
    tweetsToday: 0,
    lastResetDate: new Date().toISOString().split('T')[0],
  };
}

function saveState(state: BotState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// Fetch recent activity from OSINT.market
async function fetchActivity(): Promise<Activity[]> {
  const response = await fetch(`${OSINT_API_URL}/api/activity?limit=20`);
  if (!response.ok) {
    throw new Error(`Failed to fetch activity: ${response.status}`);
  }
  const data = await response.json();
  return data.activities || [];
}

// Generate tweet text for different event types
function generateTweet(activity: Activity): string | null {
  const shortQuestion = activity.bounty_question.slice(0, 100) + 
    (activity.bounty_question.length > 100 ? '...' : '');
  
  const bountyUrl = `${OSINT_API_URL}/bounties/${activity.bounty_id}`;
  
  switch (activity.type) {
    case 'bounty_created':
      return `🆕 New OSINT Bounty!\n\n"${shortQuestion}"\n\n💰 Reward: ${activity.reward_amount} ${activity.reward_token}\n\n🔍 Hunt it down: ${bountyUrl}\n\n#OSINT #BountyHunting #AI`;
    
    case 'bounty_resolved':
      const shortWallet = activity.wallet 
        ? `${activity.wallet.slice(0, 4)}...${activity.wallet.slice(-4)}`
        : 'Anonymous';
      return `✅ Bounty Completed!\n\n"${shortQuestion}"\n\n💸 ${activity.reward_amount} ${activity.reward_token} paid to ${shortWallet}\n\n🎯 Another mystery solved.\n\n${bountyUrl}\n\n#OSINT #BountyHunting`;
    
    default:
      // Don't tweet about claims/submissions (too noisy)
      return null;
  }
}

// Post tweet with rate limiting
async function postTweet(text: string, state: BotState): Promise<boolean> {
  // Reset daily counter
  const today = new Date().toISOString().split('T')[0];
  if (state.lastResetDate !== today) {
    state.tweetsToday = 0;
    state.lastResetDate = today;
  }
  
  // Rate limit: max 50 tweets per day
  if (state.tweetsToday >= 50) {
    console.log('Daily tweet limit reached (50), skipping...');
    return false;
  }
  
  try {
    const result = await twitter.v2.tweet(text);
    console.log(`✅ Tweeted: ${result.data.id}`);
    state.tweetsToday++;
    return true;
  } catch (error: any) {
    console.error('Failed to tweet:', error.message);
    return false;
  }
}

// Main bot loop
async function runBot(): Promise<void> {
  console.log('🤖 OSINT.market Twitter Bot starting...');
  console.log(`📡 API: ${OSINT_API_URL}`);
  console.log(`⏱️ Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  
  const state = loadState();
  console.log(`📊 State: ${state.tweetsToday} tweets today, last activity: ${state.lastSeenActivityId}`);
  
  while (true) {
    try {
      const activities = await fetchActivity();
      
      // Process new activities (newest first, so reverse to post in order)
      const newActivities = activities
        .filter(a => !state.lastSeenActivityId || a.id > state.lastSeenActivityId)
        .reverse();
      
      for (const activity of newActivities) {
        const tweet = generateTweet(activity);
        if (tweet) {
          console.log(`\n📝 New ${activity.type}:`, activity.bounty_question.slice(0, 50));
          await postTweet(tweet, state);
          
          // Small delay between tweets
          await new Promise(r => setTimeout(r, 2000));
        }
        
        // Update state
        state.lastSeenActivityId = activity.id;
        saveState(state);
      }
      
    } catch (error: any) {
      console.error('Bot error:', error.message);
    }
    
    // Wait before next poll
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// CLI: Run once (for testing) or continuous
const args = process.argv.slice(2);
if (args.includes('--once')) {
  // Single run mode (for cron)
  (async () => {
    const state = loadState();
    const activities = await fetchActivity();
    const newActivities = activities
      .filter(a => !state.lastSeenActivityId || a.id > state.lastSeenActivityId)
      .reverse();
    
    console.log(`Found ${newActivities.length} new activities`);
    
    for (const activity of newActivities) {
      const tweet = generateTweet(activity);
      if (tweet) {
        console.log(`\nWould tweet (${activity.type}):`);
        console.log(tweet);
        console.log('---');
        
        // Uncomment to actually tweet:
        // await postTweet(tweet, state);
      }
      state.lastSeenActivityId = activity.id;
    }
    
    saveState(state);
  })();
} else {
  // Continuous mode
  runBot().catch(console.error);
}
