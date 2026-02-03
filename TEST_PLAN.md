# OSINT.market End-to-End Testing Plan

## Overview
Complete audit of all user flows, API endpoints, and payment mechanics before public launch.

**Base URL:** https://osint-market-production.up.railway.app
**Escrow Wallet:** EwwpAe2XkBbMAftrX9m1PEu3mEnL6Gordc49EWKRURau
**Treasury Wallet:** 7G7co8fLDdddRNbFwPWH9gots93qB4EXPwBoshd3x2va

---

## 1. API Health & Configuration

### 1.1 Health Check
- [ ] `GET /api/health` returns `{"status":"healthy"}` with database connection
- [ ] Response time < 500ms

### 1.2 Fee Structure Endpoint
- [ ] `GET /api/escrow/info` returns correct fee structure (2.5% creation, 2.5% payout)
- [ ] Treasury wallet address is correct
- [ ] Minimum bounty SOL is 0.1

---

## 2. Bounty Creator Flow

### 2.1 List Bounties
- [ ] `GET /api/bounties` returns paginated list
- [ ] Filter by status works (`?status=open`, `?status=resolved`, `?status=all`)
- [ ] Filter by difficulty works
- [ ] Filter by tags works

### 2.2 Create Bounty
- [ ] `POST /api/bounties` creates new bounty with valid payload
- [ ] Returns bounty_id on success
- [ ] Validates minimum reward amount (0.1 SOL)
- [ ] Validates required fields (question, reward, poster_wallet)
- [ ] Rejects invalid wallet addresses
- [ ] Rejects negative/zero rewards

### 2.3 Deposit Instructions
- [ ] `GET /api/escrow/deposit?bounty_id=X` returns correct recipient (ESCROW wallet, not treasury)
- [ ] Fee calculation is correct (2.5% creation fee)
- [ ] Memo format is correct

### 2.4 Verify Deposit
- [ ] `POST /api/bounties/{id}/deposit` verifies real transaction signatures
- [ ] Rejects invalid/fake signatures
- [ ] Updates bounty status after verified deposit
- [ ] Records transaction in database

### 2.5 Get Single Bounty
- [ ] `GET /api/bounties/{id}` returns full bounty details
- [ ] Includes submissions if any
- [ ] Returns 404 for non-existent bounties

---

## 3. Hunter Flow

### 3.1 Browse & Discover
- [ ] Open bounties visible without auth
- [ ] Urgency badges display correctly (🔥 Ending soon, ⚡ Just posted, 💎 High reward)
- [ ] Difficulty levels display correctly
- [ ] Tags are filterable

### 3.2 Wallet Authentication
- [ ] `GET /api/auth/challenge?wallet=X` returns challenge message
- [ ] Challenge includes wallet address and timestamp
- [ ] Challenge expires appropriately

### 3.3 Claim Bounty
- [ ] `POST /api/bounties/{id}/claim` requires valid wallet signature
- [ ] Updates bounty status to "claimed"
- [ ] Records hunter_wallet
- [ ] Prevents double-claiming
- [ ] Prevents claiming own bounty

### 3.4 Submit Solution
- [ ] `POST /api/bounties/{id}/submit` accepts submission with evidence
- [ ] Requires valid auth (hunter who claimed)
- [ ] Updates bounty status to "submitted"
- [ ] Records submission timestamp

---

## 4. Resolution Flow

### 4.1 AI Resolver
- [ ] `POST /api/admin/resolve` triggers AI evaluation
- [ ] Resolver correctly parses submission evidence
- [ ] Returns approve/reject/partial decision
- [ ] Payout percentage is reasonable (0-100%)

### 4.2 Payout Execution
- [ ] On approval, SOL transfers from escrow to hunter wallet
- [ ] Fee (2.5% payout) transfers from escrow to treasury
- [ ] Transaction signatures are recorded
- [ ] Bounty status updates to "resolved"

### 4.3 Rejection Flow
- [ ] On rejection, bounty returns to "open" or "disputed" status
- [ ] Hunter can resubmit (if allowed)
- [ ] Rejection reason is recorded

---

## 5. Escrow & Payment Mechanics

### 5.1 Deposit Verification
- [ ] Verify real SOL deposits to escrow wallet
- [ ] Verify USDC deposits (if supported)
- [ ] Reject deposits to wrong wallet
- [ ] Handle edge cases (multiple deposits, partial deposits)

### 5.2 Payout Mechanics
- [ ] Hunter receives 95% of bounty (after both fees)
- [ ] Calculation: `bounty * (1 - 0.025) * (1 - 0.025)` = 95.0625% to hunter
- [ ] Or simpler: `bounty * 0.95` if fees are combined
- [ ] Treasury receives 5% total

### 5.3 Refund Flow
- [ ] Expired unclaimed bounties can be refunded
- [ ] Refund goes to original poster
- [ ] Creation fee (2.5%) is non-refundable
- [ ] Refund transaction recorded

### 5.4 Wallet Balance Checks
- [ ] `GET /api/escrow/balance` (if exists) returns current escrow balance
- [ ] Escrow has sufficient funds before payout

---

## 6. Reputation & Leaderboard

### 6.1 Reputation Tracking
- [ ] Hunter reputation increases on successful completion
- [ ] Reputation tracks: completed bounties, total earned, success rate
- [ ] Badges awarded correctly (Newcomer, Pro Hunter, etc.)

### 6.2 Leaderboard
- [ ] `GET /api/leaderboard` returns ranked hunters
- [ ] Rankings based on total earnings or completions
- [ ] Pagination works

---

## 7. Edge Cases & Error Handling

### 7.1 Expired Bounties
- [ ] Bounties past deadline cannot be claimed
- [ ] Expired bounties show appropriate status
- [ ] Poster can request refund for expired unclaimed bounties

### 7.2 Invalid Inputs
- [ ] SQL injection attempts blocked
- [ ] XSS in question/description sanitized
- [ ] Wallet address validation
- [ ] Amount validation (no negative, no overflow)

### 7.3 Race Conditions
- [ ] Two hunters claiming same bounty simultaneously
- [ ] Multiple submissions for same bounty
- [ ] Double-spend on deposits

### 7.4 Network Errors
- [ ] Graceful handling of Solana RPC failures
- [ ] Retry logic for transaction confirmation
- [ ] Timeout handling

---

## 8. Frontend Integration (if applicable)

### 8.1 Home Page
- [ ] Bounty list loads
- [ ] Activity feed shows recent activity
- [ ] Stats display correctly

### 8.2 Wallet Connection
- [ ] Phantom/Solflare connection works
- [ ] Wallet address displays correctly
- [ ] Disconnect works

### 8.3 Create Bounty UI
- [ ] Form validation works
- [ ] Deposit flow is clear
- [ ] Success/error states display

### 8.4 Hunter UI
- [ ] Claim button works
- [ ] Submit form works
- [ ] Status updates in real-time

---

## 9. Security Audit

### 9.1 Authentication
- [ ] Wallet signatures verified correctly
- [ ] No auth bypass vulnerabilities
- [ ] Admin endpoints protected

### 9.2 Rate Limiting
- [ ] API rate limits in place
- [ ] Prevents spam bounty creation
- [ ] Prevents claim/submit flooding

### 9.3 Secret Management
- [ ] ESCROW_PRIVATE_KEY not exposed
- [ ] ADMIN_SECRET not exposed
- [ ] RESOLVER_SECRET properly validated

---

## 10. Performance

### 10.1 Response Times
- [ ] API responses < 500ms average
- [ ] Database queries optimized
- [ ] No N+1 queries

### 10.2 Load Testing
- [ ] Handles 100 concurrent requests
- [ ] No memory leaks
- [ ] Connection pooling works

---

## Test Execution Notes

**For each test:**
1. Document the request/response
2. Note any errors or unexpected behavior
3. Verify database state changes
4. Check transaction records on Solscan

**Priority:**
- P0: Payment flows (deposits, payouts, fees)
- P1: Core CRUD (create, read, update bounties)
- P2: Auth flows
- P3: Edge cases
- P4: Performance

---

## Discovered Issues Log

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | High | Deposit instructions pointed to treasury instead of escrow | Fixed (pending deploy) |
| | | | |

