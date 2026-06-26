'use client';

import { useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { StatCard } from '@/components/StatCard';
import { ErrorPanel } from '@/components/ErrorPanel';
import { formatLamports, shortPubkey } from '@/lib/format';

async function anchorDiscriminator(name: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(`global:${name}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest).slice(0, 8);
}

function u64LE(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setBigUint64(0, value, true);
  return buf;
}

export default function StakePage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [amount, setAmount] = useState('1.0');
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const programIdStr = process.env.NEXT_PUBLIC_2_PROGRAM_ID;
  const operator = useMemo(() => publicKey?.toBase58(), [publicKey]);

  useMemo(() => {
    if (!publicKey) return;
    connection
      .getBalance(publicKey)
      .then(setBalanceLamports)
      .catch(() => setBalanceLamports(null));
  }, [publicKey, connection]);

  async function handleStake() {
    setError(null);
    setStatus(null);
    if (!publicKey || !programIdStr) return;
    const lamports = Math.floor(Number(amount) * LAMPORTS_PER_SOL);
    if (!Number.isFinite(lamports) || lamports <= 0) {
      setError('Enter a positive SOL amount.');
      return;
    }
    if (balanceLamports !== null && lamports + 5000 > balanceLamports) {
      setError('Not enough SOL to cover stake + fee.');
      return;
    }
    try {
      const programId = new PublicKey(programIdStr);
      const [stakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('stake'), publicKey.toBuffer()],
        programId,
      );
      const disc = await anchorDiscriminator('stake');
      const data = new Uint8Array(disc.length + 8);
      data.set(disc, 0);
      data.set(u64LE(BigInt(lamports)), disc.length);
      const ix = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: stakePda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(data),
      });
      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.feePayer = publicKey;
      tx.recentBlockhash = blockhash;
      setStatus('awaiting-signature');
      const signature = await sendTransaction(tx, connection, { skipPreflight: false });
      setStatus('confirming');
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      setStatus(`confirmed:${signature}`);
      const newBalance = await connection.getBalance(publicKey);
      setBalanceLamports(newBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="metric-label">Operator stake</div>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.18em] text-cluster md:text-4xl">
          Stake SOL to your node identity
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-fog">
          Stake is required to be picked by the routing engine. Higher stake unlocks higher
          routing priority; dishonest computation is slashable via dispute resolution on the
          Anchor program.
        </p>
      </section>

      {!publicKey && (
        <div className="wattz-card rounded-lg p-8 text-center text-sm text-fog">
          Connect a wallet to stake.
        </div>
      )}

      {publicKey && !programIdStr && (
        <ErrorPanel
          message="NEXT_PUBLIC_2_PROGRAM_ID is not configured for this deployment."
          hint="Add the Anchor program id in Vercel Production and redeploy."
        />
      )}

      {publicKey && (
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Wallet"
            value={<span className="font-mono text-base">{shortPubkey(operator)}</span>}
          />
          <StatCard
            label="SOL balance"
            value={balanceLamports !== null ? formatLamports(balanceLamports) : '-'}
            accent="gold"
          />
          <StatCard
            label="Cluster"
            value="mainnet-beta"
            hint="Anchor settlement program lives on mainnet."
          />
        </section>
      )}

      {publicKey && programIdStr && (
        <section className="wattz-card rounded-lg p-6">
          <label className="block">
            <span className="metric-label">Stake amount (SOL)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-3 w-full rounded-md border border-cyan/25 bg-shadow px-3 py-2 font-mono text-lg text-cluster focus:border-cyan focus:outline-none"
            />
          </label>
          <button
            onClick={handleStake}
            disabled={status === 'awaiting-signature' || status === 'confirming'}
            className="mt-5 rounded-md border border-cyan/60 bg-shadow px-5 py-3 font-display text-sm uppercase tracking-[0.24em] text-cyan shadow-cyan-glow transition-colors hover:bg-navy/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === 'awaiting-signature' && 'Awaiting wallet...'}
            {status === 'confirming' && 'Confirming on Solana...'}
            {(!status || status.startsWith('confirmed')) && 'Stake'}
          </button>
          {status?.startsWith('confirmed:') && (
            <p className="mt-3 text-xs text-cyan">
              Confirmed. Signature{' '}
              <a
                className="underline"
                href={`https://solscan.io/tx/${status.slice('confirmed:'.length)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {status.slice('confirmed:'.length, 'confirmed:'.length + 12)}...
              </a>
            </p>
          )}
          {error && <p className="mt-3 text-xs text-wire">{error}</p>}
        </section>
      )}
    </div>
  );
}
