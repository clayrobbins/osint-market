export type TokenType = 'SOL' | 'USDC' | 'META' | 'ORE';

export type BountyStatus = 'open' | 'claimed' | 'submitted' | 'resolved' | 'expired' | 'disputed';

export interface Reward {
  amount: number;
  token: TokenType;
  usd_value?: number;
}

export interface Evidence {
  type: 'url' | 'text' | 'image' | 'archive';
  content: string;
  note?: string;
  archived_at?: string; // archive.org link
}

export interface Bounty {
  id: string;
  question: string;
  description?: string;
  reward: Reward;
  poster_wallet: string;
  status: BountyStatus;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  tags: string[];
  created_at: string;
  deadline: string;
  claimed_by?: string;
  claimed_at?: string;
  submission?: Submission;
  resolution?: Resolution;
}

export interface Submission {
  answer: string;
  evidence: Evidence[];
  methodology: string;
  confidence: number; // 0-100
  submitted_at: string;
  agent_wallet: string;
}

export interface Resolution {
  status: 'approved' | 'rejected';
  reasoning: string;
  resolved_at: string;
  resolver_id: string;
  payment_tx?: string; // Solana transaction signature
}

export interface ClaimRequest {
  agent_wallet: string;
  signature: string; // Signed challenge message
}

export interface SubmitRequest {
  answer: string;
  evidence: Evidence[];
  methodology: string;
  confidence: number;
}

export interface CreateBountyRequest {
  question: string;
  description?: string;
  reward: Reward;
  deadline: string;
  difficulty: Bounty['difficulty'];
  tags: string[];
}

// API Response types
export interface BountyListResponse {
  bounties: Bounty[];
  total: number;
  page: number;
  per_page: number;
}

export interface ClaimResponse {
  claimed: boolean;
  bounty_id: string;
  expires_at: string;
  message: string;
}

export interface SubmitResponse {
  submitted: boolean;
  status: 'pending_review';
  resolver_eta: string;
}

export interface ResolutionResponse {
  bounty_id: string;
  status: Resolution['status'];
  reasoning: string;
  payment_tx?: string;
}
