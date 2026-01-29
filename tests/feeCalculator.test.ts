import { describe, it, expect } from 'vitest';
import {
  calculateFee,
  isFeeCovered,
  applySlippage,
} from '../src/feeCalculator.js';
import type { QuoteResult } from '../src/types.js';

describe('feeCalculator', () => {
  describe('calculateFee', () => {
    it('returns sponsor_cost * (1 + safetyMargin)', () => {
      expect(calculateFee(100, 0.1)).toBeCloseTo(110, 10);
      expect(calculateFee(1, 0.2)).toBeCloseTo(1.2, 10);
    });

    it('respects minUserFee when provided', () => {
      const fee = calculateFee(0.001, 0.1, 1);
      expect(fee).toBe(1);
    });
  });

  describe('isFeeCovered', () => {
    it('returns true when userFee >= sponsorCost * (1 + margin)', () => {
      const quote: QuoteResult = {
        routeAvailable: true,
        expectedOutput: 100,
        userFee: 1.1,
        sponsorCost: 1,
      };
      expect(isFeeCovered(quote, 0.1)).toBe(true);
    });

    it('returns false when userFee is too low', () => {
      const quote: QuoteResult = {
        routeAvailable: true,
        expectedOutput: 100,
        userFee: 1.0,
        sponsorCost: 1,
      };
      expect(isFeeCovered(quote, 0.1)).toBe(false);
    });
  });

  describe('applySlippage', () => {
    it('reduces expected output by slippage tolerance', () => {
      expect(applySlippage(100, 0.01)).toBe(99);
      expect(applySlippage(100, 0.05)).toBe(95);
    });

    it('clamps tolerance to [0,1]', () => {
      expect(applySlippage(100, -0.1)).toBe(100);
      expect(applySlippage(100, 2)).toBe(0);
    });
  });
});
