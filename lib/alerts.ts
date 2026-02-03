/**
 * Admin alerting system for critical events
 * Supports Discord and Slack webhooks
 */

type AlertLevel = 'info' | 'warning' | 'critical';

interface AlertPayload {
  level: AlertLevel;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  bountyId?: string;
  walletAddress?: string;
}

const DISCORD_WEBHOOK = process.env.DISCORD_ALERT_WEBHOOK;
const SLACK_WEBHOOK = process.env.SLACK_ALERT_WEBHOOK;

const LEVEL_COLORS: Record<AlertLevel, number> = {
  info: 0x3498db,     // Blue
  warning: 0xf39c12,  // Orange
  critical: 0xe74c3c, // Red
};

const LEVEL_EMOJI: Record<AlertLevel, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🚨',
};

/**
 * Send alert to Discord webhook
 */
async function sendDiscordAlert(payload: AlertPayload): Promise<boolean> {
  if (!DISCORD_WEBHOOK) return false;
  
  try {
    const fields = [];
    
    if (payload.bountyId) {
      fields.push({ name: 'Bounty ID', value: payload.bountyId, inline: true });
    }
    if (payload.walletAddress) {
      fields.push({ name: 'Wallet', value: `\`${payload.walletAddress}\``, inline: true });
    }
    if (payload.details) {
      for (const [key, value] of Object.entries(payload.details)) {
        fields.push({ 
          name: key, 
          value: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
          inline: false 
        });
      }
    }
    
    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `${LEVEL_EMOJI[payload.level]} ${payload.title}`,
          description: payload.message,
          color: LEVEL_COLORS[payload.level],
          fields,
          timestamp: new Date().toISOString(),
          footer: { text: 'OSINT Market Alert System' },
        }],
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Alerts] Discord webhook failed:', error);
    return false;
  }
}

/**
 * Send alert to Slack webhook
 */
async function sendSlackAlert(payload: AlertPayload): Promise<boolean> {
  if (!SLACK_WEBHOOK) return false;
  
  try {
    // Slack Block Kit format - use unknown[] to allow flexible block types
    const blocks: unknown[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${LEVEL_EMOJI[payload.level]} ${payload.title}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: payload.message },
      },
    ];
    
    if (payload.bountyId || payload.walletAddress) {
      const fields: { type: string; text: string }[] = [];
      if (payload.bountyId) {
        fields.push({ type: 'mrkdwn', text: `*Bounty ID:*\n${payload.bountyId}` });
      }
      if (payload.walletAddress) {
        fields.push({ type: 'mrkdwn', text: `*Wallet:*\n\`${payload.walletAddress}\`` });
      }
      blocks.push({ type: 'section', fields });
    }
    
    if (payload.details) {
      blocks.push({
        type: 'section',
        text: { 
          type: 'mrkdwn', 
          text: '```' + JSON.stringify(payload.details, null, 2) + '```' 
        },
      });
    }
    
    const response = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Alerts] Slack webhook failed:', error);
    return false;
  }
}

/**
 * Send alert to all configured channels
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  const results = await Promise.allSettled([
    sendDiscordAlert(payload),
    sendSlackAlert(payload),
  ]);
  
  const anySuccess = results.some(r => r.status === 'fulfilled' && r.value);
  
  if (!anySuccess && (DISCORD_WEBHOOK || SLACK_WEBHOOK)) {
    console.error('[Alerts] All alert channels failed for:', payload.title);
  }
  
  // Always log to console
  console.log(`[Alert:${payload.level}] ${payload.title}: ${payload.message}`);
}

// Convenience methods
export const alerts = {
  /**
   * Payment to hunter failed
   */
  paymentFailed: (bountyId: string, wallet: string, error: string, amount?: number) =>
    sendAlert({
      level: 'critical',
      title: 'Payment Failed',
      message: `Failed to send payout for bounty resolution. Hunter may be owed funds.`,
      bountyId,
      walletAddress: wallet,
      details: { error, amount, action: 'Manual payout required' },
    }),

  /**
   * Refund to poster failed  
   */
  refundFailed: (bountyId: string, wallet: string, error: string, amount?: number) =>
    sendAlert({
      level: 'critical',
      title: 'Refund Failed',
      message: `Failed to refund poster after bounty rejection/expiry.`,
      bountyId,
      walletAddress: wallet,
      details: { error, amount, action: 'Manual refund required' },
    }),

  /**
   * Resolver failed after all retries
   */
  resolverFailed: (bountyId: string, error: string) =>
    sendAlert({
      level: 'critical',
      title: 'Resolver Unavailable',
      message: `Claude resolver failed after all retries. Submission needs manual review.`,
      bountyId,
      details: { error, action: 'Manual review required' },
    }),

  /**
   * Dispute opened
   */
  disputeOpened: (bountyId: string, wallet: string, reason: string) =>
    sendAlert({
      level: 'warning',
      title: 'Dispute Opened',
      message: `Hunter has disputed a bounty resolution.`,
      bountyId,
      walletAddress: wallet,
      details: { reason },
    }),

  /**
   * Large bounty created (monitoring)
   */
  largeBountyCreated: (bountyId: string, wallet: string, amount: number, token: string) =>
    sendAlert({
      level: 'info',
      title: 'Large Bounty Created',
      message: `A high-value bounty was created.`,
      bountyId,
      walletAddress: wallet,
      details: { amount: `${amount} ${token}` },
    }),

  /**
   * Suspicious activity detected
   */
  suspiciousActivity: (message: string, details: Record<string, unknown>) =>
    sendAlert({
      level: 'warning',
      title: 'Suspicious Activity',
      message,
      details,
    }),
};
