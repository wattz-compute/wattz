import { Command } from 'commander';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { loadConfig } from '../config/schema';
import { loadKeypair } from '../solana/keypair';
import { getConnection } from '../solana/connection';
import { anchorDiscriminator, u64LE } from '../solana/anchor-ix';
import { logger } from '../utils/logger';
import { formatLamports } from '../utils/format';

export function registerStakeCommand(program: Command): void {
  program
    .command('stake')
    .description('Stake SOL to the operator identity on the Wattz Anchor program.')
    .requiredOption('--amount <sol>', 'Amount of SOL to stake', (v) => parseFloat(v))
    .option(
      '--program <programId>',
      'Anchor program id (falls back to config.programId, then WATTZ_PROGRAM_ID)',
    )
    .action(async (opts: { amount: number; program?: string }) => {
      if (!Number.isFinite(opts.amount) || opts.amount <= 0) {
        logger.error('--amount must be a positive number of SOL.');
        process.exitCode = 1;
        return;
      }
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
      const lamports = Math.floor(opts.amount * LAMPORTS_PER_SOL);

      const balance = await connection.getBalance(keypair.publicKey);
      if (balance < lamports + 5000) {
        logger.error(
          `Insufficient balance. Have ${formatLamports(balance)}, need ${formatLamports(lamports + 5000)} (stake + fee).`,
        );
        process.exitCode = 1;
        return;
      }

      const [stakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('stake'), keypair.publicKey.toBuffer()],
        programId,
      );

      const data = Buffer.concat([anchorDiscriminator('stake'), u64LE(BigInt(lamports))]);

      const ix = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: stakePda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });

      const tx = new Transaction().add(ix);
      tx.feePayer = keypair.publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.sign(keypair);

      logger.info(
        `Submitting stake tx: ${formatLamports(lamports)} to PDA ${stakePda.toBase58()}`,
      );
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
      });
      logger.info(`Signature: ${signature}. Confirming...`);
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      logger.success(`Staked ${formatLamports(lamports)}.`);
      logger.info(`Stake PDA: ${stakePda.toBase58()}`);
      logger.info(`Explorer:  https://solscan.io/tx/${signature}`);
    });
}
