# OSINT.market Pressure Test Results

**Date:** 2026-02-03  
**Base URL:** https://osint-market-production.up.railway.app  
**Tester:** Steve (QA Bot)

---

## Summary

| Category | Pass | Fail | Warning | Total |
|----------|------|------|---------|-------|
| Bounty Creation | 5 | 1 | 2 | 8 |
| Filters | 5 | 0 | 0 | 5 |
| Claim Endpoint | 3 | 0 | 1 | 4 |
| Deposit Instructions | 1 | 1 | 0 | 2 |
| Error Messages | 4 | 1 | 0 | 5 |
| Escrow Info | 2 | 0 | 0 | 2 |
| **TOTAL** | **20** | **3** | **3** | **26** |

**Pass Rate: 77%** (20/26)

---

## 1. BOUNTY CREATION

### ✅ Minimal payload (question + reward + poster_wallet)
```json
POST /api/bounties
{"question": "...", "reward": {"amount": 0.15, "token": "SOL"}, "poster_wallet": "..."}
```
- **Result:** Created successfully
- **Defaults applied:** difficulty=medium, tags=[], deadline=7 days

### ✅ Missing question → errors correctly
```json
{"error": "Question is required and must be at least 10 characters"}
```

### ✅ Reward below 0.1 SOL → errors correctly
```json
{"error": "Minimum bounty is 0.1 SOL"}
```

### ✅ Very long question (1100 chars)
- **Result:** Accepted without truncation
- Stored full question text

### ✅ Special characters / Unicode
- **Input:** `日本語テスト`, `<script>alert(1)</script>`, emojis `🔍🎯`
- **Result:** All accepted and stored

### ⚠️ XSS not sanitized
- Script tags stored verbatim in database
- **Recommendation:** Sanitize HTML entities on input or ensure proper escaping on output

### ❌ Invalid token type accepted (ETH)
```json
{"question": "...", "reward": {"amount": 0.5, "token": "ETH"}, ...}
```
- **Result:** Bounty created with ETH token
- **Expected:** Error - only SOL/USDC supported per `/api/escrow/info`
- **Impact:** Users could create bounties with unsupported tokens

### ⚠️ Negative reward → treated as below minimum
```json
{"error": "Minimum bounty is 0.1 SOL"}
```
- Works, but error message could be clearer ("amount must be positive")

---

## 2. FILTERS

### ✅ difficulty=easy
```
GET /api/bounties?difficulty=easy
```
- **Result:** Returns only easy bounties (1 found)
- No medium/hard bounties included

### ✅ difficulty=hard  
```
GET /api/bounties?difficulty=hard
```
- **Result:** Returns only hard bounties (1 found)
- No easy/medium bounties included

### ✅ difficulty=medium
```
GET /api/bounties?difficulty=medium
```
- **Result:** Returns only medium bounties (7 found)

### ✅ tags=crypto
```
GET /api/bounties?tags=crypto
```
- **Result:** Returns bounties with crypto tag (1 found)

### ✅ tags=identity,verification (multiple)
```
GET /api/bounties?tags=identity,verification
```
- **Result:** Returns bounties with ANY of the tags (OR logic)
- Found 3 bounties with identity OR verification tags

### ✅ Combined: status=open&difficulty=medium
- **Result:** Correctly filters by both criteria (7 found)

---

## 3. CLAIM ENDPOINT

### ✅ With agent_wallet field
```json
POST /api/bounties/{id}/claim
{"agent_wallet": "..."}
```
- **Result:** Wallet validation runs (gets "Invalid wallet address" error)
- Confirms field is accepted

### ✅ With hunter_wallet field
```json
{"hunter_wallet": "..."}
```
- **Result:** Wallet validation runs (gets "Invalid wallet address" error)
- Confirms field is accepted

### ✅ With neither field
```json
{"error": "Missing agent_wallet or hunter_wallet in request body"}
```
- Clear, specific error message

### ⚠️ With valid wallet format
```json
{"hunter_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"}
```
- **Result:** `{"error": "Authentication required. Include message and signature."}`
- This is correct behavior (auth required), but error gives hint about expected fields

---

## 4. DEPOSIT INSTRUCTIONS

### ✅ GET /api/escrow/deposit?bounty_id=X → CORRECT escrow wallet
```json
{
  "recipient": "EwwpAe2XkBbMAftrX9m1PEu3mEnL6Gordc49EWKRURau",
  "amount": 0.15,
  "memo": "OSINT.market bounty deposit (0.14625 net after 0.00375 fee)"
}
```
- **Escrow wallet confirmed:** `EwwpAe2XkBbMAftrX9m1PEu3mEnL6Gordc49EWKRURau` ✓

### ❌ Bounty creation response shows WRONG wallet
When bounty is created, the response includes:
```json
"deposit_instructions": {
  "recipient": "7G7co8fLDdddRNbFwPWH9gots93qB4EXPwBoshd3x2va",  // TREASURY!
  ...
}
```
- **Expected:** `EwwpAe2XkBbMAftrX9m1PEu3mEnL6Gordc49EWKRURau` (escrow)
- **Actual:** `7G7co8fLDdddRNbFwPWH9gots93qB4EXPwBoshd3x2va` (treasury)
- **Impact:** Users following create response could send to wrong wallet

---

## 5. ERROR MESSAGES

### ✅ Missing question
`"Question is required and must be at least 10 characters"`

### ✅ Reward too low
`"Minimum bounty is 0.1 SOL"`

### ✅ Missing wallet for claim
`"Missing agent_wallet or hunter_wallet in request body"`

### ✅ Bounty not found
`"Bounty not found"`

### ❌ Invalid JSON → generic error
```json
{"error": "Invalid request"}
```
- Could be more specific: "Invalid JSON body"

---

## 6. ESCROW INFO

### ✅ Treasury wallet correct
```
"treasury_wallet": "7G7co8fLDdddRNbFwPWH9gots93qB4EXPwBoshd3x2va"
```

### ✅ Fee structure correct
```json
{
  "creation_fee_percent": 2.5,
  "payout_fee_percent": 2.5,
  "total_fee_percent": 5,
  "minimum_bounty_sol": 0.1
}
```

### ✅ Example deposit shows escrow
```json
"example_deposit": {
  "recipient": "EwwpAe2XkBbMAftrX9m1PEu3mEnL6Gordc49EWKRURau"
}
```

---

## Critical Issues to Fix

### 🔴 HIGH: Bounty creation deposit_instructions shows treasury instead of escrow

**Location:** POST /api/bounties response  
**Current:** Returns treasury wallet `7G7co...` in deposit_instructions  
**Expected:** Should return escrow wallet `EwwpAe2X...`  
**Impact:** Users could send funds to wrong wallet  

### 🔴 HIGH: Invalid token types accepted

**Location:** POST /api/bounties validation  
**Current:** Accepts any token (ETH, BTC, etc.)  
**Expected:** Should only accept SOL, USDC  
**Impact:** Users create bounties with unsupported payment methods  

---

## Medium Issues

### 🟡 XSS content stored without sanitization
Script tags and HTML stored verbatim. Ensure frontend escapes properly.

### 🟡 Generic "Invalid request" for malformed JSON
Could provide more specific error.

---

## Verified Fixes from Previous Issues

| Issue | Status |
|-------|--------|
| 1. Deposit instructions pointed to treasury | ⚠️ PARTIAL - `/api/escrow/deposit` fixed, but create response still wrong |
| 2. Bounty creation failed without defaults | ✅ FIXED - defaults work |
| 3. Claim only accepted agent_wallet | ✅ FIXED - accepts hunter_wallet too |
| 4. Difficulty/tags filters didn't work | ✅ FIXED - all filters working |

---

## Test Bounties Created (cleanup needed)

| ID | Purpose |
|----|---------|
| bounty_ml72nnsmpz9ni5 | Minimal payload test |
| bounty_ml72no59i3s2qj | Long question test |
| bounty_ml72noe8xl1j25 | Unicode/XSS test |
| bounty_ml72o0nu3431xj | Tags test |
| bounty_ml72oc7l7lxhru | Identity/verification tags |
| bounty_ml72om3hcl4tgc | Invalid token (ETH) test |

---

*Generated by Steve QA Bot*
