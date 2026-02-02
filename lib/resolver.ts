/**
 * Resolver Agent - Evaluates bounty submissions
 * 
 * This module contains the logic for the objective resolver that determines
 * if a bounty submission meets the criteria for payout.
 */

import type { Bounty, Submission, Resolution } from './types';

interface EvaluationCriteria {
  // Does the answer directly address the bounty question?
  answers_question: boolean;
  // Is there at least one verifiable piece of evidence?
  has_evidence: boolean;
  // Does the evidence support the answer?
  evidence_supports_answer: boolean;
  // Is the methodology reasonable?
  methodology_valid: boolean;
  // Confidence assessment (our assessment, not theirs)
  our_confidence: number;
}

interface EvaluationResult {
  approved: boolean;
  criteria: EvaluationCriteria;
  reasoning: string;
}

/**
 * Build the evaluation prompt for Claude
 */
export function buildEvaluationPrompt(bounty: Bounty, submission: Submission): string {
  return `You are an objective resolver for an OSINT bounty marketplace. Your job is to evaluate if a submission meets the bounty requirements.

## BOUNTY
Question: ${bounty.question}
${bounty.description ? `Description: ${bounty.description}` : ''}
Difficulty: ${bounty.difficulty}
Tags: ${bounty.tags.join(', ')}

## SUBMISSION
Answer: ${submission.answer}

Evidence:
${submission.evidence.map((e, i) => `${i + 1}. [${e.type}] ${e.content}${e.note ? ` — Note: ${e.note}` : ''}`).join('\n')}

Methodology: ${submission.methodology}

Submitter's Confidence: ${submission.confidence}%

## YOUR TASK
Evaluate this submission objectively. Consider:

1. **Answers Question**: Does the answer directly address what was asked?
2. **Has Evidence**: Is there at least one piece of verifiable evidence?
3. **Evidence Quality**: Does the evidence actually support the claimed answer?
4. **Methodology**: Is the described methodology reasonable for OSINT research?
5. **Verification**: Could someone else verify this answer using the provided evidence?

## RULES
- You are OBJECTIVE. Don't favor approval or rejection.
- Partial answers can be accepted if they substantially address the question.
- Evidence doesn't need to be perfect, but must be relevant and verifiable.
- If the answer is correct but evidence is weak, you may still approve with caveats.
- If the answer seems fabricated or evidence doesn't support it, REJECT.

## OUTPUT FORMAT
Respond with JSON only:
{
  "approved": true/false,
  "criteria": {
    "answers_question": true/false,
    "has_evidence": true/false,
    "evidence_supports_answer": true/false,
    "methodology_valid": true/false,
    "our_confidence": 0-100
  },
  "reasoning": "2-3 sentence explanation of your decision"
}`;
}

/**
 * Parse Claude's evaluation response
 */
export function parseEvaluationResponse(response: string): EvaluationResult | null {
  try {
    // Extract JSON from response (in case of markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (typeof parsed.approved !== 'boolean') return null;
    if (typeof parsed.reasoning !== 'string') return null;
    
    return parsed as EvaluationResult;
  } catch {
    return null;
  }
}

/**
 * Main resolver function - to be called when a submission is received
 * 
 * In production, this would:
 * 1. Fetch bounty and submission from database
 * 2. Call Claude API with evaluation prompt
 * 3. Parse response
 * 4. Update bounty status
 * 5. Trigger payment release via mcpay if approved
 */
export async function resolveSubmission(
  bountyId: string,
  // These would come from database in production
  bounty: Bounty,
  submission: Submission,
  // Claude API call function (injected for testability)
  callClaude: (prompt: string) => Promise<string>
): Promise<Resolution> {
  const prompt = buildEvaluationPrompt(bounty, submission);
  const response = await callClaude(prompt);
  const result = parseEvaluationResponse(response);
  
  if (!result) {
    // Fallback to manual review if parsing fails
    return {
      status: 'rejected',
      reasoning: 'Resolver could not evaluate submission. Flagged for manual review.',
      resolved_at: new Date().toISOString(),
      resolver_id: 'resolver-v1-error',
    };
  }
  
  return {
    status: result.approved ? 'approved' : 'rejected',
    reasoning: result.reasoning,
    resolved_at: new Date().toISOString(),
    resolver_id: 'resolver-v1',
    // payment_tx would be set after escrow release
  };
}

/**
 * Example usage:
 * 
 * const resolution = await resolveSubmission(
 *   'bounty-123',
 *   bountyFromDb,
 *   submissionFromDb,
 *   async (prompt) => {
 *     const response = await anthropic.messages.create({
 *       model: 'claude-3-5-sonnet-20241022',
 *       max_tokens: 1024,
 *       messages: [{ role: 'user', content: prompt }],
 *     });
 *     return response.content[0].text;
 *   }
 * );
 * 
 * if (resolution.status === 'approved') {
 *   const tx = await mcpay.releaseEscrow(bounty.id, submission.agent_wallet);
 *   resolution.payment_tx = tx;
 * }
 */
