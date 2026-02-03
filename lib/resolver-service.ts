import Anthropic from '@anthropic-ai/sdk';
import { getBounty, updateBountyStatus } from './repositories/bounties';
import { getSubmissionByBounty } from './repositories/submissions';
import { createResolution } from './repositories/resolutions';
import { processPayout, processRefund } from './escrow';
import { buildEvaluationPrompt, parseEvaluationResponse, RESOLVER_SYSTEM_PROMPT } from './resolver';
import { recordSuccess, recordFailure } from './reputation';
import type { Bounty, Submission, Resolution } from './types';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const RESOLVER_MODEL = 'claude-sonnet-4-20250514';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Claude with retry logic and exponential backoff
 */
async function callClaudeWithRetry(prompt: string): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: RESOLVER_MODEL,
        max_tokens: 1024,
        temperature: 0, // Deterministic responses
        system: RESOLVER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });
      
      const textContent = response.content.find(c => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        return textContent.text;
      }
      console.error(`[Resolver] Attempt ${attempt + 1}: No text in response`);
    } catch (error: any) {
      console.error(`[Resolver] Attempt ${attempt + 1} failed:`, error.message);
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(`[Resolver] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  return null;
}

interface ResolverResult {
  success: boolean;
  resolution?: Resolution;
  payoutTx?: string;
  error?: string;
}

/**
 * Resolve a bounty submission using Claude with retry logic
 */
export async function resolveSubmission(bountyId: string): Promise<ResolverResult> {
  try {
    // Get bounty and submission
    const bounty = await getBounty(bountyId);
    if (!bounty) {
      return { success: false, error: 'Bounty not found' };
    }
    
    if (bounty.status !== 'submitted') {
      return { success: false, error: 'Bounty is not in submitted status' };
    }
    
    const submission = await getSubmissionByBounty(bountyId);
    if (!submission) {
      return { success: false, error: 'No submission found' };
    }
    
    // Build evaluation prompt (now uses sanitized inputs)
    const prompt = buildEvaluationPrompt(bounty, submission);
    
    // Call Claude with retry logic
    console.log(`[Resolver] Evaluating bounty ${bountyId} with Claude (max ${MAX_RETRIES} attempts)...`);
    
    const responseText = await callClaudeWithRetry(prompt);
    if (!responseText) {
      console.error('[Resolver] All retry attempts failed');
      return { success: false, error: 'Resolver API unavailable after retries. Queued for manual review.' };
    }
    
    // Parse the evaluation with lenient matching
    let evaluation = parseEvaluationResponse(responseText);
    
    // If parsing fails, try asking Claude to fix the JSON
    if (!evaluation) {
      console.log('[Resolver] First parse failed, asking for JSON fix...');
      const fixPrompt = `Your previous response was not valid JSON. Please respond with ONLY valid JSON in this format:
{"approved": true/false, "criteria": {...}, "reasoning": "..."}

Your original response was: ${responseText.slice(0, 500)}`;
      
      const fixedResponse = await callClaudeWithRetry(fixPrompt);
      if (fixedResponse) {
        evaluation = parseEvaluationResponse(fixedResponse);
      }
    }
    
    if (!evaluation) {
      console.error('[Resolver] Failed to parse evaluation after retry:', responseText);
      return { success: false, error: 'Failed to parse resolver response. Queued for manual review.' };
    }
    
    console.log(`[Resolver] Decision: ${evaluation.approved ? 'APPROVED' : 'REJECTED'}`);
    console.log(`[Resolver] Reasoning: ${evaluation.reasoning}`);
    
    // ATOMIC: Process payment BEFORE recording resolution
    let payoutTx: string | undefined;
    
    if (evaluation.approved) {
      // Pay the hunter - MUST succeed before we record approval
      const payout = await processPayout(bounty, submission.agent_wallet);
      if (!payout.success) {
        console.error('[Resolver] Payout failed:', payout.error);
        // DO NOT record as approved if payment failed
        return { 
          success: false, 
          error: `Approved but payment failed: ${payout.error}. Will retry.` 
        };
      }
      payoutTx = payout.payoutTx;
      console.log(`[Resolver] Payout: ${payout.netAmount} ${bounty.reward.token} to ${submission.agent_wallet}`);
    } else {
      // Refund the poster
      const refund = await processRefund(bounty);
      if (!refund.success) {
        console.error('[Resolver] Refund failed:', refund.error);
        // Rejection can proceed even if refund fails (funds stay in escrow)
      } else {
        console.log(`[Resolver] Refunded ${refund.netAmount} ${bounty.reward.token} to ${bounty.poster_wallet}`);
      }
    }
    
    // NOW record resolution (after payment confirmed for approvals)
    const resolution = await createResolution(bountyId, submission.id, {
      status: evaluation.approved ? 'approved' : 'rejected',
      reasoning: evaluation.reasoning,
      resolver_id: 'resolver-v2', // Updated version
      payment_tx: payoutTx,
    });
    
    // Update bounty status
    await updateBountyStatus(bountyId, 'resolved');
    
    // Update hunter reputation (non-blocking)
    try {
      if (evaluation.approved) {
        const claimedAt = new Date(bounty.claimed_at || bounty.created_at).getTime();
        const completionTimeMs = Date.now() - claimedAt;
        
        const newBadges = await recordSuccess(
          submission.agent_wallet,
          bountyId,
          bounty.reward.amount,
          completionTimeMs
        );
        
        if (newBadges.length > 0) {
          console.log(`[Resolver] New badges awarded to ${submission.agent_wallet}:`, newBadges);
        }
      } else {
        await recordFailure(submission.agent_wallet);
      }
    } catch (repError) {
      console.error('[Resolver] Failed to update reputation:', repError);
      // Don't fail the resolution if reputation update fails
    }
    
    return {
      success: true,
      resolution,
      payoutTx,
    };
    
  } catch (error: any) {
    console.error('[Resolver] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Queue a bounty for resolution (async processing)
 * In production, this would use a proper job queue
 */
export async function queueForResolution(bountyId: string): Promise<void> {
  // For hackathon, just resolve immediately in background
  // In production, use Bull/BullMQ, SQS, etc.
  setTimeout(async () => {
    console.log(`[Resolver] Processing queued bounty ${bountyId}`);
    const result = await resolveSubmission(bountyId);
    if (!result.success) {
      console.error(`[Resolver] Failed to resolve ${bountyId}:`, result.error);
    }
  }, 1000); // Small delay to let the HTTP response complete
}

/**
 * Manual resolution trigger (for testing/admin)
 */
export async function triggerResolution(bountyId: string): Promise<ResolverResult> {
  return resolveSubmission(bountyId);
}
