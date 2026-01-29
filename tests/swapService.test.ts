import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwapService } from '../src/swapService.js';
import { RelayBridge } from '../src/bridge/index.js';
import { clearAuditLogs, getAuditLogs } from '../src/logger.js';
import type { SwapRequest, QuoteResult, SwapResult } from '../src/types.js';
import type { IBridge } from '../src/bridge/IBridge.js';
import { expectedUserFeeFromRelay } from './relayMock.js';

const relayQuoteFixture = vi.hoisted(() => {
  const { readFileSync } = require('fs');
  const path = require('path');
  const { fileURLToPath } = require('url');
  const dir = path.dirname(fileURLToPath(import.meta.url));
  return JSON.parse(
    readFileSync(path.join(dir, 'fixtures', 'relay-quote-response.json'), 'utf-8')
  );
});

vi.mock('../src/bridge/relay/relayApi.js', () => ({
  getQuote: vi.fn().mockResolvedValue(relayQuoteFixture),
  getStatus: vi.fn(),
}));

const validRequest: SwapRequest = {
  fromChain: '8453',
  toChain: '42161',
  fromToken: '0x0000000000000000000000000000000000000000',
  toToken: '0x0000000000000000000000000000000000000000',
  amount: 100,
  userAddress: '0x03508bb71268bba25ecacc8f620e01866650532c',
};

describe('SwapService', () => {
  beforeEach(() => {
    clearAuditLogs();
  });

  it('executeSwap returns success and attaches Relay-derived fee/sponsorCost', async () => {
    const relayWithExecutor = new RelayBridge({
      executor: async () => '0xswap-service-tx',
    });
    const svc = new SwapService(relayWithExecutor);
    const result = await svc.executeSwap(validRequest);
    expect(result.success).toBe(true);
    expect(result.txHash).toBeDefined();
    expect(result.sponsorCost).toBe(0.001);
    expect(result.userFee).toBe(expectedUserFeeFromRelay(0.001));
  });

  it('rejects when quote fails (bridge throws)', async () => {
    const failingBridge: IBridge = {
      name: 'Failing',
      async getQuote() {
        throw new Error('Quote failed');
      },
      async executeSwap() {
        return { success: true };
      },
    };
    const svc = new SwapService(failingBridge);
    const result = await svc.executeSwap(validRequest);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Quote failed');
  });

  it('rejects when fee does not cover sponsor (mock bridge)', async () => {
    const badFeeBridge: IBridge = {
      name: 'BadFee',
      async getQuote(): Promise<QuoteResult> {
        return {
          routeAvailable: true,
          expectedOutput: 90,
          userFee: 0.5,
          sponsorCost: 1,
        };
      },
      async executeSwap(): Promise<SwapResult> {
        return { success: true };
      },
    };
    const svc = new SwapService(badFeeBridge, { safetyMargin: 0.1 });
    const result = await svc.executeSwap(validRequest);
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not cover');
  });

  it('writes audit log on execute_swap with Relay-derived fee', async () => {
    const relayWithExecutor = new RelayBridge({
      executor: async () => '0xaudit-log-tx',
    });
    const svc = new SwapService(relayWithExecutor);
    await svc.executeSwap(validRequest);
    const logs = getAuditLogs();
    const swapLog = logs.find((e) => e.action === 'execute_swap');
    expect(swapLog).toBeDefined();
    expect(swapLog?.result?.success).toBe(true);
    expect(swapLog?.fee).toBe(expectedUserFeeFromRelay(0.001));
  });
});
