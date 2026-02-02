# Railway Deployment Guide

## Prerequisites
1. GitHub repo is public (or Railway has access)
2. Anthropic API key
3. Railway account (free tier works)

---

## Step 1: Create Railway Account
Go to https://railway.app and sign up with GitHub.

---

## Step 2: Create New Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Find and select `clayrobbins/osint-market`
4. Click **Deploy**

---

## Step 3: Add Environment Variables
In Railway dashboard → your project → **Variables** tab:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
RESOLVER_SECRET=osint-resolver-2026
ADMIN_SECRET=osint-admin-2026
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

**Note:** ESCROW_PRIVATE_KEY is optional for demo (will log payments but not execute real transfers).

---

## Step 4: Generate Domain
1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. You'll get something like `osint-market-production.up.railway.app`

---

## Step 5: (Optional) Custom Domain
1. In **Settings** → **Networking** → **Custom Domain**
2. Add `osint.market`
3. Copy the CNAME target
4. In your domain registrar, add CNAME record pointing to Railway

---

## Step 6: Initialize Database
After deploy, visit: `https://your-domain/api/seed`

This creates demo bounties to test with.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | For AI resolver |
| `RESOLVER_SECRET` | Yes | Auth for resolver endpoint |
| `ADMIN_SECRET` | Yes | Auth for admin endpoints |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Solana RPC (can use public) |
| `ESCROW_PRIVATE_KEY` | No | Base58 escrow wallet key (for real payments) |
| `TURSO_DATABASE_URL` | No | If using Turso instead of local SQLite |
| `TURSO_AUTH_TOKEN` | No | If using Turso |

---

## Verify Deployment
1. Visit your Railway URL
2. Check `/api/health` returns `{"status":"healthy"}`
3. Check `/api/bounties` returns list (empty or seeded)
4. Try connecting a Solana wallet

---

## Troubleshooting

**Build fails:**
- Check Railway build logs
- Ensure `npm run build` works locally

**Database errors:**
- SQLite file is stored in `/app/local.db`
- Railway persists this across deploys

**Resolver not working:**
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check logs for API errors
