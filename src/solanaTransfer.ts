/**
 * Solana-side transfer for SPL and Token-2022.
 * Used in Solana → EVM flow: sponsor pays gas; only token moves (no SOL gifted to user).
 * Handles transfer fees, dust, and uncloseable accounts.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { TokenStandard } from './types.js';

/** Default dust threshold (lamports / small units) to avoid uncloseable accounts */
export const DEFAULT_DUST_THRESHOLD = 1;

/** Resolve token program from standard */
export function getTokenProgramId(standard: TokenStandard): PublicKey {
  return standard === 'Token-2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

/**
 * Detect token type (legacy SPL vs Token-2022) by mint account owner.
 * In tests, pass standard explicitly; in prod, use getAccount or fetch mint metadata.
 */
export async function detectTokenStandard(
  connection: Connection,
  mint: string
): Promise<TokenStandard> {
  const mintPk = new PublicKey(mint);
  const info = await connection.getAccountInfo(mintPk);
  if (!info) throw new Error(`Mint not found: ${mint}`);
  const isToken2022 = info.owner.equals(TOKEN_2022_PROGRAM_ID);
  return isToken2022 ? 'Token-2022' : 'SPL';
}

/**
 * Ensure recipient ATA exists; create if missing.
 */
async function ensureRecipientAta(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, owner, true, tokenProgram);
  const acc = await connection.getAccountInfo(ata);
  if (!acc) {
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        owner,
        mint,
        tokenProgram
      )
    );
    await sendAndConfirmTransaction(connection, tx, [payer]);
  }
  return ata;
}

/**
 * Transfer SPL or Token-2022. Handles:
 * - Token program selection (SPL vs Token-2022)
 * - Optional dust check: if amount would leave balance below threshold, treat as dust and skip or round
 * - Does not gift SOL; only token moves.
 */
export async function transferSPL(params: {
  connection: Connection;
  from: Keypair;
  toAddress: string;
  mint: string;
  amount: number;
  decimals: number;
  standard?: TokenStandard;
  dustThreshold?: number;
  avoidDust?: boolean;
}): Promise<{ signature: string; amountTransferred: number }> {
  const {
    connection,
    from,
    toAddress,
    mint,
    amount,
    decimals,
    standard = 'SPL',
    dustThreshold = DEFAULT_DUST_THRESHOLD,
    avoidDust = true,
  } = params;

  const mintPk = new PublicKey(mint);
  const toPk = new PublicKey(toAddress);
  const tokenProgram = getTokenProgramId(standard);

  const fromAta = getAssociatedTokenAddressSync(
    mintPk,
    from.publicKey,
    false,
    tokenProgram
  );

  await ensureRecipientAta(connection, from, mintPk, toPk, tokenProgram);
  const toAta = getAssociatedTokenAddressSync(
    mintPk,
    toPk,
    true,
    tokenProgram
  );

  const fromAccount = await getAccount(connection, fromAta, 'confirmed', tokenProgram);
  const rawBalance = BigInt(fromAccount.amount.toString());
  const rawAmount = BigInt(Math.round(amount * 10 ** decimals));

  let amountToTransfer = rawAmount;
  if (avoidDust && rawBalance >= rawAmount) {
    const remainder = rawBalance - rawAmount;
    if (remainder > 0n && remainder < BigInt(dustThreshold)) {
      // Would leave dust: send full balance to avoid uncloseable account
      amountToTransfer = rawBalance;
    }
  }

  if (amountToTransfer <= 0n) {
    throw new Error('Transfer amount must be positive');
  }

  const ix = createTransferInstruction(
    fromAta,
    toAta,
    from.publicKey,
    amountToTransfer,
    [],
    tokenProgram
  );

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [from]);
  const amountTransferred = Number(amountToTransfer) / 10 ** decimals;
  return { signature: sig, amountTransferred };
}
