export enum BetStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  VOTING = "VOTING",
  SETTLED = "SETTLED",
  DISPUTED = "DISPUTED",
  REFUNDED = "REFUNDED",
}

export enum TransactionType {
  DEPOSIT = "DEPOSIT",
  ESCROW_LOCK = "ESCROW_LOCK",
  ESCROW_RELEASE = "ESCROW_RELEASE",
  REFUND = "REFUND",
  FEE = "FEE",
}

export interface BetParticipant {
  id: string;
  userId: string;
  username: string;
  accepted: boolean | null;
  outcomeVote: string | null;
  votedAt: string | null;
}

export interface Bet {
  id: string;
  title: string;
  terms: string;
  stakeAmount: number;
  escrowAmount: number;
  status: BetStatus;
  creatorId: string;
  expiresAt: string;
  createdAt: string;
  participants: BetParticipant[];
  winnerId: string | null;
}
