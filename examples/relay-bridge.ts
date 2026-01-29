/**
 * Solana → Base quote example (Relay).
 * Run: npx tsx examples/relay-bridge.ts
 */

import { RelayBridge } from '../src/bridge/index.js';
import { RELAY_USDC, RELAY_CHAIN_IDS, RELAY_DEFAULT_BASE_URL } from '../src/bridge/relay/index.js';
import type { SwapRequest } from '../src/types.js';

async function main() {
  const req: SwapRequest = {
    fromChain: 'solana',
    toChain: String(RELAY_CHAIN_IDS.base),
    fromToken: RELAY_USDC.solanaMint,
    toToken: RELAY_USDC.baseAddress,
    amount: 1,
    userAddress: process.env.USER_SOLANA_ADDRESS ?? '11111111111111111111111111111111',
    recipient: process.env.USER_ADDRESS,
    slippageTolerance: 0.01,
  };

  const bridge = new RelayBridge({
    baseUrl: RELAY_DEFAULT_BASE_URL,
    apiKey: process.env.RELAY_API_KEY,
    originDecimals: RELAY_USDC.decimals,
  });

  const quote = await bridge.getQuote(req);
  console.log('Solana → Base USDC quote:', quote);
  if (quote.routeAvailable) {
    console.log('Expected output:', quote.expectedOutput, 'User fee:', quote.userFee, 'Sponsor cost:', quote.sponsorCost);
  }
}

main().catch(console.error);
