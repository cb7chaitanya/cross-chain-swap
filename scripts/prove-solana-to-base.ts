/**
 * Proof script: Solana → EVM cross-chain swap (Relay).
 *
 * 1. Gets Relay quote (POST /quote/v2).
 * 2. If SOLANA_PRIVATE_KEY is set: signs and sends the deposit tx inline.
 * 3. Writes proof-solana-to-base.json (request, quote, requestId, optional depositTxSignature).
 *
 * Config: env vars (USER_SOLANA_ADDRESS, USER_ADDRESS, DESTINATION_CHAIN, AMOUNT, FROM_TOKEN, DESTINATION_TOKEN, etc).
 * Run: pnpm proof
 *
 * For CLI with options, use: pnpm cli proof [options]
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction as SolanaTransaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { getQuote, RELAY_DEFAULT_BASE_URL } from '../src/bridge/relay/relayApi.js';
import {
  toRelayQuoteRequest,
  RELAY_USDC,
  RELAY_CHAIN_IDS,
} from '../src/bridge/relay/relayAdapter.js';
import type { SwapRequest } from '../src/types.js';
import type { RelayQuoteResponse } from '../src/bridge/relay/relayTypes.js';

const PROOF_FILE = join(process.cwd(), 'proof-solana-to-base.json');
const SOL_FEE_BUFFER = 0.02;

/** Options override for runProof (CLI or programmatic). Env vars still used for unset fields. */
export type ProofOptions = {
  user?: string;
  recipient?: string;
  chain?: string;
  amount?: string;
  /** Origin token on Solana (e.g. USDC mint). */
  fromToken?: string;
  /** Destination token address on EVM chain (e.g. USDC or native ETH). */
  toToken?: string;
};

/** Native ETH on EVM (Relay uses 0x0 for native). */
const NATIVE_ETH = '0x0000000000000000000000000000000000000000';

/** Fallback EVM USDC by chain ID (Circle). */
const USDC_BY_CHAIN: Record<number, string> = {
  [RELAY_CHAIN_IDS.base]: RELAY_USDC.baseAddress,
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum USDC
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Optimism USDC
};

function resolveChain(chain: string): number {
  const n = parseInt(chain, 10);
  if (!Number.isNaN(n)) return n;
  const lower = chain.toLowerCase();
  return RELAY_CHAIN_IDS[lower] ?? RELAY_CHAIN_IDS.base;
}

function buildRequest(opts: ProofOptions = {}): SwapRequest {
  const chainRaw = opts.chain ?? process.env.DESTINATION_CHAIN ?? '8453';
  const chainId = resolveChain(chainRaw);
  const amount = parseFloat(opts.amount ?? process.env.AMOUNT ?? '1') || 1;
  const toToken =
    opts.toToken ??
    process.env.DESTINATION_TOKEN ??
    NATIVE_ETH;

  return {
    fromChain: 'solana',
    toChain: String(chainId),
    fromToken: opts.fromToken ?? process.env.FROM_TOKEN ?? RELAY_USDC.solanaMint,
    toToken,
    amount,
    userAddress: opts.user ?? process.env.USER_SOLANA_ADDRESS ?? '11111111111111111111111111111111',
    recipient: opts.recipient ?? process.env.USER_ADDRESS ?? '0x0000000000000000000000000000000000000001',
  };
}

type TxPayload = {
  serialized?: string;
  instructions?: Array<{
    keys: Array<{ pubkey: string; isSigner?: boolean; isWritable?: boolean }>;
    programId: string;
    data: string;
  }>;
  addressLookupTableAddresses?: string[];
};

function getRequestId(quote: RelayQuoteResponse): string {
  return (quote as RelayQuoteResponse & { requestId?: string }).requestId ?? quote.steps?.[0]?.requestId ?? '';
}

function getTxPayload(quote: RelayQuoteResponse): TxPayload | undefined {
  const step = quote.steps?.[0] as { transaction?: TxPayload; items?: Array<{ data?: TxPayload }> } | undefined;
  return step?.transaction ?? step?.items?.[0]?.data;
}

function createProof(request: SwapRequest, quote: RelayQuoteResponse, requestId: string): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    description: `Cross-chain swap proof: Solana → chain ${request.toChain} (Relay)`,
    request,
    quote: quote as unknown,
    verificationUrl: `${RELAY_DEFAULT_BASE_URL}/intents/status/v3?requestId=${requestId}`,
    status: null,
    instructions: [] as string[],
  };
}

async function checkBalance(
  conn: Connection,
  keypair: Keypair,
  request: SwapRequest,
  proof: Record<string, unknown>
): Promise<boolean> {
  const isSolSwap = request.fromToken === 'So11111111111111111111111111111111111111112';
  const lamportsNeeded = (isSolSwap ? request.amount + SOL_FEE_BUFFER : SOL_FEE_BUFFER) * LAMPORTS_PER_SOL;
  const balance = await conn.getBalance(keypair.publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;

  if (balance < lamportsNeeded) {
    (proof.instructions as string[]).push(
      `Wallet has ${balanceSol.toFixed(4)} SOL; need ~${(lamportsNeeded / LAMPORTS_PER_SOL).toFixed(4)} SOL. Fund and re-run, or sign in Phantom.`
    );
    console.warn(
      `Insufficient SOL: ${balanceSol.toFixed(4)} SOL (need ~${(lamportsNeeded / LAMPORTS_PER_SOL).toFixed(4)}). Fund wallet or sign in Phantom.`
    );
    return false;
  }
  if (keypair.publicKey.toBase58() !== request.userAddress) {
    console.warn(
      `USER_SOLANA_ADDRESS (${request.userAddress}) does not match SOLANA_PRIVATE_KEY (${keypair.publicKey.toBase58()}). Deposit may fail – use the keypair that holds the funds.`
    );
  }
  return true;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function sendAndConfirmVersionedTx(conn: Connection, tx: VersionedTransaction): Promise<string> {
  let sig: string;
  try {
    sig = await conn.sendTransaction(tx, { skipPreflight: false });
  } catch (e: unknown) {
    if (errMsg(e).includes('Simulation failed') || errMsg(e).includes('custom program error')) {
      console.warn('Simulation failed; retrying with skipPreflight...');
      sig = await conn.sendTransaction(tx, { skipPreflight: true });
    } else {
      throw e;
    }
  }
  await conn.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function sendAndConfirmLegacyTx(
  conn: Connection,
  tx: SolanaTransaction,
  keypair: Keypair
): Promise<string> {
  try {
    return await sendAndConfirmTransaction(conn, tx, [keypair], { skipPreflight: false });
  } catch (e: unknown) {
    if (errMsg(e).includes('Simulation failed') || errMsg(e).includes('custom program error')) {
      console.warn('Simulation failed; retrying with skipPreflight...');
      return await sendAndConfirmTransaction(conn, tx, [keypair], { skipPreflight: true });
    }
    throw e;
  }
}

function parseInstructions(txPayload: TxPayload): TransactionInstruction[] {
  return (txPayload.instructions ?? []).map((ix) =>
    new TransactionInstruction({
      keys: ix.keys.map((k) => ({
        pubkey: new PublicKey(k.pubkey),
        isSigner: k.isSigner ?? false,
        isWritable: k.isWritable ?? false,
      })),
      programId: new PublicKey(ix.programId),
      data: Buffer.from(ix.data, 'hex'),
    })
  );
}

async function sendSerializedTx(
  conn: Connection,
  keypair: Keypair,
  txPayload: TxPayload,
  proof: Record<string, unknown>
): Promise<string> {
  const raw = Buffer.from(txPayload.serialized!, 'base64');
  const tx = VersionedTransaction.deserialize(raw);
  tx.sign([keypair]);
  const sig = await sendAndConfirmVersionedTx(conn, tx);
  (proof as Record<string, unknown>).depositTxSignature = sig;
  proof.instructions = ['Deposit transaction sent and confirmed.', `Signature: ${sig}`];
  console.log('Deposit transaction sent and confirmed. Signature:', sig);
  return sig;
}

async function sendInstructionsTx(
  conn: Connection,
  keypair: Keypair,
  txPayload: TxPayload,
  proof: Record<string, unknown>
): Promise<string> {
  const instructions = parseInstructions(txPayload);
  const { blockhash } = await conn.getLatestBlockhash('finalized');
  const lookupTableAddresses = txPayload.addressLookupTableAddresses;

  if (lookupTableAddresses?.length) {
    const lookupTableAccounts: import('@solana/web3.js').AddressLookupTableAccount[] = [];
    for (const addr of lookupTableAddresses.map((a) => new PublicKey(a))) {
      const r = await conn.getAddressLookupTable(addr);
      if (r.value) lookupTableAccounts.push(r.value);
    }
    const message = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(lookupTableAccounts);
    const tx = new VersionedTransaction(message);
    tx.sign([keypair]);
    const sig = await sendAndConfirmVersionedTx(conn, tx);
    (proof as Record<string, unknown>).depositTxSignature = sig;
    proof.instructions = ['Deposit transaction sent and confirmed.', `Signature: ${sig}`];
    console.log('Deposit transaction sent and confirmed. Signature:', sig);
    return sig;
  }

  const tx = new SolanaTransaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = keypair.publicKey;
  tx.add(...instructions);
  tx.sign(keypair);
  const sig = await sendAndConfirmLegacyTx(conn, tx, keypair);
  (proof as Record<string, unknown>).depositTxSignature = sig;
  proof.instructions = ['Deposit transaction sent and confirmed.', `Signature: ${sig}`];
  console.log('Deposit transaction sent and confirmed. Signature:', sig);
  return sig;
}

async function trySendDeposit(
  conn: Connection,
  keypair: Keypair,
  txPayload: TxPayload,
  request: SwapRequest,
  proof: Record<string, unknown>
): Promise<string | undefined> {
  const canSend = await checkBalance(conn, keypair, request, proof);
  if (!canSend) return undefined;

  if (txPayload.serialized) {
    return await sendSerializedTx(conn, keypair, txPayload, proof);
  }
  if (txPayload.instructions?.length) {
    return await sendInstructionsTx(conn, keypair, txPayload, proof);
  }
  console.log('Skipped inline send: transaction has no serialized payload or instructions.');
  return undefined;
}

function handleSendError(err: unknown, proof: Record<string, unknown>): void {
  const msg = errMsg(err);
  if (msg.includes('0x1788') || msg.includes('6024')) {
    console.error(
      'Inline deposit send failed: Jupiter 0x1788 (InsufficientFunds). If native SOL is sufficient, this may be wSOL/token balance or route/quote – try signing in Phantom with the proof file, or get a fresh quote.'
    );
  } else {
    console.error('Inline deposit send failed:', msg);
  }
  (proof.instructions as string[]).push(
    'Inline send failed: ' +
      (msg.includes('0x1788')
        ? 'Jupiter 0x1788 – try in Phantom with proof file or get a fresh quote.'
        : msg)
  );
}

/** Run the proof flow. Options override env vars (used by CLI). */
export async function runProof(options: ProofOptions = {}): Promise<void> {
  const request = buildRequest(options);
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

  const quote = await getQuote(toRelayQuoteRequest(request, RELAY_USDC.decimals), {
    baseUrl: RELAY_DEFAULT_BASE_URL,
    apiKey: process.env.RELAY_API_KEY,
  });

  const requestId = getRequestId(quote);
  const proof = createProof(request, quote, requestId);
  const txPayload = getTxPayload(quote);

  if (process.env.SOLANA_PRIVATE_KEY && quote.steps?.[0]?.kind === 'transaction' && txPayload) {
    try {
      const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
      const conn = new Connection(rpcUrl);
      await trySendDeposit(conn, keypair, txPayload, request, proof);
    } catch (err) {
      handleSendError(err, proof);
    }
  }

  if (!(proof as Record<string, unknown>).depositTxSignature) {
    (proof.instructions as string[]).push(
      'Set SOLANA_PRIVATE_KEY (base58) to sign and send the deposit inline, or execute quote.steps[0].transaction with your wallet.',
      `Then run: pnpm proof:status ${requestId} --poll`
    );
  }

  writeFileSync(PROOF_FILE, JSON.stringify(proof, null, 2), 'utf-8');
  console.log('Proof written to', PROOF_FILE);
  console.log('requestId:', requestId);
  console.log('Verification URL:', (proof as Record<string, unknown>).verificationUrl);
}

function main() {
  runProof().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

main();
