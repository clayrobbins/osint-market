import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDb } from '@/lib/db';
import { getBountiesByStatus, getDisputedBounties, resolveDispute, listBounties, deleteBounty } from '@/lib/repositories/bounties';
import { listDisputes, updateDisputeStatus } from '@/lib/repositories/disputes';
import { processPayout, processRefund } from '@/lib/escrow';
import { getBounty } from '@/lib/repositories/bounties';
import { getSubmissionByBounty } from '@/lib/repositories/submissions';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

// Simple admin auth - in production use proper auth
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-change-me';

function isAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  
  const [type, token] = authHeader.split(' ');
  return type === 'Bearer' && token === ADMIN_SECRET;
}

/**
 * GET /api/admin - Get admin dashboard data
 */
export async function GET(request: NextRequest) {
  await ensureDb();
  
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get overview stats
    const statusCounts = await getBountiesByStatus();
    
    // Get disputed bounties
    const disputedBounties = await getDisputedBounties();
    
    // Get pending disputes
    const { disputes: pendingDisputes, total: disputeCount } = await listDisputes({ status: 'pending' });
    
    // Get recent bounties (for monitoring)
    const { bounties: recentBounties } = await listBounties({ 
      status: 'all', 
      limit: 10 
    });
    
    return NextResponse.json({
      stats: {
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        ...statusCounts,
      },
      disputedBounties,
      pendingDisputes,
      disputeCount,
      recentBounties,
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin - Admin actions
 * 
 * Actions:
 * - resolve-dispute: Resolve a dispute (uphold or overturn)
 * - manual-payout: Manually send payout for a bounty
 * - manual-refund: Manually send refund for a bounty
 * - delete-bounty: Delete a bounty (test data cleanup)
 */
export async function POST(request: NextRequest) {
  await ensureDb();
  
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'resolve-dispute': {
        const { dispute_id, decision, admin_notes } = body;
        
        if (!dispute_id || !decision) {
          return NextResponse.json({ error: 'Missing dispute_id or decision' }, { status: 400 });
        }
        
        if (!['upheld', 'overturned'].includes(decision)) {
          return NextResponse.json({ error: 'Decision must be "upheld" or "overturned"' }, { status: 400 });
        }
        
        // Update dispute status
        const updated = await updateDisputeStatus(dispute_id, decision, admin_notes, 'admin');
        
        if (!updated) {
          return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
        }
        
        // If overturned, need to update bounty and potentially re-process payment
        // This would require getting the dispute, finding the bounty, and processing
        // For now, just update the status
        
        return NextResponse.json({ success: true, message: `Dispute ${decision}` });
      }
      
      case 'manual-payout': {
        const { bounty_id } = body;
        
        if (!bounty_id) {
          return NextResponse.json({ error: 'Missing bounty_id' }, { status: 400 });
        }
        
        const bounty = await getBounty(bounty_id);
        if (!bounty) {
          return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
        }
        
        const submission = await getSubmissionByBounty(bounty_id);
        if (!submission) {
          return NextResponse.json({ error: 'No submission found' }, { status: 404 });
        }
        
        const payout = await processPayout(bounty, submission.agent_wallet);
        
        if (!payout.success) {
          return NextResponse.json({ error: `Payout failed: ${payout.error}` }, { status: 500 });
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Payout sent',
          tx: payout.payoutTx,
          amount: payout.netAmount,
        });
      }
      
      case 'manual-refund': {
        const { bounty_id } = body;
        
        if (!bounty_id) {
          return NextResponse.json({ error: 'Missing bounty_id' }, { status: 400 });
        }
        
        const bounty = await getBounty(bounty_id);
        if (!bounty) {
          return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
        }
        
        const refund = await processRefund(bounty);
        
        if (!refund.success) {
          return NextResponse.json({ error: `Refund failed: ${refund.error}` }, { status: 500 });
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Refund sent',
          tx: refund.payoutTx,  // processRefund returns PayoutResult with payoutTx
          amount: refund.netAmount,
        });
      }
      
      case 'delete-bounty': {
        const { bounty_id } = body;
        
        if (!bounty_id) {
          return NextResponse.json({ error: 'Missing bounty_id' }, { status: 400 });
        }
        
        const deleted = await deleteBounty(bounty_id);
        
        if (!deleted) {
          return NextResponse.json({ error: 'Bounty not found or already deleted' }, { status: 404 });
        }
        
        return NextResponse.json({ success: true, message: 'Bounty deleted' });
      }
      
      case 'bulk-delete': {
        const { bounty_ids } = body;
        
        if (!bounty_ids || !Array.isArray(bounty_ids)) {
          return NextResponse.json({ error: 'Missing or invalid bounty_ids array' }, { status: 400 });
        }
        
        let deleted = 0;
        for (const id of bounty_ids) {
          const result = await deleteBounty(id);
          if (result) deleted++;
        }
        
        return NextResponse.json({ success: true, message: `Deleted ${deleted}/${bounty_ids.length} bounties` });
      }
      
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
