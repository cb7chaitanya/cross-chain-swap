import type { IBridge } from './IBridge.js';
import type { SwapRequest, SwapResult, QuoteResult } from '../types.js';
import { getQuote as relayGetQuote } from './relay/relayApi.js';
import { toRelayQuoteRequest, toQuoteResult } from './relay/relayAdapter.js';
import type { RelayApiConfig } from './relay/relayApi.js';

/** EVM step payload for Relay (to, data, value, chainId). */
export interface RelayTransactionPayload {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  chainId: number;
}

/** Submits a Relay step and returns tx hash. */
export type RelayExecutor = (tx: RelayTransactionPayload) => Promise<string>;

export interface RelayBridgeConfig extends RelayApiConfig {
  originDecimals?: number;
  executor?: RelayExecutor;
}

/** Relay bridge: quote v2 + step execution. https://api.relay.link */
export class RelayBridge implements IBridge {
  readonly name = 'Relay';

  constructor(private config: RelayBridgeConfig = {}) {}

  async getQuote(req: SwapRequest): Promise<QuoteResult> {
    const relayReq = toRelayQuoteRequest(req, this.config.originDecimals ?? 18);
    const res = await relayGetQuote(relayReq, {
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
    });
    return toQuoteResult(res);
  }

  async executeSwap(req: SwapRequest): Promise<SwapResult> {
    const relayReq = toRelayQuoteRequest(req, this.config.originDecimals ?? 18);
    const quoteRes = await relayGetQuote(relayReq, {
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
    });

    const steps = quoteRes.steps ?? [];
    if (steps.length === 0) {
      return { success: false, error: 'Relay quote returned no steps' };
    }

    const executor = this.config.executor;
    if (!executor) {
      const first = steps[0];
      const requestId = first?.requestId ?? 'unknown';
      return {
        success: false,
        error: `Relay execution requires an executor. Provide executor in RelayBridgeConfig, or execute steps client-side. requestId: ${requestId}`,
      };
    }

    try {
      let txHash: string | undefined;
      for (const step of steps) {
        if (step.kind !== 'transaction' || !step.items?.length) continue;
        const item = step.items[0];
        const data = item?.data;
        if (!data?.to || data?.data == null || data?.value == null) continue;

        const payload: RelayTransactionPayload = {
          to: data.to as `0x${string}`,
          data: data.data as `0x${string}`,
          value: BigInt(data.value),
          chainId: data.chainId,
        };
        txHash = await executor(payload);
        break;
      }

      if (!txHash) {
        return { success: false, error: 'No transaction step to execute' };
      }

      const quote = toQuoteResult(quoteRes);
      return {
        success: true,
        txHash,
        userFee: quote.userFee,
        sponsorCost: quote.sponsorCost,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
