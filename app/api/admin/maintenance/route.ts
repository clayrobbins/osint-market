import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { expireOldBounties, releaseExpiredClaims } from '@/lib/repositories/bounties';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-admin-secret';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function POST(request: NextRequest) {
  await ensureDb();
  
  try {
    const body = await request.json();
    
    // Verify admin secret
    if (body.admin_secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const results = {
      expired_bounties: 0,
      released_claims: 0,
      timestamp: new Date().toISOString(),
    };
    
    // Expire bounties past their deadline
    if (body.expire_bounties !== false) {
      results.expired_bounties = await expireOldBounties();
    }
    
    // Release claims that have exceeded their time limit (48h)
    if (body.release_claims !== false) {
      results.released_claims = await releaseExpiredClaims();
    }
    
    return NextResponse.json({
      success: true,
      ...results,
    });
    
  } catch (error) {
    console.error('Maintenance error:', error);
    return NextResponse.json({ error: 'Maintenance failed' }, { status: 500 });
  }
}
