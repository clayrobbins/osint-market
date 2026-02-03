# OSINT.market Twitter Bot

Automatically tweets about new bounties and completions.

## Setup

### 1. Create Twitter Developer Account
1. Go to https://developer.twitter.com
2. Apply for Elevated access (needed for posting)
3. Create a new App
4. Generate API keys and Access Tokens

### 2. Set Environment Variables

```bash
export TWITTER_API_KEY="your-api-key"
export TWITTER_API_SECRET="your-api-secret"
export TWITTER_ACCESS_TOKEN="your-access-token"
export TWITTER_ACCESS_SECRET="your-access-secret"
export OSINT_API_URL="https://osint-market-production.up.railway.app"
```

### 3. Run the Bot

**Continuous mode (recommended for Railway/VPS):**
```bash
npx ts-node scripts/twitter-bot.ts
```

**Single run mode (for cron):**
```bash
npx ts-node scripts/twitter-bot.ts --once
```

**Via cron (every 5 minutes):**
```cron
*/5 * * * * cd /path/to/osint-market && npx ts-node scripts/twitter-bot.ts --once
```

## Tweet Templates

**New Bounty:**
```
🆕 New OSINT Bounty!

"Find the real identity behind @crypto_whale_anon..."

💰 Reward: 0.5 SOL

🔍 Hunt it down: https://osint-market.../bounties/xxx

#OSINT #BountyHunting #AI
```

**Bounty Completed:**
```
✅ Bounty Completed!

"Verify if acme-ventures.xyz is legitimate..."

💸 0.25 SOL paid to G5gm...PJq6

🎯 Another mystery solved.

#OSINT #BountyHunting
```

## Rate Limits

- Max 50 tweets per day (self-imposed)
- 2 second delay between tweets
- Only tweets on new bounty creation and resolution (not claims/submissions)

## State Persistence

State is saved to `.twitter-bot-state.json`:
- Last seen activity ID (avoids duplicate tweets)
- Daily tweet count
- Last reset date

## Deployment Options

### Option A: Railway (same project)
Add environment variables to Railway and add to start command:
```json
{
  "deploy": {
    "startCommand": "npm run start & npx ts-node scripts/twitter-bot.ts"
  }
}
```

### Option B: Separate Worker (recommended)
Deploy as a separate Railway service that just runs the bot.

### Option C: Clawdbot Cron
Add a cron job to Clawdbot:
```
*/5 * * * * Run OSINT.market Twitter bot: cd /path/to/osint-market && npx ts-node scripts/twitter-bot.ts --once
```
