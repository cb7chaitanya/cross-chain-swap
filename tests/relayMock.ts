/**
 * Shared Relay API response mock for tests.
 * Tests use Relay's fee fields (fees.gas, fees.relayer) and assert we map them
 * correctly to QuoteResult (sponsorCost from Relay, userFee = sponsorCost * (1 + safetyMargin)).
 */

import { DEFAULT_SAFETY_MARGIN } from '../src/feeCalculator.js';
import type { RelayQuoteResponse } from '../src/bridge/relay/relayTypes.js';

/** Safety margin used in relayAdapter.toQuoteResult; must match feeCalculator.DEFAULT_SAFETY_MARGIN */
export const RELAY_SAFETY_MARGIN = DEFAULT_SAFETY_MARGIN;

/** Expected userFee from sponsorCost: userFee = sponsorCost * (1 + RELAY_SAFETY_MARGIN) */
export function expectedUserFeeFromRelay(sponsorCost: number): number {
  return sponsorCost * (1 + RELAY_SAFETY_MARGIN);
}

export interface RelayQuoteMockOptions {
  /** Relay fees.gas.amountFormatted (sponsor cost) */
  gas: number;
  /** Relay fees.relayer.amountFormatted (used when gas is 0) */
  relayer?: number;
  /** Relay details.currencyOut.amountFormatted */
  currencyOut: number;
}

/**
 * Build a Relay-shaped quote response. Our toQuoteResult reads:
 * - sponsorCost from fees.gas.amountFormatted (or fees.relayer if gas missing/0)
 * - expectedOutput from details.currencyOut.amountFormatted
 * - userFee = sponsorCost * (1 + 0.1)
 */
export function createRelayQuoteMock(
  opts: RelayQuoteMockOptions
): RelayQuoteResponse {
  const { gas, relayer, currencyOut } = opts;
  const steps = [
    {
      id: 'step-1',
      action: 'transaction',
      kind: 'transaction' as const,
      requestId: '0xtest',
      items: [
        {
          status: 'pending',
          data: {
            to: '0x0000000000000000000000000000000000000001',
            data: '0x',
            value: '0',
            chainId: 8453,
          },
        },
      ],
    },
  ];

  const fees: RelayQuoteResponse['fees'] = {
    gas: { amountFormatted: String(gas) },
  };
  if (relayer != null) {
    fees.relayer = { amountFormatted: String(relayer) };
  }

  return {
    steps,
    details: { currencyOut: { amountFormatted: String(currencyOut) } },
    fees,
  };
}
