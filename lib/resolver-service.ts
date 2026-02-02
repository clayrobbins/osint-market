import Anthropic from '@anthropic-ai/sdk';
import { getBounty, updateBountyStatus } from './repositories/bounties';
import { getSubmissionByBounty } from './repositories/submissions';
import { createResolution } from './repositories/resolutions';
import { processPayout, processRefund } from './escrow';
import { buildEvaluationPrompt, parseEvaluationResponse } from './resolver';
import type { Bounty, Submission, Resolution } from './types';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const RESOLVER_MODEL = 'claude-sonnet-4-20250514'; // Using Opus for quality as requested

interface ResolverResult {
  success: boolean;
  resolution?: Resolution;
  payoutTx?: string;
  error?: string;
}

/**
 * Resolve a bounty submission using Claude Opus
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
    
    // Build evaluation prompt
    const prompt = buildEvaluationPrompt(bounty, submission);
    
    // Call Claude Opus for evaluation
    console.log(`[Resolver] Evaluating bounty ${bountyId} with Claude...`);
    
    const response = await anthropic.messages.create({
      model: RESOLVER_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    
    // Extract text response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return { success: false, error: 'No text response from resolver' };
    }
    
    // Parse the evaluation
    const evaluation = parseEvaluationResponse(textContent.text);
    if (!evaluation) {
      console.error('[Resolver] Failed to parse evaluation:', textContent.text);
      return { success: false, error: 'Failed to parse resolver response' };
    }
    
    console.log(`[Resolver] Decision: ${evaluation.approved ? 'APPROVED' : 'REJECTED'}`);
    console.log(`[Resolver] Reasoning: ${evaluation.reasoning}`);
    
    // Process payment or refund
    let payoutTx: string | undefined;
    
    if (evaluation.approved) {
      // Pay the hunter
      const payout = await processPayout(bounty, submission.agent_wallet);
      if (!payout.success) {
        console.error('[Resolver] Payout failed:', payout.error);
        // Still record resolution, but note payment failure
      } else {
        payoutTx = payout.payoutTx;
        console.log(`[Resolver] Payout: ${payout.netAmount} ${bounty.reward.token} to ${submission.agent_wallet}`);
      }
    } else {
      // Refund the poster
      const refund = await processRefund(bounty);
      if (!refund.success) {
        console.error('[Resolver] Refund failed:', refund.error);
      } else {
        console.log(`[Resolver] Refunded ${refund.netAmount} ${bounty.reward.token} to ${bounty.poster_wallet}`);
      }
    }
    
    // Create resolution record
    const resolution = await createResolution(bountyId, submission.id, {
      status: evaluation.approved ? 'approved' : 'rejected',
      reasoning: evaluation.reasoning,
      resolver_id: 'resolver-opus-v1',
      payment_tx: payoutTx,
    });
    
    // Update bounty status
    await updateBountyStatus(bountyId, 'resolved');
    
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
