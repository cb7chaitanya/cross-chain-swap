/**
 * Relay API client: POST /quote/v2, GET /intents/status/v3.
 * Base URL: https://api.relay.link
 */

import type {
  RelayQuoteRequest,
  RelayQuoteResponse,
  RelayStatusResponse,
} from './relayTypes.js';

/** Default Relay API base URL. Use in scripts/examples for consistency. */
export const RELAY_DEFAULT_BASE_URL = 'https://api.relay.link';

export interface RelayApiConfig {
  baseUrl?: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}

function headers(apiKey?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) h['x-api-key'] = apiKey;
  return h;
}

/** POST /quote/v2 — get executable quote. */
export async function getQuote(
  body: RelayQuoteRequest,
  config: RelayApiConfig = {}
): Promise<RelayQuoteResponse> {
  const base = config.baseUrl ?? RELAY_DEFAULT_BASE_URL;
  const url = `${base.replace(/\/$/, '')}/quote/v2`;
  const fetcher = config.fetch ?? globalThis.fetch;
  const res = await fetcher(url, {
    method: 'POST',
    headers: headers(config.apiKey),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Relay quote failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<RelayQuoteResponse>;
}

/** GET /intents/status/v3 — check intent status. */
export async function getStatus(
  requestId: string,
  config: RelayApiConfig = {}
): Promise<RelayStatusResponse> {
  const base = config.baseUrl ?? RELAY_DEFAULT_BASE_URL;
  const url = `${base.replace(/\/$/, '')}/intents/status/v3?requestId=${encodeURIComponent(requestId)}`;
  const fetcher = config.fetch ?? globalThis.fetch;
  const res = await fetcher(url, {
    method: 'GET',
    headers: headers(config.apiKey),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Relay status failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<RelayStatusResponse>;
}
