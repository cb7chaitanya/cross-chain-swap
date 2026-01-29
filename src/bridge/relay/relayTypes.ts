/** Relay API types: quote v2, intent status. See https://docs.relay.link */

export interface RelayQuoteRequest {
  user: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT';
  recipient?: string;
  slippageTolerance?: string;
}

export interface RelayQuoteStepItemData {
  from?: string;
  to: string;
  data: string;
  value: string;
  chainId: number;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface RelayQuoteStepItem {
  status: string;
  data: RelayQuoteStepItemData;
  check?: { endpoint: string; method: string };
}

export interface RelayQuoteStep {
  id: string;
  action: string;
  description?: string;
  kind: 'transaction' | 'signature';
  requestId: string;
  items: RelayQuoteStepItem[];
}

export interface RelayFeeAmount {
  amount?: string;
  amountFormatted?: string;
  amountUsd?: string;
  minimumAmount?: string;
  currency?: { chainId: number; address: string; symbol: string; decimals: number };
}

export interface RelayQuoteFees {
  gas?: RelayFeeAmount;
  relayer?: RelayFeeAmount;
  relayerGas?: RelayFeeAmount;
  relayerService?: RelayFeeAmount;
  app?: RelayFeeAmount;
  subsidized?: RelayFeeAmount;
}

export interface RelayQuoteDetailsAmount {
  amount?: string;
  amountFormatted?: string;
  amountUsd?: string;
  minimumAmount?: string;
  currency?: { chainId: number; address: string; symbol: string; decimals: number };
}

export interface RelayQuoteDetails {
  currencyIn?: RelayQuoteDetailsAmount;
  currencyOut?: RelayQuoteDetailsAmount;
  operation?: string;
  sender?: string;
  recipient?: string;
}

export interface RelayQuoteResponse {
  steps: RelayQuoteStep[];
  fees?: RelayQuoteFees;
  details?: RelayQuoteDetails;
}

export interface RelayStatusResponse {
  status: string;
  requestId?: string;
  [k: string]: unknown;
}
