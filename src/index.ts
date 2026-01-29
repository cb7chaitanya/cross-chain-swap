/**
 * Off-chain Swap Service
 * - Quote & fee calculator
 * - Solana transfer handler (SPL + Token-2022, dust/uncloseable handling)
 * - Bridge interface (Relay)
 * - Safety layer (dust, fee coverage, slippage)
 * - Logging & audit
 */

export * from './types.js';
export { type IBridge, RelayBridge } from './bridge/index.js';
export {
  calculateFee,
  isFeeCovered,
  applySlippage,
  DEFAULT_SAFETY_MARGIN,
  type FeeConfig,
} from './feeCalculator.js';
export {
  transferSPL,
  detectTokenStandard,
  getTokenProgramId,
  DEFAULT_DUST_THRESHOLD,
} from './solanaTransfer.js';
export {
  validateQuoteAndRequest,
  assertSponsorSafe,
  type SafetyChecks,
} from './safety.js';
export { SwapService, type SwapServiceConfig } from './swapService.js';
export { auditLog, getAuditLogs, clearAuditLogs } from './logger.js';
