import type { IBridge } from './bridge/IBridge.js';
import type { SwapRequest, SwapResult, QuoteResult } from './types.js';
import { validateQuoteAndRequest, assertSponsorSafe } from './safety.js';
import { applySlippage } from './feeCalculator.js';
import { auditLog } from './logger.js';

export interface SwapServiceConfig {
  safetyMargin: number;
  maxSlippageTolerance?: number;
}

const DEFAULT_CONFIG: SwapServiceConfig = {
  safetyMargin: 0.1,
  maxSlippageTolerance: 0.5,
};

/**
 * Orchestrates Solana (SVM) → EVM cross-chain swap:
 * quote -> validate (before execution) -> bridge swap -> assert sponsor safe -> audit.
 * User fee is in input token (SPL); sponsor pays Solana costs; sponsor never has net loss.
 */
export class SwapService {
  constructor(
    private bridge: IBridge,
    private config: SwapServiceConfig = DEFAULT_CONFIG
  ) {}

  /** Get quote only (no execution). */
  async getQuote(req: SwapRequest): Promise<QuoteResult> {
    return this.bridge.getQuote(req);
  }

  /**
   * 1. Get quote
   * 2. Validate quote and request (fee coverage, slippage)
   * 3. Execute bridge swap
   * 4. Assert sponsor never loses, log
   */
  async executeSwap(req: SwapRequest): Promise<SwapResult> {
    const validation = await this.runValidation(req);
    if (!validation.ok) {
      auditLog({
        action: 'execute_swap_rejected',
        request: req,
        result: { success: false, error: validation.error },
      });
      return { success: false, error: validation.error };
    }

    const quote = validation.quote;
    const slippage = req.slippageTolerance ?? 0;
    const minOutput = applySlippage(quote.expectedOutput, slippage);

    let result: SwapResult;
    try {
      result = await this.bridge.executeSwap(req);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      result = { success: false, error };
    }

    if (result.success) {
      result.userFee = quote.userFee;
      result.sponsorCost = quote.sponsorCost;
      assertSponsorSafe(result, quote, this.config.safetyMargin);
    }

    auditLog({
      action: 'execute_swap',
      request: req,
      result,
      fee: result.userFee,
      sponsorCost: result.sponsorCost,
      minOutput,
    });

    return result;
  }

  private async runValidation(
    req: SwapRequest
  ): Promise<
    | { ok: true; quote: QuoteResult }
    | { ok: false; error: string }
  > {
    let quote: QuoteResult;
    try {
      quote = await this.bridge.getQuote(req);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Quote failed: ${error}` };
    }

    const check = validateQuoteAndRequest(req, quote, {
      safetyMargin: this.config.safetyMargin,
      maxSlippageTolerance: this.config.maxSlippageTolerance,
    });

    if (!check.ok) return check;
    return { ok: true, quote };
  }
}
