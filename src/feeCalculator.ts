import type { QuoteResult } from './types.js';

/**
 * Fee calculation: user_fee >= sponsor_cost + safety_margin
 * All amounts in same unit (e.g. USD or token).
 */
export interface FeeConfig {
  /** Multiplier on sponsor cost, e.g. 0.1 = 10% margin */
  safetyMargin: number;
  /** Minimum user fee (absolute) */
  minUserFee?: number;
}

/** Default safety margin (0.1 = 10%). Single source for Relay adapter and SwapService. */
export const DEFAULT_SAFETY_MARGIN = 0.1;
const DEFAULT_MIN_FEE = 0;

/**
 * Compute user fee so that sponsor never loses:
 *   user_fee >= sponsor_cost * (1 + safetyMargin)
 */
export function calculateFee(
  sponsorCost: number,
  safetyMargin: number = DEFAULT_SAFETY_MARGIN,
  minUserFee: number = DEFAULT_MIN_FEE
): number {
  const fee = sponsorCost * (1 + safetyMargin);
  return Math.max(fee, minUserFee);
}

/**
 * Validate that a quote's userFee covers sponsor cost with margin.
 */
export function isFeeCovered(
  quote: QuoteResult,
  safetyMargin: number = DEFAULT_SAFETY_MARGIN
): boolean {
  const required = quote.sponsorCost * (1 + safetyMargin);
  return quote.userFee >= required - 1e-9; // small float tolerance
}

/**
 * Apply slippage tolerance to expected output.
 * slippageTolerance e.g. 0.01 = 1% -> minOutput = expected * 0.99
 */
export function applySlippage(
  expectedOutput: number,
  slippageTolerance: number
): number {
  return expectedOutput * (1 - Math.max(0, Math.min(1, slippageTolerance)));
}
