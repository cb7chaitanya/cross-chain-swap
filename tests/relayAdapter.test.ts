/**
 * Validates that we map Relay's fee fields to QuoteResult correctly.
 * Fees come from Relay (fees.gas, fees.relayer); we assert our mapping and userFee derivation.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { toQuoteResult } from '../src/bridge/relay/relayAdapter.js';
import {
  createRelayQuoteMock,
  expectedUserFeeFromRelay,
} from './relayMock.js';

function loadRelayFixture() {
  const dir = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(
    readFileSync(join(dir, 'fixtures', 'relay-quote-response.json'), 'utf-8')
  );
}

describe('relayAdapter (Relay fee mapping)', () => {
  it('maps real Relay API response (fixture) to QuoteResult', () => {
    const relayQuote = loadRelayFixture();
    const quote = toQuoteResult(relayQuote);
    expect(quote.routeAvailable).toBe(true);
    expect(quote.expectedOutput).toBe(99);
    expect(quote.sponsorCost).toBe(0.001);
    expect(quote.userFee).toBe(expectedUserFeeFromRelay(0.001));
  });

  it('uses fees.relayer when fees.gas is zero', () => {
    const relayer = 0.3;
    const relayQuote = createRelayQuoteMock({
      gas: 0,
      relayer,
      currencyOut: 50,
    });
    const quote = toQuoteResult(relayQuote);
    expect(quote.sponsorCost).toBe(relayer);
    expect(quote.userFee).toBe(expectedUserFeeFromRelay(relayer));
  });

  it('routeAvailable is false when steps are empty', () => {
    const relayQuote = createRelayQuoteMock({ gas: 0.1, currencyOut: 10 });
    relayQuote.steps = [];
    const quote = toQuoteResult(relayQuote);
    expect(quote.routeAvailable).toBe(false);
  });
});
