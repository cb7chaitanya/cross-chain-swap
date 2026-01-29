import type { SwapRequest, SwapResult, QuoteResult } from '../types.js';

/**
 * Bridge-agnostic interface.
 * Implementation: RelayBridge.
 */
export interface IBridge {
  readonly name: string;

  /** Execute cross-chain swap. */
  executeSwap(req: SwapRequest): Promise<SwapResult>;

  /** Check route availability and get quote (liquidity, expected output, fees). */
  getQuote(req: SwapRequest): Promise<QuoteResult>;
}
