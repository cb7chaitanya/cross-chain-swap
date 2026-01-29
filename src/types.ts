/**
 * Core types for Solana (SVM) → EVM cross-chain swap.
 * Origin: Solana (SPL/Token-2022). Destination: EVM (e.g. Base).
 * Sponsor pays Solana costs; user fee in input token covers sponsor cost + margin.
 */

export interface SwapRequest {
  /** Origin chain: Solana (use "solana" or bridge-specific chain ID). */
  fromChain: string;
  /** Destination chain: EVM (e.g. "8453" Base, "42161" Arbitrum). */
  toChain: string;
  /** Input token: SPL mint address (Solana) or bridge-specific currency id. */
  fromToken: string;
  /** Output token: EVM address (e.g. 0x... for USDC on Base). */
  toToken: string;
  /** Amount in input token (SPL) human units. */
  amount: number;
  /** User/depositor wallet on origin chain (e.g. Solana base58 for Solana → EVM). */
  userAddress: string;
  /** Optional: recipient on destination chain (e.g. EVM 0x... when destination is Base). */
  recipient?: string;
  /** Optional: max slippage (e.g. 0.01 = 1%); used for quote drift / volatility. */
  slippageTolerance?: number;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
  /** Fee charged to user in the **input token** (SPL). Must cover sponsor cost + margin. */
  userFee?: number;
  /** Sponsor cost (Solana-side costs, in input-token equivalent for audit). */
  sponsorCost?: number;
}

export interface QuoteResult {
  routeAvailable: boolean;
  /** Expected output amount on destination chain (after fees, before slippage). */
  expectedOutput: number;
  /** Fee to charge user in the **input token** (SPL). Ensures user_fee >= sponsor_cost + safety_margin. */
  userFee: number;
  /** Sponsor cost (Solana gas/rent, in input-token terms). Sponsor never has net loss when fee >= this + margin. */
  sponsorCost: number;
  error?: string;
}

export type TokenStandard = 'SPL' | 'Token-2022';

export interface AuditLogEntry {
  ts: string;
  action: string;
  request: Partial<SwapRequest>;
  result?: Partial<SwapResult>;
  fee?: number;
  sponsorCost?: number;
  [k: string]: unknown;
}
