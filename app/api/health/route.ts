import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDb, getDb } from '@/lib/db';

let dbInitialized = false;

export async function GET() {
  const checks: Record<string, boolean> = {
    api: true,
    database: false,
  };
  
  try {
    if (!dbInitialized) {
      await initDb();
      dbInitialized = true;
    }
    
    // Test database connection
    const db = getDb();
    await db.execute({ sql: 'SELECT 1', args: [] });
    checks.database = true;
  } catch (error) {
    console.error('Health check failed:', error);
  }
  
  const healthy = Object.values(checks).every(v => v);
  
  return NextResponse.json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }, {
    status: healthy ? 200 : 503,
  });
}
