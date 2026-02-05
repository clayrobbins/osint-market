/**
 * AgentDEX Integration for OSINT.market
 *
 * Enables bounty hunters to swap their earnings (SOL ↔ USDC) via the AgentDEX
 * API — an agent-first DEX on Solana powered by Jupiter V6 routing.
 *
 * AgentDEX repo: https://github.com/solana-clawd/agent-dex
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AGENTDEX_BASE_URL =
  process.env.AGENTDEX_API_URL ?? "https://agentdex.solana-clawd.com/api/v1";

/** Well-known Solana token mints */
export const MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

export type SupportedToken = keyof typeof MINTS;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: number;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface SwapResult {
  txSignature: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  fee: string;
  timestamp: string;
}

export interface TokenPrice {
  mint: string;
  priceUsd: number;
  symbol?: string;
  updatedAt: string;
}

export interface AgentDexError {
  error: string;
  message: string;
  statusCode: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function agentFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${AGENTDEX_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as AgentDexError | null;
    throw new Error(
      body?.message ?? `AgentDEX request failed: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<T>;
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

/**
 * Resolve a human-readable token symbol to its mint address.
 * Falls back to treating the input as a raw mint address.
 */
export function resolveMint(tokenOrMint: string): string {
  const upper = tokenOrMint.toUpperCase() as SupportedToken;
  return MINTS[upper] ?? tokenOrMint;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a swap quote from AgentDEX.
 *
 * @param inputMint  - Input token mint address (or symbol like "SOL")
 * @param outputMint - Output token mint address (or symbol like "USDC")
 * @param amount     - Amount in the input token's smallest unit (lamports / base units)
 * @param slippageBps - Maximum slippage in basis points (default 50 = 0.5%)
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps = 50
): Promise<SwapQuote> {
  const params = new URLSearchParams({
    inputMint: resolveMint(inputMint),
    outputMint: resolveMint(outputMint),
    amount,
    slippageBps: String(slippageBps),
  });

  return agentFetch<SwapQuote>(`/quote?${params}`);
}

/**
 * Execute a swap via AgentDEX.
 *
 * Requires a valid AgentDEX API key (obtained via agent registration).
 *
 * @param apiKey     - AgentDEX Bearer token (`adx_...`)
 * @param inputMint  - Input token mint address (or symbol)
 * @param outputMint - Output token mint address (or symbol)
 * @param amount     - Amount in the input token's smallest unit
 * @param slippageBps - Maximum slippage in basis points (default 50)
 */
export async function executeSwap(
  apiKey: string,
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps = 50
): Promise<SwapResult> {
  return agentFetch<SwapResult>("/swap", {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      inputMint: resolveMint(inputMint),
      outputMint: resolveMint(outputMint),
      amount,
      slippageBps,
    }),
  });
}

/**
 * Fetch the current USD price for one or more token mints.
 *
 * @param mints - One or more mint addresses (or symbols like "SOL", "USDC")
 * @returns Array of prices keyed by mint address
 */
export async function getTokenPrices(
  ...mints: string[]
): Promise<TokenPrice[]> {
  const resolved = mints.map(resolveMint);

  if (resolved.length === 1) {
    const price = await agentFetch<TokenPrice>(`/prices/${resolved[0]}`);
    return [price];
  }

  return agentFetch<TokenPrice[]>(`/prices?mints=${resolved.join(",")}`);
}

/**
 * Convenience: convert a bounty payout amount from one token to another.
 *
 * Returns the quote so the caller can confirm before executing.
 *
 * @param fromToken  - Source token symbol ("SOL" | "USDC") or mint
 * @param toToken    - Destination token symbol or mint
 * @param amount     - Amount in base units (lamports for SOL, 1e6 units for USDC)
 */
export async function quoteBountyConversion(
  fromToken: string,
  toToken: string,
  amount: string
): Promise<{ quote: SwapQuote; estimatedOutput: string; priceImpact: number }> {
  const quote = await getSwapQuote(fromToken, toToken, amount);

  return {
    quote,
    estimatedOutput: quote.outAmount,
    priceImpact: quote.priceImpactPct,
  };
}
