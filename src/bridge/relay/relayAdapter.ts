/**
 * Maps SwapRequest to Relay API and Relay quote response to QuoteResult.
 * Solana → EVM: fromChain "solana" / "sol", toChain EVM chain ID (e.g. 8453 Base).
 */

import { DEFAULT_SAFETY_MARGIN } from '../../feeCalculator.js';
import type { SwapRequest, QuoteResult } from '../../types.js';
import type { RelayQuoteRequest, RelayQuoteResponse } from './relayTypes.js';

const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Chain name or alias → Relay chain ID. */
export const RELAY_CHAIN_IDS: Record<string, number> = {
  solana: 792703809,
  sol: 792703809,
  svm: 792703809,
  base: 8453,
  arbitrum: 42161,
  arbitrum_one: 42161,
  optimism: 10,
  ethereum: 1,
  mainnet: 1,
  polygon: 137,
};

/** USDC: Solana mint + Base address (Circle). Decimals 6. */
export const RELAY_USDC = {
  solanaMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as const,
  baseAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const,
  decimals: 6,
} as const;

function toChainId(chain: string): number {
  const n = parseInt(chain, 10);
  if (!Number.isNaN(n)) return n;
  const lower = chain.toLowerCase().replace(/\s+/g, '_');
  return RELAY_CHAIN_IDS[lower] ?? 0;
}

function toCurrency(token: string): string {
  const t = token.trim();
  if (t === 'ETH' || t === 'native' || t.toLowerCase() === NATIVE_ADDRESS) return NATIVE_ADDRESS;
  return t;
}

/** Build Relay quote request. amount in human units; originDecimals for smallest unit. */
export function toRelayQuoteRequest(
  req: SwapRequest,
  originDecimals: number = 18
): RelayQuoteRequest {
  const amountWei = BigInt(Math.round(req.amount * 10 ** originDecimals)).toString();
  const body: RelayQuoteRequest = {
    user: req.userAddress,
    originChainId: toChainId(req.fromChain),
    destinationChainId: toChainId(req.toChain),
    originCurrency: toCurrency(req.fromToken),
    destinationCurrency: toCurrency(req.toToken),
    amount: amountWei,
    tradeType: 'EXACT_INPUT',
  };
  if (req.recipient != null) body.recipient = req.recipient;
  return body;
}

/** Map Relay quote response to QuoteResult. */
export function toQuoteResult(res: RelayQuoteResponse): QuoteResult {
  const steps = res.steps ?? [];
  const routeAvailable = steps.length > 0;

  let expectedOutput = 0;
  let sponsorCost = 0;

  if (res.details?.currencyOut?.amountFormatted != null) {
    expectedOutput = parseFloat(res.details.currencyOut.amountFormatted);
  }
  if (res.fees?.gas?.amountFormatted != null) {
    sponsorCost = parseFloat(res.fees.gas.amountFormatted);
  }
  if (sponsorCost === 0 && res.fees?.relayer?.amountFormatted != null) {
    sponsorCost = parseFloat(res.fees.relayer.amountFormatted);
  }

  const userFee = sponsorCost * (1 + DEFAULT_SAFETY_MARGIN);

  return {
    routeAvailable,
    expectedOutput,
    userFee,
    sponsorCost,
  };
}
