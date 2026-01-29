/**
 * Example: get quote and (optionally) execute swap via SwapService.
 * Run: npx tsx examples/usage.ts
 */
import { SwapService, RelayBridge } from '../src/index.js';
import { RELAY_USDC, RELAY_CHAIN_IDS, RELAY_DEFAULT_BASE_URL } from '../src/bridge/relay/index.js';
import type { SwapRequest } from '../src/types.js';

async function main() {
  const bridge = new RelayBridge({
    baseUrl: RELAY_DEFAULT_BASE_URL,
    apiKey: process.env.RELAY_API_KEY,
    originDecimals: RELAY_USDC.decimals,
  });
  const service = new SwapService(bridge, { safetyMargin: 0.1 });

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

  const quote = await service.getQuote(req);
  console.log('Quote:', quote);

  // executeSwap returns success: false without executor; use pnpm proof for full flow
  const result = await service.executeSwap(req);
  console.log('Result:', result);
}

main().catch(console.error);
