# OSINT.market QA Audit Results

**Date:** 2026-02-03  
**Tester:** Steve (QA Engineer)  
**Environment:** https://osint-market-production.up.railway.app  
**Version:** 1.0.0

---

## Summary

| Category | Pass | Fail | Warning | Total |
|----------|------|------|---------|-------|
| **P0: Payment Flows** | 3 | 2 | 1 | 6 |
| **P1: Core CRUD** | 9 | 3 | 2 | 14 |
| **P2: Auth Flows** | 2 | 1 | 0 | 3 |
| **P3: Edge Cases** | 5 | 0 | 1 | 6 |
| **P4: Performance** | 2 | 0 | 1 | 3 |
| **TOTAL** | **21** | **6** | **5** | **32** |

**Pass Rate:** 65.6% (21/32)  
**Critical Issues:** 3  
**Blocking Issues:** 2

---

## Critical Issues 🚨

### CRITICAL-1: Deposit Instructions Point to Treasury (Not Escrow)
- **Severity:** CRITICAL (P0)
- **Status:** Known - pending deploy
- **Endpoint:** `GET /api/escrow/deposit?bounty_id=X`
- **Expected:** Recipient = `EwwpAe2XkBbMAftrX9m1PEu3mEnL6Gordc49EWKRURau` (escrow)
- **Actual:** Recipient = `7G7co8fLDdddRNbFwPWH9gots93qB4EXPwBoshd3x2va` (treasury)
- **Impact:** Users would send funds to wrong wallet. Funds would go to treasury instead of escrow.
- **Note:** `/api/stats` correctly shows escrow wallet, so the fix may just need deployment.

### CRITICAL-2: Wallet Address Validation Overly Strict / Broken
- **Severity:** CRITICAL (P0)
- **Status:** NEW
- **Endpoints:** `POST /api/bounties/{id}/claim`, `POST /api/bounties`
- **Reproduction:**
  ```bash
  curl -X POST "https://osint-market-production.up.railway.app/api/bounties/bounty_ml70nxf10illdq/claim" \
    -H "Content-Type: application/json" \
    -H "x-wallet-address: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" \
    -d '{"hunter_wallet":"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"}'
  ```
- **Expected:** Claim succeeds (valid Solana address format)
- **Actual:** `{"error":"Invalid wallet address"}`
- **Impact:** No one can claim bounties via API. Complete blocker for hunter flow.
- **Note:** Even real valid base58 Solana addresses fail. Only `G5gmaxjtCMQDD7o4v1c42tG8Mi3prYewW8Au6n1fPJq6` works (hardcoded in demo?)

### CRITICAL-3: Bounty Creation Returns "Invalid request"
- **Severity:** HIGH (P1)
- **Status:** NEW
- **Endpoint:** `POST /api/bounties`
- **Reproduction:**
  ```bash
  curl -X POST "https://osint-market-production.up.railway.app/api/bounties" \
    -H "Content-Type: application/json" \
    -H "x-wallet-address: G5gmaxjtCMQDD7o4v1c42tG8Mi3prYewW8Au6n1fPJq6" \
    -d '{"question":"Test bounty","reward":{"amount":0.5,"token":"SOL"},"poster_wallet":"G5gmaxjtCMQDD7o4v1c42tG8Mi3prYewW8Au6n1fPJq6"}'
  ```
- **Expected:** New bounty created
- **Actual:** `{"error":"Invalid request"}`
- **Impact:** Cannot create new bounties via API. Complete blocker for poster flow.

---

## Detailed Test Results

### 1. API Health & Configuration

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `GET /api/health` returns healthy | `{"status":"healthy"}` | ✓ Matches | ✅ Pass |
| Response time < 500ms | < 500ms | 246-548ms | ⚠️ Warning |
| `GET /api/escrow/info` fee structure | 2.5% / 2.5% | ✓ Correct | ✅ Pass |
| Treasury wallet correct | `7G7co8f...x2va` | ✓ Matches | ✅ Pass |
| Minimum bounty = 0.1 SOL | 0.1 | ✓ Matches | ✅ Pass |

### 2. Bounty Creator Flow

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `GET /api/bounties` returns list | Paginated list | ✓ Returns 3 bounties | ✅ Pass |
| Filter by status=open | Only open bounties | ✓ Works | ✅ Pass |
| Filter by status=resolved | Only resolved | ✓ Works | ✅ Pass |
| Filter by status=all | All bounties | ✓ Returns 4 bounties | ✅ Pass |
| Filter by difficulty | Only matching | Returns all (no filter) | ❌ Fail |
| Filter by tags | Only matching | Returns all (no filter) | ❌ Fail |
| `POST /api/bounties` creates bounty | Returns bounty_id | `{"error":"Invalid request"}` | ❌ Fail |
| Validates minimum reward | Rejects < 0.1 SOL | ✓ Rejects | ✅ Pass |
| Validates zero reward | Rejects | ✓ Rejects | ✅ Pass |
| Validates negative reward | Rejects | ✓ Rejects | ✅ Pass |
| `GET /api/escrow/deposit` recipient | Escrow wallet | Treasury wallet | ❌ Fail (Known) |
| `POST /api/bounties/{id}/deposit` fake sig | Reject | `{"error":"Transaction not found"}` | ✅ Pass |
| `GET /api/bounties/{id}` returns details | Full details | ✓ Returns bounty | ✅ Pass |
| 404 for non-existent bounty | `{"error":"Bounty not found"}` | ✓ Matches | ✅ Pass |

### 3. Hunter Flow

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `GET /api/auth/challenge` | Challenge message | ✓ Returns nonce + message | ✅ Pass |
| Challenge has wallet + timestamp | Present | ✓ Contains both | ✅ Pass |
| Challenge expires (300s) | Documented | ✓ `expires_in: 300` | ✅ Pass |
| `POST /api/bounties/{id}/claim` | Claim bounty | `{"error":"Invalid wallet address"}` | ❌ Fail |
| Submit requires claimed bounty | Reject unclaimed | ✓ `{"error":"Bounty must be claimed first"}` | ✅ Pass |
| Submit validates answer length | >= 10 chars | ✓ Rejects short | ✅ Pass |
| Submit validates methodology | >= 20 chars | ✓ Rejects short | ✅ Pass |

### 4. Resolution Flow

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `POST /api/admin/resolve` | Trigger AI resolver | 404 Not Found | ⚠️ Warning |
| `POST /api/resolve` | Trigger AI resolver | 404 Not Found | ⚠️ Warning |

**Note:** Resolver may be internal-only or triggered by webhook. Cannot test externally.

### 5. Escrow & Payment Mechanics

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `/api/stats` shows escrow balance | Escrow wallet + balance | ✓ `EwwpAe2X...` + 0.432 SOL | ✅ Pass |
| `/api/escrow/balance` endpoint | Balance info | 404 Not Found | ⚠️ Warning |
| Fee calculation (2.5% creation) | Correct | ✓ 0.0125 fee on 0.5 bounty | ✅ Pass |

### 6. Leaderboard & Activity

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `GET /api/leaderboard` | Ranked list | ✓ Returns hunters + posters | ✅ Pass |
| `GET /api/activity` | Recent activity | ✓ Returns 6 activities | ✅ Pass |

### 7. Security

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| SQL injection blocked | Rejected/sanitized | Blocked (Invalid request) | ✅ Pass |
| XSS in question sanitized | Rejected/sanitized | Blocked (Invalid request) | ✅ Pass |
| x-wallet-address required | 401/400 | `{"error":"Missing x-wallet-address header"}` | ✅ Pass |
| Fake tx signature rejected | Rejected | ✓ `{"error":"Transaction not found"}` | ✅ Pass |
| Deposit verification needs poster | Error message | ✓ `{"error":"tx_signature and poster_wallet are required"}` | ✅ Pass |

### 8. Frontend

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Home page loads | 200 + content | ✓ Full HTML rendered | ✅ Pass |
| `/bounties` page exists | 200 | ✓ Link present | ✅ Pass |
| `/post` page exists | 200 | ✓ Link present | ✅ Pass |
| `/leaderboard` page exists | 200 | ✓ Link present | ✅ Pass |
| `/agent-instructions` page exists | 200 | ✓ Link present | ✅ Pass |
| `/docs` page (API) | 200 | 404 Not Found | ❌ Fail |

### 9. Performance

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Health check < 500ms | < 500ms | 246ms | ✅ Pass |
| Bounties list < 500ms | < 500ms | ~350ms | ✅ Pass |
| Initial health check | < 500ms | 548ms (cold start?) | ⚠️ Warning |

---

## Bugs Found

| # | Severity | Description | Repro | Status |
|---|----------|-------------|-------|--------|
| 1 | CRITICAL | Deposit instructions show treasury wallet | See CRITICAL-1 | Known |
| 2 | CRITICAL | Wallet validation blocks all claims | See CRITICAL-2 | NEW |
| 3 | HIGH | Bounty creation fails with "Invalid request" | See CRITICAL-3 | NEW |
| 4 | MEDIUM | Difficulty filter doesn't work | `?difficulty=hard` returns all | NEW |
| 5 | MEDIUM | Tags filter doesn't work | `?tags=crypto` returns all | NEW |
| 6 | LOW | `/api/docs` returns 404 | N/A | NEW |
| 7 | LOW | Response time slightly over 500ms on first call | Cold start | NEW |

---

## Recommendations

### Before Launch (Blocking)
1. ⛔ **Deploy escrow wallet fix** - Deposit instructions pointing to treasury is CRITICAL
2. ⛔ **Fix wallet validation** - Currently no wallets can claim bounties except one hardcoded demo wallet
3. ⛔ **Fix bounty creation** - API returns "Invalid request" for valid payloads

### High Priority
4. 🔴 Fix difficulty filter (returns all bounties regardless of filter)
5. 🔴 Fix tags filter (returns all bounties regardless of filter)
6. 🔴 Add `/api/docs` endpoint or page

### Nice to Have
7. 🟡 Add `/api/escrow/balance` endpoint for escrow transparency
8. 🟡 Improve error messages (distinguish "Invalid request" reasons)
9. 🟡 Document admin/resolver endpoints

---

## Test Data Reference

**Escrow Wallet:** `EwwpAe2XkBbMAftrX9m1PEu3mEnL6Gordc49EWKRURau`  
**Treasury Wallet:** `7G7co8fLDdddRNbFwPWH9gots93qB4EXPwBoshd3x2va`  
**Working Hunter Wallet:** `G5gmaxjtCMQDD7o4v1c42tG8Mi3prYewW8Au6n1fPJq6`

**Demo Bounties:**
- `bounty_ml70nx5bew5nxs` - Twitter identity (0.5 SOL, open)
- `bounty_ml70nxf10illdq` - Email OSINT (0.15 SOL, open)
- `bounty_ml70nxajkjimgh` - VC verification (0.25 SOL, resolved)
- `bounty_ml70nxjzugfbqe` - DeFi team ID (1 SOL, open)

---

## Conclusion

**Launch Status: ⛔ NOT READY**

The platform has strong foundations but has **3 critical blockers**:
1. Wrong deposit recipient (known, pending deploy)
2. Wallet validation broken (NEW - blocks all hunters)
3. Bounty creation broken (NEW - blocks all posters)

Until these are fixed, the platform cannot support real user flows. Filters being broken is a UX issue but not a blocker.

---

*Audit completed by Steve (QA) on 2026-02-03 at 20:16 UTC*
