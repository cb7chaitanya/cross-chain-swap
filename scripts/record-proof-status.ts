/**
 * Record Relay intent status into proof file.
 * Usage: pnpm proof:status <requestId> [--poll]
 * Env: RELAY_API_KEY (optional)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getStatus, RELAY_DEFAULT_BASE_URL } from '../src/bridge/relay/relayApi.js';

const PROOF_FILE = join(process.cwd(), 'proof-solana-to-base.json');

async function main() {
  const requestId = process.argv[2];
  if (!requestId) {
    console.error('Usage: pnpm proof:status <requestId> [--poll]');
    process.exit(1);
  }
  const poll = process.argv.includes('--poll');

  const config = { baseUrl: RELAY_DEFAULT_BASE_URL, apiKey: process.env.RELAY_API_KEY };

  let status: string;
  try {
    if (poll) {
      const deadline = Date.now() + 60_000;
      const interval = 2_000;
      const res = await getStatus(requestId, config);
      status = res.status;
      console.log('Status:', status);
      while (Date.now() < deadline) {
        if (status === 'success' || status === 'failure' || status === 'refunded') break;
        await new Promise((r) => setTimeout(r, interval));
        const next = await getStatus(requestId, config);
        status = next.status;
        console.log('Status:', status);
      }
    } else {
      const res = await getStatus(requestId, config);
      status = res.status;
    }
  } catch (err) {
    console.error('Failed to fetch status:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (!existsSync(PROOF_FILE)) {
    console.log('Proof file not found. Status:', status);
    return;
  }
  const proof = JSON.parse(readFileSync(PROOF_FILE, 'utf-8'));
  proof.status = status;
  proof.statusRecordedAt = new Date().toISOString();
  writeFileSync(PROOF_FILE, JSON.stringify(proof, null, 2), 'utf-8');
  console.log('Updated', PROOF_FILE, 'with status:', status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
