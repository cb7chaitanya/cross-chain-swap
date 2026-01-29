import { describe, it, expect, vi } from 'vitest';
import { RelayBridge } from '../src/bridge/index.js';
import type { SwapRequest } from '../src/types.js';
import { expectedUserFeeFromRelay } from './relayMock.js';

const mockRequest: SwapRequest = {
  fromChain: '8453',
  toChain: '42161',
  fromToken: '0x0000000000000000000000000000000000000000',
  toToken: '0x0000000000000000000000000000000000000000',
  amount: 100,
  userAddress: '0x03508bb71268bba25ecacc8f620e01866650532c',
};

// Real Relay API response shape (tests/fixtures/relay-quote-response.json).
// vi.hoisted runs before vi.mock so the fixture is available in the mock factory.
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

describe('RelayBridge', () => {
  it('getQuote maps Relay fees to quote (sponsorCost from Relay, userFee derived)', async () => {
    const bridge = new RelayBridge();
    const quote = await bridge.getQuote(mockRequest);
    expect(quote.routeAvailable).toBe(true);
    expect(quote.expectedOutput).toBe(99);
    expect(quote.sponsorCost).toBe(0.001);
    expect(quote.userFee).toBe(expectedUserFeeFromRelay(0.001));
  });

  it('executeSwap without executor returns success false with message', async () => {
    const bridge = new RelayBridge();
    const result = await bridge.executeSwap(mockRequest);
    expect(result.success).toBe(false);
    expect(result.error).toContain('executor');
  });

  it('executeSwap with executor returns success and txHash', async () => {
    const executor = async () => '0xrelay-tx-hash';
    const bridge = new RelayBridge({ executor });
    const result = await bridge.executeSwap(mockRequest);
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xrelay-tx-hash');
    expect(result.userFee).toBeDefined();
    expect(result.sponsorCost).toBeDefined();
  });
});
