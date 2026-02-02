import { getDb, generateId } from '../db';
import type { Submission, Evidence, SubmitRequest } from '../types';

export interface SubmissionRow {
  id: string;
  bounty_id: string;
  agent_wallet: string;
  answer: string;
  evidence: string;
  methodology: string;
  confidence: number;
  submitted_at: string;
}

function rowToSubmission(row: SubmissionRow): Submission {
  return {
    answer: row.answer,
    evidence: JSON.parse(row.evidence) as Evidence[],
    methodology: row.methodology,
    confidence: row.confidence,
    submitted_at: row.submitted_at,
    agent_wallet: row.agent_wallet,
  };
}

export async function createSubmission(
  bountyId: string,
  agentWallet: string,
  data: SubmitRequest
): Promise<{ id: string; submission: Submission }> {
  const db = getDb();
  const id = generateId('sub');
  const now = new Date().toISOString();
  
  await db.execute({
    sql: `INSERT INTO submissions (
      id, bounty_id, agent_wallet, answer, evidence, methodology, confidence, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      bountyId,
      agentWallet,
      data.answer,
      JSON.stringify(data.evidence),
      data.methodology,
      data.confidence,
      now,
    ],
  });
  
  const submission: Submission = {
    answer: data.answer,
    evidence: data.evidence,
    methodology: data.methodology,
    confidence: data.confidence,
    submitted_at: now,
    agent_wallet: agentWallet,
  };
  
  return { id, submission };
}

export async function getSubmission(id: string): Promise<(Submission & { id: string; bounty_id: string }) | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM submissions WHERE id = ?',
    args: [id],
  });
  
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as unknown as SubmissionRow;
  return {
    id: row.id,
    bounty_id: row.bounty_id,
    ...rowToSubmission(row),
  };
}

export async function getSubmissionByBounty(bountyId: string): Promise<(Submission & { id: string }) | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM submissions WHERE bounty_id = ? ORDER BY submitted_at DESC LIMIT 1',
    args: [bountyId],
  });
  
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as unknown as SubmissionRow;
  return {
    id: row.id,
    ...rowToSubmission(row),
  };
}
