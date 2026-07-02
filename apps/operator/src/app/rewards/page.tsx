'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { api } from '@/lib/api';
import { ErrorPanel } from '@/components/ErrorPanel';
import { StatCard } from '@/components/StatCard';
import { RevenueChart } from '@/components/RevenueChart';
import { errorTitle, explorerTxUrl, formatLamports, solanaCluster, timeAgo } from '@/lib/format';

async function anchorDiscriminator(name: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(`global:${name}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest).slice(0, 8);
}

export default function RewardsPage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const operator = useMemo(() => publicKey?.toBase58(), [publicKey]);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const cluster = solanaCluster();

  const programIdStr = process.env.NEXT_PUBLIC_2_PROGRAM_ID;

  const rewardsQuery = useQuery({
    queryKey: ['rewards', operator],
    queryFn: () => api.rewards(operator!),
    enabled: !!operator,
    refetchInterval: 30_000,
  });

  const rewards = rewardsQuery.data;
  const hasRewards =
    !!rewards &&
    (rewards.pending_lamports > 0 ||
      rewards.claimed_lamports > 0 ||
      rewards.revenue_series.length > 0);

  const canClaim =
    !!publicKey &&
    !!programIdStr &&
    programIdStr.length > 0 &&
    (rewards?.pending_lamports ?? 0) > 0;

  async function handleClaim() {
    if (!publicKey || !programIdStr) return;
    setTxStatus('preparing');
    setTxError(null);
    try {
      const programId = new PublicKey(programIdStr);
      const [rewardPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('reward'), publicKey.toBuffer()],
        programId,
      );
      const disc = await anchorDiscriminator('claim_reward');
      const ix = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: rewardPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(disc),
      });
      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      setTxStatus('awaiting-signature');
      const signature = await sendTransaction(tx, connection, { skipPreflight: false });
      setTxStatus('confirming');
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      setTxStatus(`confirmed:${signature}`);
      // Pull the fresh pending balance from the gateway.
      await queryClient.invalidateQueries({ queryKey: ['rewards', operator] });
    } catch (err) {
      setTxError(err instanceof Error ? err.message : String(err));
      setTxStatus(null);
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="metric-label">Operator rewards</div>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.18em] text-cluster md:text-4xl">
          Inference rewards
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-fog">
          Rewards accrue every time your node serves inference. Settlement runs on the Wattz Anchor
          program on Solana ({cluster}). Claiming pulls the pending amount into your wallet.
        </p>
      </section>

      {!publicKey && (
        <div className="wattz-card rounded-lg p-8 text-center text-sm text-fog">
          Connect a wallet to view your rewards.
        </div>
      )}

      {publicKey && !programIdStr && (
        <ErrorPanel
          title="Program id missing"
          message="NEXT_PUBLIC_2_PROGRAM_ID is not configured for this deployment."
          hint="Add the Anchor program id in Vercel Production and redeploy."
        />
      )}

      {publicKey && rewardsQuery.isError && (
        <ErrorPanel
          title={errorTitle(rewardsQuery.error)}
          message={(rewardsQuery.error as Error).message}
        />
      )}

      {publicKey && rewards && !hasRewards && (
        <div className="wattz-card rounded-lg p-8 text-center text-sm text-fog">
          No rewards accrued yet — bring a node online.
        </div>
      )}

      {publicKey && rewards && hasRewards && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Pending"
              value={formatLamports(rewards.pending_lamports)}
              hint="Claimable now"
              accent="gold"
            />
            <StatCard
              label="Claimed lifetime"
              value={formatLamports(rewards.claimed_lamports)}
              accent="wire"
            />
            <StatCard
              label="Last claim"
              value={rewards.last_claim_at ? timeAgo(rewards.last_claim_at) : 'never'}
            />
          </section>

          <section>
            <button
              onClick={handleClaim}
              disabled={!canClaim || txStatus === 'awaiting-signature' || txStatus === 'confirming'}
              className="rounded-md border border-gold/60 bg-shadow px-5 py-3 font-display text-sm uppercase tracking-[0.24em] text-gold shadow-wire-glow transition-colors hover:bg-navy/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {txStatus === 'preparing' && 'Preparing...'}
              {txStatus === 'awaiting-signature' && 'Awaiting wallet signature...'}
              {txStatus === 'confirming' && 'Confirming on Solana...'}
              {(!txStatus || txStatus.startsWith('confirmed')) &&
                (canClaim ? 'Claim rewards' : 'Nothing to claim')}
            </button>
            {txStatus?.startsWith('confirmed:') && (
              <p className="mt-3 text-xs text-cyan">
                Confirmed. Signature:{' '}
                <a
                  className="underline"
                  href={explorerTxUrl(txStatus.slice('confirmed:'.length))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {txStatus.slice('confirmed:'.length, 'confirmed:'.length + 12)}...
                </a>
              </p>
            )}
            {txError && <p className="mt-3 text-xs text-wire">Claim failed: {txError}</p>}
          </section>

          <section>
            <RevenueChart data={rewards.revenue_series} />
          </section>
        </>
      )}
    </div>
  );
}
