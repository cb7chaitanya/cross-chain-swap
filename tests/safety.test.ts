import { describe, it, expect } from 'vitest';
import { validateQuoteAndRequest } from '../src/safety.js';
import type { SwapRequest, QuoteResult } from '../src/types.js';

const baseRequest: SwapRequest = {
  fromChain: 'solana',
  toChain: 'ethereum',
  fromToken: 'USDC',
  toToken: 'USDC',
  amount: 100,
  userAddress: 'user123',
};

const validQuote: QuoteResult = {
  routeAvailable: true,
  expectedOutput: 99,
  userFee: 1.1,
  sponsorCost: 1,
};

describe('safety', () => {
  describe('validateQuoteAndRequest', () => {
    it('accepts valid quote and request', () => {
      const r = validateQuoteAndRequest(
        baseRequest,
        validQuote,
        { safetyMargin: 0.1 }
      );
      expect(r.ok).toBe(true);
    });

    it('rejects when route not available', () => {
      const r = validateQuoteAndRequest(
        baseRequest,
        { ...validQuote, routeAvailable: false },
        { safetyMargin: 0.1 }
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('Route not available');
    });

    it('rejects when user fee does not cover sponsor cost + margin', () => {
      const r = validateQuoteAndRequest(
        baseRequest,
        { ...validQuote, userFee: 0.5, sponsorCost: 1 },
        { safetyMargin: 0.1 }
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('does not cover');
    });

    it('rejects when slippage exceeds max', () => {
      const r = validateQuoteAndRequest(
        { ...baseRequest, slippageTolerance: 0.6 },
        validQuote,
        { safetyMargin: 0.1, maxSlippageTolerance: 0.5 }
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('Slippage');
    });

    it('rejects non-positive amount', () => {
      const r = validateQuoteAndRequest(
        { ...baseRequest, amount: 0 },
        validQuote,
        { safetyMargin: 0.1 }
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('positive');
    });
  });
});
