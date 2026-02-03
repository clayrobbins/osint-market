import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDb } from '@/lib/db';
import { listSubmissions } from '@/lib/repositories/submissions';

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  await ensureDb();
  
  const searchParams = request.nextUrl.searchParams;
  const bounty_id = searchParams.get('bounty_id') || undefined;
  const agent_wallet = searchParams.get('agent_wallet') || undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const per_page = parseInt(searchParams.get('per_page') || '20');
  
  const { submissions, total } = await listSubmissions({
    bounty_id,
    agent_wallet,
    limit: per_page,
    offset: (page - 1) * per_page,
  });

  return NextResponse.json({
    submissions,
    total,
    page,
    per_page,
  });
}
