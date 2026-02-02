import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDb } from '@/lib/db';
import { triggerResolution } from '@/lib/resolver-service';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

// Secret for admin access
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-admin-secret';

/**
 * Manually trigger resolution for a bounty
 * Used for testing or admin intervention
 */
export async function POST(request: NextRequest) {
  await ensureDb();
  
  try {
    const body = await request.json();
    
    // Verify admin access
    if (body.admin_secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!body.bounty_id) {
      return NextResponse.json({ error: 'bounty_id is required' }, { status: 400 });
    }
    
    console.log(`[Admin] Triggering resolution for ${body.bounty_id}`);
    
    const result = await triggerResolution(body.bounty_id);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Resolution failed' 
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      bounty_id: body.bounty_id,
      resolution: result.resolution,
      payment_tx: result.payoutTx,
    });
    
  } catch (error: any) {
    console.error('Resolver trigger error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
