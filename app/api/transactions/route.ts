import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDb } from '@/lib/db';
import { listTransactions } from '@/lib/repositories/transactions';

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
  const wallet = searchParams.get('wallet') || undefined;
  const type = searchParams.get('type') || undefined;
  const status = searchParams.get('status') || undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const per_page = parseInt(searchParams.get('per_page') || '50');
  
  const { transactions, total } = await listTransactions({
    bounty_id,
    wallet,
    type,
    status,
    limit: per_page,
    offset: (page - 1) * per_page,
  });

  return NextResponse.json({
    transactions,
    total,
    page,
    per_page,
  });
}
