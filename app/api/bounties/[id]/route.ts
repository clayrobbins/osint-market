import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getBounty } from '@/lib/repositories/bounties';
import { getSubmissionByBounty } from '@/lib/repositories/submissions';
import { getResolutionByBounty } from '@/lib/repositories/resolutions';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureDb();
  const { id } = params;

  const bounty = await getBounty(id);
  
  if (!bounty) {
    return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
  }
  
  // Include submission and resolution if they exist
  const submission = await getSubmissionByBounty(id);
  const resolution = await getResolutionByBounty(id);
  
  return NextResponse.json({
    ...bounty,
    submission: submission || undefined,
    resolution: resolution || undefined,
  });
}
