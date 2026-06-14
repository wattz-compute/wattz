import { Command } from 'commander';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { loadConfig } from '../config/schema';
import { loadKeypair } from '../solana/keypair';
import { getConnection } from '../solana/connection';
import { anchorDiscriminator } from '../solana/anchor-ix';
import { logger } from '../utils/logger';
import { formatLamports } from '../utils/format';

/** Anchor account layout: [8 disc][32 operator pubkey][8 pending u64][8 total_claimed u64]. */
const REWARD_LAYOUT_OFFSET_PENDING = 8 + 32;

export function registerClaimCommand(program: Command): void {
  program
    .command('claim')
    .description('Claim accrued inference rewards for the operator identity.')
    .option(
      '--program <programId>',
      'Anchor program id (falls back to config.programId, then WATTZ_PROGRAM_ID)',
    )
    .option('--dry-run', 'Print the pending reward without submitting a transaction', false)
    .action(async (opts: { program?: string; dryRun: boolean }) => {
      const config = await loadConfig();
      const programIdStr = opts.program ?? config.programId ?? process.env.WATTZ_PROGRAM_ID;
      if (!programIdStr) {
        logger.error(
          'No Anchor program id provided. Pass --program, run `wattz config set programId <pubkey>`, or set WATTZ_PROGRAM_ID.',
        );
        process.exitCode = 1;
        return;
      }
      const programId = new PublicKey(programIdStr);
      const keypair = await loadKeypair();
      const connection = await getConnection();

      const [rewardPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('reward'), keypair.publicKey.toBuffer()],
        programId,
      );

      const accountInfo = await connection.getAccountInfo(rewardPda);
      if (!accountInfo) {
        logger.info(`No reward account exists yet at ${rewardPda.toBase58()}.`);
        return;
      }
      if (accountInfo.data.length < REWARD_LAYOUT_OFFSET_PENDING + 8) {
        logger.warn(
          `Reward account data too short (${accountInfo.data.length} bytes). Skipping decode.`,
        );
      } else {
        const pending = accountInfo.data.readBigUInt64LE(REWARD_LAYOUT_OFFSET_PENDING);
        logger.info(`Pending reward: ${formatLamports(pending)}`);
        if (pending === 0n) {
          logger.info('Nothing to claim.');
          return;
        }
      }

      if (opts.dryRun) {
        logger.info('Dry run: not submitting a transaction.');
        return;
      }

      const data = anchorDiscriminator('claim_reward');
      const ix = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: rewardPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });

      const tx = new Transaction().add(ix);
      tx.feePayer = keypair.publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.sign(keypair);

      const signature = await connection.sendRawTransaction(tx.serialize());
      logger.info(`Submitted claim tx: ${signature}. Confirming...`);
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      logger.success(`Claim confirmed.`);
      logger.info(`Explorer: https://solscan.io/tx/${signature}`);
    });
}
