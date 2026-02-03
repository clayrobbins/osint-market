#!/usr/bin/env npx ts-node
/**
 * Cleanup test bounties from the database
 * Run with: npx ts-node scripts/cleanup-test-data.ts
 * 
 * Or via API:
 * curl -X POST https://osint-market-production.up.railway.app/api/admin \
 *   -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
 *   -H "Content-Type: application/json" \
 *   -d '{"action":"bulk-delete","bounty_ids":["bounty_ml72nnsmpz9ni5","bounty_ml72no59i3s2qj"]}'
 */

const TEST_BOUNTY_IDS = [
  'bounty_ml72nnsmpz9ni5', // Minimal payload test
  'bounty_ml72no59i3s2qj', // Long question test
  'bounty_ml72noe8xl1j25', // Unicode/XSS test
  'bounty_ml72o0nu3431xj', // Tags test
  'bounty_ml72oc7l7lxhru', // Identity/verification tags
  'bounty_ml72om3hcl4tgc', // Invalid token (ETH) test
];

async function cleanupTestData() {
  const apiUrl = process.env.API_URL || 'https://osint-market-production.up.railway.app';
  const adminSecret = process.env.ADMIN_SECRET;
  
  if (!adminSecret) {
    console.error('Set ADMIN_SECRET environment variable');
    process.exit(1);
  }
  
  console.log(`Cleaning up ${TEST_BOUNTY_IDS.length} test bounties...`);
  
  const response = await fetch(`${apiUrl}/api/admin`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'bulk-delete',
      bounty_ids: TEST_BOUNTY_IDS,
    }),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('Failed:', result.error);
    process.exit(1);
  }
  
  console.log('✅', result.message);
}

cleanupTestData().catch(console.error);
