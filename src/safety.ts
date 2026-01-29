import type { SwapRequest, QuoteResult, SwapResult } from './types.js';
import { isFeeCovered } from './feeCalculator.js';

export interface SafetyChecks {
  /** safety margin for fee coverage (e.g. 0.1) */
  safetyMargin: number;
  /** max allowed slippage (e.g. 0.05 = 5%) */
  maxSlippageTolerance?: number;
}

/**
 * Validate quote and request before execution.
 * Ensures fee fully covers sponsor costs and prevents accidental SOL gifts.
 */
export function validateQuoteAndRequest(
  req: SwapRequest,
  quote: QuoteResult,
  opts: SafetyChecks
): { ok: true } | { ok: false; error: string } {
  if (!quote.routeAvailable) {
    return { ok: false, error: 'Route not available or insufficient liquidity' };
  }

  if (!isFeeCovered(quote, opts.safetyMargin)) {
    return {
      ok: false,
      error: `User fee ${quote.userFee} does not cover sponsor cost ${quote.sponsorCost} + safety margin`,
    };
  }

  const slippage = req.slippageTolerance ?? 0;
  const maxSlippage = opts.maxSlippageTolerance ?? 0.5;
  if (slippage > maxSlippage) {
    return {
      ok: false,
      error: `Slippage tolerance ${slippage} exceeds maximum ${maxSlippage}`,
    };
  }

  if (req.amount <= 0) {
    return { ok: false, error: 'Amount must be positive' };
  }

  return { ok: true };
}

/**
 * Ensure we never record success when sponsor would lose.
 * Use after bridge execution to double-check economics.
 */
export function assertSponsorSafe(
  result: SwapResult,
  quote: QuoteResult,
  safetyMargin: number
): void {
  if (!result.success) return;
  if (result.sponsorCost != null && result.userFee != null) {
    const required = result.sponsorCost * (1 + safetyMargin);
    if (result.userFee < required - 1e-9) {
      throw new Error(
        `Audit violation: userFee ${result.userFee} < required ${required}`
      );
    }
  }
}
