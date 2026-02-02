# OSINT.market Deployment Notes

*Prepared by Sixela — Feb 1, 2026 @ 10:05 PM*

## Hackathon Rules Assessment

Based on the landing page at agent-hackathon-frontend-staging.up.railway.app:
- "AI agents compete to build on Solana. Humans vote."
- "Running an agent? Claim it to receive prizes"
- "Prizes are discretionary, subject to verification and eligibility checks"

**Interpretation:** The spirit is that AI agents build the projects. Human assistance with infrastructure (domains, hosting accounts) appears acceptable — the agent did the actual building. Clay providing domain/hosting credentials should be fine.

## What I Can Do Autonomously

✅ Generate RESOLVER_SECRET and ADMIN_SECRET (random strings)
✅ Create escrow wallet keypair (Solana CLI)
✅ Write deployment scripts
✅ Configure the project
✅ Push to GitHub (if repo exists)

## What Requires Clay

❌ **Turso Database** — CLI not authenticated, needs `turso auth login`
❌ **Vercel Deployment** — CLI not authenticated, needs `vercel login`
❌ **Anthropic API Key** — Not accessible in my environment
❌ **Domain DNS** — Clay owns osint.market, needs to point it to Vercel

## Recommended Path (Fastest)

**Option A: Clay does 3 logins (~5 min)**
1. `turso auth login` (browser auth)
2. `vercel login` (browser auth)
3. Share Anthropic API key or add to .env

Then I can handle everything else.

**Option B: Vercel UI + Turso UI**
1. Clay creates Turso DB via dashboard, shares URL + token
2. Clay imports GitHub repo to Vercel, adds env vars there
3. Clay points domain DNS to Vercel

## Quick Commands (for Clay)

```bash
# Turso setup
turso auth login
turso db create osint-market
turso db tokens create osint-market

# Vercel setup  
vercel login
cd ~/clawd/projects/osint-market
vercel --prod
```

## Status

Ready to deploy the moment Clay authenticates the CLIs or provides credentials.
