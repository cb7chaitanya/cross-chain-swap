import { describe, it, expect, vi } from 'vitest';
import {
  getTokenProgramId,
  detectTokenStandard,
} from '../src/solanaTransfer.js';
import type { Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

describe('solanaTransfer (unit)', () => {
  describe('getTokenProgramId', () => {
    it('returns TOKEN_PROGRAM_ID for SPL', () => {
      expect(getTokenProgramId('SPL')).toEqual(TOKEN_PROGRAM_ID);
    });

    it('returns TOKEN_2022_PROGRAM_ID for Token-2022', () => {
      expect(getTokenProgramId('Token-2022')).toEqual(TOKEN_2022_PROGRAM_ID);
    });
  });

  describe('detectTokenStandard', () => {
    it('returns SPL when mint is owned by TOKEN_PROGRAM_ID', async () => {
      const connection = {
        getAccountInfo: vi.fn().mockResolvedValue({ owner: TOKEN_PROGRAM_ID }),
      } as unknown as Connection;
      const result = await detectTokenStandard(
        connection,
        'So11111111111111111111111111111111111111112'
      );
      expect(result).toBe('SPL');
    });

    it('returns Token-2022 when mint is owned by TOKEN_2022_PROGRAM_ID', async () => {
      const connection = {
        getAccountInfo: vi.fn().mockResolvedValue({ owner: TOKEN_2022_PROGRAM_ID }),
      } as unknown as Connection;
      const result = await detectTokenStandard(
        connection,
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      );
      expect(result).toBe('Token-2022');
    });

    it('throws when mint account is not found', async () => {
      const connection = {
        getAccountInfo: vi.fn().mockResolvedValue(null),
      } as unknown as Connection;
      const validMint = 'So11111111111111111111111111111111111111112';
      await expect(detectTokenStandard(connection, validMint)).rejects.toThrow(
        'Mint not found'
      );
    });
  });

});
