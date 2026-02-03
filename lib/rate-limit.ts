/**
 * Simple in-memory rate limiter for API protection
 * For production at scale, use Redis-based solution
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  store.forEach((entry, key) => {
    if (entry.resetAt < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => store.delete(key));
}, 60000); // Clean every minute

export interface RateLimitConfig {
  windowMs: number;  // Time window in ms
  maxRequests: number;  // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  // Bounty creation - prevent spam
  'bounty-create': { windowMs: 60000, maxRequests: 5 },
  
  // Submission - prevent abuse
  'bounty-submit': { windowMs: 60000, maxRequests: 10 },
  
  // Claims - moderate limit
  'bounty-claim': { windowMs: 60000, maxRequests: 20 },
  
  // General API - generous limit
  'api-general': { windowMs: 60000, maxRequests: 100 },
  
  // Dispute - very limited
  'bounty-dispute': { windowMs: 3600000, maxRequests: 3 },
};

/**
 * Check rate limit for a given identifier and action
 */
export function checkRateLimit(
  identifier: string,  // IP address or wallet address
  action: keyof typeof DEFAULT_CONFIGS,
  config?: RateLimitConfig
): RateLimitResult {
  const cfg = config || DEFAULT_CONFIGS[action] || DEFAULT_CONFIGS['api-general'];
  const key = `${action}:${identifier}`;
  const now = Date.now();
  
  let entry = store.get(key);
  
  // Create new entry or reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + cfg.windowMs,
    };
  }
  
  entry.count++;
  store.set(key, entry);
  
  const allowed = entry.count <= cfg.maxRequests;
  const remaining = Math.max(0, cfg.maxRequests - entry.count);
  
  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    retryAfter: allowed ? undefined : Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Get identifier from request (IP or wallet)
 */
export function getIdentifier(request: Request): string {
  // Try wallet first (more reliable for web3)
  const wallet = request.headers.get('x-wallet-address');
  if (wallet) return `wallet:${wallet}`;
  
  // Fall back to IP
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') || 
             'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toString(),
    ...(result.retryAfter ? { 'Retry-After': result.retryAfter.toString() } : {}),
  };
}
