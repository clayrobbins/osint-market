/**
 * Resolver Agent - Evaluates bounty submissions
 * 
 * This module contains the logic for the objective resolver that determines
 * if a bounty submission meets the criteria for payout.
 */

import type { Bounty, Submission, Resolution } from './types';

interface EvaluationCriteria {
  // Does the answer address the bounty question (partial counts)?
  answers_question: boolean;
  // Is there any supporting evidence or reasoning?
  has_evidence: boolean;
  // Does the evidence point toward the answer?
  evidence_supports_answer: boolean;
  // Is the methodology reasonable for OSINT?
  methodology_valid: boolean;
  // Confidence assessment (our assessment, not theirs)
  our_confidence: number;
  // Payout percentage recommendation (50-100)
  payout_percent: number;
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
Evaluate this submission with a PERMISSIVE lens. We want to reward effort and actionable intelligence.

1. **Answers Question**: Does the answer address what was asked? Partial answers count!
2. **Has Evidence**: Is there ANY supporting evidence or reasoning?
3. **Evidence Quality**: Does evidence point toward the answer? Circumstantial is OK.
4. **Methodology**: Did they do reasonable OSINT work?
5. **Value Provided**: Would this info be useful to the poster?

## RULES - LEAN TOWARD APPROVAL
- **APPROVE partial answers** that provide useful leads or narrow the search
- **APPROVE circumstantial evidence** if the reasoning chain is logical
- **APPROVE speculative conclusions** if clearly labeled and well-reasoned
- **APPROVE negative findings** ("X doesn't exist" with search evidence)
- **APPROVE low-confidence submissions** if methodology was solid
- Evidence does NOT need to be perfect — good-faith effort matters
- Only REJECT if: fabricated evidence, no real work done, or completely wrong answer

## CONFIDENCE → PAYOUT MAPPING
The resolver assigns confidence which maps to payout:
- 90%+: Full payout (definitive answer with strong evidence)
- 70-89%: Full payout (solid answer, reasonable evidence)
- 50-69%: Full payout (useful leads, partial answer)
- 30-49%: Partial payout consideration (speculative but valuable)
- <30%: Reject (no useful information provided)

## BIAS TOWARD HUNTERS
When in doubt, APPROVE. Hunters took time to investigate. Reward good faith effort.
The marketplace works better when hunters feel their work is valued.

## OUTPUT FORMAT
Respond with JSON only:
{
  "approved": true/false,
  "criteria": {
    "answers_question": true/false,
    "has_evidence": true/false,
    "evidence_supports_answer": true/false,
    "methodology_valid": true/false,
    "our_confidence": 0-100,
    "payout_percent": 50-100
  },
  "reasoning": "2-3 sentence explanation of your decision"
}

Note: payout_percent should be:
- 100 for complete, well-evidenced answers
- 75-99 for solid answers with minor gaps
- 50-74 for useful partial answers or leads
- Only reject (approved=false) if truly no value provided`;
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
