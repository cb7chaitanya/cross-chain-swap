/**
 * CLI for cross-chain proof flow (Commander).
 * Reuses runProof from the proof script; adds --user, --recipient, --chain, --amount, --from-token, --dest-token.
 *
 * Run: pnpm cli proof [options]
 *      pnpm cli proof --help
 */

import { program } from 'commander';
import { runProof } from './prove-solana-to-base.js';

program
  .name('cli')
  .description('Cross-chain proof CLI (Solana → EVM via Relay)')
  .version('1.0.0');

program
  .command('proof', { isDefault: true })
  .description('Get Relay quote, optionally send deposit, write proof file (default command)')
  .option('-u, --user <address>', 'Solana wallet address (env: USER_SOLANA_ADDRESS)')
  .option('-r, --recipient <address>', 'EVM recipient address (env: USER_ADDRESS)')
  .option('-c, --chain <id|name>', 'Destination chain ID or name, e.g. 8453 or base', '8453')
  .option('-a, --amount <number>', 'Token amount to swap', '1')
  .option('-f, --from-token <address>', 'Origin token on Solana, e.g. USDC mint (env: FROM_TOKEN)')
  .option('-t, --dest-token <address>', 'Destination token address on EVM chain (env: DESTINATION_TOKEN)')
  .action(
    async (opts: {
      user?: string;
      recipient?: string;
      chain?: string;
      amount?: string;
      fromToken?: string;
      destToken?: string;
    }) => {
      await runProof({
        ...opts,
        toToken: opts.destToken,
      });
    }
  );

program.parse();
