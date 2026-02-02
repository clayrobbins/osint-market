#!/usr/bin/env npx ts-node
/**
 * Generate demo data for OSINT.market
 * 
 * Usage: npx ts-node scripts/demo-data.ts
 */

const API_BASE = process.env.API_URL || 'http://localhost:3000';

interface DemoBounty {
  question: string;
  description: string;
  reward: { amount: number; token: 'SOL' | 'USDC' };
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  tags: string[];
  deadlineDays: number;
}

const demoBounties: DemoBounty[] = [
  {
    question: "Find the LinkedIn profile for Twitter user @crypto_builder_anon",
    description: "This developer has been very active in crypto Twitter but remains pseudonymous. Need to verify their professional background for a potential collaboration.",
    reward: { amount: 0.5, token: 'SOL' },
    difficulty: 'medium',
    tags: ['twitter', 'linkedin', 'identity', 'developer'],
    deadlineDays: 7,
  },
  {
    question: "Verify if quantum-ventures.io is a legitimate investment firm",
    description: "Claims to have backed multiple Series A rounds in AI companies. Need verification of their portfolio, team, and registration status.",
    reward: { amount: 1.0, token: 'SOL' },
    difficulty: 'hard',
    tags: ['verification', 'vc', 'due-diligence', 'company'],
    deadlineDays: 14,
  },
  {
    question: "Find all GitHub repositories owned by email: dev@shadowtech.xyz",
    description: "Need a comprehensive list of public repositories and contributions associated with this email address.",
    reward: { amount: 0.2, token: 'SOL' },
    difficulty: 'easy',
    tags: ['github', 'email', 'developer', 'code'],
    deadlineDays: 3,
  },
  {
    question: "Identify the team behind the anonymous Discord server 'Alpha Hunters Club'",
    description: "Server has 50K+ members and runs paid signals. Need to identify the admins and their track record.",
    reward: { amount: 0.75, token: 'SOL' },
    difficulty: 'hard',
    tags: ['discord', 'identity', 'crypto', 'trading'],
    deadlineDays: 10,
  },
  {
    question: "Find the real name of Medium author 'TechInsider2024'",
    description: "Prolific tech writer with insider knowledge. Need to verify their claimed industry experience.",
    reward: { amount: 0.3, token: 'SOL' },
    difficulty: 'medium',
    tags: ['medium', 'identity', 'journalism', 'tech'],
    deadlineDays: 7,
  },
  {
    question: "Verify the educational credentials of 'Dr. Alex Chen' from Stanford AI Lab",
    description: "Claims PhD from Stanford and publications in Nature. Need verification of academic record.",
    reward: { amount: 0.4, token: 'SOL' },
    difficulty: 'medium',
    tags: ['education', 'verification', 'academia', 'ai'],
    deadlineDays: 5,
  },
  {
    question: "Find the corporate registration for 'NexGen Protocol' crypto project",
    description: "Project has raised $10M but no clear legal entity. Need to find their corporate structure and jurisdiction.",
    reward: { amount: 0.6, token: 'SOL' },
    difficulty: 'medium',
    tags: ['crypto', 'legal', 'corporate', 'verification'],
    deadlineDays: 7,
  },
  {
    question: "Identify all social media accounts linked to wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD05",
    description: "This wallet has been involved in suspicious activity. Need to trace its owner's social presence.",
    reward: { amount: 1.5, token: 'SOL' },
    difficulty: 'expert',
    tags: ['wallet', 'blockchain', 'identity', 'investigation'],
    deadlineDays: 14,
  },
  {
    question: "Find the employer of Reddit user u/insider_trader_2024",
    description: "User has been posting suspiciously accurate market predictions. Need to identify potential conflicts.",
    reward: { amount: 0.35, token: 'SOL' },
    difficulty: 'medium',
    tags: ['reddit', 'identity', 'finance', 'investigation'],
    deadlineDays: 7,
  },
  {
    question: "Verify if podcast 'Crypto Insider Daily' has disclosed sponsorships",
    description: "Podcast promotes various tokens. Need to verify if they've properly disclosed paid promotions.",
    reward: { amount: 0.25, token: 'SOL' },
    difficulty: 'easy',
    tags: ['podcast', 'disclosure', 'crypto', 'media'],
    deadlineDays: 5,
  },
];

const demoWallets = [
  'DemoWallet1A1111111111111111111111111111111',
  'DemoWallet2B2222222222222222222222222222222',
  'DemoWallet3C3333333333333333333333333333333',
  'DemoWallet4D4444444444444444444444444444444',
  'DemoWallet5E5555555555555555555555555555555',
];

async function seedDemoData() {
  console.log('🌱 Seeding demo data...\n');

  for (const bounty of demoBounties) {
    const wallet = demoWallets[Math.floor(Math.random() * demoWallets.length)];
    const deadline = new Date(Date.now() + bounty.deadlineDays * 24 * 60 * 60 * 1000).toISOString();

    try {
      const response = await fetch(`${API_BASE}/api/bounties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': wallet,
        },
        body: JSON.stringify({
          question: bounty.question,
          description: bounty.description,
          reward: bounty.reward,
          difficulty: bounty.difficulty,
          tags: bounty.tags,
          deadline,
        }),
      });

      const data = await response.json();
      
      if (data.created) {
        console.log(`✅ Created: ${bounty.question.slice(0, 50)}...`);
        console.log(`   ID: ${data.bounty_id} | ${bounty.reward.amount} ${bounty.reward.token}\n`);
      } else {
        console.log(`❌ Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error}`);
    }
  }

  console.log('\n✨ Demo data seeding complete!');
  
  // Show stats
  try {
    const stats = await fetch(`${API_BASE}/api/stats`).then(r => r.json());
    console.log('\n📊 Current stats:');
    console.log(`   Total bounties: ${stats.total_bounties}`);
    console.log(`   Value locked: ${stats.total_value_locked_sol} SOL`);
  } catch {}
}

seedDemoData().catch(console.error);
